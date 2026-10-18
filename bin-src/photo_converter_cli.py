# -*- coding: utf-8 -*-
"""
Photo Converter / ICO Converter (CLI-enabled rebuild)
======================================================
Reconstruction of the original "Modern ICO Converter" desktop application.

Processing core (identical engine to the original app):
    open image -> convert("RGBA") -> center square crop -> LANCZOS resize
    -> save as multi-size .ico via Pillow's ICO writer.

Added a command-line mode so the app can be driven reliably by external
tooling without any GUI interaction.

Usage (CLI):
    PhotoConverter.exe --input <image> --output <file> [--format ico|png|jpg|jpeg|bmp|tiff|webp|gif] [--sizes 16,32,48,64,128,256]

    --format ico    multi-size .ico (center square crop, LANCZOS) [default]
    --format other  straight format conversion, original dimensions preserved

Exit codes:
    0  success
    2  usage / argument error
    1  processing error
"""

import os
import sys
import argparse

from PIL import Image, ImageOps

# ---------------------------------------------------------------------------
# Shared processing core (same engine as the original app)
# ---------------------------------------------------------------------------

DEFAULT_ICO_SIZES = [16, 32, 48, 64, 128, 256]
SUPPORTED_FORMATS = (".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".gif", ".webp")
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
    "ico": ".ico",
    "png": ".png",
    "jpg": ".jpg",
    "jpeg": ".jpg",
    "bmp": ".bmp",
    "tiff": ".tiff",
    "webp": ".webp",
    "gif": ".gif",
}


def image_to_fullsize_ico(input_path, output_path, sizes=None):
    """Convert an image to a square, multi-size .ico (RGBA, LANCZOS resize)."""
    if sizes is None:
        sizes = DEFAULT_ICO_SIZES
    sizes = sorted(set(int(s) for s in sizes if int(s) > 0))
    if not sizes:
        raise ValueError("at least one positive ICO size is required")

    img = Image.open(input_path)
    img = ImageOps.exif_transpose(img).convert("RGBA")
    width, height = img.size
    min_side = min(width, height)

    # center square crop
    left = (width - min_side) // 2
    top = (height - min_side) // 2
    right = left + min_side
    bottom = top + min_side
    img = img.crop((left, top, right, bottom))

    # resize the base image to the largest requested size (LANCZOS, as original)
    max_size = max(sizes)
    if img.width != max_size or img.height != max_size:
        img = img.resize((max_size, max_size), Image.LANCZOS)

    # Pillow generates every requested size from the base image
    img.save(output_path, format="ICO", sizes=[(s, s) for s in sizes])
    return img


def convert_to_format(input_path, output_path, out_format):
    """Straight format conversion, preserving original dimensions and aspect."""
    pil_format = PIL_FORMATS[out_format]
    img = Image.open(input_path)
    img = ImageOps.exif_transpose(img)
    if out_format in ("jpg", "jpeg", "bmp", "tiff", "gif"):
        # JPEG, BMP, TIFF and GIF have no alpha channel -> flatten cleanly onto white canvas
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            alpha_img = img.convert("RGBA")
            bg.paste(alpha_img, mask=alpha_img.split()[3])
            img = bg
        else:
            img = img.convert("RGB")
    else:
        img = img.convert("RGBA")
    img.save(output_path, format=pil_format)
    return img


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def cli_main(argv):
    parser = argparse.ArgumentParser(
        prog="PhotoConverter",
        description="Convert an image to ICO, PNG, JPG, BMP, TIFF, WEBP or GIF (same engine as the desktop app).",
    )
    parser.add_argument("--input", required=True, help="Input image path (png, jpg, jpeg, bmp, tiff, gif, webp).")
    parser.add_argument("--output", required=True, help="Output path. Extension selects the format when --format is omitted.")
    parser.add_argument(
        "--format",
        choices=["ico", "png", "jpg", "jpeg", "bmp", "tiff", "webp", "gif"],
        default=None,
        help="Output format. Defaults to ico (or the extension of --output for non-ico).",
    )
    parser.add_argument(
        "--sizes",
        default=",".join(str(s) for s in DEFAULT_ICO_SIZES),
        help="Comma-separated icon sizes in pixels, for --format ico (default 16,32,48,64,128,256).",
    )
    parser.add_argument("--version", action="version", version="PhotoConverter CLI 2.0.0")

    args = parser.parse_args(argv)

    if not os.path.isfile(args.input):
        print(f"Error: input file not found: {args.input}", file=sys.stderr)
        return 1

    out_format = args.format
    if out_format is None:
        ext = os.path.splitext(args.output)[1].lower()
        out_format = "ico" if ext in ("", ".ico") else ext.lstrip(".")
        if out_format not in PIL_FORMATS and out_format != "ico":
            print(
                f"Error: unsupported output extension .{out_format} "
                "(use --format ico|png|jpg|jpeg|bmp|tiff|webp|gif)",
                file=sys.stderr,
            )
            return 2

    try:
        # Force a consistent extension for the requested format.
        desired_ext = FORMAT_EXTENSIONS[out_format]
        base, _ = os.path.splitext(args.output)
        output_path = base + desired_ext if os.path.splitext(args.output)[1].lower() != desired_ext else args.output

        output_dir = os.path.dirname(os.path.abspath(output_path))
        os.makedirs(output_dir, exist_ok=True)

        if out_format == "ico":
            sizes = [int(s) for s in args.sizes.replace(";", ",").split(",") if s.strip()]
            image_to_fullsize_ico(args.input, output_path, sizes)
        else:
            convert_to_format(args.input, output_path, out_format)
    except Exception as exc:  # keep errors friendly for the backend
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Converted {os.path.basename(args.input)} -> {os.path.basename(output_path)} ({out_format})")
    return 0


# ---------------------------------------------------------------------------
# GUI (reconstruction of the original "Modern ICO Converter")
# ---------------------------------------------------------------------------

def gui_main():
    from PyQt6.QtWidgets import (
        QApplication, QWidget, QLabel, QPushButton, QVBoxLayout,
        QFileDialog, QMessageBox, QListWidget, QProgressBar, QHBoxLayout,
    )
    from PyQt6.QtGui import QPixmap, QLinearGradient, QBrush, QPalette, QColor
    from PyQt6.QtCore import Qt

    def set_folder_icon(folder_path, ico_path):
        """Windows folder icon via desktop.ini (as in the original app)."""
        try:
            desktop_ini = os.path.join(folder_path, "desktop.ini")
            with open(desktop_ini, "w") as f:
                f.write("[.ShellClassInfo]\n")
                f.write("IconResource=" + os.path.basename(ico_path) + ",0\n")
                f.write("IconFile={}\n".format(os.path.basename(ico_path)))
                f.write("IconIndex=0\n")
            os.system(f'attrib +h "{desktop_ini}"')
            os.system(f'attrib +r "{folder_path}"')
            import ctypes
            SHCNE_ASSOCCHANGED = 0x08000000
            SHCNF_IDLIST = 0x0000
            ctypes.windll.shell32.SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None)
        except Exception as exc:
            print(f"Warning: could not set folder icon: {exc}")

    class ICOConverter(QWidget):
        def __init__(self):
            super().__init__()
            self.setWindowTitle("Modern ICO Converter")
            self.setFixedSize(620, 560)
            self.selected_images = []
            self.selected_folder = ""

            self.setAutoFillBackground(True)
            palette = self.palette()
            gradient = QLinearGradient(0, 0, 0, self.height())
            gradient.setColorAt(0, QColor("#1e1e2e"))
            gradient.setColorAt(1, QColor("#2e2e3e"))
            palette.setBrush(QPalette.ColorRole.Window, QBrush(gradient))
            self.setPalette(palette)

            layout = QVBoxLayout()

            title = QLabel("Modern ICO Converter")
            title.setAlignment(Qt.AlignmentFlag.AlignCenter)
            title.setStyleSheet("font-size: 22px; font-weight: bold; color: white; padding: 8px;")
            layout.addWidget(title)

            self.input_label = QLabel("No file selected")
            self.input_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.input_label.setStyleSheet("color: #bbb; padding: 6px; border: 2px solid #555; border-radius: 8px;")
            layout.addWidget(self.input_label)

            self.preview_label = QLabel()
            self.preview_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.preview_label.setFixedHeight(150)
            layout.addWidget(self.preview_label)

            btn_style = (
                "QPushButton { background-color: #4CAF50; color: white; border-radius: 10px; padding: 10px; "
                "font-weight: bold; } QPushButton:hover { background-color: #45a049; }"
            )

            sec1 = QLabel("Single Image Conversion:")
            sec1.setStyleSheet("color: white; font-weight: bold;")
            layout.addWidget(sec1)

            self.btn_select = QPushButton("Select Image")
            self.btn_select.setStyleSheet(btn_style)
            self.btn_select.clicked.connect(self.select_image)
            layout.addWidget(self.btn_select)

            self.output_label = QLabel("Choose Output (Optional)  \u2014  default location will be used")
            self.output_label.setStyleSheet("color: #bbb;")
            layout.addWidget(self.output_label)

            self.btn_output = QPushButton("Choose Output")
            self.btn_output.clicked.connect(self.select_output)
            layout.addWidget(self.btn_output)

            sec2 = QLabel("Bulk Folder Conversion:")
            sec2.setStyleSheet("color: white; font-weight: bold; margin-top: 10px;")
            layout.addWidget(sec2)

            self.btn_bulk = QPushButton("Select Folder for Bulk Conversion")
            self.btn_bulk.clicked.connect(self.select_folder)
            layout.addWidget(self.btn_bulk)

            self.list_widget = QListWidget()
            self.list_widget.setStyleSheet("color: white; background: #2e2e3e; border-radius: 8px;")
            layout.addWidget(self.list_widget)

            self.progress_bar = QProgressBar()
            self.progress_bar.setValue(0)
            layout.addWidget(self.progress_bar)

            self.btn_convert_single = QPushButton("Convert Single Image to ICO")
            self.btn_convert_single.setStyleSheet(btn_style)
            self.btn_convert_single.clicked.connect(self.convert_single)
            layout.addWidget(self.btn_convert_single)

            self.btn_convert_bulk = QPushButton("Convert All Images in Folder & Set Icons")
            self.btn_convert_bulk.setStyleSheet(btn_style)
            self.btn_convert_bulk.clicked.connect(self.convert_bulk)
            layout.addWidget(self.btn_convert_bulk)

            self.setLayout(layout)

        def select_image(self):
            file_path, _ = QFileDialog.getOpenFileName(
                self, "Select Image", "", "Images (*.png *.jpg *.jpeg *.bmp *.tiff *.gif)"
            )
            if file_path:
                self.selected_images = [file_path]
                self.input_label.setText(os.path.basename(file_path))
                pixmap = QPixmap(file_path).scaled(
                    150, 150, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation
                )
                self.preview_label.setPixmap(pixmap)

        def select_output(self):
            file_path, _ = QFileDialog.getSaveFileName(self, "Save ICO As", "icon.ico", "ICO Files (*.ico)")
            if file_path:
                self.selected_output = file_path
                self.output_label.setText(file_path)

        def select_folder(self):
            folder = QFileDialog.getExistingDirectory(self, "Select Folder")
            if folder:
                self.selected_folder = folder
                self.list_widget.clear()
                for f in os.listdir(folder):
                    if f.lower().endswith(SUPPORTED_FORMATS):
                        self.list_widget.addItem(f)
                self.selected_images = [
                    os.path.join(folder, f)
                    for f in os.listdir(folder)
                    if f.lower().endswith(SUPPORTED_FORMATS)
                ]

        def convert_single(self):
            if not self.selected_images:
                QMessageBox.warning(self, "No Image", "Please select an image first.")
                return
            try:
                output = getattr(self, "selected_output", None)
                if not output:
                    base, _ = os.path.splitext(self.selected_images[0])
                    output = base + ".ico"
                image_to_fullsize_ico(self.selected_images[0], output)
                QMessageBox.information(self, "Success", f"ICO created:\n{output}")
            except Exception as exc:
                QMessageBox.critical(self, "Error", f"Failed:\n{exc}")

        def convert_bulk(self):
            if not self.selected_folder:
                QMessageBox.warning(self, "No Folder", "Please select a folder first.")
                return
            files = [f for f in self.selected_images if f.lower().endswith(SUPPORTED_FORMATS)]
            total = len(files)
            if total == 0:
                QMessageBox.information(self, "Done", "No supported images in the folder.")
                return
            try:
                for index, img_path in enumerate(files):
                    base, _ = os.path.splitext(img_path)
                    image_to_fullsize_ico(img_path, base + ".ico")
                    percent = int((index + 1) / total * 100)
                    self.progress_bar.setValue(percent)
                    QApplication.processEvents()
                ico_path = os.path.join(self.selected_folder, "folder.ico")
                image_to_fullsize_ico(files[0], ico_path)
                set_folder_icon(self.selected_folder, ico_path)
                QMessageBox.information(
                    self, "Done", f"All images converted and folder icon set!\n({total} images)"
                )
            except Exception as exc:
                QMessageBox.critical(self, "Error", f"Failed:\n{exc}")

    app = QApplication(sys.argv)
    window = ICOConverter()
    window.show()
    sys.exit(app.exec_())


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    argv = sys.argv[1:]

    # Bare invocation (no arguments) launches the desktop GUI.
    if not argv:
        gui_main()
        return

    try:
        sys.exit(cli_main(argv))
    except SystemExit as exc:
        raise exc


if __name__ == "__main__":
    main()
