# -*- coding: utf-8 -*-
"""
PDF Tools (CLI)
===============
Offline PDF operations driven by a jobs JSON file:

  --jobs <jobs.json>
      {
        "op": "convert" | "merge" | "split" | "tojpg" | "edit",
        "outputDir": "S:/.../output",
        "outputBase": "doc",
        "inputs": ["S:/.../a.pdf", ...],
        "plan": { ... }        # only for op "edit"
      }

  Ops and produced primary artifact:
  convert  first PDF -> <base>.docx          (pdf2docx, layout-aware text)
  merge    all PDFs -> <base>.pdf            (page order = input order)
  split    first PDF -> <base>.zip           (one single-page PDF per page)
  tojpg    first PDF -> <base>.zip           (page-N.jpg at 200 dpi)
  edit     first PDF -> <base>.pdf           (reorder/rotate/delete + overlays)

  The "edit" plan:
      {
        "pages":  [{"src": 0, "rotate": 90}, {"src": 2}, ...],
        "annotations": [
          {"kind": "text",     "page": 0, "x": 72, "y": 72, "size": 18,
           "font": "helv", "color": "#ff0000", "text": "Hello"},
          {"kind": "image",    "page": 0, "x": 72, "y": 200, "w": 200, "h": 150,
           "asset": "S:/.../logo.png"},
          {"kind": "draw",     "page": 1, "color": "#111111", "width": 2,
           "opacity": 1, "points": [[10, 10], [20, 40]]},
          {"kind": "highlight","page": 1, "color": "#ffe600", "opacity": 0.4,
           "points": [[10, 10], [200, 10]]}
        ],
        "metadata": {"title": "...", "author": "..."}
      }

  Coordinates are PDF points with the origin at the top-left of the *rotated*
  page, which is what PyMuPDF's page space already uses, so browser canvas
  positions map across without conversion. Omitting a page from "pages" deletes
  it; the order of "pages" is the order of the result.

Exit codes:
  0 success
  2 usage / argument error
  1 processing error
"""

import argparse
import json
import os
import sys
import zipfile

OPS = ("convert", "merge", "split", "tojpg", "edit")

# Built-in PDF base-14 fonts, addressed by the short names the plan uses.
EDIT_FONTS = {
    "helv": "helv",
    "hebo": "hebo",
    "cour": "cour",
    "cobo": "cobo",
}

# Metadata keys the editor is allowed to overwrite.
EDIT_METADATA_KEYS = ("title", "author", "subject", "keywords")

# Upper bound on text lines reported per page in the preview manifest.
PDF_MAX_PREVIEW_LINES = 4000


def op_convert(inputs, output_dir, base):
    from pdf2docx import Converter

    out_path = os.path.join(output_dir, "%s.docx" % base)
    cvt = Converter(inputs[0])
    try:
        cvt.convert(out_path)
    finally:
        cvt.close()
    return out_path


def op_merge(inputs, output_dir, base):
    from pypdf import PdfWriter

    if len(inputs) < 2:
        raise ValueError("Merging requires at least two PDF files.")
    writer = PdfWriter()
    for path in inputs:
        writer.append(path)
    out_path = os.path.join(output_dir, "%s.pdf" % base)
    with open(out_path, "wb") as fh:
        writer.write(fh)
    writer.close()
    return out_path


def op_split(inputs, output_dir, base):
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(inputs[0])
    zip_path = os.path.join(output_dir, "%s.zip" % base)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, page in enumerate(reader.pages):
            writer = PdfWriter()
            writer.add_page(page)
            name = "%s-part-%d.pdf" % (base, i + 1)
            part_path = os.path.join(output_dir, name)
            with open(part_path, "wb") as fh:
                writer.write(fh)
            writer.close()
            zf.write(part_path, name)
            os.remove(part_path)
    return zip_path


def op_tojpg(inputs, output_dir, base, dpi=200):
    import pymupdf

    doc = pymupdf.open(inputs[0])
    zoom = dpi / 72.0
    matrix = pymupdf.Matrix(zoom, zoom)
    zip_path = os.path.join(output_dir, "%s.zip" % base)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, page in enumerate(doc):
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            name = "page-%d.jpg" % (i + 1)
            img_path = os.path.join(output_dir, name)
            pix.save(img_path)
            zf.write(img_path, name)
            os.remove(img_path)
        doc.close()
    return zip_path


def _number(value, default=0.0):
    """Coerce to float, falling back when the value is missing or not numeric."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _opacity(value):
    return max(0.0, min(1.0, _number(value, 1.0)))


def _hex_to_rgb(value, default=(0.0, 0.0, 0.0)):
    """Turn #rgb / #rrggbb into the 0..1 float triple PyMuPDF expects."""
    if not isinstance(value, str):
        return default
    text = value.strip().lstrip("#")
    if len(text) == 3:
        text = "".join(ch * 2 for ch in text)
    if len(text) != 6:
        return default
    try:
        return tuple(int(text[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    except ValueError:
        return default


# Base-14 PostScript names, grouped by the shape of the original face. These
# ship with every PDF reader, so a replacement never depends on a font that
# happened to be embedded in the source document.
_BASE14_SANS = ("helv", "hebo", "heit", "hebi")
_BASE14_SERIF = ("tiro", "tibo", "tiit", "tibi")
_BASE14_MONO = ("cour", "cobo", "coit", "cobi")


def _base14_for(font_name, flags=0, bold=False, italic=False):
    """Map an embedded font name/flags onto the closest base-14 family.

    The index is regular / bold / italic / bold-italic. A document that
    embeds a subsetted custom face still renders correctly with these, which
    is what keeps edited text looking native instead of falling back to a
    mismatched default.
    """
    name = (font_name or "").lower()
    if not bold:
        bold = bool(int(flags or 0) & 16)
    if not italic:
        italic = bool(int(flags or 0) & 2)
    index = (1 if bold else 0) + (2 if italic else 0)

    if "courier" in name or "mono" in name or "consol" in name or "menlo" in name:
        return _BASE14_MONO[index]
    if any(key in name for key in ("times", "serif", "roman", "georgia", "garamond", "book")):
        return _BASE14_SERIF[index]
    if int(flags or 0) & 4:  # span flagged as serifed but name is unhelpful
        return _BASE14_SERIF[index]
    return _BASE14_SANS[index]


# The base-14 faces are Latin-1 only, so anything outside that range (€, curly
# quotes, CJK, emoji) renders as garbage. Those replacements borrow a real
# Unicode font from the OS instead, matched to the same family.
_UNICODE_FONT_FILES = {
    "helv": ("arial.ttf", "segoeui.ttf", "calibri.ttf"),
    "hebo": ("arialbd.ttf", "seguisb.ttf", "calibrib.ttf"),
    "heit": ("ariali.ttf", "segoeuii.ttf"),
    "hebi": ("arialbi.ttf", "segoeuiz.ttf"),
    "tiro": ("times.ttf", "georgia.ttf"),
    "tibo": ("timesbd.ttf", "georgiab.ttf"),
    "tiit": ("timesi.ttf", "georgiai.ttf"),
    "tibi": ("timesbi.ttf", "georgiaz.ttf"),
    "cour": ("cour.ttf", "consola.ttf"),
    "cobo": ("courbd.ttf", "consolab.ttf"),
    "coit": ("couri.ttf", "consolai.ttf"),
    "cobi": ("courbi.ttf", "consolaz.ttf"),
}

# Faces that carry CJK coverage, tried when the family font lacks the glyphs.
_CJK_FONT_FILES = ("msyh.ttc", "segoeui.ttf", "msgothic.ttc", "simsun.ttc", "malgun.ttf")


def _needs_unicode_font(text):
    return any(ord(ch) > 0xFF for ch in text)


def _font_dirs():
    dirs = []
    windir = os.environ.get("WINDIR")
    if windir:
        dirs.append(os.path.join(windir, "Fonts"))
    dirs.append("/usr/share/fonts/truetype/dejavu")
    dirs.append("/Library/Fonts")
    return dirs


def _find_font_file(candidates):
    for name in candidates:
        for directory in _font_dirs():
            path = os.path.join(directory, name)
            if os.path.isfile(path):
                return path
    return None


def _font_covers(path, text):
    """True when every character in `text` has a real glyph in `path`."""
    import pymupdf

    try:
        font = pymupdf.Font(fontfile=path)
    except Exception:
        return False
    try:
        return all(ch.isspace() or font.has_glyph(ord(ch)) for ch in text)
    except Exception:
        return False


def _resolve_font(base14, text):
    """Return (fontname, fontfile) able to render `text`.

    The base-14 name is kept whenever it can draw the string, so the common
    case still matches the surrounding document exactly. Text that would
    otherwise come out as replacement characters is matched against real
    system fonts, so CJK or symbol text gets a face that actually has those
    glyphs rather than a row of empty boxes.
    """
    if not _needs_unicode_font(text):
        return base14, None

    family = _UNICODE_FONT_FILES.get(base14, ())
    for name in tuple(family) + _CJK_FONT_FILES:
        path = _find_font_file((name,))
        if path and _font_covers(path, text):
            return os.path.splitext(name)[0], path

    # Nothing on this machine covers the text; draw it with the family face.
    path = _find_font_file(family)
    if path:
        return os.path.splitext(os.path.basename(path))[0], path
    return base14, None


def _int_to_rgb(value):
    try:
        packed = int(value)
    except (TypeError, ValueError):
        return (0.0, 0.0, 0.0)
    return (
        ((packed >> 16) & 255) / 255.0,
        ((packed >> 8) & 255) / 255.0,
        (packed & 255) / 255.0,
    )


def _page_lines(page):
    """Flatten a page's text into one entry per visual line.

    Each entry carries the line box, the baseline origin of its first span and
    the face details, which is everything needed to redraw that line in place.
    """
    lines = []
    try:
        blocks = page.get_text("dict").get("blocks", [])
    except Exception:
        return lines
    for block in blocks:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans") or []
            if not spans:
                continue
            text = "".join(str(span.get("text", "")) for span in spans)
            if not text.strip():
                continue
            bbox = [round(float(v), 2) for v in line.get("bbox", (0, 0, 0, 0))]
            first = spans[0]
            origin = first.get("origin") or (bbox[0], bbox[3])
            lines.append({
                "text": text,
                "bbox": bbox,
                "origin": [round(float(origin[0]), 2), round(float(origin[1]), 2)],
                "size": round(float(first.get("size", 12.0)), 2),
                "font": str(first.get("font", "")),
                "color": int(first.get("color", 0)),
            })
    return lines


def _span_at(page, rect):
    """Return the text line that best overlaps `rect`, or None."""
    import pymupdf

    best = None
    best_area = 0.0
    for line in _page_lines(page):
        try:
            box = pymupdf.Rect(line["bbox"])
        except Exception:
            continue
        if box.is_empty or box.is_infinite:
            continue
        inter = box & rect
        if inter.is_empty or inter.is_infinite:
            continue
        area = inter.get_area()
        if area > best_area:
            best_area = area
            best = line
    return best


def _point_pairs(raw):
    points = []
    for item in raw or []:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            points.append((_number(item[0]), _number(item[1])))
    return points


def _draw_replacement(page, rect, ann, line):
    """Redraw replacement text on the original baseline, inside the line box."""
    import pymupdf

    text = str(ann.get("text", ""))
    if not text:
        return  # empty replacement: the redaction alone deletes the original

    if line:
        size = float(line.get("size", 12.0)) or 12.0
        color = _int_to_rgb(line.get("color", 0))
        font = _base14_for(line.get("font", ""))
    else:
        size = 12.0
        color = (0.0, 0.0, 0.0)
        font = _base14_for("helv")

    if ann.get("size") is not None:
        size = max(1.0, _number(ann.get("size"), size))
    if ann.get("color"):
        color = _hex_to_rgb(ann.get("color"), color)
    if ann.get("font"):
        font = _base14_for(str(ann.get("font", "helv")))

    # Horizontally the replacement starts exactly where the text it replaces
    # started, not where its line starts -- otherwise a word in the middle of
    # a sentence would be drawn on top of the words before it. Vertically we
    # reuse the line's baseline so the glyphs sit on the same line.
    baseline = rect.y1
    if line and line.get("origin"):
        baseline = float(line["origin"][1])
    origin = (rect.x0, baseline)

    # Keep the replacement on its line: if it is wider than the text it
    # replaced, shrink it rather than letting it run past the line box. The
    # floor stops a long replacement from turning into unreadable 5pt text;
    # past that point it is allowed to overhang, like a real word processor.
    fontname, fontfile = _resolve_font(font, text)
    available = rect.width
    if available > 0.5:
        try:
            drawn = pymupdf.get_text_length(
                text, fontname=fontname, fontsize=size, fontfile=fontfile
            )
        except Exception:
            drawn = 0.0
        if drawn > available:
            size = max(size * 0.6, size * (available / drawn), 1.0)

    extra = {"fontfile": fontfile} if fontfile else {}
    page.insert_text(
        origin,
        text,
        fontname=fontname,
        fontsize=size,
        color=color,
        **extra
    )


def op_edit(inputs, output_dir, base, plan):
    """Apply a page plan (reorder/rotate/delete) plus overlays and metadata."""
    import pymupdf

    plan = plan or {}
    doc = pymupdf.open(inputs[0])

    pages = plan.get("pages")
    if isinstance(pages, list) and pages:
        kept = []
        for spec in pages:
            if not isinstance(spec, dict):
                continue
            src = int(_number(spec.get("src"), -1))
            if 0 <= src < doc.page_count:
                kept.append((src, int(_number(spec.get("rotate"), 0)) % 360))
        if not kept:
            raise ValueError("The edit plan does not keep any pages.")
        # pymupdf's select() takes 0-based positions and keeps the given order.
        doc.select([src for src, _ in kept])
        for index, (_, rotate) in enumerate(kept):
            if rotate:
                doc[index].set_rotation(rotate)

    # --- existing-text replacement -----------------------------------------
    # Redactions have to be applied before the replacement glyphs are drawn,
    # otherwise apply_redactions() would strip the new text as well. So the
    # replace pass is collected first, applied per page, then written.
    pending = {}
    for ann in plan.get("annotations") or []:
        if not isinstance(ann, dict) or str(ann.get("kind", "")) != "replace":
            continue
        index = int(_number(ann.get("page"), -1))
        if not (0 <= index < doc.page_count):
            continue
        needle = str(ann.get("find", ""))
        if not needle.strip():
            continue
        page = doc[index]
        try:
            hits = page.search_for(needle)
        except Exception:
            continue
        if not hits:
            continue
        occurrence = int(_number(ann.get("occurrence"), 0))
        targets = hits if occurrence < 0 else hits[occurrence:occurrence + 1]
        if not targets:
            continue
        line = _span_at(page, targets[0])
        fill = _hex_to_rgb(ann.get("bg"), (1.0, 1.0, 1.0))
        for rect in targets:
            if rect.is_empty or rect.is_infinite:
                continue
            pending.setdefault(index, []).append((rect, ann, line))
            try:
                page.add_redact_annot(rect, fill=fill)
            except Exception:
                continue

    for index, items in pending.items():
        page = doc[index]
        try:
            # Only strip text: neighbouring line art and images must survive.
            page.apply_redactions(
                images=pymupdf.PDF_REDACT_IMAGE_NONE,
                graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
                text=pymupdf.PDF_REDACT_TEXT_REMOVE,
            )
        except Exception:
            continue
        for rect, ann, line in items:
            _draw_replacement(page, rect, ann, line)

    for ann in plan.get("annotations") or []:

        if not isinstance(ann, dict):
            continue
        index = int(_number(ann.get("page"), -1))
        if not (0 <= index < doc.page_count):
            continue

        kind = str(ann.get("kind", ""))
        page = doc[index]
        color = _hex_to_rgb(ann.get("color"))
        alpha = _opacity(ann.get("opacity"))

        if kind == "text":
            fontname = EDIT_FONTS.get(str(ann.get("font", "helv")), "helv")
            page.insert_text(
                (_number(ann.get("x")), _number(ann.get("y"))),
                str(ann.get("text", "")),
                fontname=fontname,
                fontsize=max(1.0, _number(ann.get("size"), 12.0)),
                color=color,
            )
        elif kind == "image":
            asset = str(ann.get("asset") or "")
            if not asset or not os.path.isfile(asset):
                continue
            x = _number(ann.get("x"))
            y = _number(ann.get("y"))
            rect = pymupdf.Rect(x, y, x + _number(ann.get("w"), 1.0), y + _number(ann.get("h"), 1.0))
            if rect.is_empty:
                continue
            page.insert_image(rect, filename=asset, keep_proportion=False, overlay=True)
        elif kind in ("draw", "highlight"):
            points = _point_pairs(ann.get("points"))
            if len(points) < 2:
                continue
            shape = page.new_shape()
            shape.draw_polyline(points)
            if kind == "highlight":
                width = max(4.0, _number(ann.get("width"), 12.0))
                shape.finish(
                    color=color,
                    fill=color,
                    width=width,
                    fill_opacity=alpha,
                    stroke_opacity=alpha,
                    lineCap=1,
                    lineJoin=1,
                )
            else:
                shape.finish(
                    color=color,
                    width=max(0.5, _number(ann.get("width"), 2.0)),
                    stroke_opacity=alpha,
                    lineCap=1,
                    lineJoin=1,
                )
            shape.commit()

    metadata = plan.get("metadata")
    if isinstance(metadata, dict):
        current = dict(doc.metadata or {})
        for key in EDIT_METADATA_KEYS:
            value = metadata.get(key)
            if isinstance(value, str) and value.strip():
                current[key] = value.strip()[:300]
        doc.set_metadata(current)

    out_path = os.path.join(output_dir, "%s.pdf" % base)
    doc.save(out_path, garbage=3, deflate=True)
    doc.close()
    return out_path


def run_jobs(jobs_path):
    with open(jobs_path, "r", encoding="utf-8-sig") as fh:
        spec = json.load(fh)

    op = spec.get("op")
    if op not in OPS:
        raise ValueError("Unknown op: %s" % op)
    inputs = spec.get("inputs") or []
    inputs = [os.path.abspath(p) for p in inputs]
    for path in inputs:
        if not os.path.isfile(path):
            raise FileNotFoundError(path)
    if not inputs:
        raise ValueError("At least one input PDF is required.")

    output_dir = spec["outputDir"]
    base = spec.get("outputBase") or "doc"
    os.makedirs(output_dir, exist_ok=True)

    if op == "convert":
        out = op_convert(inputs, output_dir, base)
    elif op == "merge":
        out = op_merge(inputs, output_dir, base)
    elif op == "split":
        out = op_split(inputs, output_dir, base)
    elif op == "edit":
        out = op_edit(inputs, output_dir, base, spec.get("plan"))
    else:
        out = op_tojpg(inputs, output_dir, base)

    size_kb = max(1, round(os.path.getsize(out) / 1024))
    print("%s %s %d KB" % (os.path.basename(out), op, size_kb))
    return 0


def op_preview(pdf_path, out_dir, dpi=96.0):
    """Render every page to JPEG plus a manifest of page geometry and text.

    Used by the editor to show pages before any edit is applied. Sizes are
    reported in points and already account for each page's /Rotate, which is
    the same space the edit plan uses. Each page also carries its text lines
    so the editor can offer click-to-edit on real text, not just overlays.
    """
    import pymupdf

    os.makedirs(out_dir, exist_ok=True)
    doc = pymupdf.open(pdf_path)
    matrix = pymupdf.Matrix(dpi / 72.0, dpi / 72.0)
    pages = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        pix.save(os.path.join(out_dir, "page-%d.jpg" % (i + 1)))
        lines = _page_lines(page)
        pages.append({
            "index": i,
            "width": round(page.rect.width, 2),
            "height": round(page.rect.height, 2),
            # Capped so a text-heavy document cannot blow up the payload.
            "lines": lines[:PDF_MAX_PREVIEW_LINES],
            "lineCount": len(lines),
        })
    doc.close()

    with open(os.path.join(out_dir, "preview.json"), "w", encoding="utf-8") as fh:
        json.dump({"dpi": dpi, "pages": pages}, fh)
    return out_dir


def main(argv=None):
    parser = argparse.ArgumentParser(description="PhotoPdf CLI")
    parser.add_argument("--version", action="version", version="PhotoPdf CLI 1.2.0")
    parser.add_argument("--jobs", metavar="JOBS_JSON", help="process one PDF job")
    parser.add_argument("--preview", metavar="PDF", help="render page previews for the editor")
    parser.add_argument("--out", metavar="DIR", help="output directory for --preview")
    parser.add_argument("--dpi", type=float, default=96.0, help="preview DPI (default 96)")
    args = parser.parse_args(argv)

    if args.preview:
        try:
            op_preview(os.path.abspath(args.preview), args.out or os.getcwd(), args.dpi)
            return 0
        except Exception as exc:
            print("Error: %s" % exc, file=sys.stderr)
            return 1

    if not args.jobs:
        print(__doc__)
        return 0
    try:
        return run_jobs(args.jobs)
    except Exception as exc:
        print("Error: %s" % exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
