import pytest
import io
import json
import base64
import sys
import os
import numpy as np
import cv2
from PIL import Image
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
import dip

client = TestClient(app)

@pytest.fixture
def sample_image_bytes():
    # 64x64 simple image
    img = np.zeros((64, 64, 3), dtype=np.uint8)
    img[:, :32] = [200, 100, 50]
    img[:, 32:] = [50, 150, 200]
    success, encoded = cv2.imencode(".png", img)
    return encoded.tobytes()

@pytest.fixture
def sample_image_data_url(sample_image_bytes):
    b64 = base64.b64encode(sample_image_bytes).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_every_algorithm_via_api(sample_image_data_url):
    for algo in dip.SPEC.keys():
        payload = {
            "algo": algo,
            "image": sample_image_data_url,
            "params": {}
        }
        res = client.post("/api/process", json=payload)
        assert res.status_code == 200, f"Algorithm '{algo}' failed with {res.text}"
        data = res.json()
        assert "image" in data and data["image"].startswith("data:image/png;base64,")
        assert "time_ms" in data and data["time_ms"] >= 0
        assert "stats_original" in data and "stats_processed" in data
        assert "hist_original" in data and "hist_processed" in data
        assert "metrics" in data
        assert "entropy" in data["metrics"]
        assert 0.0 <= data["metrics"]["entropy"] <= 8.0


def test_unknown_algorithm_gives_400(sample_image_data_url):
    payload = {
        "algo": "non_existent_algorithm_xyz",
        "image": sample_image_data_url,
        "params": {}
    }
    res = client.post("/api/process", json=payload)
    assert res.status_code == 400
    assert "Unknown algorithm" in res.json()["detail"]


def test_invalid_parameters_give_400(sample_image_data_url):
    payload = {
        "algo": "contrast",
        "image": sample_image_data_url,
        "params": {"value": "not_a_number"}
    }
    res = client.post("/api/process", json=payload)
    assert res.status_code == 400


def test_non_image_file_gives_400():
    files = {"file": ("test.txt", b"this is not an image", "text/plain")}
    data = {"algo": "brightness"}
    res = client.post("/api/process", data=data, files=files)
    assert res.status_code == 400


def test_oversized_image_gives_413():
    # Oversized byte payload > 20MB
    huge_bytes = b"0" * (20 * 1024 * 1024 + 100)
    files = {"file": ("huge.png", huge_bytes, "image/png")}
    data = {"algo": "brightness"}
    res = client.post("/api/process", data=data, files=files)
    assert res.status_code == 413


def test_reverse_geocode_and_elevation():
    rev = client.get("/api/reverse?lat=25.2048&lon=55.2708")
    assert rev.status_code == 200
    assert "name" in rev.json()

    elev = client.get("/api/elevation?lat=25.2048&lon=55.2708")
    assert elev.status_code == 200
    assert "elevation_m" in elev.json()


def test_capture_endpoint():
    res = client.get("/api/capture?lat=25.118&lon=55.133&radius_km=1.0")
    assert res.status_code == 200
    assert res.headers.get("content-type") == "image/jpeg"
    assert "X-Meta" in res.headers
    meta = json.loads(res.headers["X-Meta"])
    assert "source" in meta
    assert "coordinates" in meta
    assert "area_sqkm" in meta

    # Test BBox option
    res_bbox = client.get("/api/capture?bbox=55.12,25.10,55.15,25.13")
    assert res_bbox.status_code == 200
    assert "X-Meta" in res_bbox.headers


def test_spectral_index_error():
    res = client.post("/api/index")
    assert res.status_code == 400
    assert "NIR" in res.json()["detail"]
