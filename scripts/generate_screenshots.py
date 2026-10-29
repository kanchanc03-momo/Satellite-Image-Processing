import os
import sys
import cv2
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
import dip
import imagery

out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "screenshots"))
os.makedirs(out_dir, exist_ok=True)

# Generate or fetch real satellite sample image
raw_bytes = imagery.generate_demo_satellite_image(25.118, 55.133, 512, 512)
nparr = np.frombuffer(raw_bytes, np.uint8)
img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

cv2.imwrite(os.path.join(out_dir, "00_original.png"), img)

algos_to_test = [
    ("01_brightness", "brightness", {"value": 35}),
    ("02_contrast", "contrast", {"value": 1.6}),
    ("03_gamma", "gamma", {"gamma": 1.7}),
    ("04_hist_eq", "hist_eq", {}),
    ("05_clahe", "clahe", {"clip": 3.0, "tile": 8}),
    ("06_contrast_stretch", "contrast_stretch", {"low": 3, "high": 97}),
    ("07_gaussian", "gaussian", {"ksize": 7, "sigma": 2.0}),
    ("08_median", "median", {"ksize": 5}),
    ("09_mean", "mean", {"ksize": 7}),
    ("10_sharpen", "sharpen", {"amount": 2.5, "sigma": 1.5}),
    ("11_otsu_threshold", "gray_threshold", {"method": "otsu"}),
    ("12_adaptive_threshold", "adaptive_threshold", {"block": 35, "c": 5, "method": "gaussian"}),
    ("13_kmeans", "kmeans", {"k": 4}),
    ("14_region_highlight", "region_highlight", {"invert": False}),
    ("15_grayscale", "grayscale", {}),
    ("16_rgb_channel_g", "rgb_channel", {"channel": "g"}),
    ("17_sobel", "sobel", {"ksize": 3}),
    ("18_canny", "canny", {"low": 100, "high": 200}),
    ("19_vegetation_proxy", "vegetation_proxy", {})
]

for filename, algo, params in algos_to_test:
    res_img, legend = dip.run(algo, img, params)
    cv2.imwrite(os.path.join(out_dir, f"{filename}.png"), res_img)
    print(f"Generated screenshot: {filename}.png (Legend: {len(legend)} items)")

print("All screenshots successfully generated!")
