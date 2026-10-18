# -*- coding: utf-8 -*-
"""
Watermark (CLI)
===============
Stamps a text watermark over an image — single placement (centre or corners)
or a repeated tile pattern. Pure Pillow, CPU-only, fully deterministic. The
watermark is rendered as pixels; nothing user-supplied touches filenames.

Usage:
    --input <path>        input image
    --output <path>       output image path
    --text "..."          watermark text (1..60 chars after sanitising upstream)
    --position <pos>      center | top-left | top-right | bottom-left |
                          bottom-right | tile          (default: center)
    --opacity <0..100>    text opacity percent          (default: 40)
    --size <2..30>        font size as % of image width (default: 8)
    --color white|black   text colour                   (default: white)
    --format <fmt>        jpg | png | bmp | tiff | webp | gif   (default: jpg)

Exit codes:
    0  success
    2  usage / argument error
    1  processing error
"""

import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFont, ImageOps

POSITIONS = ("center", "top-left", "top-right", "bottom-left", "bottom-right", "tile")
PIL_FORMATS = {
    "jpg": "JPEG", "jpeg": "JPEG", "png": "PNG", "bmp": "BMP",
    "tiff": "TIFF", "webp": "WEBP", "gif": "GIF",
}
OUTPUT_EXTS = {"jpg": ".jpg", "jpeg": ".jpg", "png": ".png", "bmp": ".bmp",
               "tiff": ".tiff", "webp": ".webp", "gif": ".gif"}

FONT_CANDIDATES = [
    "arial.ttf", "Arial.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def load_font(size_px):
    for candidate in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(candidate, size_px)
        except Exception:
            continue
    return ImageFont.load_default()


def load_rgb(path):
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    return img.convert("RGB")


def stamp_once(draw, xy, text, font, fill):
    draw.text(xy, text, font=font, fill=fill)


def place_single(img, text, font, position, fill):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    margin = max(8, int(min(img.size) * 0.03))

    coords = {
        "top-left": (margin, margin),
        "top-right": (img.width - tw - margin, margin),
        "bottom-left": (margin, img.height - th - margin),
        "bottom-right": (img.width - tw - margin, img.height - th - margin),
        "center": ((img.width - tw) // 2, (img.height - th) // 2),
    }
    xy = coords.get(position, coords["center"])
    draw.text(xy, text, font=font, fill=fill)
    return layer


def place_tile(img, text, font, fill):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    gap_x = max(tw * 2, 60)
    gap_y = max(th * 4, 90)

    y = -(th // 2)
    row = 0
    while y < img.height + th:
        x = -(tw // 2) if row % 2 == 0 else -(tw // 2) - gap_x // 2
        while x < img.width + tw:
            draw.text((x, y), text, font=font, fill=fill)
            x += gap_x
        y += gap_y
        row += 1
    return layer


def process(input_path, output_path, text, position="center", opacity=40,
            size_pct=8, color="white", fmt="jpg"):
    if not os.path.isfile(input_path):
        raise FileNotFoundError(input_path)

    img = load_rgb(input_path)
    font_px = max(12, int(img.width * size_pct / 100))
    font = load_font(font_px)
    color_rgb = (0, 0, 0) if color == "black" else (255, 255, 255)
    alpha = max(13, min(255, round(opacity * 255 / 100)))
    fill = color_rgb + (alpha,)

    if position == "tile":
        layer = place_tile(img, text, font, fill)
    else:
        layer = place_single(img, text, font, position, fill)

    out = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")

    root, _ = os.path.splitext(output_path)
    final_path = root + OUTPUT_EXTS[fmt]
    save_kwargs = {}
    if fmt in ("jpg", "jpeg"):
        save_kwargs = {"quality": 92}
    elif fmt == "webp":
        save_kwargs = {"quality": 92}
    out.save(final_path, PIL_FORMATS[fmt], **save_kwargs)

    size_kb = max(1, round(os.path.getsize(final_path) / 1024))
    print("%s watermarked %d KB" % (os.path.basename(final_path), size_kb))
    return final_path


def main(argv=None):
    parser = argparse.ArgumentParser(description="PhotoWatermark CLI")
    parser.add_argument("--version", action="version", version="PhotoWatermark CLI 1.0.0")
    parser.add_argument("--input", required=True, metavar="PATH", help="input image path")
    parser.add_argument("--output", required=True, metavar="PATH", help="output image path")
    parser.add_argument("--text", required=True, metavar="TEXT", help="watermark text")
    parser.add_argument("--position", choices=list(POSITIONS), default="center")
    parser.add_argument("--opacity", type=int, default=40, help="5..100 percent")
    parser.add_argument("--size", type=int, default=8, help="font size as %% of width (2..30)")
    parser.add_argument("--color", choices=["white", "black"], default="white")
    parser.add_argument("--format", choices=list(PIL_FORMATS), default="jpg")
    args = parser.parse_args(argv)

    try:
        process(args.input, args.output, args.text, args.position,
                args.opacity, args.size, args.color, args.format)
        return 0
    except Exception as exc:
        print("Error: %s" % exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
