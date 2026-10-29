import time
import math
import cv2
import numpy as np
from typing import Dict, Any, Tuple, Optional, List
from skimage.metrics import peak_signal_noise_ratio, structural_similarity

# Algorithm specification table: parameter name, type, default, min, max, allowed values
SPEC = {
    "brightness": {
        "params": {
            "value": {"type": float, "default": 0, "min": -100, "max": 100}
        }
    },
    "contrast": {
        "params": {
            "value": {"type": float, "default": 1.0, "min": 0.2, "max": 3.0}
        }
    },
    "gamma": {
        "params": {
            "gamma": {"type": float, "default": 1.0, "min": 0.2, "max": 3.0}
        }
    },
    "hist_eq": {
        "params": {}
    },
    "clahe": {
        "params": {
            "clip": {"type": float, "default": 2.0, "min": 1.0, "max": 10.0},
            "tile": {"type": int, "default": 8, "min": 2, "max": 16}
        }
    },
    "contrast_stretch": {
        "params": {
            "low": {"type": float, "default": 2.0, "min": 0.0, "max": 49.0},
            "high": {"type": float, "default": 98.0, "min": 51.0, "max": 100.0}
        }
    },
    "gaussian": {
        "params": {
            "ksize": {"type": int, "default": 5, "min": 3, "max": 31, "odd": True},
            "sigma": {"type": float, "default": 0.0, "min": 0.0, "max": 10.0}
        }
    },
    "median": {
        "params": {
            "ksize": {"type": int, "default": 5, "min": 3, "max": 15, "odd": True}
        }
    },
    "mean": {
        "params": {
            "ksize": {"type": int, "default": 5, "min": 3, "max": 31, "odd": True}
        }
    },
    "sharpen": {
        "params": {
            "amount": {"type": float, "default": 1.0, "min": 0.0, "max": 5.0},
            "sigma": {"type": float, "default": 2.0, "min": 0.5, "max": 5.0}
        }
    },
    "gray_threshold": {
        "params": {
            "method": {"type": str, "default": "otsu", "values": ["otsu", "manual"]},
            "value": {"type": int, "default": 127, "min": 0, "max": 255}
        }
    },
    "adaptive_threshold": {
        "params": {
            "block": {"type": int, "default": 35, "min": 3, "max": 99, "odd": True},
            "c": {"type": float, "default": 5.0, "min": -20.0, "max": 20.0},
            "method": {"type": str, "default": "gaussian", "values": ["gaussian", "mean"]}
        }
    },
    "kmeans": {
        "params": {
            "k": {"type": int, "default": 4, "min": 2, "max": 8}
        }
    },
    "region_highlight": {
        "params": {
            "invert": {"type": bool, "default": False}
        }
    },
    "grayscale": {
        "params": {}
    },
    "rgb_channel": {
        "params": {
            "channel": {"type": str, "default": "g", "values": ["r", "g", "b"]}
        }
    },
    "sobel": {
        "params": {
            "ksize": {"type": int, "default": 3, "min": 1, "max": 7, "odd": True, "values": [1, 3, 5, 7]}
        }
    },
    "canny": {
        "params": {
            "low": {"type": float, "default": 100.0, "min": 0.0, "max": 255.0},
            "high": {"type": float, "default": 200.0, "min": 0.0, "max": 255.0}
        }
    },
    "histogram": {
        "params": {}
    },
    "vegetation_proxy": {
        "params": {}
    },
    "erosion": {
        "params": {
            "ksize": {"type": int, "default": 3, "min": 3, "max": 15, "odd": True},
            "iterations": {"type": int, "default": 1, "min": 1, "max": 5}
        }
    },
    "dilation": {
        "params": {
            "ksize": {"type": int, "default": 3, "min": 3, "max": 15, "odd": True},
            "iterations": {"type": int, "default": 1, "min": 1, "max": 5}
        }
    },
    "morph_open": {
        "params": {
            "ksize": {"type": int, "default": 3, "min": 3, "max": 15, "odd": True}
        }
    },
    "morph_close": {
        "params": {
            "ksize": {"type": int, "default": 3, "min": 3, "max": 15, "odd": True}
        }
    }
}

PSNR_SSIM_ALGOS = {
    "brightness", "contrast", "gamma", "hist_eq", "clahe",
    "contrast_stretch", "gaussian", "median", "mean", "sharpen",
    "erosion", "dilation", "morph_open", "morph_close"
}


def to_bgr(img: np.ndarray) -> np.ndarray:
    """Ensure image is 3-channel BGR uint8."""
    if img is None:
        raise ValueError("Image is None")
    if img.ndim == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.ndim == 3:
        if img.shape[2] == 4:
            return cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
        elif img.shape[2] == 3:
            return img
        elif img.shape[2] == 1:
            return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    raise ValueError(f"Unsupported image dimensions: {img.shape}")


def sanitize(algo: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Validate and sanitize parameters for an algorithm."""
    if algo not in SPEC:
        raise ValueError(f"Unknown algorithm '{algo}'. Supported: {list(SPEC.keys())}")
    
    spec_params = SPEC[algo]["params"]
    raw_params = params or {}
    clean = {}

    for name, p_spec in spec_params.items():
        val = raw_params.get(name, p_spec.get("default"))
        expected_type = p_spec["type"]

        # Type conversion & checking
        try:
            if expected_type is bool:
                if isinstance(val, str):
                    val = val.lower() in ("true", "1", "yes")
                else:
                    val = bool(val)
            elif expected_type is int:
                if isinstance(val, str) and not val.strip().lstrip("-").isdigit():
                    raise ValueError(f"Parameter '{name}' must be integer, got '{val}'")
                val = int(round(float(val)))
            elif expected_type is float:
                val = float(val)
            elif expected_type is str:
                val = str(val).lower()
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid type for parameter '{name}': {e}")

        # Allowed values
        if "values" in p_spec:
            if val not in p_spec["values"]:
                raise ValueError(f"Parameter '{name}' must be one of {p_spec['values']}, got '{val}'")

        # Range clamping for numeric values
        if "min" in p_spec and "max" in p_spec:
            val = max(p_spec["min"], min(p_spec["max"], val))

        # Enforce odd kernel sizes
        if p_spec.get("odd", False):
            val = int(val)
            if val % 2 == 0:
                val += 1
            if "min" in p_spec and val < p_spec["min"]:
                val = p_spec["min"]
            if "max" in p_spec and val > p_spec["max"]:
                val = p_spec["max"]

        clean[name] = val

    return clean


def compute_metrics(original: np.ndarray, processed: np.ndarray, algo: str) -> Dict[str, Any]:
    """Compute entropy, dynamic range, and conditional PSNR/SSIM."""
    # Ensure processed is uint8
    proc_uint8 = np.clip(processed, 0, 255).astype(np.uint8)
    
    # Entropy (Shannon in bits)
    if proc_uint8.ndim == 3:
        gray = cv2.cvtColor(proc_uint8, cv2.COLOR_BGR2GRAY)
    else:
        gray = proc_uint8
    
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
    total_pixels = gray.size
    probs = hist[hist > 0] / total_pixels
    entropy = float(-np.sum(probs * np.log2(probs))) if len(probs) > 0 else 0.0

    min_val = int(np.min(proc_uint8))
    max_val = int(np.max(proc_uint8))

    psnr_val = None
    ssim_val = None

    if algo in PSNR_SSIM_ALGOS:
        # Prepare matching dimensions for PSNR/SSIM
        orig_eval = original
        proc_eval = proc_uint8

        # Ensure both are BGR 3-channel or both 1-channel
        if orig_eval.ndim != proc_eval.ndim or (orig_eval.ndim == 3 and orig_eval.shape[2] != proc_eval.shape[2]):
            if orig_eval.ndim == 2:
                orig_eval = cv2.cvtColor(orig_eval, cv2.COLOR_GRAY2BGR)
            if proc_eval.ndim == 2:
                proc_eval = cv2.cvtColor(proc_eval, cv2.COLOR_GRAY2BGR)

        # Downscale if larger than 1024px for speed
        h, w = orig_eval.shape[:2]
        max_dim = max(h, w)
        if max_dim > 1024:
            scale = 1024.0 / max_dim
            new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
            orig_eval = cv2.resize(orig_eval, (new_w, new_h), interpolation=cv2.INTER_AREA)
            proc_eval = cv2.resize(proc_eval, (new_w, new_h), interpolation=cv2.INTER_AREA)

        try:
            if np.array_equal(orig_eval, proc_eval):
                psnr_val = 100.0  # Perfect match
                ssim_val = 1.0
            else:
                psnr_calc = peak_signal_noise_ratio(orig_eval, proc_eval, data_range=255)
                psnr_val = round(float(psnr_calc), 2)
                
                channel_axis = 2 if orig_eval.ndim == 3 else None
                ssim_calc = structural_similarity(
                    orig_eval, proc_eval, data_range=255, channel_axis=channel_axis
                )
                ssim_val = round(float(ssim_calc), 4)
        except Exception:
            psnr_val = None
            ssim_val = None

    return {
        "entropy": round(entropy, 3),
        "min": min_val,
        "max": max_val,
        "psnr": psnr_val,
        "ssim": ssim_val
    }


def compute_histogram_and_stats(img: np.ndarray) -> Tuple[Dict[str, List[int]], Dict[str, float]]:
    """Compute per-channel histograms (256 bins) and basic raster stats."""
    hists = {"r": [0]*256, "g": [0]*256, "b": [0]*256, "lum": [0]*256}
    
    if img.ndim == 2 or (img.ndim == 3 and img.shape[2] == 1):
        gray = img.squeeze()
        h = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
        h_list = [int(x) for x in h]
        hists["r"] = h_list
        hists["g"] = h_list
        hists["b"] = h_list
        hists["lum"] = h_list
        mean_val = float(np.mean(gray))
        std_val = float(np.std(gray))
        min_val = float(np.min(gray))
        max_val = float(np.max(gray))
    else:
        # BGR
        b_hist = cv2.calcHist([img], [0], None, [256], [0, 256]).flatten()
        g_hist = cv2.calcHist([img], [1], None, [256], [0, 256]).flatten()
        r_hist = cv2.calcHist([img], [2], None, [256], [0, 256]).flatten()
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        lum_hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()

        hists["b"] = [int(x) for x in b_hist]
        hists["g"] = [int(x) for x in g_hist]
        hists["r"] = [int(x) for x in r_hist]
        hists["lum"] = [int(x) for x in lum_hist]

        mean_val = float(np.mean(gray))
        std_val = float(np.std(gray))
        min_val = float(np.min(gray))
        max_val = float(np.max(gray))

    stats = {
        "mean": round(mean_val, 2),
        "std": round(std_val, 2),
        "min": round(min_val, 2),
        "max": round(max_val, 2)
    }
    return hists, stats


def run(algo: str, img: np.ndarray, raw_params: Optional[Dict[str, Any]] = None) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """Execute algorithm on input image. Returns (processed_img, legend)."""
    if img is None or img.size == 0:
        raise ValueError("Invalid image input")
    
    params = sanitize(algo, raw_params)
    legend: List[Dict[str, Any]] = []

    # 1. BRIGHTNESS
    if algo == "brightness":
        val = params["value"]
        out = np.clip(img.astype(np.float32) + val, 0, 255).astype(np.uint8)
        return out, legend

    # 2. CONTRAST
    elif algo == "contrast":
        factor = params["value"]
        # Contrast adjustment relative to midtone (128)
        out = np.clip(128.0 + factor * (img.astype(np.float32) - 128.0), 0, 255).astype(np.uint8)
        return out, legend

    # 3. GAMMA
    elif algo == "gamma":
        gamma = params["gamma"]
        if abs(gamma - 1.0) < 1e-4:
            return img.copy(), legend
        # LUT: gamma > 1 brightens, gamma < 1 darkens
        inv_gamma = 1.0 / gamma
        lut = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)]).astype(np.uint8)
        out = cv2.LUT(img, lut)
        return out, legend

    # 4. HIST_EQ
    elif algo == "hist_eq":
        if img.ndim == 2:
            out = cv2.equalizeHist(img)
        else:
            bgr = to_bgr(img)
            ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
            ycrcb[:, :, 0] = cv2.equalizeHist(ycrcb[:, :, 0])
            out = cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)
        return out, legend

    # 5. CLAHE
    elif algo == "clahe":
        clip = params["clip"]
        tile = params["tile"]
        clahe_obj = cv2.createCLAHE(clipLimit=clip, tileGridSize=(tile, tile))
        if img.ndim == 2:
            out = clahe_obj.apply(img)
        else:
            bgr = to_bgr(img)
            lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
            lab[:, :, 0] = clahe_obj.apply(lab[:, :, 0])
            out = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        return out, legend

    # 6. CONTRAST_STRETCH
    elif algo == "contrast_stretch":
        low_pct = params["low"]
        high_pct = params["high"]
        if img.ndim == 2:
            p_low = np.percentile(img, low_pct)
            p_high = np.percentile(img, high_pct)
            if p_high > p_low:
                out = np.clip((img.astype(np.float32) - p_low) * (255.0 / (p_high - p_low)), 0, 255).astype(np.uint8)
            else:
                out = img.copy()
        else:
            bgr = to_bgr(img)
            chans = []
            for c in range(3):
                ch = bgr[:, :, c]
                p_low = np.percentile(ch, low_pct)
                p_high = np.percentile(ch, high_pct)
                if p_high > p_low:
                    stretched = np.clip((ch.astype(np.float32) - p_low) * (255.0 / (p_high - p_low)), 0, 255).astype(np.uint8)
                else:
                    stretched = ch.copy()
                chans.append(stretched)
            out = cv2.merge(chans)
        return out, legend

    # 7. GAUSSIAN
    elif algo == "gaussian":
        ksize = params["ksize"]
        sigma = params["sigma"]
        out = cv2.GaussianBlur(img, (ksize, ksize), sigma)
        return out, legend

    # 8. MEDIAN
    elif algo == "median":
        ksize = params["ksize"]
        out = cv2.medianBlur(img, ksize)
        return out, legend

    # 9. MEAN
    elif algo == "mean":
        ksize = params["ksize"]
        out = cv2.blur(img, (ksize, ksize))
        return out, legend

    # 10. SHARPEN
    elif algo == "sharpen":
        amount = params["amount"]
        sigma = params["sigma"]
        blurred = cv2.GaussianBlur(img, (0, 0), sigma)
        # Unsharp mask formula
        out = cv2.addWeighted(img, 1.0 + amount, blurred, -amount, 0)
        return out, legend

    # 11. GRAY_THRESHOLD
    elif algo == "gray_threshold":
        method = params["method"]
        val = params["value"]
        gray = cv2.cvtColor(to_bgr(img), cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
        if method == "otsu":
            _, out = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        else:
            _, out = cv2.threshold(gray, val, 255, cv2.THRESH_BINARY)
        return out, legend

    # 12. ADAPTIVE_THRESHOLD
    elif algo == "adaptive_threshold":
        block = params["block"]
        c_val = params["c"]
        method_str = params["method"]
        gray = cv2.cvtColor(to_bgr(img), cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
        adapt_type = cv2.ADAPTIVE_THRESH_GAUSSIAN_C if method_str == "gaussian" else cv2.ADAPTIVE_THRESH_MEAN_C
        out = cv2.adaptiveThreshold(gray, 255, adapt_type, cv2.THRESH_BINARY, block, c_val)
        return out, legend

    # 13. KMEANS
    elif algo == "kmeans":
        k = params["k"]
        bgr = to_bgr(img)
        h, w = bgr.shape[:2]
        flat_pixels = bgr.reshape(-1, 3).astype(np.float32)
        total_pixels = flat_pixels.shape[0]

        # Memory safe: sample at most 100k pixels for cluster centers
        np.random.seed(42)
        cv2.setRNGSeed(42)
        if total_pixels > 100000:
            sample_idx = np.random.choice(total_pixels, 100000, replace=False)
            sample_pixels = flat_pixels[sample_idx]
        else:
            sample_pixels = flat_pixels

        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.2)
        _, _, centers = cv2.kmeans(sample_pixels, k, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
        centers_uint8 = np.clip(centers, 0, 255).astype(np.uint8)

        # Assign all pixels in chunks to avoid memory spikes
        chunk_size = 200000
        labels = np.zeros((total_pixels,), dtype=np.int32)
        for i in range(0, total_pixels, chunk_size):
            chunk = flat_pixels[i:i + chunk_size]
            # dist shape: (chunk_size, k)
            dists = np.sum((chunk[:, np.newaxis, :] - centers[np.newaxis, :, :]) ** 2, axis=2)
            labels[i:i + chunk_size] = np.argmin(dists, axis=1)

        segmented = centers_uint8[labels].reshape((h, w, 3))

        # Build legend summing to exactly 100%
        counts = np.bincount(labels, minlength=k)
        pcts = [float(c / total_pixels * 100.0) for c in counts]
        
        # Adjust rounding so sum is exactly 100
        rounded = [round(p, 1) for p in pcts]
        diff = round(100.0 - sum(rounded), 1)
        if len(rounded) > 0:
            rounded[0] = round(rounded[0] + diff, 1)

        palette = [
            "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
            "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"
        ]

        for idx in range(k):
            hex_color = palette[idx % len(palette)]
            legend.append({
                "label": f"Cluster {idx + 1}",
                "color": hex_color,
                "percent": rounded[idx]
            })

        return segmented, legend

    # 14. REGION_HIGHLIGHT
    elif algo == "region_highlight":
        invert = params["invert"]
        bgr = to_bgr(img)
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        if invert:
            mask = cv2.bitwise_not(mask)

        # Accent overlay: cyan tinted region
        overlay = bgr.copy()
        cyan_tint = np.zeros_like(bgr)
        cyan_tint[:, :] = [246, 215, 76]  # BGR for #4cd7f6
        
        region_bool = mask > 0
        overlay[region_bool] = cv2.addWeighted(bgr[region_bool], 0.5, cyan_tint[region_bool], 0.5, 0)
        
        # Contours outline
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(overlay, contours, -1, (246, 215, 76), 2)

        pct = float(np.count_nonzero(region_bool) / mask.size * 100.0)
        legend = [
            {"label": "Highlighted Region", "color": "#4cd7f6", "percent": round(pct, 1)},
            {"label": "Background", "color": "#1b1f2e", "percent": round(100.0 - pct, 1)}
        ]
        return overlay, legend

    # 15. GRAYSCALE
    elif algo == "grayscale":
        if img.ndim == 2:
            return img.copy(), legend
        bgr = to_bgr(img)
        out = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        return out, legend

    # 16. RGB_CHANNEL
    elif algo == "rgb_channel":
        ch_name = params["channel"]
        bgr = to_bgr(img)
        ch_idx = {"b": 0, "g": 1, "r": 2}[ch_name]
        out = bgr[:, :, ch_idx].copy()
        return out, legend

    # 17. SOBEL
    elif algo == "sobel":
        ksize = params["ksize"]
        gray = cv2.cvtColor(to_bgr(img), cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
        gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=ksize)
        gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=ksize)
        mag = np.hypot(gx, gy)
        max_m = np.max(mag)
        if max_m > 0:
            out = np.clip((mag / max_m) * 255.0, 0, 255).astype(np.uint8)
        else:
            out = np.zeros_like(gray, dtype=np.uint8)
        return out, legend

    # 18. CANNY
    elif algo == "canny":
        low = params["low"]
        high = params["high"]
        if low > high:
            low, high = high, low
        gray = cv2.cvtColor(to_bgr(img), cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
        out = cv2.Canny(gray, int(low), int(high))
        return out, legend

    # 19. HISTOGRAM
    elif algo == "histogram":
        return img.copy(), legend

    # 20. VEGETATION_PROXY
    elif algo == "vegetation_proxy":
        bgr = to_bgr(img)
        b = bgr[:, :, 0].astype(np.float32)
        g = bgr[:, :, 1].astype(np.float32)
        r = bgr[:, :, 2].astype(np.float32)

        # Excess Green Index: 2G - R - B
        exg = 2.0 * g - r - b
        veg_mask = exg > 15.0

        out = bgr.copy()
        # Highlighting vegetation with bright green
        green_overlay = np.zeros_like(bgr)
        green_overlay[:, :] = [34, 197, 94]  # #22c55e in BGR
        if np.any(veg_mask):
            out[veg_mask] = np.clip(0.4 * bgr[veg_mask] + 0.6 * green_overlay[veg_mask], 0, 255).astype(np.uint8)

        veg_pct = float(np.count_nonzero(veg_mask) / veg_mask.size * 100.0)
        legend = [
            {"label": "Vegetation (Proxy, not NDVI)", "color": "#22c55e", "percent": round(veg_pct, 1)},
            {"label": "Non-Vegetation", "color": "#64748b", "percent": round(100.0 - veg_pct, 1)}
        ]
        return out, legend

    # 21. EROSION
    elif algo == "erosion":
        ksize = params["ksize"]
        iters = params.get("iterations", 1)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (ksize, ksize))
        out = cv2.erode(img, kernel, iterations=iters)
        return out, legend

    # 22. DILATION
    elif algo == "dilation":
        ksize = params["ksize"]
        iters = params.get("iterations", 1)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (ksize, ksize))
        out = cv2.dilate(img, kernel, iterations=iters)
        return out, legend

    # 23. MORPHOLOGICAL OPENING (Erosion followed by Dilation)
    elif algo == "morph_open":
        ksize = params["ksize"]
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (ksize, ksize))
        out = cv2.morphologyEx(img, cv2.MORPH_OPEN, kernel)
        return out, legend

    # 24. MORPHOLOGICAL CLOSING (Dilation followed by Erosion)
    elif algo == "morph_close":
        ksize = params["ksize"]
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (ksize, ksize))
        out = cv2.morphologyEx(img, cv2.MORPH_CLOSE, kernel)
        return out, legend

    raise ValueError(f"Unhandled algorithm: {algo}")
