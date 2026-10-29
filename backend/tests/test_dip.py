import pytest
import numpy as np
import cv2
import sys
import os

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import dip

@pytest.fixture
def color_img():
    # 128x128 synthetic test image with patterns
    np.random.seed(101)
    img = np.zeros((128, 128, 3), dtype=np.uint8)
    img[:64, :64] = [180, 50, 50]    # Blueish
    img[:64, 64:] = [50, 180, 50]    # Greenish
    img[64:, :64] = [50, 50, 180]    # Reddish
    img[64:, 64:] = [120, 120, 120]  # Grey
    # Add subtle gradient
    x = np.linspace(0, 20, 128).astype(int)
    img[:, :, 0] = np.clip(img[:, :, 0].astype(int) + x[np.newaxis, :], 0, 255).astype(np.uint8)
    return img

@pytest.fixture
def gray_img(color_img):
    return cv2.cvtColor(color_img, cv2.COLOR_BGR2GRAY)


def test_every_algorithm_runs_color_and_gray(color_img, gray_img):
    for algo in dip.SPEC.keys():
        # Test on color
        out_c, _ = dip.run(algo, color_img)
        assert out_c.dtype == np.uint8, f"{algo} output must be uint8"
        assert out_c.shape[0] == color_img.shape[0] and out_c.shape[1] == color_img.shape[1]
        assert out_c.ndim in (2, 3)

        # Test on single-channel
        out_g, _ = dip.run(algo, gray_img)
        assert out_g.dtype == np.uint8, f"{algo} output must be uint8 on gray"
        assert out_g.shape[0] == gray_img.shape[0] and out_g.shape[1] == gray_img.shape[1]
        assert out_g.ndim in (2, 3)


def test_brightness(color_img):
    mean_orig = np.mean(color_img)
    up, _ = dip.run("brightness", color_img, {"value": 30})
    down, _ = dip.run("brightness", color_img, {"value": -30})
    assert np.mean(up) > mean_orig
    assert np.mean(down) < mean_orig


def test_contrast(color_img):
    std_orig = np.std(color_img)
    higher, _ = dip.run("contrast", color_img, {"value": 1.5})
    assert np.std(higher) > std_orig


def test_gamma(color_img):
    mean_orig = np.mean(color_img)
    bright, _ = dip.run("gamma", color_img, {"gamma": 1.8})
    dark, _ = dip.run("gamma", color_img, {"gamma": 0.5})
    same, _ = dip.run("gamma", color_img, {"gamma": 1.0})
    
    assert np.mean(bright) > mean_orig
    assert np.mean(dark) < mean_orig
    assert np.array_equal(same, color_img)


def test_hist_eq_and_stretch():
    # Low contrast image centered at 120
    low_contrast = (np.random.normal(120, 5, (100, 100, 3))).clip(100, 140).astype(np.uint8)
    orig_range = np.max(low_contrast) - np.min(low_contrast)

    stretched, _ = dip.run("contrast_stretch", low_contrast, {"low": 2, "high": 98})
    eq, _ = dip.run("hist_eq", low_contrast)

    assert (np.max(stretched) - np.min(stretched)) > orig_range
    assert (np.max(eq) - np.min(eq)) > orig_range

    # CLAHE preserves spatial structure/shape
    clahe_out, _ = dip.run("clahe", low_contrast)
    assert clahe_out.shape == low_contrast.shape


def test_filters_and_noise_reduction():
    # Clean image
    clean = np.ones((100, 100), dtype=np.uint8) * 128
    noisy = clean.copy()
    # Add salt and pepper
    np.random.seed(42)
    sp_mask1 = np.random.rand(100, 100) < 0.05
    sp_mask2 = np.random.rand(100, 100) < 0.05
    noisy[sp_mask1] = 255
    noisy[sp_mask2] = 0

    orig_err = np.mean(np.abs(noisy.astype(float) - clean.astype(float)))
    med, _ = dip.run("median", noisy, {"ksize": 5})
    med_err = np.mean(np.abs(med.astype(float) - clean.astype(float)))

    # Median removes salt-and-pepper noise (error drops by at least 80%)
    assert med_err < orig_err * 0.20

    # Gaussian and mean reduce standard deviation
    rand_img = np.random.randint(50, 200, (100, 100, 3), dtype=np.uint8)
    std_orig = np.std(rand_img)
    gauss_out, _ = dip.run("gaussian", rand_img, {"ksize": 5, "sigma": 1.5})
    mean_out, _ = dip.run("mean", rand_img, {"ksize": 5})
    assert np.std(gauss_out) < std_orig
    assert np.std(mean_out) < std_orig

    # Sharpen increases Laplacian variance of a blurred image
    blurred = cv2.GaussianBlur(rand_img, (5, 5), 1.5)
    lap_blur = cv2.Laplacian(cv2.cvtColor(blurred, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()
    sharpened, _ = dip.run("sharpen", blurred, {"amount": 2.0, "sigma": 1.0})
    lap_sharp = cv2.Laplacian(cv2.cvtColor(sharpened, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()
    assert lap_sharp > lap_blur


def test_thresholds():
    img = np.zeros((100, 100), dtype=np.uint8)
    img[:, :50] = 50
    img[:, 50:] = 200

    # Manual threshold equals (gray > value)
    thresh_manual, _ = dip.run("gray_threshold", img, {"method": "manual", "value": 127})
    expected = np.zeros((100, 100), dtype=np.uint8)
    expected[:, 50:] = 255
    assert np.array_equal(thresh_manual, expected)

    # Output values are only 0 and 255
    unique_vals = np.unique(thresh_manual)
    assert set(unique_vals).issubset({0, 255})

    # Adaptive methods (gaussian & mean) return only 0 and 255
    ad_g, _ = dip.run("adaptive_threshold", img, {"method": "gaussian", "block": 35, "c": 5})
    ad_m, _ = dip.run("adaptive_threshold", img, {"method": "mean", "block": 35, "c": 5})
    assert set(np.unique(ad_g)).issubset({0, 255})
    assert set(np.unique(ad_m)).issubset({0, 255})


def test_kmeans():
    # Two-region image
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    img[:, :50] = [255, 0, 0]
    img[:, 50:] = [0, 0, 255]

    out2, leg2 = dip.run("kmeans", img, {"k": 2})
    # exactly 2 colors
    assert len(leg2) == 2
    # about 50% each
    assert abs(leg2[0]["percent"] - 50.0) <= 2.0
    assert abs(leg2[1]["percent"] - 50.0) <= 2.0
    assert sum(it["percent"] for it in leg2) == pytest.approx(100.0, 0.1)

    # k=5 gives 5 legend entries summing to 100 and is deterministic
    grad = np.repeat(np.arange(100, dtype=np.uint8)[:, np.newaxis], 100, axis=1)
    grad3 = cv2.merge([grad, grad, grad])
    run1, leg_k5_1 = dip.run("kmeans", grad3, {"k": 5})
    run2, leg_k5_2 = dip.run("kmeans", grad3, {"k": 5})
    assert len(leg_k5_1) == 5
    assert sum(it["percent"] for it in leg_k5_1) == pytest.approx(100.0, 0.1)
    assert np.array_equal(run1, run2)

    # 2000x2000 image completes without memory error
    big_img = np.zeros((2000, 2000, 3), dtype=np.uint8)
    big_img[:1000, :] = [200, 100, 50]
    big_img[1000:, :] = [50, 150, 200]
    big_out, big_leg = dip.run("kmeans", big_img, {"k": 3})
    assert big_out.shape == (2000, 2000, 3)
    assert len(big_leg) == 3


def test_region_highlight(color_img):
    out, legend = dip.run("region_highlight", color_img, {"invert": False})
    assert not np.array_equal(out, color_img)
    assert len(legend) == 2
    assert 0.0 <= legend[0]["percent"] <= 100.0
    assert sum(it["percent"] for it in legend) == pytest.approx(100.0, 0.1)


def test_rgb_channel_and_grayscale(color_img):
    gray, _ = dip.run("grayscale", color_img)
    expected_gray = cv2.cvtColor(color_img, cv2.COLOR_BGR2GRAY)
    assert np.array_equal(gray, expected_gray)

    r_ch, _ = dip.run("rgb_channel", color_img, {"channel": "r"})
    g_ch, _ = dip.run("rgb_channel", color_img, {"channel": "g"})
    b_ch, _ = dip.run("rgb_channel", color_img, {"channel": "b"})
    
    # In BGR: [B, G, R]
    assert np.array_equal(r_ch, color_img[:, :, 2])
    assert np.array_equal(g_ch, color_img[:, :, 1])
    assert np.array_equal(b_ch, color_img[:, :, 0])


def test_sobel_and_canny():
    # Vertical step edge at x=50
    edge_img = np.zeros((100, 100), dtype=np.uint8)
    edge_img[:, 50:] = 255

    sobel_out, _ = dip.run("sobel", edge_img, {"ksize": 3})
    # Peak gradient should be within 2px of 50
    peak_x = np.argmax(sobel_out[50, :])
    assert abs(peak_x - 50) <= 2
    # Flat areas are 0
    assert sobel_out[50, 10] == 0
    assert sobel_out[50, 90] == 0

    canny_out, _ = dip.run("canny", edge_img, {"low": 100, "high": 200})
    canny_peak_x = np.where(canny_out[50, :] > 0)[0]
    assert len(canny_peak_x) > 0
    assert abs(canny_peak_x[0] - 50) <= 2
    assert canny_out[50, 10] == 0

    # Reversed Canny thresholds do not crash
    canny_rev, _ = dip.run("canny", edge_img, {"low": 200, "high": 50})
    assert canny_rev.shape == edge_img.shape


def test_vegetation_proxy():
    # Half green, half grey
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    img[:, :50] = [30, 200, 30]   # Bright green: 2G - R - B = 400 - 30 - 30 = 340 >> 15
    img[:, 50:] = [120, 120, 120] # Grey: 2G - R - B = 240 - 120 - 120 = 0

    out, legend = dip.run("vegetation_proxy", img)
    assert len(legend) == 2
    assert "not NDVI" in legend[0]["label"]
    assert abs(legend[0]["percent"] - 50.0) <= 2.0


def test_sanitization_and_errors(color_img):
    # Out-of-range clamped
    clean = dip.sanitize("brightness", {"value": 500})
    assert clean["value"] == 100

    clean2 = dip.sanitize("brightness", {"value": -500})
    assert clean2["value"] == -100

    # Even kernel sizes corrected
    clean_k = dip.sanitize("gaussian", {"ksize": 4})
    assert clean_k["ksize"] % 2 == 1

    # Non-numeric values raise ValueError
    with pytest.raises(ValueError):
        dip.sanitize("contrast", {"value": "invalid_abc"})

    # Unknown algorithm raises ValueError
    with pytest.raises(ValueError):
        dip.run("quantum_teleportation", color_img)


def test_metrics(color_img):
    # Identical images give SSIM 1.0
    m_id = dip.compute_metrics(color_img, color_img, "brightness")
    assert m_id["ssim"] == 1.0

    # Blurred image gives valid PSNR and SSIM
    blurred = cv2.GaussianBlur(color_img, (5, 5), 1.5)
    m_blur = dip.compute_metrics(color_img, blurred, "gaussian")
    assert m_blur["psnr"] is not None and m_blur["psnr"] > 0
    assert m_blur["ssim"] is not None and 0.0 <= m_blur["ssim"] <= 1.0

    # Canny gives null PSNR and SSIM
    canny_out, _ = dip.run("canny", color_img)
    m_canny = dip.compute_metrics(color_img, canny_out, "canny")
    assert m_canny["psnr"] is None
    assert m_canny["ssim"] is None

    # Entropy is between 0 and 8
    assert 0.0 <= m_id["entropy"] <= 8.0
    assert 0.0 <= m_blur["entropy"] <= 8.0
