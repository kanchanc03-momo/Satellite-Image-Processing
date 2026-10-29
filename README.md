# EarthVision — Orbital Observation & Satellite Digital Image Processing (DIP) Platform

EarthVision is a production-grade Earth observation and satellite image processing web application. It combines a real 3D CesiumJS globe with true-color Esri World Imagery basemaps, click-to-2D-image capture, 24 digital image processing (DIP) algorithms powered by OpenCV and scikit-image, real-time radiometric metrics, session history, and full cloud deployment readiness.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend Framework** | Vanilla HTML5 / ES6 JavaScript | Native ES6 modules, lightweight and zero-bloat |
| **Styling** | Tailwind CSS & Google Material Symbols | High-contrast geospatial glassmorphism theme |
| **3D Engine** | CesiumJS v1.121 (No Ion Token Required) | Photorealistic lighting, day/night terminator, atmosphere, starfield |
| **Imagery Basemap** | Esri World Imagery (True-Color RGB) | Real satellite tiles (0.5m – 1.0m / pixel) |
| **Night Lights** | NASA GIBS VIIRS Black Marble | Blended dynamically on the night-side terminator |
| **State Management** | Reactive `EarthVisionState` Store | Cross-page synchronization + browser `localStorage` persistence |
| **Build & Dev Proxy** | Vite v5 | Serves frontend on `:3000`, proxies `/api/*` to `:8000` |
| **Backend Framework** | FastAPI (Python 3.11+) | Asynchronous REST gateway running on port `:8000` |
| **DIP & Vision Engine** | OpenCV 4.10+ & scikit-image | 24 algorithms, multi-stage pipeline chaining, PSNR/SSIM, Shannon entropy |

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ (for frontend dev server/build)

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Run FastAPI backend
uvicorn main:app --host 0.0.0.0 --port 8000
```
Backend will be live at `http://localhost:8000`.

### 3. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install Vite dev toolchain
npm install

# Start Vite dev server with proxy to backend
npm run dev
```
Open `http://localhost:3000` in your browser. All `/api/*` calls will be automatically proxied to `http://localhost:8000`.

### 4. Running Automated Tests
```bash
pytest backend/tests/ -v
```

---

## 🛰️ 24 DIP Algorithms Specification Contract

All algorithms clamp to these ranges, accept both color and single-channel inputs, and preserve spatial dimensions.

| # | Algorithm Key | Parameters (Types, Clamped Ranges, Defaults) | Description / Math |
|---|---|---|---|
| 1 | `brightness` | `value` (-100 to 100, default 0) | Offset addition: `np.clip(img + value, 0, 255)` |
| 2 | `contrast` | `value` (0.2 to 3.0, default 1.0) | Scaling relative to midtone (128): `128 + value * (img - 128)` |
| 3 | `gamma` | `gamma` (0.2 to 3.0, default 1.0) | Power law lookup table: `255 * (DN/255)^(1/gamma)` |
| 4 | `hist_eq` | *None* | Luminance-only equalization (YCrCb space) to preserve color fidelity |
| 5 | `clahe` | `clip` (1.0 to 10.0, def 2.0), `tile` (2 to 16, def 8) | Contrast Limited Adaptive Histogram Equalization on L channel |
| 6 | `contrast_stretch`| `low` (0 to 49, def 2), `high` (51 to 100, def 98) | Per-channel percentile dynamic range stretching |
| 7 | `gaussian` | `ksize` (3 to 31 odd, def 5), `sigma` (0 to 10, def 0) | Gaussian low-pass spatial smoothing convolution |
| 8 | `median` | `ksize` (3 to 15 odd, def 5) | Non-linear median filter for salt-and-pepper noise reduction |
| 9 | `mean` | `ksize` (3 to 31 odd, def 5) | Uniform box blur filter |
| 10 | `sharpen` | `amount` (0 to 5.0, def 1.0), `sigma` (0.5 to 5, def 2) | High-pass unsharp mask enhancement |
| 11 | `gray_threshold` | `method` (`otsu` or `manual`), `value` (0 to 255, def 127) | Binary segmentation yielding strictly 0 and 255 |
| 12 | `adaptive_threshold`| `block` (3 to 99 odd, def 35), `c` (-20 to 20), `method` (`gaussian` or `mean`) | Locally adaptive binarization |
| 13 | `kmeans` | `k` (2 to 8, def 4) | Deterministic seed k-means clustering; chunked for memory safety |
| 14 | `region_highlight` | `invert` (bool, def false) | Otsu region contour delineation with cyan translucent overlay |
| 15 | `grayscale` | *None* | Single-channel luminance conversion |
| 16 | `rgb_channel` | `channel` (`r`, `g`, or `b`, def `g`) | Exact channel separation |
| 17 | `sobel` | `ksize` (1, 3, 5, 7, def 3) | Normalized gradient magnitude $\sqrt{G_x^2 + G_y^2}$ |
| 18 | `canny` | `low` (0 to 255, def 100), `high` (0 to 255, def 200) | Two-threshold hysteresis edge detection (auto-swaps if reversed) |
| 19 | `histogram` | *None* | Returns input unchanged with updated telemetry histograms |
| 20 | `vegetation_proxy`| *None* | Excess Green Index ($2G - R - B$) RGB proxy (honestly labelled "not NDVI") |
| 21 | `erosion` | `ksize` (3 to 15 odd, def 3), `iterations` (1 to 5, def 1) | Morphological erosion: strips noise and shrinks white boundaries |
| 22 | `dilation` | `ksize` (3 to 15 odd, def 3), `iterations` (1 to 5, def 1) | Morphological dilation: expands regions and fills small gaps |
| 23 | `morph_open` | `ksize` (3 to 15 odd, def 3) | Morphological opening (Erosion $\rightarrow$ Dilation): eliminates speckles |
| 24 | `morph_close` | `ksize` (3 to 15 odd, def 3) | Morphological closing (Dilation $\rightarrow$ Erosion): closes holes & bridges |

---

## 📡 API Reference

- **`GET /api/health`**: Returns service status and version (`2.4.0`).
- **`GET /api/reverse?lat={lat}&lon={lon}`**: Reverse geocoding via OpenStreetMap Nominatim with in-memory caching.
- **`GET /api/geocode?q={query}`**: Location suggestion autocomplete (debounced 400ms on frontend).
- **`GET /api/elevation?lat={lat}&lon={lon}`**: Ground surface elevation lookup in meters.
- **`GET /api/capture?lat={lat}&lon={lon}&radius_km={r}`** or **`&bbox={minLon,minLat,maxLon,maxLat}`**:
  - Downlinks and stitches real Esri World Imagery tiles.
  - Returns raw JPEG image with `X-Meta` JSON header containing metadata.
  - Maximum BBox area: 2,500 km².
- **`POST /api/process`**:
  - Accepts JSON or multipart form containing algorithm key, parameters, and base64/binary image.
  - Returns processed data URL, execution `time_ms`, per-channel histograms, statistics, legend, and metrics:
    - **Entropy**: Shannon entropy in bits ($0.0 - 8.0$)
    - **Dynamic Range**: Minimum and maximum DN values
    - **PSNR & SSIM**: Computed via `scikit-image` for radiometric and filter algorithms (strictly `null` for segmentation and edge detectors).
- **`POST /api/index`**: Explicitly rejects NDVI/NDWI requests because true Near-Infrared (NIR) bands are unavailable in standard RGB basemaps, directing users to `vegetation_proxy`.

---

## ⚖️ Honest Labels & Imagery Disclosure

EarthVision strictly adheres to scientific honesty and eliminates all deceptive or simulated labels:
- **Provider**: Esri World Imagery (True-Color RGB optical basemap).
- **Spectral Depth**: 8-bit RGB (Bands: Red, Green, Blue). No fake "12-bit Sentinel-2 Level-1C" or "B4/B3/B2" claims.
- **Telemetry**: Real elevation from ground elevation models, real solar elevation and zenith angles calculated from spherical trigonometry and local solar time.
- **Vegetation**: Excess Green ($2G - R - B$) is clearly labelled as a **Vegetation Proxy (not NDVI)**.
- **Clusters**: Segmented partitions are named neutral "Cluster 1 to K" with user rename fields, avoiding arbitrary automated classifications like "Dense Rainforest".

---

## 🚢 Deployment Guide

### Frontend Deployment (Vercel)
The `frontend/` directory includes `vercel.json` configured with `/api/*` proxy rewrites and SPA fallbacks:
```bash
cd frontend
vercel deploy --prod
```
Set the destination in `frontend/vercel.json` to your deployed backend URL.

### Backend Deployment (Render / Docker)
The `backend/Dockerfile` builds a production container on Debian slim with Mesa GL libraries:
```bash
cd backend
docker build -t earthvision-backend:latest .
docker run -p 8000:8000 -e ALLOWED_ORIGINS="*" earthvision-backend:latest
```
On Render, deploy as a **Web Service** pointing to the `backend/` directory using the Docker runtime.

---

## 📄 License
MIT License. Esri World Imagery tiles © Esri, Maxar, Earthstar Geographics, and GIS User Community.
