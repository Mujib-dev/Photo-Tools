# -*- coding: utf-8 -*-
"""
Photo Enhancer — category test suite (v3: old vs new comparison)
================================================================
Generates synthetic images for 12 categories, then runs BOTH:

  * the previous-release auto engine (embedded copy, "current"), and
  * the new adaptive auto engine (the CLI under test)

and compares objective metrics (brightness, contrast, saturation, noise,
detail, clipping) so the new algorithm can be verified against the old one.

Usage:
    python test_enhancer.py <cli_py_or_exe> [output_dir]

Examples:
    python test_enhancer.py photo_enhancer_cli.py
    python test_enhancer.py ..\\bin\\PhotoEnhancer.exe
"""

import os
import sys
import math
import subprocess
import random

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

try:
    import numpy as np
    import cv2
    HAVE_CV2 = True
except Exception:
    HAVE_CV2 = False

random.seed(42)

CATEGORIES = [
    "dark_photo",
    "bright_photo",
    "low_contrast_photo",
    "oversaturated_photo",
    "desaturated_photo",
    "noisy_photo",
    "clean_photo",
    "portrait",
    "landscape",
    "screenshot",
    "small_image",
    "large_image",
]

# ---------------------------------------------------------------------------
# Synthetic image generators
# ---------------------------------------------------------------------------

def _detail_texture(w, h, amplitude=18.0, frequency=7.0):
    """Smooth pseudo-scene detail (gradients + ripples + soft shapes)."""
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            n = 0.5 + 0.5 * math.sin(frequency * x / w * 3.1415)
            m = 0.5 + 0.5 * math.sin(frequency * y / h * 3.1415 + 1.0)
            r = int(120 + amplitude * n * m)
            g = int(110 + amplitude * n)
            b = int(140 + amplitude * m)
            px[x, y] = (r, g, b)
    draw = ImageDraw.Draw(img)
    for i in range(14):
        cx = random.randint(0, w)
        cy = random.randint(0, h)
        rad = random.randint(12, 60)
        color = (
            random.randint(0, 255),
            random.randint(0, 255),
            random.randint(0, 255),
        )
        draw.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), outline=color, width=3)
    return img


def _make_scene(w, h):
    """Sky->ground gradient with a bright sun blob and detail."""
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / h
        sky = (90 + 60 * t, 130 + 40 * t, 200 - 60 * t)
        for x in range(w):
            detail = 8 * math.sin(x / 7.0) * math.cos(y / 9.0)
            if (x - w * 0.75) ** 2 + (y - h * 0.2) ** 2 < (w * 0.12) ** 2:
                base = (250, 240, 200)
            else:
                base = sky
            px[x, y] = tuple(max(0, min(255, int(c + detail))) for c in base)
    return img


def generate(category, w, h):
    if category == "dark_photo":
        return _make_scene(w, h).point(lambda v: v * 0.45)
    if category == "bright_photo":
        return _make_scene(w, h).point(lambda v: min(255, int(v * 1.6)))
    if category == "low_contrast_photo":
        img = _make_scene(w, h)
        return ImageEnhance.Contrast(img).enhance(0.25)
    if category == "oversaturated_photo":
        return ImageEnhance.Color(_make_scene(w, h)).enhance(2.2)
    if category == "desaturated_photo":
        return ImageEnhance.Color(_make_scene(w, h)).enhance(0.15)
    if category == "noisy_photo":
        base = _make_scene(w, h).convert("L").convert("RGB")
        noise = Image.effect_noise((w, h), 34).convert("L")
        return Image.blend(base, noise.convert("RGB"), 0.30)
    if category == "clean_photo":
        return _make_scene(w, h).filter(ImageFilter.GaussianBlur(0.4))
    if category == "portrait":
        img = _detail_texture(w, h, amplitude=12.0)
        draw = ImageDraw.Draw(img, "RGBA")
        cx, cy = w // 2, int(h * 0.45)
        r = int(h * 0.28)
        for i in range(30, 0, -1):
            alpha = int(26)
            draw.ellipse(
                (cx - r * i / 30, cy - r * i / 30, cx + r * i / 30, cy + r * i / 30),
                fill=(245, 208, 175, alpha),
            )
        draw.rectangle((w // 3, int(h * 0.8), w * 2 // 3, h), fill=(60, 70, 120, 255))
        return img
    if category == "landscape":
        return _make_scene(w, h)
    if category == "screenshot":
        img = Image.new("RGB", (w, h), (245, 246, 250))
        draw = ImageDraw.Draw(img)
        draw.rectangle((0, 0, w, int(h * 0.12)), fill=(30, 33, 48))
        draw.rectangle((int(w * 0.05), int(h * 0.2), int(w * 0.55), int(h * 0.9)), fill=(255, 255, 255), outline=(200, 205, 215))
        draw.rectangle((int(w * 0.6), int(h * 0.2), int(w * 0.95), int(h * 0.55)), fill=(220, 226, 240))
        for row, label in enumerate(["Settings", "Account", "Help"]):
            draw.text((int(w * 0.07), int(h * 0.28) + row * int(h * 0.08)), label, fill=(40, 44, 60))
        draw.text((int(w * 0.62), int(h * 0.3)), "Status: Ready", fill=(40, 44, 60))
        return img
    if category == "small_image":
        return _detail_texture(64, 48, amplitude=16.0)
    if category == "large_image":
        return _make_scene(w, h)
    return _make_scene(w, h)


# ---------------------------------------------------------------------------
# Objective metrics (on a downscaled working copy)
# ---------------------------------------------------------------------------

def metrics(path):
    """Brightness, contrast, saturation, noise, detail, clipping, dims."""
    img = Image.open(path).convert("RGB")
    w, h = img.size
    long_side = max(w, h)
    if long_side > 512:
        img = img.resize((max(1, round(w * 512 / long_side)), max(1, round(h * 512 / long_side))), Image.LANCZOS)
    arr = np.asarray(img, dtype=np.uint8)
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    g = gray.astype(np.float32) / 255.0

    mean = float(g.mean())
    contrast = float(g.std())
    p2, p98 = np.percentile(gray, [2, 98])
    dyn = float((p98 - p2) / 255.0)
    hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)
    sat = float(hsv[:, :, 1].mean() / 255.0)

    ksize = 5
    blur = cv2.boxFilter(g, -1, (ksize, ksize))
    blur_sq = cv2.boxFilter(g * g, -1, (ksize, ksize))
    local_std = np.sqrt(np.maximum(blur_sq - blur * blur, 0.0))
    noise = max(0.0, min(1.0, float(np.percentile(local_std, 25) * 255.0 / 12.0)))

    smooth = cv2.bilateralFilter(gray, 7, 30, 7)
    lap = cv2.Laplacian(smooth, cv2.CV_64F)
    detail = max(0.0, min(1.0, float(lap.var()) / 900.0))

    low = float((gray < 8).mean())
    high = float((gray > 247).mean())

    return {
        "dims": (w, h),
        "mean": mean,
        "contrast": contrast,
        "sat": sat,
        "noise": noise,
        "detail": detail,
        "dyn": dyn,
        "low": low,
        "high": high,
    }


# ---------------------------------------------------------------------------
# Previous-release ("current") auto engine — faithful embedded copy
# ---------------------------------------------------------------------------

def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def _legacy_brightness_lut(factor):
    x = [i / 255.0 for i in range(256)]
    if factor >= 1.0:
        gamma = _clamp(1.0 - (factor - 1.0) * 0.7, 0.78, 1.0)
        lin = _clamp(1.0 + (factor - 1.0) * 0.4, 1.0, 1.12)
        y = [lin * (v ** gamma) for v in x]
    else:
        y = [v * factor for v in x]
    return bytes(round(_clamp(v, 0.0, 1.0) * 255) for v in y)


def _legacy_stretch_lut(gray_pixels):
    lo, hi = 2, 253
    p1 = int(np.percentile(gray_pixels, 1))
    p99 = int(np.percentile(gray_pixels, 99))
    if p99 - p1 < 45:
        return None
    span = max(1, p99 - p1)
    x = [i for i in range(256)]
    y = [lo + (hi - lo) * (i - p1) / span if p1 <= i <= p99 else (lo if i < p1 else hi) for i in x]
    return bytes(round(_clamp(v, 0.0, 255.0)) for v in y)


def _legacy_shared_lut(img, lut256):
    if img.mode == "L":
        return img.point(lut256)
    bands = img.split()
    mapped = [b.point(lut256) if b.mode == "L" else b for b in bands]
    return Image.merge(img.mode, mapped)


def _legacy_derive(scores, requested_scale):
    brightness = scores["brightness"]
    contrast = scores["contrast"]
    saturation = scores["saturation"]
    noise = scores["noise"]
    detail = scores["detail"]
    p_range = scores["dynamic_range"]

    if brightness < 0.36:
        b_factor = _clamp(0.50 / brightness, 1.04, 1.30)
    elif brightness > 0.62:
        b_factor = _clamp(0.55 / brightness, 0.80, 0.98)
    else:
        b_factor = 1.01
    if scores.get("_p98", 0.97) > 0.97 and b_factor > 1.0:
        b_factor = b_factor + (1.0 - b_factor) * 0.7
    if scores.get("_p2", 0.03) < 0.02 and b_factor < 1.0:
        b_factor = b_factor + (1.0 - b_factor) * 0.7

    if contrast < 0.32:
        c_factor = _clamp(0.40 / max(contrast, 0.12), 1.02, 1.28)
        stretch = p_range < 0.45
    elif contrast > 0.62:
        c_factor = _clamp(0.55 / max(contrast, 0.5), 0.82, 1.0)
        stretch = False
    else:
        c_factor = 1.05
        stretch = False

    if saturation < 0.16:
        s_factor = _clamp(0.28 / max(saturation, 0.05), 1.0, 1.32)
    elif saturation > 0.46:
        s_factor = _clamp(0.34 / max(saturation, 0.4), 0.78, 0.98)
    else:
        s_factor = 1.03

    if noise < 0.08:
        d_level = 0
    elif noise < 0.18:
        d_level = 1
    elif noise < 0.30:
        d_level = 2
    else:
        d_level = 3
    if detail > 0.65:
        d_level = min(d_level, 1)

    if detail < 0.22:
        radius, percent = 1.4, 95
    elif detail < 0.45:
        radius, percent = 1.1, 60
    else:
        radius, percent = 0.9, 38
    threshold = 4
    if noise > 0.25:
        percent = int(percent * 0.5)
        threshold = 6
    if requested_scale > 1.0:
        percent = min(percent + 30, 130)
        radius = max(radius, 1.3)

    return {
        "brightness_factor": b_factor,
        "contrast_factor": c_factor,
        "saturation_factor": s_factor,
        "denoise": d_level,
        "stretch": stretch,
        "radius": radius,
        "percent": percent,
        "threshold": threshold,
        "scale": requested_scale,
    }


def _legacy_denoise(img, level):
    if level <= 0:
        return img
    if level == 1:
        return img.filter(ImageFilter.MedianFilter(size=3))
    if level == 2 and HAVE_CV2 and max(img.size) <= 1600:
        arr = np.asarray(img.convert("RGB"), dtype=np.uint8)
        bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        out = cv2.fastNlMeansDenoisingColored(bgr, None, h=6, hColor=6, templateWindowSize=7, searchWindowSize=21)
        return Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
    if level == 3 and HAVE_CV2 and max(img.size) <= 1600:
        arr = np.asarray(img.convert("RGB"), dtype=np.uint8)
        bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        out = cv2.fastNlMeansDenoisingColored(bgr, None, h=10, hColor=10, templateWindowSize=7, searchWindowSize=21)
        return Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
    return img.filter(ImageFilter.MedianFilter(size=5))


def legacy_enhance(src_path, dst_path):
    """Previous-release auto pipeline (v2 engine), written to dst_path as PNG."""
    img = Image.open(src_path).convert("RGB")

    work = img.copy()
    long_side = max(work.size)
    if long_side > 512:
        w, h = work.size
        work = work.resize((max(1, round(w * 512 / long_side)), max(1, round(h * 512 / long_side))), Image.LANCZOS)
    arr = np.asarray(work, dtype=np.uint8)
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    g = gray.astype(np.float32) / 255.0
    p2, p98 = np.percentile(gray, [2, 98])
    scores = {
        "brightness": _clamp(float(g.mean()), 0.0, 1.0),
        "contrast": _clamp(float(g.std()) / 0.45, 0.0, 1.0),
        "saturation": _clamp(float(cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)[:, :, 1].mean() / 255.0), 0.0, 1.0),
        "noise": 0.0,
        "detail": 0.0,
        "dynamic_range": _clamp(float((p98 - p2) / 255.0), 0.0, 1.0),
        "_p2": float(p2 / 255.0),
        "_p98": float(p98 / 255.0),
    }
    settings = _legacy_derive(scores, 1.0)

    stretch_lut = None
    if settings["stretch"] and HAVE_CV2:
        stretch_lut = _legacy_stretch_lut(np.asarray(img.convert("L"), dtype=np.uint8))

    img = _legacy_denoise(img, settings["denoise"])
    img = _legacy_shared_lut(img, _legacy_brightness_lut(settings["brightness_factor"]))
    if stretch_lut is not None:
        img = _legacy_shared_lut(img, stretch_lut)
    if settings["contrast_factor"] != 1.0:
        img = ImageEnhance.Contrast(img).enhance(settings["contrast_factor"])
    if settings["saturation_factor"] != 1.0:
        img = ImageEnhance.Color(img).enhance(settings["saturation_factor"])
    img = img.filter(ImageFilter.UnsharpMask(radius=settings["radius"], percent=settings["percent"], threshold=settings["threshold"]))
    img.save(dst_path, format="PNG")
    return settings


# ---------------------------------------------------------------------------
# CLI runner + guards
# ---------------------------------------------------------------------------

def run_cli(cli, args):
    if cli.lower().endswith(".exe"):
        return subprocess.run([cli, *args], capture_output=True, text=True)
    return subprocess.run([sys.executable, cli, *args], capture_output=True, text=True)


def fmt(v, width=6):
    return f"{v:{width}.2f}"


def main():
    if len(sys.argv) < 2:
        print("usage: python test_enhancer.py <cli_py_or_exe> [output_dir]")
        return 1
    cli = os.path.abspath(sys.argv[1])
    out_dir = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(os.path.dirname(cli), "test_out")
    os.makedirs(out_dir, exist_ok=True)

    print(f"CLI: {cli}\nOutput: {out_dir}\n")

    # Expectation table: (category, check_fn(im, legacy, new))
    expectations = {
        "dark_photo": ("mean up by >= .04", lambda im, l, n: n["mean"] - im["mean"] >= 0.04),
        "bright_photo": ("mean down by >= .03", lambda im, l, n: im["mean"] - n["mean"] >= 0.03),
        "low_contrast_photo": ("contrast up by >= .015", lambda im, l, n: n["contrast"] - im["contrast"] >= 0.015),
        "oversaturated_photo": ("sat down by >= .02", lambda im, l, n: im["sat"] - n["sat"] >= 0.02),
        "desaturated_photo": ("sat up by >= .01", lambda im, l, n: n["sat"] - im["sat"] >= 0.01),
        "noisy_photo": ("noise down >= .05 & 25%", lambda im, l, n: (im["noise"] - n["noise"] >= 0.05) and n["noise"] < im["noise"] * 0.75),
        "clean_photo": ("detail preserved >= 80%", lambda im, l, n: n["detail"] >= im["detail"] * 0.8),
        "portrait": ("sat not doubled", lambda im, l, n: n["sat"] <= im["sat"] * 1.4 + 0.05),
        "landscape": ("mean sane", lambda im, l, n: 0.20 < n["mean"] < 0.85),
        "screenshot": ("sat near-neutral", lambda im, l, n: abs(n["sat"] - im["sat"]) < 0.05),
        "small_image": ("4x upscale", lambda im, l, n: n["dims"][0] == im["dims"][0] * 4 and n["dims"][1] == im["dims"][1] * 4),
        "large_image": ("no resize", lambda im, l, n: n["dims"] == im["dims"]),
    }

    # Categories where strong contrast/brightness correction legitimately
    # amplifies structure — the "noise" metric is not a fair guard there.
    NOISE_GUARD_SKIP = {"dark_photo", "bright_photo", "low_contrast_photo", "desaturated_photo"}

    print(f"{'category':<20} {'metric':>26} {'input':>7} {'legacy':>7} {'new':>7}   check")
    print("-" * 92)

    failures = 0
    for category in CATEGORIES:
        if category == "large_image":
            w, h = 4096, 2732
        else:
            w, h = 800, 600
        src = os.path.join(out_dir, f"{category}_in.png")
        dst_new = os.path.join(out_dir, f"{category}_auto.png")
        dst_leg = os.path.join(out_dir, f"{category}_legacy.png")
        generate(category, w, h).save(src)

        im = metrics(src)

        result = run_cli(cli, ["--input", src, "--output", dst_new])
        if result.returncode != 0 or not os.path.exists(dst_new):
            print(f"{category:<20} {'RUN':>26} {'':>7} {'':>7} {'FAILED':>7}   {result.stderr.strip()[:80]}")
            failures += 1
            continue
        new = metrics(dst_new)
        try:
            legacy_enhance(src, dst_leg)
            leg = metrics(dst_leg)
        except Exception as exc:  # pragma: no cover
            leg = im
            print(f"   legacy engine failed for {category}: {exc}")

        # metric comparison rows (brightness, contrast, sat, noise, detail, clip)
        rows = [
            ("brightness", "mean", lambda m: m["mean"], lambda im, l, n: True),
            ("contrast", "std", lambda m: m["contrast"], lambda im, l, n: True),
            ("saturation", "sat", lambda m: m["sat"], lambda im, l, n: True),
            ("noise", "noise", lambda m: m["noise"], lambda im, l, n: True),
            ("detail", "lap var", lambda m: m["detail"], lambda im, l, n: True),
        ]
        print(f"{category:<20}")
        for label, unit, get, _ in rows:
            print(f"{'':<20} {label + ' (' + unit + ')':>26} {fmt(get(im)):>7} {fmt(get(leg)):>7} {fmt(get(new)):>7}")
        clip_in, clip_leg, clip_new = im["low"] + im["high"], leg["low"] + leg["high"], new["low"] + new["high"]
        print(f"{'':<20} {'clipping (low+high)':>26} {clip_in:>7.2%} {clip_leg:>7.2%} {clip_new:>7.2%}")

        report = "\n".join(line for line in result.stdout.splitlines() if line.strip())
        print("   " + report.replace("\n", "\n   "))

        # universal sanity guards
        guard_msgs = []
        if not (0.05 <= new["mean"] <= 0.96):
            guard_msgs.append(f"mean {new['mean']:.2f} out of sane range")
        if clip_new > 0.30 and category != "screenshot":
            guard_msgs.append(f"high combined clipping ({clip_new:.0%})")
        if new["noise"] > im["noise"] * 1.5 + 0.03 and category not in NOISE_GUARD_SKIP:
            guard_msgs.append(f"noise increased ({im['noise']:.2f}->{new['noise']:.2f})")
        if clip_new > clip_leg + 0.05:
            guard_msgs.append(f"clipping worse than legacy ({clip_leg:.0%}->{clip_new:.0%})")
        if new["sat"] > 0.95 or (im["sat"] >= 0.02 and new["sat"] < 0.02):
            guard_msgs.append(f"saturation {new['sat']:.2f} out of range")

        label, check = expectations.get(category, ("none", lambda im, l, n: True))
        passed = check(im, leg, new) and not guard_msgs
        status = "PASS" if passed else "FAIL"
        if not passed:
            failures += 1
        print(f"   check[{label}]: {'OK' if check(im, leg, new) else 'FAIL'}")
        for msg in guard_msgs:
            print(f"   WARN: {msg}")
        print(f"   -> {status}\n")

    print("FAILURES:", failures)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
