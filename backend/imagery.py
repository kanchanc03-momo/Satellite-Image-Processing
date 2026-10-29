import io
import math
import time
import requests
import numpy as np
from PIL import Image
from typing import Tuple, Dict, Any, Optional

USER_AGENT = "EarthVision-OrbitalObserver/2.4 (contact@earthvision.internal)"

def deg2num(lat_deg: float, lon_deg: float, zoom: int) -> Tuple[float, float]:
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = (lon_deg + 180.0) / 360.0 * n
    ytile = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n
    return (xtile, ytile)

def num2deg(xtile: float, ytile: float, zoom: int) -> Tuple[float, float]:
    n = 2.0 ** zoom
    lon_deg = xtile / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
    lat_deg = math.degrees(lat_rad)
    return (lat_deg, lon_deg)

def generate_demo_satellite_image(lat: float, lon: float, w: int = 768, h: int = 768) -> bytes:
    """Generate a clean, high-fidelity synthetic satellite scene when offline."""
    np.random.seed(int(abs(lat * 1000 + lon * 100)) % 100000)
    
    # Base terrain gradient (ocean, desert, or vegetation depending on lat/lon)
    if abs(lat) < 25 and (lon > 30 and lon < 60):  # Desert / Gulf region
        base_color = np.array([195, 175, 140], dtype=np.float32)  # Sand
        water_color = np.array([20, 95, 145], dtype=np.float32)   # Persian Gulf blue
    elif abs(lat) < 15 and (lon < -45 and lon > -75):  # Amazon
        base_color = np.array([35, 80, 40], dtype=np.float32)     # Dense canopy
        water_color = np.array([60, 50, 40], dtype=np.float32)    # Amazon river silt
    else:
        base_color = np.array([60, 95, 50], dtype=np.float32)
        water_color = np.array([25, 65, 110], dtype=np.float32)

    img = np.ones((h, w, 3), dtype=np.float32) * base_color

    # Add multiscale Perlin-like texture
    for scale in [64, 32, 16, 8]:
        noise = np.random.randn(h // scale + 2, w // scale + 2)
        from scipy.ndimage import zoom
        noise_upscaled = zoom(noise, (scale, scale), order=1)[:h, :w]
        for c in range(3):
            img[:, :, c] += noise_upscaled * (scale * 0.4)

    # Add a simulated water body / coastline or river
    x = np.linspace(-2, 2, w)
    y = np.linspace(-2, 2, h)
    xx, yy = np.meshgrid(x, y)
    channel = np.sin(xx * 2.5 + np.cos(yy * 3)) + 0.3 * np.sin(yy * 5)
    water_mask = channel > 0.8
    for c in range(3):
        img[water_mask, c] = water_color[c] + np.random.randn(np.count_nonzero(water_mask)) * 5

    # Clip to valid uint8
    img_uint8 = np.clip(img, 0, 255).astype(np.uint8)
    pil_img = Image.fromarray(img_uint8, mode="RGB")
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=92)
    return buf.getvalue()

def fetch_esri_tiles(min_lon: float, min_lat: float, max_lon: float, max_lat: float, zoom: int) -> Optional[Image.Image]:
    """Fetch and stitch Esri World Imagery tiles for the given bbox."""
    x1, y1 = deg2num(max_lat, min_lon, zoom)
    x2, y2 = deg2num(min_lat, max_lon, zoom)

    min_x, max_x = int(math.floor(min(x1, x2))), int(math.floor(max(x1, x2)))
    min_y, max_y = int(math.floor(min(y1, y2))), int(math.floor(max(y1, y2)))

    # Limit maximum tiles to stitch (avoid DOS/huge memory usage)
    num_tiles_x = max_x - min_x + 1
    num_tiles_y = max_y - min_y + 1
    if num_tiles_x * num_tiles_y > 36:
        # Step down zoom level
        zoom = max(1, zoom - 1)
        return fetch_esri_tiles(min_lon, min_lat, max_lon, max_lat, zoom)

    canvas_w = num_tiles_x * 256
    canvas_h = num_tiles_y * 256
    stitched = Image.new("RGB", (canvas_w, canvas_h))

    session = requests.Session()
    headers = {"User-Agent": USER_AGENT}

    fetched_any = False
    for ix, tx in enumerate(range(min_x, max_x + 1)):
        for iy, ty in enumerate(range(min_y, max_y + 1)):
            url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{zoom}/{ty}/{tx}"
            try:
                resp = session.get(url, headers=headers, timeout=4.0)
                if resp.status_code == 200:
                    tile_img = Image.open(io.BytesIO(resp.content)).convert("RGB")
                    stitched.paste(tile_img, (ix * 256, iy * 256))
                    fetched_any = True
            except Exception:
                pass

    if not fetched_any:
        return None

    # Compute pixel crop for exact bounding box
    start_x_f, start_y_f = deg2num(max_lat, min_lon, zoom)
    end_x_f, end_y_f = deg2num(min_lat, max_lon, zoom)

    crop_left = int(max(0, (start_x_f - min_x) * 256))
    crop_top = int(max(0, (start_y_f - min_y) * 256))
    crop_right = int(min(canvas_w, (end_x_f - min_x) * 256))
    crop_bottom = int(min(canvas_h, (end_y_f - min_y) * 256))

    if crop_right > crop_left + 10 and crop_bottom > crop_top + 10:
        return stitched.crop((crop_left, crop_top, crop_right, crop_bottom))
    return stitched

def capture_aoi(
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_km: float = 1.0,
    bbox: Optional[Tuple[float, float, float, float]] = None
) -> Tuple[bytes, Dict[str, Any]]:
    """Capture true satellite imagery for an AOI radius or BBox."""
    if bbox is not None:
        min_lon, min_lat, max_lon, max_lat = bbox
        center_lat = (min_lat + max_lat) / 2.0
        center_lon = (min_lon + max_lon) / 2.0
        # Compute approximate area in km^2
        lat_dist_km = abs(max_lat - min_lat) * 111.0
        lon_dist_km = abs(max_lon - min_lon) * 111.0 * math.cos(math.radians(center_lat))
        area_sqkm = max(0.01, lat_dist_km * lon_dist_km)
    else:
        if lat is None or lon is None:
            raise ValueError("Must provide either (lat, lon) or bbox")
        center_lat = lat
        center_lon = lon
        radius_km = max(0.1, min(50.0, radius_km))
        delta_lat = radius_km / 111.0
        delta_lon = radius_km / (111.0 * max(0.1, math.cos(math.radians(lat))))
        min_lat = lat - delta_lat
        max_lat = lat + delta_lat
        min_lon = lon - delta_lon
        max_lon = lon + delta_lon
        area_sqkm = math.pi * (radius_km ** 2)

    # Determine zoom level from area
    if area_sqkm < 4.0:
        zoom = 16
    elif area_sqkm < 25.0:
        zoom = 15
    elif area_sqkm < 100.0:
        zoom = 14
    else:
        zoom = 13

    img = None
    is_demo = False
    try:
        img = fetch_esri_tiles(min_lon, min_lat, max_lon, max_lat, zoom)
    except Exception:
        img = None

    if img is None:
        # Fallback to realistic synthetic satellite rendering
        raw_bytes = generate_demo_satellite_image(center_lat, center_lon, 768, 768)
        img = Image.open(io.BytesIO(raw_bytes))
        is_demo = True

    # Standardize image size
    img = img.resize((768, 768), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    img_bytes = buf.getvalue()

    metadata = {
        "source": "Esri World Imagery" if not is_demo else "Esri World Imagery (Demo Fallback)",
        "resolution": "0.5m - 1.0m / px (True Color RGB)",
        "dimensions": [img.width, img.height],
        "coordinates": {"lat": round(center_lat, 5), "lon": round(center_lon, 5)},
        "area_sqkm": round(area_sqkm, 2),
        "demo": is_demo,
        "radiometric_depth": "8-bit RGB",
        "bands": ["Red", "Green", "Blue"],
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

    return img_bytes, metadata
