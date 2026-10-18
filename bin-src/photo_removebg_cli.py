# -*- coding: utf-8 -*-
"""
Background Remover (CLI)
========================
AI subject cut-out driven by rembg (U2Net), exposed as a CLI so the web app
can drive it reliably. The U2Net model (~170 MB) is downloaded once on first
use and cached by rembg in the user's home directory.

Usage:
    --input <path>          input image (JPG/PNG/WEBP/BMP/TIFF)
    --output <path>         output image path
    --background <mode>     transparent | white | black   (default: transparent)
    --format <fmt>          png | jpg | webp              (default: png)

Notes:
    * png/webp keep alpha when background=transparent.
    * jpg always flattens onto the chosen solid colour (white default).
    * The first run downloads the model — allow network access.

Exit codes:
    0  success
    2  usage / argument error
    1  processing error
"""

import argparse
import os
import sys

from PIL import Image, ImageOps

# Available rembg models (U2Net variants + others)
# u2net           — general purpose, 170 MB (default)
# u2netp          — lightweight U2Net, 4 MB (faster, less accurate)
# u2net_human_seg — human segmentation, 170 MB
# isnet-general-use — ISNet general, ~200 MB (high quality)
# silueta         — lightweight, 43 MB
REMBG_MODELS = ("u2net", "u2netp", "u2net_human_seg", "isnet-general-use", "silueta")

DEFAULT_MODEL = "u2net"

BACKGROUNDS = ("transparent", "white", "black", "custom")
FORMATS = {"png": "PNG", "jpg": "JPEG", "webp": "WEBP"}
OUTPUT_EXTS = {"png": ".png", "jpg": ".jpg", "webp": ".webp"}


def load_source(path):
    """Open an image, transpose it by EXIF orientation, return PIL image."""
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    return img


_REMBG_SESSIONS = {}


def get_session(model: str = DEFAULT_MODEL):
    """Create (once per model) and return the shared rembg session."""
    global _REMBG_SESSIONS
    try:
        from rembg import new_session
    except Exception as exc:
        raise RuntimeError("rembg is not installed (%s)" % exc) from exc

    if model not in _REMBG_SESSIONS:
        print(f"Loading AI model ({model})...", flush=True)
        _REMBG_SESSIONS[model] = new_session(model)
    return _REMBG_SESSIONS[model]


def cutout(rgb_img, model: str):
    """Run the rembg matting and return an RGBA PIL image."""
    from rembg import remove

    session = get_session(model)
    cut = remove(rgb_img, session=session)
    return cut.convert("RGBA")


def flatten_on(rgba, color):
    """Composite an RGBA image onto a solid background colour."""
    if len(color) == 3:
        color = color + (255,)
    bg = Image.new("RGBA", rgba.size, color)
    return Image.alpha_composite(bg, rgba)


def _parse_rgba(value):
    """Parse 'r,g,b,a' or 'r,g,b' string into (r,g,b,a) tuple 0-255."""
    parts = [int(p.strip()) for p in value.split(",")]
    if len(parts) == 3:
        return (*parts, 255)
    if len(parts) == 4:
        return tuple(parts)
    raise ValueError("custom-color must be 'r,g,b' or 'r,g,b,a' (0-255)")


def process(input_path, output_path, background="transparent", fmt="png", model=DEFAULT_MODEL, custom_color=None):
    if not os.path.isfile(input_path):
        raise FileNotFoundError(input_path)

    src = load_source(input_path)
    rgb = src.convert("RGB")

    print("Loading AI model (first run downloads it)...", flush=True)
    print("Removing background...", flush=True)

    cut = cutout(rgb, model)

    if background == "transparent":
        out = cut
        effective = "transparent"
    elif background == "custom":
        if custom_color is None:
            raise ValueError("custom-color required when background=custom")
        color = _parse_rgba(custom_color)
        out = flatten_on(cut, color)
        effective = "custom"
    else:
        color = (255, 255, 255) if background == "white" else (0, 0, 0)
        out = flatten_on(cut, color)
        effective = background

    if fmt == "png":
        out = out.convert("RGBA") if effective == "transparent" else out.convert("RGB")
    else:
        out = out.convert("RGB")

    root, _ = os.path.splitext(output_path)
    final_path = root + OUTPUT_EXTS[fmt]
    save_kwargs = {}
    if fmt == "webp":
        save_kwargs["quality"] = 95
    elif fmt == "jpg":
        save_kwargs["quality"] = 92
    out.save(final_path, FORMATS[fmt], **save_kwargs)

    size_kb = max(1, round(os.path.getsize(final_path) / 1024))
    print("%s removed-bg %d KB" % (os.path.basename(final_path), size_kb))
    return final_path


def main(argv=None):
    parser = argparse.ArgumentParser(description="PhotoRemoveBg CLI")
    parser.add_argument("--version", action="version", version="PhotoRemoveBg CLI 1.0.0")
    parser.add_argument("--input", required=True, metavar="PATH", help="input image path")
    parser.add_argument("--output", required=True, metavar="PATH", help="output image path")
    parser.add_argument("--background", choices=BACKGROUNDS, default="transparent",
                        help="new background behind the subject")
    parser.add_argument("--custom-color", metavar="RGBA", help="custom background 'r,g,b' or 'r,g,b,a' (0-255) when background=custom")
    parser.add_argument("--format", choices=list(FORMATS), default="png",
                        help="output format")
    parser.add_argument("--model", choices=REMBG_MODELS, default=DEFAULT_MODEL,
                        help="AI model: u2net (general), u2net_human_seg (people), isnet-general-use (high quality), silueta (fast)")
    args = parser.parse_args(argv)

    try:
        process(args.input, args.output, args.background, args.format, args.model, args.custom_color)
        return 0
    except Exception as exc:
        print("Error: %s" % exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
