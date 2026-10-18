# -*- coding: utf-8 -*-
"""
Document Scanner (CLI) — classic computer-vision document scanning
==================================================================
Deterministic, CPU-friendly document scanner built on Pillow + OpenCV + numpy,
exposed as a CLI so the web app can drive it reliably.

Two subcommands:

  --detect <input> [--out-json <file>] [--rotate 0|90|180|270]
      Detects the four document corners in the input photo and writes the
      result as JSON:  {"corners": [[x,y], [x,y], [x,y], [x,y]]}
      or {"corners": null} when no confident document boundary was found.
      Corners are returned in the rotated (EXIF-transposed) pixel space and
      are ordered top-left, top-right, bottom-right, bottom-left.

  --jobs <jobs.json>
      Processes a batch of document pages. The jobs file carries per-page
      input paths, optional user-adjusted corners, rotation and scan mode:

        {
          "outputDir": "S:/.../output",
          "outputBase": "scan",
          "format": "png",                    // jpg | png | webp
          "pages": [
            { "input": "S:/.../input/a.jpg",  // absolute path
              "corners": [[x,y], [x,y], [x,y], [x,y]] | null,
              "rotate": 0,                    // 0 | 90 | 180 | 270 (source)
              "mode": "auto" }                // see scan modes below
          ]
        }

      For every page the engine:
          open (EXIF-transposed) -> rotate source -> detect corners (or use
          the supplied ones) -> perspective warp + crop -> scan enhancement ->
          save page-N.<ext>
      and additionally writes:
          scan.pdf   (multi-page PDF, JPEG-compressed pages, ~150 dpi)
          pages.zip  (ZIP of the enhanced page images)

Scan modes:
    original   natural, no enhancement
    auto       adaptive document cleanup (shadow removal, contrast, sharpen)
    bw         clean monochrome document — pure white paper, solid black ink
    grayscale  grayscale scan with enhanced readability
    color      preserve colours while improving readability
    magic      aggressive background whitening, colour and contrast boost

Exit codes:
    0  success
    2  usage / argument error
    1  processing error
"""

import argparse
import json
import math
import os
import sys
import zipfile

from PIL import Image, ImageOps

# ---------------------------------------------------------------------------
# Optional acceleration libraries
# ---------------------------------------------------------------------------

try:
    import numpy as _np
    import cv2 as _cv2
    HAVE_CV2 = True
except Exception:  # pragma: no cover
    _np = None
    _cv2 = None
    HAVE_CV2 = False

if not HAVE_CV2:
    sys.stderr.write("Document Scanner requires OpenCV (cv2) and numpy.\n")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DETECT_MAX_SIDE = 1280.0   # detection working copy long side (px)
DETECT_MIN_AREA = 0.030    # minimum contour area fraction for a confident hit
WARP_MAX_SIDE = 2600       # cap on the long side of a warped page
ILLUM_MAX_SIDE = 1200      # illumination estimate working copy long side

ROTATE_CV = {
    90: _cv2.ROTATE_90_CLOCKWISE,
    180: _cv2.ROTATE_180,
    270: _cv2.ROTATE_90_COUNTERCLOCKWISE,
}

PIL_FORMATS = {"jpg": "JPEG", "jpeg": "JPEG", "png": "PNG", "webp": "WEBP"}
OUTPUT_EXTS = {"jpg": ".jpg", "jpeg": ".jpg", "png": ".png", "webp": ".webp"}

MODES = ("original", "auto", "bw", "grayscale", "color", "magic", "removebg")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clamp(value, low, high):
    return max(low, min(high, value))


def to_np_rgb(img):
    """Convert a PIL RGB image to a uint8 numpy array (HxWx3, RGB order)."""
    return _np.asarray(img.convert("RGB"), dtype=_np.uint8)


def from_np_rgb(arr):
    return Image.fromarray(_np.ascontiguousarray(arr))


def load_source(path):
    """Open an image, transpose it by EXIF orientation, return PIL RGB."""
    with Image.open(path) as raw:
        img = raw.copy()
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    return img.convert("RGB")


def rotate_source(rgb, rot):
    """Rotate a source image by 0/90/180/270 degrees clockwise."""
    code = ROTATE_CV.get(int(rot))
    if code is None or int(rot) % 360 == 0:
        return rgb
    return _cv2.rotate(rgb, code)


def rotate_points(points, w, h, rot):
    """Rotate corner points to match rotate_source of a WxH image.

    Transforms positions and reorders so the result stays TL,TR,BR,BL: rotating
    the image 90deg CW moves the original BL corner to the new top-left, TR to
    the new bottom-right, etc.
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


# ---------------------------------------------------------------------------
# Corner detection
# ---------------------------------------------------------------------------

def _order_points(pts):
    """Order 4 points as top-left, top-right, bottom-right, bottom-left."""
    pts = _np.asarray(pts, dtype=_np.float32).reshape(4, 2)
    rect = _np.zeros((4, 2), dtype=_np.float32)
    s = pts.sum(axis=1)
    d = _np.diff(pts, axis=1).ravel()
    rect[0] = pts[_np.argmin(s)]
    rect[2] = pts[_np.argmax(s)]
    rect[1] = pts[_np.argmin(d)]
    rect[3] = pts[_np.argmax(d)]
    return rect


def _quad_from_contour(cnt):
    """Return an ordered float32 4x2 quadrilateral from a contour, or None."""
    if cnt is None or len(cnt) < 4:
        return None
    peri = _cv2.arcLength(cnt, True)
    if peri <= 0:
        return None
    approx = _cv2.approxPolyDP(cnt, 0.02 * peri, True)
    if len(approx) == 4 and _cv2.isContourConvex(approx):
        return _order_points(approx.reshape(4, 2))
    # Relaxed fit for slightly rounded corners.
    approx = _cv2.approxPolyDP(cnt, 0.035 * peri, True)
    if len(approx) == 4 and _cv2.isContourConvex(approx):
        return _order_points(approx.reshape(4, 2))
    # Last resort: tightest rotated rectangle.
    if len(cnt) >= 4:
        rect = _cv2.minAreaRect(cnt)
        return _order_points(_cv2.boxPoints(rect))
    return None


def _quad_area(quad):
    return 0.5 * abs(
        quad[0, 0] * quad[1, 1] + quad[1, 0] * quad[2, 1]
        + quad[2, 0] * quad[3, 1] + quad[3, 0] * quad[0, 1]
        - quad[1, 0] * quad[0, 1] - quad[2, 0] * quad[1, 1]
        - quad[3, 0] * quad[2, 1] - quad[0, 0] * quad[3, 1]
    )


def _valid_quad(quad, h, w):
    """Reject quads that are too small, non-convex, or outside the image."""
    if quad is None:
        return False
    if _quad_area(quad) < DETECT_MIN_AREA * w * h:
        return False
    x = quad[:, 0]
    y = quad[:, 1]
    if float(x.min()) < -0.02 * w or float(x.max()) > 1.02 * w + 1:
        return False
    if float(y.min()) < -0.02 * h or float(y.max()) > 1.02 * h + 1:
        return False
    return True


def _touches_border(quad, h, w):
    """True when the quad runs into the image edge (likely not the page)."""
    x = quad[:, 0]
    y = quad[:, 1]
    return float(x.min()) <= 3 or float(x.max()) >= w - 4 \
        or float(y.min()) <= 3 or float(y.max()) >= h - 4


def _is_full_frame(quad, h, w):
    """True when the quad covers (almost) the whole image — a border, not a page."""
    return _quad_area(quad) >= 0.995 * w * h


def detect_corners(rgb):
    """Detect the four document corners; returns 4x2 float array or None."""
    h, w = rgb.shape[:2]
    if h < 40 or w < 40:
        return None

    scale = min(1.0, DETECT_MAX_SIDE / max(h, w))
    small = rgb
    if scale < 1.0:
        small = _cv2.resize(
            rgb, (int(round(w * scale)), int(round(h * scale))),
            interpolation=_cv2.INTER_AREA,
        )
    sh, sw = small.shape[:2]
    gray = _cv2.cvtColor(small, _cv2.COLOR_RGB2GRAY)
    blurred = _cv2.GaussianBlur(gray, (5, 5), 0)

    best = None
    best_area = 0.0
    fallback = None
    fallback_area = 0.0

    def consider(cnt, factor):
        nonlocal best, best_area, fallback, fallback_area
        quad = _quad_from_contour(cnt)
        if not _valid_quad(quad, sh, sw):
            return
        if _is_full_frame(quad, sh, sw):
            return
        pts = quad.reshape(4, 2)
        a = _cv2.contourArea(cnt) if len(cnt) >= 4 else 0.0
        score = a * factor
        if _touches_border(quad, sh, sw):
            if score > fallback_area:
                fallback_area = score
                fallback = quad
            return
        if score > best_area:
            best_area = score
            best = quad

    def feed_contours(contours):
        for cnt in sorted(contours, key=_cv2.contourArea, reverse=True)[:12]:
            consider(cnt, 1.0)
        return best is not None

    # Strategy 1 (highest priority): adaptive threshold binarisation. This
    # segments the page region directly and handles uneven lighting well.
    thresh = _cv2.adaptiveThreshold(
        blurred, 255, _cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        _cv2.THRESH_BINARY_INV, 21, 10,
    )
    thresh = _cv2.morphologyEx(thresh, _cv2.MORPH_CLOSE, _np.ones((5, 5), dtype=_np.uint8))
    contours, _ = _cv2.findContours(thresh, _cv2.RETR_LIST, _cv2.CHAIN_APPROX_SIMPLE)
    if not feed_contours(contours):
        # Strategy 2: strong edges, largest quadrilateral.
        edges = _cv2.Canny(blurred, 50, 150)
        edges = _cv2.dilate(edges, _np.ones((3, 3), dtype=_np.uint8), iterations=2)
        contours, _ = _cv2.findContours(edges, _cv2.RETR_LIST, _cv2.CHAIN_APPROX_SIMPLE)
        if not feed_contours(contours):
            # Strategy 3: Otsu binarisation (holes included).
            _, otsu = _cv2.threshold(blurred, 0, 255, _cv2.THRESH_BINARY_INV + _cv2.THRESH_OTSU)
            contours, _ = _cv2.findContours(otsu, _cv2.RETR_LIST, _cv2.CHAIN_APPROX_SIMPLE)
            feed_contours(contours)

    if best is None:
        best = fallback

    if best is None:
        return None

    if scale < 1.0:
        best = best * (1.0 / scale)
    return _np.clip(best, 0, _np.array([w - 1, h - 1], dtype=_np.float32))


# ---------------------------------------------------------------------------
# Perspective correction
# ---------------------------------------------------------------------------

def warp_perspective(rgb, corners):
    """Warp + crop the quadrilateral defined by `corners` to a rectangle."""
    h, w = rgb.shape[:2]
    src = _np.asarray(corners, dtype=_np.float32).reshape(4, 2)
    src = _np.clip(src, 0, _np.array([w - 1, h - 1], dtype=_np.float32))

    def dist(a, b):
        return float(_np.linalg.norm(a - b))

    top = dist(src[1], src[0])
    bottom = dist(src[2], src[3])
    left = dist(src[3], src[0])
    right = dist(src[2], src[1])

    out_w = int(round(max(2.0, top, bottom)))
    out_h = int(round(max(2.0, left, right)))

    max_side = max(out_w, out_h)
    if max_side > WARP_MAX_SIDE:
        s = WARP_MAX_SIDE / float(max_side)
        out_w = int(round(out_w * s))
        out_h = int(round(out_h * s))
    out_w = max(2, out_w)
    out_h = max(2, out_h)

    dst = _np.array(
        [[0, 0], [out_w - 1, 0], [out_w - 1, out_h - 1], [0, out_h - 1]],
        dtype=_np.float32,
    )
    matrix = _cv2.getPerspectiveTransform(src, dst)
    warped = _cv2.warpPerspective(
        rgb, matrix, (out_w, out_h),
        flags=_cv2.INTER_LINEAR | _cv2.WARP_FILL_OUTLIERS,
        borderValue=(255, 255, 255),
    )
    return warped


# ---------------------------------------------------------------------------
# Scan enhancement
# ---------------------------------------------------------------------------

def _background_estimate(rgb):
    """Smooth per-channel background/illumination estimate of the page."""
    h, w = rgb.shape[:2]
    scale = min(1.0, ILLUM_MAX_SIDE / max(h, w))
    small = rgb
    if scale < 1.0:
        small = _cv2.resize(
            rgb, (int(round(w * scale)), int(round(h * scale))),
            interpolation=_cv2.INTER_AREA,
        )
    sh, sw = small.shape[:2]
    ksize = max(15, int(min(sh, sw) * 0.15) | 1)
    bg = _cv2.GaussianBlur(small, (ksize, ksize), 0)
    if scale < 1.0:
        bg = _cv2.resize(bg, (w, h), interpolation=_cv2.INTER_LINEAR)
    return bg


def _illumination_gradient(rgb):
    """Relative strength of uneven lighting on the page (0..1+)."""
    bg = _background_estimate(rgb)
    lum = _cv2.cvtColor(bg, _cv2.COLOR_RGB2GRAY).astype(_np.float32)
    p2 = _np.percentile(lum, 2)
    p98 = _np.percentile(lum, 98)
    center = float(_np.median(lum))
    if center <= 1.0:
        return 0.0
    return float((p98 - p2) / center)


def normalize_illumination(rgb, strength):
    """Remove phone/finger shadows and lighting gradients (divisive model).

    The smooth background estimate is divided out channel-wise so genuine
    ink/text contrast (high frequency) is preserved while slow shadows fade.
    """
    bg = _background_estimate(rgb).astype(_np.float32)
    rgb_f = rgb.astype(_np.float32)
    center = float(_np.median(bg))
    if center <= 1.0:
        return rgb
    norm = rgb_f / (_np.maximum(bg, 1.0)) * center
    norm = _np.clip(norm, 0.0, 255.0)
    if strength >= 1.0:
        return norm.astype(_np.uint8)
    return _cv2.addWeighted(rgb, 1.0 - strength, norm.astype(_np.uint8), strength, 0)


def _percentile_stretch(gray, lo=1.0, hi=99.0):
    g = gray.astype(_np.float32)
    p_lo = float(_np.percentile(g, lo))
    p_hi = float(_np.percentile(g, hi))
    if p_hi - p_lo < 8.0:
        return gray
    stretched = (g - p_lo) * (255.0 / (p_hi - p_lo))
    return _np.clip(stretched, 0, 255).astype(_np.uint8)


def _clahe_l(rgb, clip_limit=2.0, tile=8):
    lab = _cv2.cvtColor(rgb, _cv2.COLOR_RGB2LAB)
    l, a, b = _cv2.split(lab)
    clahe = _cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile, tile))
    l = clahe.apply(l)
    return _cv2.cvtColor(_cv2.merge((l, a, b)), _cv2.COLOR_LAB2RGB)


def _white_balance(rgb, strength=1.0):
    """Luminance-stable gray-world white balance with capped gains."""
    lab = _cv2.cvtColor(rgb, _cv2.COLOR_RGB2LAB)
    lum = lab[..., 0].astype(_np.float32)
    r = rgb[..., 0].astype(_np.float32)
    g = rgb[..., 1].astype(_np.float32)
    b = rgb[..., 2].astype(_np.float32)
    mr = float(r.mean())
    mg = float(g.mean())
    mb = float(b.mean())
    mean = max(1.0, (mr + mg + mb) / 3.0)
    gains = _np.array([mean / mr, mean / mg, mean / mb])
    gains = _np.clip(gains, 1 / 1.16, 1.16)
    gains /= float(gains.mean())
    wb = _np.clip(_np.stack([r, g, b], axis=-1) * gains, 0, 255)
    if strength >= 1.0:
        return wb.astype(_np.uint8)
    return _cv2.addWeighted(rgb, 1.0 - strength, wb.astype(_np.uint8), strength, 0)


def _saturation_boost(rgb, factor):
    if abs(factor - 1.0) < 1e-3:
        return rgb
    hsv = _cv2.cvtColor(rgb, _cv2.COLOR_RGB2HSV).astype(_np.float32)
    hsv[..., 1] = _np.clip(hsv[..., 1] * factor, 0, 255)
    return _cv2.cvtColor(hsv.astype(_np.uint8), _cv2.COLOR_HSV2RGB)


def _unsharp(rgb, radius, percent, threshold):
    blurred = _cv2.GaussianBlur(rgb, (0, 0), sigmaX=radius)
    sharp = _cv2.addWeighted(rgb, 1.0 + percent / 100.0, blurred, -percent / 100.0, 0)
    if threshold <= 0:
        return sharp
    diff = _cv2.absdiff(rgb.astype(_np.int16), sharp.astype(_np.int16))
    mask = (diff.mean(axis=-1) >= threshold).astype(_np.float32)[..., None]
    return (rgb.astype(_np.float32) * (1 - mask) + sharp.astype(_np.float32) * mask).astype(_np.uint8)


def _remove_blue_cast(rgb, strength=1.0):
    """Remove blue/cold color cast from the image.

    Uses two complementary strategies:
    1. LAB colour space — the 'b' channel encodes the blue-yellow axis.  A
       negative mean indicates a blue shift; we shift the channel toward neutral.
    2. RGB grey-world — if the blue mean exceeds the green mean we pull it down.
    """
    if strength <= 0:
        return rgb

    lab = _cv2.cvtColor(rgb, _cv2.COLOR_RGB2LAB).astype(_np.float32)
    _, a_ch, b_ch = _cv2.split(lab)

    # b channel: positive = yellow, negative = blue.  Neutral is ~128 (uint8)
    # but in float it sits around 0 after centering.  Analyse raw uint8 range.
    b_mean = float(_np.mean(b_ch))
    # b_mean < 128 → blue cast, > 128 → yellow cast
    blue_shift = max(0.0, 128.0 - b_mean)  # how far below neutral

    if blue_shift > 1.5:
        correction = blue_shift * 0.65 * strength
        b_ch = _np.clip(b_ch + correction, 0, 255)
        lab = _cv2.merge([lab[..., 0], a_ch, b_ch])
        rgb = _cv2.cvtColor(lab.astype(_np.uint8), _cv2.COLOR_LAB2RGB)

    # Second pass: RGB grey-world check
    r_mean = float(_np.mean(rgb[..., 0]))
    g_mean = float(_np.mean(rgb[..., 1]))
    b_mean_rgb = float(_np.mean(rgb[..., 2]))
    if b_mean_rgb > g_mean * 1.04:
        factor = (g_mean / max(b_mean_rgb, 1.0)) ** (0.5 * strength)
        rgb_f = rgb.astype(_np.float32)
        rgb_f[..., 2] = _np.clip(rgb_f[..., 2] * factor, 0, 255)
        rgb = rgb_f.astype(_np.uint8)

    return rgb


def _noise_level(gray):
    """Robust noise estimate: 25th percentile of local std (0..1)."""
    small = gray
    if max(gray.shape[:2]) > 1200:
        s = 1200.0 / max(gray.shape[:2])
        small = _cv2.resize(gray, (int(gray.shape[1] * s), int(gray.shape[0] * s)),
                            interpolation=_cv2.INTER_AREA)
    blur = _cv2.GaussianBlur(small.astype(_np.float32) / 255.0, (5, 5), 0)
    sq = blur * blur
    sq2 = _cv2.GaussianBlur((small.astype(_np.float32) / 255.0) ** 2, (5, 5), 0)
    var = _np.maximum(sq2 - sq, 0.0)
    return float(_np.percentile(_np.sqrt(var), 25))


# ---------------------------------------------------------------------------
# Enhancement modes
# ---------------------------------------------------------------------------

def _paper_estimate(gray):
    """Robust, smooth paper/background luminance map of a page.

    A 16x16 grid of high percentiles ignores dark ink while following slow
    lighting changes (shadows, vignetting, colour tint). Blurring the grid
    keeps the estimate smooth so genuine ink contrast is not smoothed away.
    """
    h, w = gray.shape[:2]
    blocks = 16
    bh = max(1, h // blocks)
    bw = max(1, w // blocks)
    rows = []
    for y in range(0, h, bh):
        row = []
        for x in range(0, w, bw):
            tile = gray[y:y + bh, x:x + bw]
            row.append(float(_np.percentile(tile, 88)))
        rows.append(row)
    grid = _cv2.GaussianBlur(_np.asarray(rows, dtype=_np.float32), (3, 3), 0)
    paper = _cv2.resize(grid, (w, h), interpolation=_cv2.INTER_CUBIC)
    paper = _cv2.GaussianBlur(paper, (0, 0), max(3.0, min(h, w) * 0.02))
    return paper


def _to_binary_doc(rgb):
    """Clean binary (black/white) document for crisp printing.

    The page is divided by a robust paper-background estimate so coloured or
    shaded paper collapses to pure white while real ink stays dark. A single
    Otsu threshold on the flattened page keeps solid fills (logos, stamps,
    coloured banners) solid instead of hollow, which local adaptive
    thresholding cannot do.
    """
    gray = _cv2.cvtColor(rgb, _cv2.COLOR_RGB2GRAY).astype(_np.float32)
    paper = _paper_estimate(gray)
    norm = _np.clip(gray / _np.maximum(paper, 1.0) * 255.0, 0, 255).astype(_np.uint8)

    _, bin_ = _cv2.threshold(norm, 0, 255, _cv2.THRESH_BINARY + _cv2.THRESH_OTSU)

    # Polarity guard: the page must end up white. Deep shadows or a dark
    # surface around the paper can flip large regions to black; if the
    # result is mostly dark, invert so prints stay clean like CamScanner.
    if float((bin_ == 255).mean()) < 0.5:
        bin_ = 255 - bin_

    bin_ = _cv2.medianBlur(bin_, 3)
    kernel = _np.ones((3, 3), dtype=_np.uint8)
    bin_ = _cv2.morphologyEx(bin_, _cv2.MORPH_OPEN, kernel)

    # Remove leftover small dark specks that survive the opening.
    h, w = bin_.shape[:2]
    num, labels, stats, _centers = _cv2.connectedComponentsWithStats(
        255 - bin_, connectivity=8,
    )
    if num > 1:
        min_area = max(8, int(min(h, w) * 0.0004))
        for i in range(1, num):
            if stats[i, _cv2.CC_STAT_AREA] < min_area:
                bin_[labels == i] = 255

    return bin_


def enhance_grayscale(rgb):
    gray = _cv2.cvtColor(rgb, _cv2.COLOR_RGB2GRAY)
    grad = _illumination_gradient(rgb)
    if grad > 0.05:
        gray = _cv2.cvtColor(normalize_illumination(rgb, 0.85), _cv2.COLOR_RGB2GRAY)
    gray = _percentile_stretch(gray)
    gray = _unsharp(gray, 1.0, 35, 3)
    return _cv2.cvtColor(gray, _cv2.COLOR_GRAY2RGB)


def enhance_bw(rgb):
    return _cv2.cvtColor(_to_binary_doc(rgb), _cv2.COLOR_GRAY2RGB)


_REMBG_SESSION = None


def enhance_removebg(rgb):
    """Cut out the subject (person/item) with U2Net and place it on white."""
    global _REMBG_SESSION
    try:
        from rembg import new_session, remove

        if _REMBG_SESSION is None:
            _REMBG_SESSION = new_session("u2net")
        cut = remove(Image.fromarray(rgb), session=_REMBG_SESSION)
    except Exception as exc:
        raise RuntimeError(
            "AI background removal failed (%s). The first run downloads the "
            "AI model - please check your internet connection." % exc
        ) from exc

    white = Image.new("RGBA", cut.size, (255, 255, 255, 255))
    return to_np_rgb(Image.alpha_composite(white, cut).convert("RGB"))


def enhance_color(rgb):
    out = _remove_blue_cast(rgb, 0.9)
    grad = _illumination_gradient(out)
    if grad > 0.05:
        out = normalize_illumination(out, 0.7)
    out = _white_balance(out, 0.8)
    out = _clahe_l(out, clip_limit=1.6, tile=8)
    out = _saturation_boost(out, 1.07)
    out = _unsharp(out, 1.0, 30, 3)
    return out


def enhance_magic(rgb):
    out = _remove_blue_cast(rgb, 1.0)
    out = normalize_illumination(out, 1.0)
    out = _white_balance(out, 1.0)
    out = _clahe_l(out, clip_limit=2.2, tile=8)
    out = _saturation_boost(out, 1.12)
    out = _unsharp(out, 1.1, 45, 3)
    return out


def _analyze(rgb):
    small = rgb
    if max(rgb.shape[:2]) > 900:
        s = 900.0 / max(rgb.shape[:2])
        small = _cv2.resize(rgb, (int(rgb.shape[1] * s), int(rgb.shape[0] * s)),
                            interpolation=_cv2.INTER_AREA)
    gray = _cv2.cvtColor(small, _cv2.COLOR_RGB2GRAY)
    hsv = _cv2.cvtColor(small, _cv2.COLOR_RGB2HSV)
    return {
        "mean": float(gray.mean()) / 255.0,
        "contrast": float(gray.std()) / 255.0,
        "saturation": float(hsv[..., 1].mean()) / 255.0,
        "noise": _noise_level(gray),
    }


def enhance_auto(rgb):
    a = _analyze(rgb)
    out = _remove_blue_cast(rgb, 0.8)

    grad = _illumination_gradient(out)
    if grad > 0.05:
        strength = clamp((grad - 0.05) / 0.25, 0.3, 1.0)
        out = normalize_illumination(out, strength)

    is_gray_doc = a["saturation"] < 0.09
    if is_gray_doc:
        gray = _cv2.cvtColor(out, _cv2.COLOR_RGB2GRAY)
        if a["contrast"] < 0.18:
            gray = _clahe_l(_cv2.cvtColor(gray, _cv2.COLOR_GRAY2RGB), 2.0, 8)
            gray = _cv2.cvtColor(gray, _cv2.COLOR_RGB2GRAY)
        else:
            gray = _percentile_stretch(gray)
        gray = _unsharp(gray, 1.0, 40, 3)
        out = _cv2.cvtColor(gray, _cv2.COLOR_GRAY2RGB)
    else:
        if a["contrast"] < 0.14:
            out = _clahe_l(out, clip_limit=1.8, tile=8)
        elif 0.14 <= a["contrast"] < 0.3:
            out = _clahe_l(out, clip_limit=1.4, tile=8)
        else:
            lab = _cv2.cvtColor(out, _cv2.COLOR_RGB2LAB)
            l, c1, c2 = _cv2.split(lab)
            l = _percentile_stretch(l)
            out = _cv2.cvtColor(_cv2.merge((l, c1, c2)), _cv2.COLOR_LAB2RGB)
        out = _white_balance(out, 0.6)
        out = _saturation_boost(out, 1.06)

    if a["noise"] > 0.30:
        out = _cv2.medianBlur(out, 3)

    out = _unsharp(out, 1.0, 32, 3)
    return out


def enhance_scan(rgb, mode):
    if mode == "original":
        return rgb.copy()
    if mode == "bw":
        return enhance_bw(rgb)
    if mode == "grayscale":
        return enhance_grayscale(rgb)
    if mode == "color":
        return enhance_color(rgb)
    if mode == "magic":
        return enhance_magic(rgb)
    if mode == "removebg":
        return enhance_removebg(rgb)
    if mode == "auto":
        return enhance_auto(rgb)
    raise ValueError("Unknown scan mode: %s" % mode)


# ---------------------------------------------------------------------------
# Page pipeline
# ---------------------------------------------------------------------------

def process_page(spec, index):
    """Process one page spec -> (PIL RGB image, dims)."""
    img = load_source(spec["input"])
    rgb = to_np_rgb(img)
    h, w = rgb.shape[:2]

    rot = int(spec.get("rotate", 0))
    if rot % 360:
        rgb = rotate_source(rgb, rot)
        h, w = rgb.shape[:2]

    corners = spec.get("corners")
    detected = False
    if corners is None or len(corners) != 4:
        found = detect_corners(rgb)
        if found is not None:
            corners = found.tolist()
            detected = True
        else:
            inset = 0.03
            corners = [
                [w * inset, h * inset],
                [w * (1 - inset), h * inset],
                [w * (1 - inset), h * (1 - inset)],
                [w * inset, h * (1 - inset)],
            ]

    warped = warp_perspective(rgb, corners)

    mode = spec.get("mode", "auto")
    if mode not in MODES:
        mode = "auto"
    enhanced = enhance_scan(warped, mode)

    return from_np_rgb(enhanced), (detected, corners)


def write_page(out, path):
    ext = os.path.splitext(path)[1].lower().lstrip(".")
    fmt = PIL_FORMATS.get(ext, "PNG")
    kwargs = {}
    if fmt == "JPEG":
        kwargs["quality"] = 92
    elif fmt == "WEBP":
        kwargs["quality"] = 90
    out.save(path, fmt, **kwargs)


def build_pdf(page_images, pdf_path, resolution=150):
    """Assemble a multi-page PDF; JPEG-compresses pages so size stays sane."""
    tmp_paths = []
    try:
        for i, img in enumerate(page_images):
            tmp = os.path.join(os.path.dirname(pdf_path), "_pdf_tmp_%d.jpg" % i)
            img.convert("RGB").save(tmp, "JPEG", quality=88)
            tmp_paths.append(tmp)
        first = Image.open(tmp_paths[0])
        rest = [Image.open(p) for p in tmp_paths[1:]]
        first.save(
            pdf_path, "PDF", save_all=True, append_images=rest, resolution=resolution,
        )
    finally:
        for p in tmp_paths:
            try:
                os.remove(p)
            except OSError:
                pass


def build_zip(page_paths, zip_path):
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=8) as zf:
        for p in page_paths:
            zf.write(p, os.path.basename(p))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def run_detect(args):
    img = load_source(args.detect)
    rgb = to_np_rgb(img)
    h, w = rgb.shape[:2]
    rot = int(args.rotate or 0)
    if rot % 360:
        rgb = rotate_source(rgb, rot)
        h, w = rgb.shape[:2]
    corners = detect_corners(rgb)
    result = {"corners": None}
    if corners is not None:
        result = {"corners": [[float(x), float(y)] for x, y in corners.tolist()]}
    payload = json.dumps(result)
    if args.out_json:
        with open(args.out_json, "w", encoding="utf-8") as fh:
            fh.write(payload)
    sys.stdout.write(payload + "\n")
    return 0


def run_jobs(args):
    with open(args.jobs, "r", encoding="utf-8") as fh:
        job = json.load(fh)

    output_dir = job["outputDir"]
    output_base = job.get("outputBase", "scan")
    fmt = str(job.get("format", "png")).lower()
    if fmt not in OUTPUT_EXTS:
        fmt = "png"
    pages = job.get("pages", [])
    if not pages:
        sys.stderr.write("No pages in job.\n")
        return 1

    page_images = []
    page_paths = []
    for i, spec in enumerate(pages, start=1):
        try:
            out_img, (detected, corners) = process_page(spec, i)
        except Exception as exc:
            sys.stderr.write("Page %d failed: %s\n" % (i, exc))
            return 1
        page_images.append(out_img)
        page_path = os.path.join(output_dir, "page-%d%s" % (i, OUTPUT_EXTS[fmt]))
        write_page(out_img, page_path)
        page_paths.append(page_path)
        sys.stdout.write(
            "page-%d%s %s %dx%d corners=%s\n"
            % (i, OUTPUT_EXTS[fmt], spec["mode"], out_img.size[0], out_img.size[1],
               "detected" if detected else "provided")
        )

    pdf_path = os.path.join(output_dir, "%s.pdf" % output_base)
    build_pdf(page_images, pdf_path)
    sys.stdout.write("%s.pdf %d pages %.0f KB\n" % (
        output_base, len(page_images), os.path.getsize(pdf_path) / 1024.0))

    zip_path = os.path.join(output_dir, "%s.zip" % output_base)
    build_zip(page_paths, zip_path)
    sys.stdout.write("%s.zip %d pages %.0f KB\n" % (
        output_base, len(page_paths), os.path.getsize(zip_path) / 1024.0))
    return 0


def build_arg_parser():
    parser = argparse.ArgumentParser(
        prog="PhotoScanner",
        description="Document Scanner — detect, correct and clean document photos.",
    )
    parser.add_argument("--version", action="version", version="PhotoScanner CLI 1.0.0")
    parser.add_argument("--detect", metavar="INPUT", help="detect document corners in an image")
    parser.add_argument("--out-json", metavar="FILE", help="write detection result as JSON")
    parser.add_argument("--rotate", metavar="DEG", default=0, help="rotate the source 0/90/180/270")
    parser.add_argument("--jobs", metavar="JOBS_JSON", help="process a batch of pages from a jobs file")
    return parser


def main(argv=None):
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    if args.detect:
        return run_detect(args)
    if args.jobs:
        return run_jobs(args)
    parser.print_help(sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
