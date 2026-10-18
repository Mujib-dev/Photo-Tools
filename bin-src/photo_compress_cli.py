# -*- coding: utf-8 -*-
"""
Compress To Size (CLI)
======================
Shrinks an image to sit at or under a target file size using binary search on
the encoder quality, downscaling only as a last resort. Pure Pillow, CPU-only,
fully deterministic.

Usage:
    --input <path>       input image (any Pillow-readable format)
    --output <path>      base output path; the real extension (.jpg/.webp)
                         is appended automatically
    --target-kb <n>      target maximum size in KB (10..20000)
    --format <fmt>       keep | jpg | webp   (default: keep)

"keep" re-encodes in the input's lossy format: JPG stays JPG, WEBP stays
WEBP, everything else (PNG/GIF/BMP/TIFF) falls back to JPG.

Exit codes:
    0  success
    2  usage / argument error
    1  processing error (e.g. target unreachable even after downscaling)
"""

import argparse
import io
import os
import sys

from PIL import Image, ImageOps

MIN_QUALITY = 10
MAX_QUALITY = 95
TARGET_MIN_KB = 10
TARGET_MAX_KB = 20000


def load_rgb(path):
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    return img.convert("RGB")


def pick_format(requested, source_path):
    if requested != "keep":
        return requested
    ext = os.path.splitext(source_path)[1].lower().lstrip(".")
    if ext == "webp":
        return "webp"
    return "jpg"


def encode(img, fmt, quality):
    buf = io.BytesIO()
    kwargs = {"quality": quality}
    if fmt == "jpg":
        kwargs["optimize"] = True
        if "exif" in img.info:
            kwargs["exif"] = img.info["exif"]
    elif fmt == "webp":
        kwargs["method"] = 6
    img.save(buf, "JPEG" if fmt == "jpg" else "WEBP", **kwargs)
    return buf.getvalue()


def compress(input_path, output_base, target_kb, requested_fmt="keep"):
    if not os.path.isfile(input_path):
        raise FileNotFoundError(input_path)
    if not TARGET_MIN_KB <= target_kb <= TARGET_MAX_KB:
        raise ValueError("target-kb must be between %d and %d" % (TARGET_MIN_KB, TARGET_MAX_KB))

    fmt = pick_format(requested_fmt, input_path)
    img = load_rgb(input_path)
    target_bytes = target_kb * 1024

    # Binary search for the highest quality that fits the budget.
    best = None
    lo, hi = MIN_QUALITY, MAX_QUALITY
    work = img
    while True:
        lo, hi = MIN_QUALITY, MAX_QUALITY
        best = None
        while lo <= hi:
            mid = (lo + hi) // 2
            data = encode(work, fmt, mid)
            if len(data) <= target_bytes:
                best = (mid, data)
                lo = mid + 1
            else:
                hi = mid - 1
        if best is not None:
            break

        # Even minimum quality overshoots: shrink the image and retry.
        w, h = work.size
        scale = 0.85
        new_size = (max(16, int(w * scale)), max(16, int(h * scale)))
        if new_size == work.size:
            break
        work = work.resize(new_size, Image.LANCZOS)
        print("Downscaled to %dx%d, retrying..." % new_size, flush=True)

    if best is None:
        raise RuntimeError("Could not reach the target size.")

    quality, data = best
    out_path = "%s.%s" % (output_base, "jpg" if fmt == "jpg" else "webp")
    with open(out_path, "wb") as fh:
        fh.write(data)

    size_kb = max(1, round(os.path.getsize(out_path) / 1024))
    print("%s compressed %d KB (quality %d)" % (os.path.basename(out_path), size_kb, quality))
    return out_path


def main(argv=None):
    parser = argparse.ArgumentParser(description="PhotoCompress CLI")
    parser.add_argument("--version", action="version", version="PhotoCompress CLI 1.0.0")
    parser.add_argument("--input", required=True, metavar="PATH", help="input image path")
    parser.add_argument("--output", required=True, metavar="PATH",
                        help="output base path (extension appended)")
    parser.add_argument("--target-kb", type=int, required=True, metavar="N",
                        help="target maximum size in KB (10..20000)")
    parser.add_argument("--format", choices=["keep", "jpg", "webp"], default="keep",
                        help="output format")
    args = parser.parse_args(argv)

    try:
        compress(args.input, args.output, args.target_kb, args.format)
        return 0
    except Exception as exc:
        print("Error: %s" % exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
