# -*- coding: utf-8 -*-
"""
Document Scanner test suite
===========================
Synthesises realistic "photographed document" images and verifies the scanner
engine (photo_scanner_cli.py) end to end:

  * automatic corner detection accuracy (vs known ground truth)
  * perspective warp + crop produces the page rectangle
  * all six scan modes produce valid, non-blank output
  * shadow removal reduces uneven lighting
  * black & white mode produces a clean binary document
  * source rotation + corner transform consistency
  * user-supplied corners bypass detection
  * detection failure falls back to a usable default crop
  * multi-page PDF + ZIP generation

Usage:
    python test_scanner.py [photo_scanner_cli.py] [out_dir]
"""

import argparse
import json
import math
import os
import re
import subprocess
import sys
import zipfile

import numpy as np

try:
    import cv2
except Exception:  # pragma: no cover
    cv2 = None

try:
    from PIL import Image
except Exception:  # pragma: no cover
    Image = None

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SCRIPT = os.path.join(HERE, "photo_scanner_cli.py")

FAILURES = 0
CHECKS = 0


def check(name, cond, extra=""):
    global FAILURES, CHECKS
    CHECKS += 1
    if cond:
        print("   -> PASS  %s %s" % (name, extra))
    else:
        FAILURES += 1
        print("   -> FAIL  %s %s" % (name, extra))


# ---------------------------------------------------------------------------
# Synthetic document photo generation
# ---------------------------------------------------------------------------

def make_doc_photo(width=1100, height=1500, seed=11, shadow=True, colored_stamp=True):
    """Build a realistic photo of a document on a desk.

    Returns (photo_bgr, expected_corners) where expected_corners is the ground
    truth page quad (TL, TR, BR, BL) inside the photo, in RGB-pixel space.
    """
    rng = np.random.default_rng(seed)

    # Page geometry inside the (unwarped) canvas.
    pw = int(width * 0.60)
    ph = int(height * 0.72)
    px = int(width * 0.20)
    py = int(height * 0.14)

    # Textured desk background.
    bg = np.full((height, width, 3), 58, np.uint8)
    bg = bg + rng.integers(-12, 13, size=bg.shape, dtype=np.int16)
    vignette_y, vignette_x = np.mgrid[0:height, 0:width].astype(np.float32)
    vx = (vignette_x - width / 2) / (width / 2)
    vy = (vignette_y - height / 2) / (height / 2)
    vignette = np.clip(1.0 - 0.35 * (vx * vx + vy * vy), 0.55, 1.0)[..., None]
    bg = np.clip(bg.astype(np.float32) * vignette, 0, 255).astype(np.uint8)

    # Paper page (slightly warm, subtle texture).
    page = np.full((ph, pw, 3), 250, np.uint8)
    page_i = page.astype(np.int16)
    page_i[..., 0] += rng.integers(-3, 4, size=(ph, pw))
    page_i[..., 1] += rng.integers(-3, 4, size=(ph, pw))
    page_i[..., 2] += rng.integers(-2, 3, size=(ph, pw))
    page = np.clip(page_i, 0, 255).astype(np.uint8)

    # Text rows.
    for i in range(7):
        y = int(ph * (0.10 + i * 0.11))
        cv2.rectangle(page, (int(pw * 0.05), y), (int(pw * 0.95), y + 7), (38, 38, 44), -1)

    # Signature squiggle (handwriting-like strokes).
    pts = [(int(pw * 0.55), int(ph * 0.88))]
    t = 0.0
    while t < 1.0:
        t += 0.02
        pts.append((int(pw * (0.55 + 0.38 * t)), int(ph * (0.88 + 0.03 * math.sin(t * 40)))))
    for i in range(len(pts) - 1):
        cv2.line(page, pts[i], pts[i + 1], (40, 40, 50), 2)

    # Red stamp (coloured information that must survive enhancement).
    # page is a BGR array, so the red stamp uses a low-blue BGR tuple.
    if colored_stamp:
        cv2.circle(page, (int(pw * 0.78), int(ph * 0.20)), int(ph * 0.06), (45, 45, 196), 3)
        cv2.circle(page, (int(pw * 0.78), int(ph * 0.20)), int(ph * 0.05), (45, 45, 196), -1)

    # Phone-style shadow: multiplicative gradient + a diagonal band.
    if shadow:
        xl = np.linspace(1.0, 0.86, pw, dtype=np.float32)[None, :, None]
        yl = np.linspace(1.0, 0.88, ph, dtype=np.float32)[:, None, None]
        band = 1.0 - 0.28 * np.clip(1.0 - np.abs(
            (np.mgrid[0:ph, 0:pw][0] / ph) - 0.62), 0.0, 1.0)[..., None]
        shade = (xl * yl * band)
        page = np.clip(page.astype(np.float32) * shade, 0, 255).astype(np.uint8)

    canvas = bg.copy()
    canvas[py:py + ph, px:px + pw] = page

    # Mild perspective so the page looks photographed at an angle.
    src = np.float32([[0, 0], [width, 0], [width, height], [0, height]])
    dst = np.float32([
        [int(width * 0.05), int(height * 0.06)],
        [int(width * 0.94), int(height * 0.03)],
        [int(width * 0.97), int(height * 0.96)],
        [int(width * 0.06), int(height * 0.97)],
    ])
    matrix = cv2.getPerspectiveTransform(src, dst)
    photo = cv2.warpPerspective(canvas, matrix, (width, height), flags=cv2.INTER_LINEAR)

    page_rect = np.float32([[px, py], [px + pw, py], [px + pw, py + ph], [px, py + ph]])
    expected = cv2.perspectiveTransform(np.array([page_rect]), matrix)[0]
    return photo, expected


def save_rgb(path, rgb):
    Image.fromarray(rgb).save(path)


def run_cli(script, args, timeout=240):
    return subprocess.run(
        [sys.executable, script] + args,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=HERE,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_detection(script, out_dir):
    print("Detection accuracy")
    photo, expected = make_doc_photo()
    path = os.path.join(out_dir, "detect_input.png")
    save_rgb(path, cv2.cvtColor(photo, cv2.COLOR_BGR2RGB))

    r = run_cli(script, ["--detect", path, "--out-json", os.path.join(out_dir, "detect_result.json")])
    check("detect exits 0", r.returncode == 0, "rc=%s" % r.returncode)
    with open(os.path.join(out_dir, "detect_result.json"), encoding="utf-8") as fh:
        data = json.load(fh)
    corners = data.get("corners")
    check("detection produced corners", corners is not None and len(corners) == 4)
    if corners:
        got = np.array(corners, dtype=np.float32)
        err = float(np.abs(got - np.asarray(expected, np.float32)).max())
        tol = max(12.0, 0.03 * min(photo.shape[:2]))
        check("detection within tolerance (max %.1f px vs %.1f px)" % (err, tol), err <= tol)

    # Ordering sanity: TL has the smallest sum, BR the largest.
    if corners:
        s = [c[0] + c[1] for c in corners]
        check("corners ordered TL..BR", int(np.argmin(s)) == 0 and int(np.argmax(s)) == 2)


def test_warp_and_modes(script, out_dir):
    print("Perspective warp + scan modes")
    photo, expected = make_doc_photo(seed=23)
    path = os.path.join(out_dir, "job_input.png")
    save_rgb(path, cv2.cvtColor(photo, cv2.COLOR_BGR2RGB))

    corners = [[float(x), float(y)] for x, y in expected.tolist()]
    modes = ["original", "auto", "bw", "grayscale", "color", "magic"]
    pages = [
        {"input": path, "corners": corners, "rotate": 0, "mode": m}
        for m in modes
    ]
    job = {"outputDir": out_dir, "outputBase": "scan", "format": "png", "pages": pages}
    job_path = os.path.join(out_dir, "warp_job.json")
    with open(job_path, "w", encoding="utf-8") as fh:
        json.dump(job, fh)

    r = run_cli(script, ["--jobs", job_path])
    check("job exits 0", r.returncode == 0, r.stderr.strip()[-200:])

    sizes = {}
    for i, mode in enumerate(modes, start=1):
        p = os.path.join(out_dir, "page-%d.png" % i)
        check("page %d (%s) exists" % (i, mode), os.path.exists(p))
        if os.path.exists(p):
            arr = np.asarray(Image.open(p).convert("RGB"), dtype=np.uint8)
            sizes[mode] = (arr.shape[1], arr.shape[0])
            gray = arr.mean(axis=-1)
            check("page %d (%s) non-blank" % (i, mode), float(gray.std()) > 5.0)
            check("page %d (%s) near-white background" % (i, mode),
                  0.25 < float(gray.mean()) / 255.0 < 0.98)

    if "original" in sizes and "bw" in sizes:
        check("all modes produce same size",
              len({sizes[m] for m in modes}) == 1, str({sizes[m] for m in modes}))
        # Original warped page should be much whiter than the dark desk.
        h, w = Image.open(os.path.join(out_dir, "page-1.png")).size
        check("warped page aspect ~ page aspect",
              abs((h / w) - (0.60 / 0.72)) < 0.25, "%.2f" % (h / w))

    # Binary check on BW output.
    bw = np.asarray(Image.open(os.path.join(out_dir, "page-3.png")).convert("L"), dtype=np.uint8)
    frac = float(((bw < 60) | (bw > 195)).mean())
    check("BW output is clean binary (%.0f%% pure pixels)" % (frac * 100), frac > 0.95)


def test_shadow_removal(script, out_dir):
    print("Shadow removal")
    photo, expected = make_doc_photo(seed=41, shadow=True)
    path = os.path.join(out_dir, "shadow_input.png")
    save_rgb(path, cv2.cvtColor(photo, cv2.COLOR_BGR2RGB))
    corners = [[float(x), float(y)] for x, y in expected.tolist()]

    job = {
        "outputDir": out_dir, "outputBase": "scan", "format": "png",
        "pages": [
            {"input": path, "corners": corners, "rotate": 0, "mode": "original"},
            {"input": path, "corners": corners, "rotate": 0, "mode": "auto"},
        ],
    }
    job_path = os.path.join(out_dir, "shadow_job.json")
    with open(job_path, "w", encoding="utf-8") as fh:
        json.dump(job, fh)
    r = run_cli(script, ["--jobs", job_path])
    check("shadow job exits 0", r.returncode == 0, r.stderr.strip()[-200:])

    def region_mean(page):
        arr = np.asarray(Image.open(os.path.join(out_dir, page)).convert("RGB"), np.uint8)
        g = arr.mean(axis=-1)
        h, w = g.shape
        return float(g[: h // 2, : w // 2].mean()), float(g[h // 2 :, w // 2 :].mean())

    orig_tl, orig_br = region_mean("page-1.png")
    auto_tl, auto_br = region_mean("page-2.png")
    delta_orig = abs(orig_br - orig_tl)
    delta_auto = abs(auto_br - auto_tl)
    check("auto reduces lighting gradient (%.1f -> %.1f)" % (delta_orig, delta_auto),
          delta_auto < 0.5 * delta_orig)
    # Illumination uniformity: downsample the page and look at the residual
    # low-frequency variance (text is averaged out, shadows remain). Shadow
    # removal should flatten this residual.
    def illum_std(page):
        arr = np.asarray(Image.open(os.path.join(out_dir, page)).convert("RGB"), np.uint8)
        g = arr.mean(axis=-1).astype(np.float32)
        small = np.asarray(Image.fromarray(g).resize((16, 16), Image.BILINEAR), np.float32)
        return float(small[4:12, 4:12].std())

    orig_illum = illum_std("page-1.png")
    auto_illum = illum_std("page-2.png")
    check("shadow flattening reduces low-frequency variance (%.1f -> %.1f)" % (orig_illum, auto_illum),
          auto_illum < 0.6 * orig_illum)


def test_grayscale_and_magic(script, out_dir):
    print("Grayscale + Magic")
    photo, expected = make_doc_photo(seed=57)
    path = os.path.join(out_dir, "gs_input.png")
    save_rgb(path, cv2.cvtColor(photo, cv2.COLOR_BGR2RGB))
    corners = [[float(x), float(y)] for x, y in expected.tolist()]
    job = {
        "outputDir": out_dir, "outputBase": "scan", "format": "png",
        "pages": [
            {"input": path, "corners": corners, "rotate": 0, "mode": "grayscale"},
            {"input": path, "corners": corners, "rotate": 0, "mode": "magic"},
        ],
    }
    job_path = os.path.join(out_dir, "gm_job.json")
    with open(job_path, "w", encoding="utf-8") as fh:
        json.dump(job, fh)
    r = run_cli(script, ["--jobs", job_path])
    check("grayscale/magic job exits 0", r.returncode == 0, r.stderr.strip()[-200:])

    gs = np.asarray(Image.open(os.path.join(out_dir, "page-1.png")).convert("RGB"), np.uint8)
    # True neutral gray has identical channel content, so the std deviations of
    # the three channels must match (not be small in absolute terms).
    s0 = gs[..., 0].astype(int).std()
    s1 = gs[..., 1].astype(int).std()
    s2 = gs[..., 2].astype(int).std()
    channel_spread = float(abs(s0 - s1) + abs(s1 - s2) + abs(s0 - s2))
    check("grayscale output is neutral (channel spread %.1f)" % channel_spread, channel_spread < 6.0)

    magic = np.asarray(Image.open(os.path.join(out_dir, "page-2.png")).convert("RGB"), np.uint8)
    mr, mg = magic[..., 0].astype(int), magic[..., 1].astype(int)
    red_px = int(((mr - mg) > 25).sum())
    check("magic preserves the red stamp (%d red px)" % red_px, red_px > 2000)


def test_rotation(script, out_dir):
    print("Source rotation")
    photo, expected = make_doc_photo(seed=73)
    path = os.path.join(out_dir, "rot_input.png")
    save_rgb(path, cv2.cvtColor(photo, cv2.COLOR_BGR2RGB))
    h, w = photo.shape[:2]
    corners = [[float(x), float(y)] for x, y in expected.tolist()]

    rot_corners = rotate_pts(corners, w, h, 90)
    job = {
        "outputDir": out_dir, "outputBase": "scan", "format": "png",
        "pages": [
            {"input": path, "corners": corners, "rotate": 0, "mode": "auto"},
            {"input": path, "corners": rot_corners, "rotate": 90, "mode": "auto"},
        ],
    }
    job_path = os.path.join(out_dir, "rot_job.json")
    with open(job_path, "w", encoding="utf-8") as fh:
        json.dump(job, fh)
    r = run_cli(script, ["--jobs", job_path])
    check("rotation job exits 0", r.returncode == 0, r.stderr.strip()[-200:])

    w0, h0 = Image.open(os.path.join(out_dir, "page-1.png")).size
    w90, h90 = Image.open(os.path.join(out_dir, "page-2.png")).size
    check("90-degree rotation swaps output dimensions (%dx%d -> %dx%d)" % (w0, h0, w90, h90),
          abs(w90 - h0) <= 2 and abs(h90 - w0) <= 2)


def rotate_pts(points, w, h, rot):
    """Rotate corners by `rot` (CW) and reorder so the result stays TL,TR,BR,BL.

    When the image is rotated 90deg CW, the original BL corner becomes the new
    top-left, TR becomes the new bottom-right, etc. Simply transforming the
    point positions without reordering produces a quad whose labelled edges
    (TL->TR, TR->BR, ...) no longer follow the page contour.
    """
    pts = [list(p) for p in points]
    if rot == 90:
        pts = [[h - 1 - y, x] for x, y in pts]
        return [pts[3], pts[0], pts[1], pts[2]]
    if rot == 180:
        pts = [[w - 1 - x, h - 1 - y] for x, y in pts]
        return [pts[2], pts[3], pts[0], pts[1]]
    if rot == 270:
        pts = [[y, w - 1 - x] for x, y in pts]
        return [pts[1], pts[2], pts[3], pts[0]]
    return pts


def test_detection_failure_fallback(script, out_dir):
    print("Detection failure fallback")
    # A completely uniform image has no document boundary.
    rng = np.random.default_rng(3)
    flat = np.full((600, 800, 3), 200, np.uint8)
    flat += rng.integers(0, 3, size=flat.shape, dtype=np.uint8)
    path = os.path.join(out_dir, "flat_input.png")
    save_rgb(path, flat)

    r = run_cli(script, ["--detect", path, "--out-json", os.path.join(out_dir, "flat_detect.json")])
    with open(os.path.join(out_dir, "flat_detect.json"), encoding="utf-8") as fh:
        data = json.load(fh)
    check("uniform image -> corners null", data.get("corners") is None)

    # A job with no corners on a normal photo should fall back to a crop.
    photo, _expected = make_doc_photo(seed=91)
    path2 = os.path.join(out_dir, "fallback_input.png")
    save_rgb(path2, cv2.cvtColor(photo, cv2.COLOR_BGR2RGB))
    job = {
        "outputDir": out_dir, "outputBase": "scan", "format": "png",
        "pages": [{"input": path2, "corners": None, "rotate": 0, "mode": "auto"}],
    }
    job_path = os.path.join(out_dir, "fallback_job.json")
    with open(job_path, "w", encoding="utf-8") as fh:
        json.dump(job, fh)
    r = run_cli(script, ["--jobs", job_path])
    check("fallback job exits 0", r.returncode == 0, r.stderr.strip()[-200:])
    check("fallback produced output", os.path.exists(os.path.join(out_dir, "page-1.png")))


def test_pdf_and_zip(script, out_dir):
    print("PDF + ZIP export")
    photos = [make_doc_photo(seed=s) for s in (101, 102, 103)]
    pages = []
    for i, (photo, expected) in enumerate(photos, start=1):
        p = os.path.join(out_dir, "pdf_input_%d.png" % i)
        save_rgb(p, cv2.cvtColor(photo, cv2.COLOR_BGR2RGB))
        pages.append({
            "input": p,
            "corners": [[float(x), float(y)] for x, y in expected.tolist()],
            "rotate": 0,
            "mode": "auto",
        })
    job = {"outputDir": out_dir, "outputBase": "scan", "format": "jpg", "pages": pages}
    job_path = os.path.join(out_dir, "pdf_job.json")
    with open(job_path, "w", encoding="utf-8") as fh:
        json.dump(job, fh)
    r = run_cli(script, ["--jobs", job_path])
    check("pdf job exits 0", r.returncode == 0, r.stderr.strip()[-200:])

    pdf_path = os.path.join(out_dir, "scan.pdf")
    check("pdf exists", os.path.exists(pdf_path))
    if os.path.exists(pdf_path):
        with open(pdf_path, "rb") as fh:
            pdf_bytes = fh.read()
        check("pdf has valid header", pdf_bytes[:5] == b"%PDF-")
        check("pdf size reasonable", 3000 < len(pdf_bytes) < 50 * 1024 * 1024, "%d bytes" % len(pdf_bytes))
        page_objects = len(re.findall(rb"/Type\s*/Page[^s]", pdf_bytes))
        check("pdf has 3 pages (found %d page objects)" % page_objects, page_objects == 3)

    zip_path = os.path.join(out_dir, "scan.zip")
    check("zip exists", os.path.exists(zip_path))
    if os.path.exists(zip_path):
        with zipfile.ZipFile(zip_path) as zf:
            names = sorted(zf.namelist())
        check("zip contains 3 pages", names == ["page-1.jpg", "page-2.jpg", "page-3.jpg"], str(names))


def test_cli_contract(script, out_dir):
    print("CLI contract")
    r = run_cli(script, ["--version"])
    check("--version prints version", r.returncode == 0 and "PhotoScanner" in r.stdout)

    r = run_cli(script, [])
    check("no args -> usage exit code 2", r.returncode == 2)


def main():
    parser = argparse.ArgumentParser(description="Document Scanner test suite")
    parser.add_argument("script", nargs="?", default=DEFAULT_SCRIPT, help="path to photo_scanner_cli.py")
    parser.add_argument("out_dir", nargs="?", default=os.path.join(HERE, "test_scanner_out"))
    args = parser.parse_args()

    if cv2 is None or Image is None:
        print("OpenCV and Pillow are required to run the scanner tests.")
        sys.exit(1)

    os.makedirs(args.out_dir, exist_ok=True)

    test_cli_contract(args.script, args.out_dir)
    test_detection(args.script, args.out_dir)
    test_warp_and_modes(args.script, args.out_dir)
    test_shadow_removal(args.script, args.out_dir)
    test_grayscale_and_magic(args.script, args.out_dir)
    test_rotation(args.script, args.out_dir)
    test_detection_failure_fallback(args.script, args.out_dir)
    test_pdf_and_zip(args.script, args.out_dir)

    print("\n%d checks, %d failures" % (CHECKS, FAILURES))
    sys.exit(1 if FAILURES else 0)


if __name__ == "__main__":
    main()
