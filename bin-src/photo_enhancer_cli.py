# -*- coding: utf-8 -*-
"""
Photo Enhancer (CLI) — adaptive traditional enhancement
========================================================
Classic (non-AI, CPU-only) image enhancement built on Pillow + OpenCV + numpy,
exposed as a CLI so the web app can drive it reliably.

Two modes:

  --auto 1 (default)
      Analyzes the input image (brightness, contrast, saturation, noise,
      detail, dynamic range, color cast, clipping, screenshot detection)
      and derives per-image enhancement settings. Manual slider values are
      ignored. The analysis + selected settings are printed to stdout for
      inspection.

  --auto 0
      Uses the exact manual values supplied (denoise, brightness, contrast,
      saturation, sharpness, scale) — identical pipeline to previous releases.

Auto pipeline order:
      Validate -> Analyze -> Adaptive settings -> Denoise -> Brightness ->
      Contrast -> Color (white balance + saturation) -> LANCZOS resize ->
      Adaptive UnsharpMask (luminance only) -> Final quality check -> Output

Usage (CLI):
    PhotoEnhancer.exe --input <image> --output <file.png> [--auto 0] \
        [--sharpness 1.3] [--contrast 1.1] [--saturation 1.1] \
        [--brightness 1.03] [--denoise 1] [--scale 2]

    --denoise  0 = off, 1 = light, 2 = strong   (manual mode)
    --scale    1..4 (1 = no upscaling)
    Slider ranges (0..2, 1.0 = neutral): sharpness, contrast, saturation, brightness.

Output format is chosen by the extension of --output (png, jpg, jpeg, bmp,
tiff, webp, gif). jpg is used when the extension is unknown.

Exit codes:
    0  success
    2  usage / argument error
    1  processing error
"""

import math
import os
import sys
import argparse

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

# ---------------------------------------------------------------------------
# Optional acceleration libraries (used for analysis + high-quality denoise).
# The engine degrades gracefully to Pillow-only when they are unavailable.
# ---------------------------------------------------------------------------

try:
    import numpy as _np
    import cv2 as _cv2
    HAVE_CV2 = True
except Exception:  # pragma: no cover
    _np = None
    _cv2 = None
    HAVE_CV2 = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PIL_FORMATS = {
    "jpg": "JPEG",
    "jpeg": "JPEG",
    "png": "PNG",
    "bmp": "BMP",
    "tiff": "TIFF",
    "webp": "WEBP",
    "gif": "GIF",
}
FORMAT_EXTENSIONS = {
    "jpg": ".jpg",
    "jpeg": ".jpg",
    "png": ".png",
    "bmp": ".bmp",
    "tiff": ".tiff",
    "webp": ".webp",
    "gif": ".gif",
}
NO_ALPHA_FORMATS = ("jpg", "jpeg", "bmp", "tiff", "gif")

ANALYSIS_MAX_SIDE = 768        # analysis working copy long side
DENOISE_NLMEANS_MAX_SIDE = 1600  # fastNlMeans cost guard (larger -> bilateral/median)
DENOISE_MEDIAN_MAX_SIDE = 3200   # bilateral cost guard (larger -> median)
CLAHE_MAX_MP = 20.0              # CLAHE memory guard
SATURATION_NP_MAX_MP = 12.0      # per-pixel numpy saturation guard

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clamp(value, low, high):
    """Clamp scalars and numpy arrays to [low, high]."""
    if HAVE_CV2 and isinstance(value, _np.ndarray):
        return _np.clip(value, low, high)
    return max(low, min(high, value))


def _np_array(img):
    """Convert a PIL RGB image to a uint8 numpy array (HxWx3)."""
    if HAVE_CV2:
        return _np.asarray(img.convert("RGB"), dtype=_np.uint8)
    return None


def smoothstep(a, b, x):
    """Smooth 0..1 step between a and b (works on scalars and arrays)."""
    t = clamp((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def split_alpha(img):
    """Return (RGB/L image, alpha band or None) so pipelines never lose alpha."""
    if img.mode == "RGBA":
        return img.convert("RGB"), img.getchannel("A")
    return img, None


def merge_alpha(img, alpha):
    """Attach an alpha band back onto an RGB image (no-op when alpha is None)."""
    if alpha is None:
        return img
    img = img.convert("RGB")
    img.putalpha(alpha)
    return img


# ---------------------------------------------------------------------------
# Image analysis
# ---------------------------------------------------------------------------

def _hist_percentiles(hist):
    """Return {percentile: level} from a 256-bin histogram."""
    total = max(1, sum(hist))
    out = {}
    for p in (1.5, 2.0, 50.0, 98.0, 98.5):
        target = total * p / 100.0
        acc = 0
        for level, count in enumerate(hist):
            acc += count
            if acc >= target:
                out[p] = level
                break
        else:
            out[p] = 255
    return out


def analyze_image(img):
    """Return per-image quality scores (0..1 ranges) from a small working copy.

    Scores returned:
        brightness, contrast, saturation, noise, color_noise, detail,
        dynamic_range, shadow_clip, highlight_clip, edge_density,
        flat_fraction, color_cast, is_screenshot plus percentiles.
    """
    work = img.convert("RGB")
    width, height = work.size
    long_side = max(width, height)
    if long_side > ANALYSIS_MAX_SIDE:
        work = work.resize(
            (max(1, round(width * ANALYSIS_MAX_SIDE / long_side)),
             max(1, round(height * ANALYSIS_MAX_SIDE / long_side))),
            Image.LANCZOS,
        )

    base = {
        "width": width,
        "height": height,
        "long_side": long_side,
        "megapixels": width * height / 1e6,
        "brightness": 0.0,
        "contrast": 0.0,
        "saturation": 0.0,
        "noise": 0.0,
        "color_noise": 0.0,
        "detail": 0.0,
        "dynamic_range": 0.0,
        "p2": 0.0,
        "p50": 0.5,
        "p98": 1.0,
        "_p1_5": 0.0,
        "_p98_5": 1.0,
        "shadow_clip": 0.0,
        "highlight_clip": 0.0,
        "edge_density": 0.0,
        "flat_fraction": 0.0,
        "color_cast": 0.0,
        "r_mean": 0.0,
        "g_mean": 0.0,
        "b_mean": 0.0,
        "is_screenshot": False,
    }

    if not HAVE_CV2:
        # Pillow-only fallback (brightness, contrast, saturation, range).
        g = work.convert("L")
        hist = g.histogram()
        total = max(1, sum(hist))
        brightness = sum(level * count for level, count in enumerate(hist)) / (total * 255.0)

        from PIL import ImageStat
        stat = ImageStat.Stat(g)
        contrast = clamp(stat.stddev[0] / 64.0, 0.0, 1.0)

        hsv = work.convert("HSV")
        saturation = clamp(ImageStat.Stat(hsv).mean[1] / 255.0, 0.0, 1.0)

        per = _hist_percentiles(hist)
        base.update({
            "brightness": clamp(brightness, 0.0, 1.0),
            "contrast": contrast,
            "saturation": saturation,
            "dynamic_range": clamp((per[98.0] - per[2.0]) / 255.0, 0.0, 1.0),
            "p2": per[2.0] / 255.0,
            "p50": per[50.0] / 255.0,
            "p98": per[98.0] / 255.0,
            "_p1_5": per[1.5] / 255.0,
            "_p98_5": per[98.5] / 255.0,
            "shadow_clip": sum(hist[i] for i in range(8)) / total,
            "highlight_clip": sum(hist[i] for i in range(248, 256)) / total,
        })
        rgb_stat = ImageStat.Stat(work)
        r_mean, g_mean, b_mean = [v / 255.0 for v in rgb_stat.mean[:3]]
        overall = (r_mean + g_mean + b_mean) / 3.0
        if overall >= 0.05:
            dev = max(abs(r_mean - overall), abs(g_mean - overall), abs(b_mean - overall)) / max(overall, 0.05)
            base["color_cast"] = clamp(dev / 0.16, 0.0, 1.0)
        base["r_mean"], base["g_mean"], base["b_mean"] = r_mean, g_mean, b_mean
        return base

    arr = _np_array(work)
    gray_u8 = _cv2.cvtColor(arr, _cv2.COLOR_RGB2GRAY)
    g = gray_u8.astype(_np.float32) / 255.0

    base["brightness"] = clamp(float(g.mean()), 0.0, 1.0)

    p2, p50, p98 = _np.percentile(gray_u8, [2, 50, 98])
    p1_5, p98_5 = _np.percentile(gray_u8, [1.5, 98.5])
    base["p2"], base["p50"], base["p98"] = p2 / 255.0, p50 / 255.0, p98 / 255.0
    base["_p1_5"], base["_p98_5"] = p1_5 / 255.0, p98_5 / 255.0
    base["dynamic_range"] = clamp(float((p98 - p2) / 255.0), 0.0, 1.0)
    base["contrast"] = clamp(float(g.std()) / 0.45, 0.0, 1.0)

    hsv = _cv2.cvtColor(arr, _cv2.COLOR_RGB2HSV)
    base["saturation"] = clamp(float(hsv[:, :, 1].mean() / 255.0), 0.0, 1.0)

    # Robust noise estimate: local std in the flattest quarter of the image.
    # Structure/texture rarely reaches the flattest pixels, so clean images
    # score low while real noise shows up everywhere.
    ksize = 5
    blur = _cv2.boxFilter(g, -1, (ksize, ksize))
    blur_sq = _cv2.boxFilter(g * g, -1, (ksize, ksize))
    local_var = _np.maximum(blur_sq - blur * blur, 0.0)
    local_std = _np.sqrt(local_var)
    base["flat_fraction"] = float((local_std < 0.030).mean())
    sigma = float(_np.percentile(local_std, 25))
    base["noise"] = clamp(sigma * 255.0 / 12.0, 0.0, 1.0)

    # Chroma noise (guides whether to denoise color heavily).
    ycc = _cv2.cvtColor(arr, _cv2.COLOR_RGB2YCrCb).astype(_np.float32)
    _, cr, cb = _cv2.split(ycc)

    def _mad_sigma(channel):
        res = channel - _cv2.medianBlur(channel.astype(_np.uint8), 5).astype(_np.float32)
        m = float(_np.median(res))
        return float(1.4826 * _np.median(_np.abs(res - m)))

    chroma_sigma = (_mad_sigma(cr) + _mad_sigma(cb)) / 2.0
    base["color_noise"] = clamp(chroma_sigma / max(sigma, 1e-3), 0.0, 1.0) if sigma > 0 else 0.0

    # Detail strength from a bilaterally smoothed copy so pixel noise does not
    # inflate the score (which would wrongly suppress denoising).
    smooth = _cv2.bilateralFilter(gray_u8, 7, 30, 7)
    lap = _cv2.Laplacian(smooth, _cv2.CV_64F)
    base["detail"] = clamp(float(lap.var()) / 900.0, 0.0, 1.0)

    # Edge density from Sobel magnitude.
    gx = _cv2.Sobel(gray_u8, _cv2.CV_32F, 1, 0, ksize=3)
    gy = _cv2.Sobel(gray_u8, _cv2.CV_32F, 0, 1, ksize=3)
    mag = _np.sqrt(gx * gx + gy * gy)
    base["edge_density"] = clamp(float((mag > 90).mean()) * 5.0, 0.0, 1.0)

    # Color cast measured on near-neutral pixels (the reliable gray reference).
    # Strongly colored scenes (sunsets, skin) have few neutral pixels -> cast ~0
    # so automatic white balance never fights the intended color.
    b_ch, g_ch, r_ch = _cv2.split(arr)
    neutral_mask = (hsv[:, :, 1] < 64) & (hsv[:, :, 2] > 30)
    neutral_frac = float(neutral_mask.mean())
    if neutral_frac > 0.04:
        b_mean = float(b_ch[neutral_mask].mean()) / 255.0
        g_mean = float(g_ch[neutral_mask].mean()) / 255.0
        r_mean = float(r_ch[neutral_mask].mean()) / 255.0
    else:
        b_mean = float(b_ch.mean()) / 255.0
        g_mean = float(g_ch.mean()) / 255.0
        r_mean = float(r_ch.mean()) / 255.0
    base["r_mean"], base["g_mean"], base["b_mean"] = r_mean, g_mean, b_mean
    overall = (r_mean + g_mean + b_mean) / 3.0
    if overall >= 0.05:
        dev = max(abs(r_mean - overall), abs(g_mean - overall), abs(b_mean - overall)) / max(overall, 0.05)
        base["color_cast"] = clamp(dev / 0.16, 0.0, 1.0)

    base["shadow_clip"] = float((gray_u8 < 8).mean())
    base["highlight_clip"] = float((gray_u8 > 247).mean())

    # Screenshot / UI detection: UI images have large *very* flat regions
    # (nearly uniform panels), a wide dark-to-white range and crisp contrast,
    # with almost no smooth photographic gradients.
    very_flat = local_std < 0.016
    soft = (local_std >= 0.016) & (local_std < 0.05)
    very_flat_frac = float(very_flat.mean())
    soft_frac = float(soft.mean())
    base["is_screenshot"] = (
        very_flat_frac > 0.50 and soft_frac < 0.15 and (p98 - p2) > 170 and base["contrast"] > 0.28
    )
    base["_very_flat_frac"] = very_flat_frac
    base["_soft_frac"] = soft_frac

    return base


# ---------------------------------------------------------------------------
# Adaptive setting derivation (auto mode)
# ---------------------------------------------------------------------------

def build_brightness_lut(shadow_lift, highlight_cut):
    """Shadow-lifting + highlight-protecting tone curve (shared across bands).

    shadow_lift > 0 lifts shadows and lower midtones without touching the top
    of the range; highlight_cut > 0 gently pulls near-whites down without
    crushing blacks.
    """
    lut = []
    for i in range(256):
        v = i / 255.0
        out = v + shadow_lift * smoothstep(0.0, 0.6, v) * (1.0 - v)
        out = out - highlight_cut * smoothstep(0.55, 1.0, out) * out
        lut.append(round(clamp(out, 0.0, 1.0) * 255))
    return bytes(lut)


def build_stretch_lut(p1, p99):
    """Controlled luminance histogram stretch (percentile-anchored).

    Wide dynamic ranges stretch less (avoids over-processing); narrow ranges
    get a moderate boost while keeping margins off the hard clip points.
    Returns None when the range is too narrow to stretch safely.
    """
    lo_level = int(round(p1 * 255.0))
    hi_level = int(round(p99 * 255.0))
    span = hi_level - lo_level
    if span < 24:
        return None
    strength = clamp(150.0 / span, 0.4, 1.0)
    half = 121.5 * strength
    out_lo, out_hi = 128.0 - half, 128.0 + half
    scale = (out_hi - out_lo) / span
    lut = []
    for i in range(256):
        if i <= lo_level:
            v = out_lo
        elif i >= hi_level:
            v = out_hi
        else:
            v = out_lo + (i - lo_level) * scale
        lut.append(round(clamp(v, 0.0, 255.0)))
    return bytes(lut)


def suggest_auto_scale(scores):
    """Upscaling behavior: only genuinely small, non-UI images get upscaled."""
    if scores["is_screenshot"]:
        return 1.0
    long_side = scores["long_side"]
    if long_side >= 640:
        return 1.0
    factor = int(round(1280.0 / max(long_side, 1)))
    return float(clamp(factor, 2, 4))


def derive_auto_settings(scores, requested_scale):
    """Map analysis scores to concrete enhancement settings."""
    p50 = scores["p50"]
    brightness = scores["brightness"]
    p2 = scores["p2"]
    p98 = scores["p98"]
    contrast = scores["contrast"]
    saturation = scores["saturation"]
    noise = scores["noise"]
    detail = scores["detail"]
    dynamic_range = scores["dynamic_range"]
    color_cast = scores["color_cast"]
    is_screenshot = scores["is_screenshot"]

    # ---- Brightness: shadow lift or highlight reduction --------------------
    shadow_lift = 0.0
    highlight_cut = 0.0
    if p50 < 0.40 or brightness < 0.38:
        deficit = max(0.0, 0.48 - p50)
        shadow_lift = clamp(deficit * 0.6, 0.0, 0.32)
        if p2 < 0.03:
            shadow_lift = min(shadow_lift + 0.05, 0.34)
        if p98 > 0.97:
            shadow_lift *= 0.6
    elif p50 > 0.60 or brightness > 0.62:
        highlight_cut = clamp((p50 - 0.55) * 0.5, 0.0, 0.24)
        if p2 < 0.02:
            highlight_cut *= 0.6
    brightness_lut = build_brightness_lut(shadow_lift, highlight_cut)

    # ---- Contrast: CLAHE for genuinely flat, percentile stretch otherwise ----
    use_clahe = False
    stretch = False
    if contrast < 0.16:
        c_factor = clamp(0.30 / max(contrast, 0.05), 1.04, 1.28)
        if not is_screenshot and dynamic_range < 0.60 and scores["megapixels"] <= CLAHE_MAX_MP:
            use_clahe = True
        else:
            stretch = True
    elif contrast > 0.55:
        c_factor = clamp(0.48 / max(contrast, 0.45), 0.88, 1.0)
    elif contrast < 0.35:
        c_factor = 1.08
    else:
        c_factor = 1.03

    stretch_lut = None
    if stretch:
        stretch_lut = build_stretch_lut(scores["_p1_5"], scores["_p98_5"])
        if stretch_lut is None:
            c_factor = clamp(c_factor * 1.05, 1.03, 1.32)

    # ---- White balance (gray world, strength from measured cast) ------------
    wb_strength = 0.0
    if not is_screenshot and color_cast > 0.06:
        wb_strength = clamp((color_cast - 0.06) * 1.4, 0.0, 0.55)

    # ---- Saturation (skin-tone friendly cap) --------------------------------
    if is_screenshot:
        s_factor = 1.0
    elif saturation < 0.16:
        s_factor = clamp(0.26 / max(saturation, 0.05), 1.0, 1.30)
    elif saturation > 0.48:
        s_factor = clamp(0.36 / max(saturation, 0.40), 0.80, 0.97)
    else:
        s_factor = 1.04

    # ---- Denoise level (0 none, 1 light, 2 moderate, 3 strong) --------------
    # Thresholds sit well above the structural "noise" of clean photos
    # (local std ~1-2 in 0..255) and below genuinely noisy images (~9+).
    if is_screenshot:
        d_level = 0
    elif noise < 0.25:
        d_level = 0
    elif noise < 0.45:
        d_level = 1
    elif noise < 0.70:
        d_level = 2
    else:
        d_level = 3
    if detail > 0.62:      # keep fine detail crisp
        d_level = min(d_level, 1)
    denoise_label = {0: "none", 1: "bilateral", 2: "nlmeans", 3: "nlmeans"}[d_level]

    # ---- Sharpening (adaptive luminance UnsharpMask) -------------------------
    if detail < 0.20:
        radius, percent = 1.1, 70
    elif detail < 0.42:
        radius, percent = 1.0, 55
    else:
        radius, percent = 0.8, 32
    if is_screenshot:
        percent = int(percent * 0.65)
    if noise > 0.22:
        percent = int(percent * 0.45)
    if requested_scale > 1.0:
        percent = min(percent + 35, 135)
        radius = max(radius, 1.2)
    # Larger images need proportionally larger radii to stay visible.
    size_factor = clamp(math.sqrt(scores["long_side"] / 1000.0), 0.8, 2.2)
    radius = clamp(radius * size_factor, 0.6, 3.0)
    threshold = 5 if noise > 0.18 else 3
    if detail < 0.25:
        threshold = 4

    return {
        "brightness_lut": brightness_lut,
        "shadow_lift": shadow_lift,
        "highlight_cut": highlight_cut,
        "contrast_factor": c_factor,
        "stretch_lut": stretch_lut,
        "use_clahe": use_clahe,
        "wb_strength": wb_strength,
        "saturation_factor": s_factor,
        "denoise": d_level,
        "denoise_label": denoise_label,
        "radius": radius,
        "percent": percent,
        "threshold": threshold,
        "scale": requested_scale,
    }


# ---------------------------------------------------------------------------
# Enhancement steps
# ---------------------------------------------------------------------------

def denoise_luminance_nlmeans(img, h_lum, h_chroma):
    """fastNlMeans on the luma + light luma on chroma (YCrCb) to avoid
    blurring color edges or smearing chroma noise into the luminance."""
    arr = _np_array(img)
    ycc = _cv2.cvtColor(arr, _cv2.COLOR_RGB2YCrCb)
    y, cr, cb = _cv2.split(ycc)
    y = _cv2.fastNlMeansDenoising(y, None, h_lum, 7, 21)
    if h_chroma > 0.5:
        cr = _cv2.fastNlMeansDenoising(cr, None, h_chroma, 5, 15)
        cb = _cv2.fastNlMeansDenoising(cb, None, h_chroma, 5, 15)
    merged = _cv2.merge((y, cr, cb))
    out = _cv2.cvtColor(merged, _cv2.COLOR_YCrCb2RGB)
    return Image.fromarray(out)


def apply_denoise(img, level, noise):
    """Adaptive denoise. Clean images get level 0 (never touched).

    Level 1: edge-preserving bilateral (better than median 3).
    Level 2/3: luminance-aware fastNlMeans on reasonably sized images.
    Large images fall back to cheap median/bilateral filtering.
    """
    if level <= 0:
        return img
    long_side = max(img.size)

    if not HAVE_CV2:
        return img.filter(ImageFilter.MedianFilter(size=3 if level == 1 else 5))

    if long_side > DENOISE_MEDIAN_MAX_SIDE:
        return img.filter(ImageFilter.MedianFilter(size=3 if level == 1 else 5))

    if level == 1:
        if long_side <= DENOISE_NLMEANS_MAX_SIDE:
            arr = _np_array(img)
            bgr = _cv2.cvtColor(arr, _cv2.COLOR_RGB2BGR)
            sigma = clamp(5.0 + noise * 26.0, 5.0, 14.0)
            out = _cv2.bilateralFilter(bgr, 5, sigma, 5.0)
            return Image.fromarray(_cv2.cvtColor(out, _cv2.COLOR_BGR2RGB))
        return img.filter(ImageFilter.MedianFilter(size=3))

    if long_side > DENOISE_NLMEANS_MAX_SIDE:
        return img.filter(ImageFilter.MedianFilter(size=5))

    h = clamp(5.0 + noise * 11.0, 5.0, 13.0)
    if level >= 3:
        h = clamp(h + 2.0, 7.0, 14.0)
    return denoise_luminance_nlmeans(img, h, h * 0.45)


def apply_clahe(img, clip_limit=1.5, grid=8):
    """Mild contrast-limited adaptive histogram equalization on the L* band.
    Used only for genuinely flat images; clip limit kept low to avoid
    amplifying noise or creating halos."""
    if not HAVE_CV2:
        return img
    rgb = _np.asarray(img.convert("RGB"), dtype=_np.uint8)
    lab = _cv2.cvtColor(rgb, _cv2.COLOR_RGB2LAB)
    l, a, b = _cv2.split(lab)
    clahe = _cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(grid, grid))
    l2 = clahe.apply(l)
    merged = _cv2.merge((l2, a, b))
    out = _cv2.cvtColor(merged, _cv2.COLOR_LAB2RGB)
    return Image.fromarray(out)


def apply_shared_lut(img, lut256):
    """Apply a single 256-entry LUT to every color band (alpha preserved)."""
    if img.mode == "L":
        return img.point(lut256)
    bands = img.split()
    mapped = [b.point(lut256) if b.mode == "L" else b for b in bands]
    return Image.merge(img.mode, mapped)


def apply_white_balance(img, strength, r_mean, g_mean, b_mean):
    """Luminance-stable gray-world white balance (channels stay near-neutral).
    Gains are capped so strong single-hue scenes are only mildly corrected."""
    overall = (r_mean + g_mean + b_mean) / 3.0
    if overall < 0.05:
        return img
    gains = []
    for m in (r_mean, g_mean, b_mean):
        g = clamp(overall / max(m, 0.02), 0.88, 1.14)
        gains.append(1.0 + (g - 1.0) * strength)
    mean_gain = sum(gains) / 3.0
    if mean_gain > 0.0:
        gains = [g / mean_gain for g in gains]
    if max(abs(g - 1.0) for g in gains) < 0.015:
        return img

    bands = img.split()
    out = []
    for band, gain in zip(bands, gains):
        lut = bytes(round(clamp(i * gain, 0, 255)) for i in range(256))
        out.append(band.point(lut))
    return Image.merge(img.mode, out)


def apply_saturation(img, factor):
    """Adaptive saturation with skin-tone protection.

    Boost is stronger for low-saturation pixels and gentle for already-saturated
    pixels; warm skin hues get a reduced gain so faces never turn orange. For
    very large images (memory guard) it falls back to ImageEnhance.Color.
    """
    if factor == 1.0:
        return img
    if not HAVE_CV2 or img.width * img.height > SATURATION_NP_MAX_MP * 1e6:
        return ImageEnhance.Color(img).enhance(factor)

    def _lut(gain_skin):
        lut = bytearray(256)
        for i in range(256):
            if factor >= 1.0:
                if gain_skin:
                    g = 1.0 + (factor - 1.0) * 0.30
                else:
                    g = 1.0 + (factor - 1.0) * (1.0 - 0.7 * (i / 255.0))
            else:
                g = factor
            lut[i] = round(clamp(i * g, 0, 255))
        return bytes(lut)

    rgb = _np_array(img)
    hsv = _cv2.cvtColor(rgb, _cv2.COLOR_RGB2HSV)
    h, s, v = _cv2.split(hsv)

    lut_arr = _np.frombuffer(_lut(False), dtype=_np.uint8)
    s2 = _np.take(lut_arr, s)
    if factor >= 1.0:
        h_i = h.astype(_np.int16)
        skin = ((h_i < 20) | (h_i > 168)) & (s > 25) & (s < 145) & (v > 60)
        if skin.any():
            lut_skin = _np.frombuffer(_lut(True), dtype=_np.uint8)
            s2 = _np.where(skin, _np.take(lut_skin, s), s2)

    hsv2 = _cv2.merge((h, s2.astype(_np.uint8), v))
    out = _cv2.cvtColor(hsv2, _cv2.COLOR_HSV2RGB)
    return Image.fromarray(out)


def sharpen_luminance(img, radius, percent, threshold):
    """UnsharpMask applied to luminance only (YCrCb) to avoid color fringing."""
    if radius <= 0 or percent <= 0:
        return img
    if img.mode == "L":
        return img.filter(ImageFilter.UnsharpMask(radius=radius, percent=percent, threshold=threshold))
    ycbcr = img.convert("YCbCr")
    y, cb, cr = ycbcr.split()
    y = y.filter(ImageFilter.UnsharpMask(radius=radius, percent=percent, threshold=threshold))
    return Image.merge("YCbCr", (y, cb, cr)).convert("RGB")


def resize_lanczos(img, scale):
    if scale <= 1.0:
        return img
    width = max(1, round(img.width * scale))
    height = max(1, round(img.height * scale))
    return img.resize((width, height), Image.LANCZOS)


# ---------------------------------------------------------------------------
# AI upscale (Real-ESRGAN x4 via ONNX Runtime, tiled CPU inference)
# ---------------------------------------------------------------------------

AI_MODEL_URL = (
    "https://huggingface.co/qualcomm/Real-ESRGAN-x4plus/resolve/"
    "83db0da6e1b4969f85fe60ee713bd2c2b3160c23/Real-ESRGAN-x4plus.onnx"
)
AI_UPSCALE_MAX_SIDE = 1600  # bound runtime: huge inputs are pre-shrunk


def _ai_model_path():
    base = os.path.join(os.path.expanduser("~"), ".photo-tools", "models")
    os.makedirs(base, exist_ok=True)
    return os.path.join(base, "realesrgan-x4plus.onnx")


def _ensure_ai_model():
    """Download the ONNX model once (~67 MB)."""
    path = _ai_model_path()
    if os.path.isfile(path) and os.path.getsize(path) > 1_000_000:
        return path
    import urllib.request

    tmp = path + ".part"
    print("Downloading AI upscale model (~67 MB, one-time)...", flush=True)
    urllib.request.urlretrieve(AI_MODEL_URL, tmp)
    os.replace(tmp, path)
    return path


def ai_upscale_rgb(rgb, target_scale):
    """Upscale an RGB PIL image with Real-ESRGAN x4 tiles; returns target x."""
    if target_scale not in (2, 4):
        raise ValueError("ai-upscale must be 0, 2 or 4")
    try:
        import numpy as np
        import onnxruntime as ort
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("AI upscale requires onnxruntime (%s)" % exc)

    if max(rgb.size) > AI_UPSCALE_MAX_SIDE:
        s = AI_UPSCALE_MAX_SIDE / float(max(rgb.size))
        rgb = rgb.resize(
            (max(1, round(rgb.width * s)), max(1, round(rgb.height * s))),
            Image.LANCZOS,
        )

    model_path = _ensure_ai_model()
    sess = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    inp = sess.get_inputs()[0]

    def _dim(v, default):
        return v if isinstance(v, int) and v > 0 else default

    tile_h = _dim(inp.shape[2], 256)
    tile_w = _dim(inp.shape[3], 256)
    out_scale = 4

    w, h = rgb.size
    arr = np.asarray(rgb, dtype=np.float32) / 255.0
    pad_h = (tile_h - h % tile_h) % tile_h
    pad_w = (tile_w - w % tile_w) % tile_w
    arr = np.pad(arr, ((0, pad_h), (0, pad_w), (0, 0)), mode="reflect")
    H, W = arr.shape[:2]
    out = np.zeros((H * out_scale, W * out_scale, 3), dtype=np.uint8)

    for y0 in range(0, H, tile_h):
        for x0 in range(0, W, tile_w):
            tile = arr[y0:y0 + tile_h, x0:x0 + tile_w].transpose(2, 0, 1)[None]
            res = sess.run(None, {inp.name: tile})[0]
            nchw = res if res.ndim == 3 else res[0]
            block = np.clip(nchw.transpose(1, 2, 0), 0.0, 1.0)
            out[
                y0 * out_scale:(y0 + tile_h) * out_scale,
                x0 * out_scale:(x0 + tile_w) * out_scale,
            ] = (block * 255.0 + 0.5).astype(np.uint8)

    up = Image.fromarray(out[:h * out_scale, :w * out_scale])
    if target_scale == 2:
        up = up.resize((w * 2, h * 2), Image.LANCZOS)
    return up


# ---------------------------------------------------------------------------
# Pipelines
# ---------------------------------------------------------------------------

def enhance_manual_rgb(img, sharpness, contrast, saturation, brightness,
                       denoise, scale, ai_scale=0):
    """Exact previous-release behavior on an RGB image (no I/O).

    Returns the enhanced RGB image. ``scale`` is ignored when ``ai_scale`` is set.
    """
    if denoise >= 1:
        img = img.filter(ImageFilter.MedianFilter(size=3))
    if denoise >= 2:
        img = img.filter(ImageFilter.MedianFilter(size=5))

    if ai_scale:
        img = ai_upscale_rgb(img, ai_scale)
        scale = 1.0

    img = resize_lanczos(img, scale)

    if saturation != 1.0:
        img = ImageEnhance.Color(img).enhance(saturation)
    if brightness != 1.0:
        img = ImageEnhance.Brightness(img).enhance(brightness)
    if contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(contrast)
    if sharpness != 1.0:
        img = ImageEnhance.Sharpness(img).enhance(sharpness)

    return img


def enhance_auto_rgb(rgb, requested_scale, ai_scale=0, allow_auto_scale=True):
    """Adaptive pipeline on an RGB image (no I/O).

    Returns ``(rgb, scores, settings)``; ``rgb`` may be upscaled. Set
    ``allow_auto_scale=False`` to never upscale (used for selective regions).
    """
    scores = analyze_image(rgb)

    if ai_scale:
        rgb = ai_upscale_rgb(rgb, ai_scale)
        scale = 1.0
    elif allow_auto_scale:
        scale = requested_scale if requested_scale > 1.0 else suggest_auto_scale(scores)
        scale = clamp(float(scale), 1.0, 4.0)
    else:
        scale = clamp(float(requested_scale), 1.0, 4.0)
    settings = derive_auto_settings(scores, scale)

    # 1. Denoise (only when the analysis says the image actually needs it)
    if settings["denoise"] > 0:
        rgb = apply_denoise(rgb, settings["denoise"], scores["noise"])

    # 2. Brightness correction (shadow-lifting / highlight-preserving curve)
    rgb = apply_shared_lut(rgb, settings["brightness_lut"])

    # 3. Contrast: controlled histogram stretch or CLAHE + adaptive factor
    if settings["use_clahe"]:
        rgb = apply_clahe(rgb, clip_limit=1.8)
    elif settings["stretch_lut"] is not None:
        rgb = apply_shared_lut(rgb, settings["stretch_lut"])
    if settings["contrast_factor"] != 1.0:
        rgb = ImageEnhance.Contrast(rgb).enhance(settings["contrast_factor"])

    # 4. Color: white balance then saturation
    if settings["wb_strength"] > 0.0:
        rgb = apply_white_balance(
            rgb, settings["wb_strength"],
            scores["r_mean"], scores["g_mean"], scores["b_mean"],
        )
    if settings["saturation_factor"] != 1.0:
        rgb = apply_saturation(rgb, settings["saturation_factor"])

    # 5. Upscale (LANCZOS, only when requested / genuinely small image)
    rgb = resize_lanczos(rgb, scale)

    # 6. Adaptive luminance-only UnsharpMask (final sharpening)
    rgb = sharpen_luminance(rgb, settings["radius"], settings["percent"], settings["threshold"])

    return rgb, scores, settings


def _sync_alpha(alpha, size):
    """Resize an alpha band to match a possibly upscaled RGB image."""
    if alpha is not None and alpha.size != size:
        return alpha.resize(size, Image.LANCZOS)
    return alpha


def manual_pipeline(input_path, output_path, out_format, sharpness, contrast,
                    saturation, brightness, denoise, scale, ai_scale=0):
    """Exact previous-release behavior: direct ImageEnhance + median + LANCZOS."""
    img = open_input(input_path, out_format)
    rgb, alpha = split_alpha(img)

    rgb = enhance_manual_rgb(
        rgb, sharpness, contrast, saturation, brightness, denoise, scale, ai_scale,
    )
    img = merge_alpha(rgb, _sync_alpha(alpha, rgb.size))

    img.save(output_path, format=PIL_FORMATS[out_format])
    return img


def auto_pipeline(input_path, output_path, out_format, requested_scale, ai_scale=0):
    """Adaptive pipeline: analyze -> derive settings -> apply, then log."""
    img = open_input(input_path, out_format)
    rgb, alpha = split_alpha(img)

    rgb, scores, settings = enhance_auto_rgb(rgb, requested_scale, ai_scale)
    img = merge_alpha(rgb, _sync_alpha(alpha, rgb.size))

    report_quality(img, input_path, out_format)
    img.save(output_path, format=PIL_FORMATS[out_format])

    print_auto_report(scores, settings)
    return img


def region_pipeline(input_path, output_path, out_format, region, auto,
                    sharpness=1.0, contrast=1.0, saturation=1.0, brightness=1.0,
                    denoise=0, scale=1.0, ai_scale=0):
    """Selective enhance: enhance only the given normalized rectangle.

    The box is enhanced in isolation (no upscaling), composited back onto the
    original with a soft feathered edge, then the whole image may be upscaled.
    AI upscaling is not applied to a region (pass ``ai_scale=0``).
    """
    img = open_input(input_path, out_format)
    rgb, alpha = split_alpha(img)
    width, height = rgb.size

    x = clamp(float(region[0]), 0.0, 1.0)
    y = clamp(float(region[1]), 0.0, 1.0)
    w = clamp(float(region[2]), 0.0, 1.0 - x)
    h = clamp(float(region[3]), 0.0, 1.0 - y)

    left = max(0, min(width - 1, int(round(x * width))))
    top = max(0, min(height - 1, int(round(y * height))))
    right = max(left + 1, min(width, int(round((x + w) * width))))
    bottom = max(top + 1, min(height, int(round((y + h) * height))))

    crop = rgb.crop((left, top, right, bottom))
    if auto:
        enhanced, _, _ = enhance_auto_rgb(crop, 1.0, 0, allow_auto_scale=False)
    else:
        enhanced = enhance_manual_rgb(
            crop, sharpness, contrast, saturation, brightness, denoise, 1.0, 0,
        )
    # The crop is never upscaled in region mode; guarantee the same size.
    if enhanced.size != crop.size:
        enhanced = enhanced.resize(crop.size, Image.LANCZOS)

    # Full-size mask: white inside the box, feathered at the edges.
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rectangle([left, top, right - 1, bottom - 1], fill=255)
    feather = max(2, int(round(min(width, height) * 0.004)))
    mask = mask.filter(ImageFilter.GaussianBlur(feather))

    enhanced_full = rgb.copy()
    enhanced_full.paste(enhanced, (left, top))
    out = Image.composite(enhanced_full, rgb, mask)

    # Optional global upscale (applies to the whole composite).
    out = resize_lanczos(out, scale)
    result = merge_alpha(out, _sync_alpha(alpha, out.size))

    report_quality(result, input_path, out_format)
    result.save(output_path, format=PIL_FORMATS[out_format])
    print(f"Enhanced region ({x:.3f},{y:.3f},{w:.3f},{h:.3f}) of "
          f"{os.path.basename(input_path)} -> {os.path.basename(output_path)} ({out_format})")
    return result


def open_input(input_path, out_format):
    """Open and convert the source image for the requested output format."""
    img = Image.open(input_path)
    keep_alpha = out_format not in NO_ALPHA_FORMATS and img.mode in ("RGBA", "LA", "P")
    return img.convert("RGBA" if keep_alpha else "RGB")


def report_quality(img, input_path, out_format):
    """Lightweight sanity check: warn (stderr) about gross artifacts."""
    try:
        small = img.convert("L")
        if small.width * small.height > 2000:
            long_side = max(small.width, small.height)
            small = small.resize((max(1, round(small.width * 256 / long_side)),
                                  max(1, round(small.height * 256 / long_side))), Image.LANCZOS)
        px = list(small.getdata())
        n = max(1, len(px))
        clipped_low = sum(1 for v in px if v < 6)
        clipped_high = sum(1 for v in px if v > 249)
        mean = sum(px) / n
        if clipped_low / n > 0.04 and clipped_high / n > 0.04:
            print(f"Quality warning: heavy clipping both ends ({clipped_low / n:.0%}/{clipped_high / n:.0%}).", file=sys.stderr)
        elif mean < 0.08 * 255:
            print("Quality warning: output is very dark.", file=sys.stderr)
        elif mean > 0.93 * 255:
            print("Quality warning: output is very bright.", file=sys.stderr)
    except Exception:
        pass


def print_auto_report(scores, settings):
    """Human-readable analysis + chosen settings (stdout, captured by backend)."""
    sign = lambda v: f"{'+' if v > 0 else ''}{v}"
    net_brightness = settings["shadow_lift"] - settings["highlight_cut"]
    print("Auto Analysis")
    print(f"Brightness: {scores['brightness']:.2f}")
    print(f"Contrast: {scores['contrast']:.2f}")
    print(f"Saturation: {scores['saturation']:.2f}")
    print(f"Noise: {scores['noise']:.2f}")
    print(f"Detail: {scores['detail']:.2f}")
    print(f"Dynamic range: {scores['dynamic_range']:.2f}")
    print(f"Color cast: {scores['color_cast']:.2f}")
    print(f"Clipping: L {scores['shadow_clip']:.1%} H {scores['highlight_clip']:.1%}")
    print(f"Screenshot-like: {'yes' if scores['is_screenshot'] else 'no'}")
    print()
    print("Selected Settings")
    print(f"Denoise: {settings['denoise']}")
    print(f"Brightness: {sign(round(net_brightness * 100))}")
    print(f"Contrast: {sign(round((settings['contrast_factor'] - 1.0) * 100))}")
    print(f"Saturation: {sign(round((settings['saturation_factor'] - 1.0) * 100))}")
    print(f"Sharpness: {sign(settings['percent'])}")
    print(f"Upscale: {settings['scale']}x")
    contrast_method = "clahe" if settings["use_clahe"] else ("stretch" if settings["stretch_lut"] is not None else "factor")
    print(f"Method: denoise={settings['denoise_label']}, contrast={contrast_method}, "
          f"wb={settings['wb_strength']:.2f}, sharpen=unsharp(lum r={settings['radius']:.1f} t={settings['threshold']})")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def cli_main(argv):
    parser = argparse.ArgumentParser(
        prog="PhotoEnhancer",
        description="Enhance an image (adaptive auto mode or exact manual mode).",
    )
    parser.add_argument("--input", required=True, help="Input image path (png, jpg, jpeg, bmp, tiff, gif, webp).")
    parser.add_argument("--output", required=True, help="Output path. Extension selects the format.")
    parser.add_argument("--auto", type=int, choices=[0, 1], default=1,
                        help="1 = adaptive auto-enhance (default), 0 = exact manual slider values.")
    parser.add_argument("--sharpness", type=float, default=None, help="Manual sharpness 0..2 (1.0 neutral).")
    parser.add_argument("--contrast", type=float, default=None, help="Manual contrast 0..2 (1.0 neutral).")
    parser.add_argument("--saturation", type=float, default=None, help="Manual saturation 0..2 (1.0 neutral).")
    parser.add_argument("--brightness", type=float, default=None, help="Manual brightness 0..2 (1.0 neutral).")
    parser.add_argument("--denoise", type=int, choices=[0, 1, 2], default=None,
                        help="Manual denoise: 0 off, 1 light, 2 strong.")
    parser.add_argument("--scale", type=float, default=None, help="Upscale factor 1..4 (1 = no upscaling).")
    parser.add_argument("--ai-upscale", type=int, choices=[0, 2, 4], default=0,
                        help="AI Real-ESRGAN upscale before enhancement: 0 = off, 2 or 4.")
    parser.add_argument("--region", type=str, default=None,
                        help="Selective enhance: 'x,y,width,height' normalized 0..1. "
                             "Only this rectangle is enhanced.")
    parser.add_argument("--version", action="version", version="PhotoEnhancer CLI 3.1.0")

    args = parser.parse_args(argv)

    if not os.path.isfile(args.input):
        print(f"Error: input file not found: {args.input}", file=sys.stderr)
        return 1

    region = None
    if args.region:
        parts = args.region.split(",")
        if len(parts) != 4:
            print("Error: --region must be 'x,y,width,height'.", file=sys.stderr)
            return 2
        try:
            region = [float(p) for p in parts]
        except ValueError:
            print("Error: --region values must be numbers.", file=sys.stderr)
            return 2

    ext = os.path.splitext(args.output)[1].lower().lstrip(".")
    out_format = ext if ext in PIL_FORMATS else "jpg"
    desired_ext = FORMAT_EXTENSIONS[out_format]
    if os.path.splitext(args.output)[1].lower() != desired_ext:
        args.output = os.path.splitext(args.output)[0] + desired_ext

    try:
        output_dir = os.path.dirname(os.path.abspath(args.output))
        os.makedirs(output_dir, exist_ok=True)

        if region is not None:
            scale = args.scale if args.scale is not None else 1.0
            scale = clamp(float(scale), 1.0, 4.0)
            region_pipeline(
                args.input, args.output, out_format, region,
                auto=(args.auto == 1),
                sharpness=args.sharpness if args.sharpness is not None else 1.0,
                contrast=args.contrast if args.contrast is not None else 1.0,
                saturation=args.saturation if args.saturation is not None else 1.0,
                brightness=args.brightness if args.brightness is not None else 1.0,
                denoise=args.denoise if args.denoise is not None else 0,
                scale=scale,
                ai_scale=args.ai_upscale,
            )
        elif args.auto == 1:
            scale = args.scale if args.scale is not None else 1.0
            scale = clamp(float(scale), 1.0, 4.0)
            auto_pipeline(args.input, args.output, out_format, scale, ai_scale=args.ai_upscale)
        else:
            manual_pipeline(
                args.input, args.output, out_format,
                sharpness=args.sharpness if args.sharpness is not None else 1.0,
                contrast=args.contrast if args.contrast is not None else 1.0,
                saturation=args.saturation if args.saturation is not None else 1.0,
                brightness=args.brightness if args.brightness is not None else 1.0,
                denoise=args.denoise if args.denoise is not None else 0,
                scale=args.scale if args.scale is not None else 1.0,
                ai_scale=args.ai_upscale,
            )
    except Exception as exc:  # keep errors friendly for the backend
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Enhanced {os.path.basename(args.input)} -> {os.path.basename(args.output)} ({out_format})")
    return 0


def main():
    argv = sys.argv[1:]

    # Bare invocation (no arguments) prints usage.
    if not argv:
        print(__doc__)
        return 0

    try:
        sys.exit(cli_main(argv))
    except SystemExit as exc:
        raise exc


if __name__ == "__main__":
    main()
