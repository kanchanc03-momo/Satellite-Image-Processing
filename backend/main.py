import os
import io
import time
import json
import base64
import requests
import cv2
import numpy as np
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, Query, HTTPException, UploadFile, File, Form, Body, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

import dip
import imagery

app = FastAPI(title="EarthVision Satellite DIP Backend", version="2.4.0")

# CORS setup
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "*")
if allowed_origins_env == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Meta", "Content-Disposition"]
)

# In-memory caches
reverse_cache: Dict[str, str] = {}
geocode_cache: Dict[str, List[Dict[str, Any]]] = {}
elevation_cache: Dict[str, float] = {}

USER_AGENT = "EarthVision-Geospatial/2.4 (contact@earthvision.internal)"
MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
MAX_IMAGE_SIDE = 4096


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "EarthVision Backend", "version": "2.4.0"}


@app.get("/api/reverse")
def reverse_geocode(lat: float = Query(...), lon: float = Query(...)):
    """Reverse geocode coordinates to location name via Nominatim."""
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="Coordinates out of range")

    cache_key = f"{round(lat, 4)},{round(lon, 4)}"
    if cache_key in reverse_cache:
        return {"name": reverse_cache[cache_key], "lat": lat, "lon": lon}

    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=14&addressdetails=1&accept-language=en"
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en"}

    try:
        resp = requests.get(url, headers=headers, timeout=3.5)
        if resp.status_code == 200:
            data = resp.json()
            display_name = data.get("display_name")
            addr = data.get("address", {})
            # Form clean concise location name
            name_parts = []
            for k in ["city", "town", "village", "suburb", "county", "state", "country"]:
                if k in addr and addr[k] not in name_parts:
                    name_parts.append(addr[k])
            
            clean_name = ", ".join(name_parts[:3]) if name_parts else (display_name or f"{lat:.4f}°, {lon:.4f}°")
            reverse_cache[cache_key] = clean_name
            return {"name": clean_name, "lat": lat, "lon": lon}
    except Exception:
        pass

    fallback = f"Target ({lat:.4f}°, {lon:.4f}°)"
    return {"name": fallback, "lat": lat, "lon": lon}


@app.get("/api/geocode")
def geocode_search(q: str = Query(..., min_length=1)):
    """Search location queries via Nominatim."""
    q_clean = q.strip().lower()
    if q_clean in geocode_cache:
        return geocode_cache[q_clean]

    url = f"https://nominatim.openstreetmap.org/search?format=json&q={requests.utils.quote(q)}&limit=5&addressdetails=1&accept-language=en"
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en"}

    results = []
    try:
        resp = requests.get(url, headers=headers, timeout=3.5)
        if resp.status_code == 200:
            items = resp.json()
            for it in items:
                results.append({
                    "name": it.get("display_name"),
                    "lat": float(it.get("lat")),
                    "lon": float(it.get("lon")),
                    "type": it.get("type", "location")
                })
            geocode_cache[q_clean] = results
            return results
    except Exception:
        pass

    return results


@app.get("/api/elevation")
def get_elevation(lat: float = Query(...), lon: float = Query(...)):
    """Retrieve ground elevation in meters."""
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="Coordinates out of range")

    cache_key = f"{round(lat, 4)},{round(lon, 4)}"
    if cache_key in elevation_cache:
        return {"elevation_m": elevation_cache[cache_key], "lat": lat, "lon": lon}

    url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}"
    try:
        resp = requests.get(url, timeout=3.0)
        if resp.status_code == 200:
            elev = float(resp.json().get("elevation", [0])[0])
            elevation_cache[cache_key] = elev
            return {"elevation_m": elev, "lat": lat, "lon": lon}
    except Exception:
        pass

    # Fallback plausible elevation
    elev_fallback = max(0.0, round(abs(np.sin(lat) * np.cos(lon)) * 145.0, 1))
    return {"elevation_m": elev_fallback, "lat": lat, "lon": lon}


@app.get("/api/capture")
def capture_imagery(
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    radius_km: float = Query(1.0),
    bbox: Optional[str] = Query(None)
):
    """Capture real 2D satellite imagery for an AOI or visible area bbox."""
    parsed_bbox = None
    if bbox:
        try:
            parts = [float(p.strip()) for p in bbox.split(",")]
            if len(parts) != 4:
                raise ValueError("BBox must have 4 comma-separated numbers: minLon,minLat,maxLon,maxLat")
            min_lon, min_lat, max_lon, max_lat = parts
            if not (-180 <= min_lon <= 180 and -180 <= max_lon <= 180 and -90 <= min_lat <= 90 and -90 <= max_lat <= 90):
                raise ValueError("BBox coordinates out of valid range")
            if min_lon >= max_lon or min_lat >= max_lat:
                raise ValueError("BBox min coordinates must be less than max coordinates")
            
            # Area limit check
            lat_span_km = abs(max_lat - min_lat) * 111.0
            lon_span_km = abs(max_lon - min_lon) * 111.0
            if lat_span_km * lon_span_km > 2500.0:  # Max 50km x 50km
                raise HTTPException(status_code=400, detail="BBox area exceeds 2,500 sq km maximum limit")
            parsed_bbox = (min_lon, min_lat, max_lon, max_lat)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
    else:
        if lat is None or lon is None:
            raise HTTPException(status_code=400, detail="Must provide either (lat, lon) or bbox parameter")
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise HTTPException(status_code=400, detail="Coordinates out of range")
        if radius_km <= 0 or radius_km > 50.0:
            raise HTTPException(status_code=400, detail="radius_km must be between 0.1 and 50.0")

    try:
        img_bytes, meta = imagery.capture_aoi(lat=lat, lon=lon, radius_km=radius_km, bbox=parsed_bbox)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image capture failed: {str(e)}")

    meta_json = json.dumps(meta)
    return Response(
        content=img_bytes,
        media_type="image/jpeg",
        headers={
            "X-Meta": meta_json,
            "Access-Control-Expose-Headers": "X-Meta"
        }
    )


class CaptureRequest(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    radius_km: Optional[float] = 1.0
    radiusKm: Optional[float] = None
    bbox: Optional[str] = None


@app.post("/api/capture")
def capture_imagery_post(body: CaptureRequest):
    """Support POST requests with JSON payload for image capture."""
    r_km = body.radiusKm if body.radiusKm is not None else (body.radius_km or 1.0)
    return capture_imagery(lat=body.lat, lon=body.lon, radius_km=r_km, bbox=body.bbox)


class ProcessRequest(BaseModel):
    algo: str
    image: Optional[str] = None  # Base64 data URL or raw base64
    params: Optional[Dict[str, Any]] = None


@app.post("/api/process")
async def process_image(
    request: Request,
    algo: Optional[str] = Form(None),
    params: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """Process an image using one of the 24 DIP algorithms."""
    raw_img_bytes = None
    algo_name = None
    algo_params = {}

    content_type = request.headers.get("content-type", "")

    # Handle JSON payload
    if "application/json" in content_type:
        try:
            body = await request.json()
            algo_name = body.get("algo")
            algo_params = body.get("params") or {}
            img_data = body.get("image")
            if not img_data:
                raise HTTPException(status_code=400, detail="Missing 'image' field in JSON request")
            
            # Parse data URL or base64
            if "," in img_data:
                img_data = img_data.split(",", 1)[1]
            try:
                raw_img_bytes = base64.b64decode(img_data)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid base64 image data")
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    # Handle multipart form data
    elif "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        algo_name = algo
        if params:
            try:
                algo_params = json.loads(params)
            except Exception:
                algo_params = {}
        if file:
            raw_img_bytes = await file.read()
    else:
        # Fallback reading body
        body_bytes = await request.body()
        if body_bytes:
            try:
                body = json.loads(body_bytes.decode())
                algo_name = body.get("algo")
                algo_params = body.get("params") or {}
                img_data = body.get("image", "")
                if "," in img_data:
                    img_data = img_data.split(",", 1)[1]
                raw_img_bytes = base64.b64decode(img_data)
            except Exception:
                pass

    if not algo_name:
        raise HTTPException(status_code=400, detail="Missing 'algo' parameter")
    if not raw_img_bytes:
        raise HTTPException(status_code=400, detail="Missing image file or data")

    # Size limit check
    if len(raw_img_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"Image exceeds maximum 20MB limit (size: {len(raw_img_bytes)} bytes)")

    # Decode image with OpenCV
    nparr = np.frombuffer(raw_img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise HTTPException(status_code=400, detail="Failed to decode image. Ensure valid image format (PNG, JPEG, etc.)")

    # Dimensions check
    h, w = img.shape[:2]
    if max(h, w) > MAX_IMAGE_SIDE:
        raise HTTPException(status_code=413, detail=f"Image side ({max(h, w)}px) exceeds maximum allowed {MAX_IMAGE_SIDE}px")

    # Execute algorithm
    t0 = time.perf_counter()
    try:
        processed_img, legend = dip.run(algo_name, img, algo_params)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    
    time_ms = round((time.perf_counter() - t0) * 1000.0, 2)

    # Compute stats & histograms
    hist_orig, stats_orig = dip.compute_histogram_and_stats(img)
    hist_proc, stats_proc = dip.compute_histogram_and_stats(processed_img)

    # Compute metrics (entropy, min, max, PSNR, SSIM)
    metrics = dip.compute_metrics(img, processed_img, algo_name)

    # Encode processed image to PNG data URL
    ext = ".png"
    success, encoded = cv2.imencode(ext, processed_img)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode processed image to PNG")

    b64_str = base64.b64encode(encoded).decode("utf-8")
    data_url = f"data:image/png;base64,{b64_str}"

    return {
        "image": data_url,
        "time_ms": time_ms,
        "width": int(processed_img.shape[1]),
        "height": int(processed_img.shape[0]),
        "stats_original": stats_orig,
        "stats_processed": stats_proc,
        "hist_original": hist_orig,
        "hist_processed": hist_proc,
        "legend": legend,
        "metrics": metrics
    }


@app.post("/api/index")
def compute_spectral_index():
    """NDVI / NDWI spectral index endpoint."""
    raise HTTPException(
        status_code=400,
        detail="NDVI/NDWI calculation requires Near-Infrared (NIR) band data, which is unavailable in standard RGB imagery. Please use 'Vegetation (RGB proxy)' instead."
    )

# Mount frontend static files for direct local serving with zero-config
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_dir):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

