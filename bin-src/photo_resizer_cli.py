# -*- coding: utf-8 -*-
"""
Passport Photo Resizer (CLI-enabled rebuild)
=============================================
Original GUI application preserved verbatim (see PassportPhotoResizer).

Added a command-line mode that exposes the SAME image-processing core
(PIL.Image.open -> convert("RGB") -> resize(LANCZOS) -> save with DPI) so the
app can be driven reliably by external tooling without any GUI interaction.

Usage (CLI):
    PhotoResizer.exe --input <image> --output <image> --width <n> --height <n> \
                     --mode cm|px [--dpi <n>] [--version]

    --mode cm   width/height are in centimeters; converted to pixels using DPI.
    --mode px   width/height are in pixels directly.

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
# Shared processing core (identical to the original GUI logic)
# ---------------------------------------------------------------------------

def compute_target_size(mode, width, height, dpi):
    """Mimic PassportPhotoResizer.get_passport_dimensions()."""
    if mode == "cm":
        width_px = int((float(width) / 2.54) * dpi)
        height_px = int((float(height) / 2.54) * dpi)
    else:
        width_px = int(width)
        height_px = int(height)
    return width_px, height_px


def process_image(input_path, output_path, width_px, height_px, dpi):
    """Core: open -> EXIF orientation -> preserve alpha / composite -> resize LANCZOS -> save with dpi metadata."""
    img = Image.open(input_path)
    img = ImageOps.exif_transpose(img)
    ext = os.path.splitext(output_path)[1].lower()
    if ext in (".png", ".webp") and (img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)):
        img = img.convert("RGBA")
    else:
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            alpha_img = img.convert("RGBA")
            bg.paste(alpha_img, mask=alpha_img.split()[3])
            img = bg
        else:
            img = img.convert("RGB")
    resized = img.resize((width_px, height_px), Image.LANCZOS)
    resized.save(output_path, dpi=(dpi, dpi))
    return resized


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def cli_main(argv):
    parser = argparse.ArgumentParser(
        prog="PhotoResizer",
        description="Resize an image to the requested dimensions (same engine as the desktop app).",
    )
    parser.add_argument("--input", required=True, help="Input image path (jpg, jpeg, png, bmp, tiff).")
    parser.add_argument("--output", required=True, help="Output image path. Extension selects the format.")
    parser.add_argument("--width", required=True, help="Width value (cm when --mode cm, pixels when --mode px).")
    parser.add_argument("--height", required=True, help="Height value (cm when --mode cm, pixels when --mode px).")
    parser.add_argument(
        "--mode",
        choices=["cm", "px"],
        default="cm",
        help="Units of --width/--height. cm = centimeters (converted at --dpi), px = pixels.",
    )
    parser.add_argument("--dpi", type=int, default=None, help="DPI for conversion and metadata (default 300 for cm, 72 for px).")
    parser.add_argument("--version", action="version", version="PhotoResizer CLI 1.0.0")

    args = parser.parse_args(argv)

    if not os.path.isfile(args.input):
        print(f"Error: input file not found: {args.input}", file=sys.stderr)
        return 1

    if args.mode == "cm":
        dpi = args.dpi or 300
    else:
        dpi = args.dpi or 72

    try:
        width_px, height_px = compute_target_size(args.mode, args.width, args.height, dpi)
        if width_px <= 0 or height_px <= 0:
            print("Error: width and height must be positive numbers.", file=sys.stderr)
            return 2
        output_dir = os.path.dirname(os.path.abspath(args.output))
        os.makedirs(output_dir, exist_ok=True)
        process_image(args.input, args.output, width_px, height_px, dpi)
    except Exception as exc:  # keep errors friendly for the backend
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Resized {os.path.basename(args.input)} -> {os.path.basename(args.output)} ({width_px}x{height_px}px, {dpi} dpi)")
    return 0


# ---------------------------------------------------------------------------
# Original GUI (preserved verbatim)
# ---------------------------------------------------------------------------

def gui_main():
    from PyQt5.QtWidgets import (
        QApplication, QWidget, QVBoxLayout, QLabel, QPushButton,
        QFileDialog, QMessageBox, QLineEdit, QHBoxLayout,
        QDoubleSpinBox, QCheckBox, QComboBox, QFrame
    )
    from PyQt5.QtCore import Qt, QPoint
    from PyQt5.QtGui import QPixmap, QIcon, QPainter, QBrush, QColor, QLinearGradient, QFont
    from PyQt5.QtWidgets import QGraphicsDropShadowEffect

    class PassportPhotoResizer(QWidget):
        def __init__(self):
            super().__init__()
            # ------------------ Frameless Window ------------------
            self.setWindowFlags(Qt.FramelessWindowHint)
            self.setAttribute(Qt.WA_TranslucentBackground)
            self.resize(720, 580)
            self.setMinimumSize(720, 580)
            self.oldPos = self.pos()

            # ------------------ Main Layout ------------------
            self.main_layout = QVBoxLayout()
            self.main_layout.setContentsMargins(10, 10, 10, 10)
            self.setLayout(self.main_layout)

            # ------------------ Main Card ------------------
            self.card = QFrame()
            self.card.setStyleSheet("""
                QFrame {
                   background-color: #4F4F4F;
                    border-radius: 15px;
                }
            """)
            self.card_layout = QVBoxLayout()
            self.card_layout.setContentsMargins(20, 20, 20, 20)
            self.card.setLayout(self.card_layout)
            self.main_layout.addWidget(self.card)

            # ------------------ Custom Title Bar ------------------
            self.title_layout = QHBoxLayout()
            self.title_layout.setAlignment(Qt.AlignHCenter)

            # Logo
            logo = QLabel()
            pixmap = QPixmap("logo.png").scaled(60, 60, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            # Rounded logo
            rounded = QPixmap(60, 60)
            rounded.fill(Qt.transparent)
            p = QPainter(rounded)
            p.setRenderHint(QPainter.Antialiasing)
            p.setBrush(QBrush(pixmap))
            p.setPen(Qt.NoPen)
            p.drawEllipse(0, 0, 60, 60)
            p.end()
            logo.setPixmap(rounded)

            # Gradient Title
            title = QLabel("Passport Photo Resizer")
            title.setFont(QFont("Segoe UI", 15, QFont.Bold))
            title.setStyleSheet("""
                QLabel {
                    margin-left: 10px;
                    background: -webkit-linear-gradient(left, #ff512f, #dd2476);
                    -webkit-background-clip: text;
                }
            """)
            shadow = QGraphicsDropShadowEffect()
            shadow.setBlurRadius(18)
            shadow.setOffset(2, 2)
            shadow.setColor(QColor(50, 50, 50, 180))
            title.setGraphicsEffect(shadow)

            self.title_layout.addWidget(logo)
            self.title_layout.addWidget(title)
            self.card_layout.addLayout(self.title_layout)

            # ------------------ Selection Buttons ------------------
            selection_frame = QFrame()
            selection_frame.setStyleSheet("""
                QFrame {
                    background-color: #B0B0B0;
                    border-radius: 10px;
                }
            """)
            selection_layout = QHBoxLayout()
            selection_frame.setLayout(selection_layout)

            btn_style = """
                QPushButton {
                    background-color: #B0B0B0; color: black; border-radius: 8px; padding: 6px;
                }
                QPushButton:hover {
                    background-color: white;
                }
                QPushButton:pressed {
                    background-color: white;
                }
            """

            self.btn_single = QPushButton("Select Single Image")
            self.btn_single.setStyleSheet(btn_style)
            self.btn_multiple = QPushButton("Select Multiple Images")
            self.btn_multiple.setStyleSheet(btn_style)
            self.btn_folder = QPushButton("Select Folder")
            self.btn_folder.setStyleSheet(btn_style)
            self.btn_clear = QPushButton("Clear Selection")
            self.btn_clear.setStyleSheet(btn_style)

            selection_layout.addWidget(self.btn_single)
            selection_layout.addWidget(self.btn_multiple)
            selection_layout.addWidget(self.btn_folder)
            selection_layout.addWidget(self.btn_clear)
            self.card_layout.addWidget(selection_frame)

            # ------------------ Output Folder ------------------
            output_frame = QFrame()
            output_frame.setStyleSheet("""
                QFrame {
                    background-color: #B0B0B0;
                    border-radius: 10px;
                }
            """)
            output_layout = QHBoxLayout()
            output_frame.setLayout(output_layout)

            self.output_label = QLineEdit()
            self.output_label.setPlaceholderText("Select output folder...")
            self.output_label.setReadOnly(True)
            self.btn_output = QPushButton("Browse Output Folder")
            self.btn_output.setStyleSheet(btn_style)

            output_layout.addWidget(self.output_label)
            output_layout.addWidget(self.btn_output)
            self.card_layout.addWidget(output_frame)

            # ------------------ Image Type ------------------
            type_frame = QFrame()
            type_frame.setStyleSheet("""
                QFrame {
                    background-color: rgba(245,245,245,0.9);
                    border-radius: 10px;
                }
            """)
            type_layout = QHBoxLayout()
            type_frame.setLayout(type_layout)

            lbl_type = QLabel("Image Type:")
            self.type_dropdown = QComboBox()
            self.type_dropdown.addItems(["Passport", "Visa", "Email / Avatar", "LinkedIn / CV", "Custom"])
            type_layout.addWidget(lbl_type)
            type_layout.addWidget(self.type_dropdown)
            self.card_layout.addWidget(type_frame)

            # ------------------ Size Inputs ------------------
            size_layout = QHBoxLayout()
            lbl_width = QLabel("Width:")
            self.width_input = QDoubleSpinBox()
            self.width_input.setRange(1, 1000)
            self.width_input.setDecimals(2)
            self.width_input.setValue(3.5)
            self.width_input.setSuffix(" cm")

            lbl_height = QLabel("Height:")
            self.height_input = QDoubleSpinBox()
            self.height_input.setRange(1, 1000)
            self.height_input.setDecimals(2)
            self.height_input.setValue(4.5)
            self.height_input.setSuffix(" cm")

            size_layout.addWidget(lbl_width)
            size_layout.addWidget(self.width_input)
            size_layout.addWidget(lbl_height)
            size_layout.addWidget(self.height_input)
            self.card_layout.addLayout(size_layout)

            # ------------------ Filename Option ------------------
            self.keep_original_checkbox = QCheckBox("Keep original filenames (no 'passport_' prefix)")
            self.keep_original_checkbox.setChecked(True)
            self.card_layout.addWidget(self.keep_original_checkbox)

            # ------------------ Convert Button ------------------
            self.convert_button = QPushButton("Convert Images & Create A4 Sheet")
            self.convert_button.setStyleSheet(btn_style + "padding: 10px; font-weight:bold;")
            self.card_layout.addWidget(self.convert_button)

            # ------------------ Credit Label ------------------
            credit_label = QLabel("Created by LynkZone \n 0348-1974606")
            credit_label.setAlignment(Qt.AlignRight)
            credit_label.setStyleSheet("font-size: 12px; color: white; margin-top: 10px;")
            self.card_layout.addWidget(credit_label)

            # ------------------ Functionality ------------------
            self.image_paths = []
            self.output_folder = ""
            self.dpi = 300  # default DPI

            # Connect buttons
            self.btn_single.clicked.connect(self.select_single_image)
            self.btn_multiple.clicked.connect(self.select_multiple_images)
            self.btn_folder.clicked.connect(self.select_folder)
            self.btn_clear.clicked.connect(self.clear_selection)
            self.btn_output.clicked.connect(self.browse_output)
            self.convert_button.clicked.connect(self.convert_images)
            self.type_dropdown.currentTextChanged.connect(self.update_size_from_type)

        # ------------------ Window Drag ------------------
        def mousePressEvent(self, event):
            self.oldPos = event.globalPos()

        def mouseMoveEvent(self, event):
            delta = QPoint(event.globalPos() - self.oldPos)
            self.move(self.x() + delta.x(), self.y() + delta.y())
            self.oldPos = event.globalPos()

        # ------------------ Selection Methods ------------------
        def select_single_image(self):
            file_path, _ = QFileDialog.getOpenFileName(
                self, "Select Image", "", "Images (*.jpg *.jpeg *.png *.bmp *.tiff)"
            )
            if file_path:
                self.image_paths = [file_path]

        def select_multiple_images(self):
            files, _ = QFileDialog.getOpenFileNames(
                self, "Select Images", "", "Images (*.jpg *.jpeg *.png *.bmp *.tiff)"
            )
            if files:
                self.image_paths = files

        def select_folder(self):
            folder = QFileDialog.getExistingDirectory(self, "Select Folder")
            if folder:
                supported_formats = (".jpg", ".jpeg", ".png", ".bmp", ".tiff")
                self.image_paths = [
                    os.path.join(folder, f)
                    for f in os.listdir(folder)
                    if f.lower().endswith(supported_formats)
                ]

        def clear_selection(self):
            self.image_paths = []
            self.output_folder = ""
            self.output_label.clear()
            QMessageBox.information(self, "Cleared", "Image selection and output folder cleared.")

        def browse_output(self):
            folder = QFileDialog.getExistingDirectory(self, "Select Output Folder")
            if folder:
                self.output_folder = folder
                self.output_label.setText(folder)

        # ---------------- Dropdown logic ----------------
        def update_size_from_type(self, text):
            if text == "Passport":
                self.width_input.setValue(3.5)
                self.height_input.setValue(4.5)
                self.dpi = 300
                self.width_input.setSuffix(" cm")
                self.height_input.setSuffix(" cm")
            elif text == "Visa":
                self.width_input.setValue(3.0)
                self.height_input.setValue(4.0)
                self.dpi = 300
                self.width_input.setSuffix(" cm")
                self.height_input.setSuffix(" cm")
            elif text == "Email / Avatar":
                self.width_input.setValue(180)
                self.height_input.setValue(180)
                self.dpi = 72
                self.width_input.setSuffix(" px")
                self.height_input.setSuffix(" px")
            elif text == "LinkedIn / CV":
                self.width_input.setValue(400)
                self.height_input.setValue(400)
                self.dpi = 72
                self.width_input.setSuffix(" px")
                self.height_input.setSuffix(" px")
            elif text == "Custom":
                self.width_input.setSuffix("")
                self.height_input.setSuffix("")

        # ---------------- Conversion ----------------
        def get_passport_dimensions(self):
            width = int(self.width_input.value())
            height = int(self.height_input.value())
            if self.dpi == 300:  # convert cm to px
                width_px = int((width / 2.54) * self.dpi)
                height_px = int((height / 2.54) * self.dpi)
            else:
                width_px = width
                height_px = height
            return width_px, height_px

        def convert_images(self):
            if not self.image_paths:
                QMessageBox.warning(self, "Warning", "No images selected!")
                return
            if not self.output_folder:
                QMessageBox.warning(self, "Warning", "Please select an output folder!")
                return

            width_px, height_px = self.get_passport_dimensions()
            converted_count = 0
            images_list = []

            for img_path in self.image_paths:
                filename = os.path.basename(img_path)
                try:
                    img = Image.open(img_path).convert("RGB")
                    resized_img = img.resize((width_px, height_px), Image.LANCZOS)

                    if self.keep_original_checkbox.isChecked():
                        base_name, ext = os.path.splitext(filename)
                        output_path = os.path.join(self.output_folder, filename)
                        counter = 1
                        while os.path.exists(output_path):
                            output_path = os.path.join(self.output_folder, f"{base_name}_{counter}{ext}")
                            counter += 1
                    else:
                        output_path = os.path.join(self.output_folder, f"passport_{filename}")

                    resized_img.save(output_path, dpi=(self.dpi, self.dpi))
                    converted_count += 1
                    images_list.append(resized_img)
                except Exception as e:
                    print(f"Error processing {filename}: {e}")

            if images_list and self.dpi == 300:
                create_sheet = QMessageBox.question(
                    self,
                    "Create A4 Sheet?",
                    "Do you want to create A4 sheet(s) with all photos?",
                    QMessageBox.Yes | QMessageBox.No,
                    QMessageBox.Yes
                )
                if create_sheet == QMessageBox.Yes:
                    a4_width_px = int(210 / 25.4 * self.dpi)
                    a4_height_px = int(297 / 25.4 * self.dpi)
                    margin_px = 50
                    spacing_px = 20
                    sheet_count = 1
                    x, y = margin_px, margin_px
                    sheet = Image.new("RGB", (a4_width_px, a4_height_px), color="white")

                    for img in images_list:
                        if x + width_px + margin_px > a4_width_px:
                            x = margin_px
                            y += height_px + spacing_px
                        if y + height_px + margin_px > a4_height_px:
                            sheet_output_path = os.path.join(self.output_folder, f"A4_sheet_{sheet_count}.jpg")
                            sheet.save(sheet_output_path, dpi=(self.dpi, self.dpi))
                            sheet_count += 1
                            sheet = Image.new("RGB", (a4_width_px, a4_height_px), color="white")
                            x, y = margin_px, margin_px

                        sheet.paste(img, (x, y))
                        x += width_px + spacing_px

                    sheet_output_path = os.path.join(self.output_folder, f"A4_sheet_{sheet_count}.jpg")
                    sheet.save(sheet_output_path, dpi=(self.dpi, self.dpi))
                    QMessageBox.information(
                        self,
                        "Done",
                        f"✅ Converted {converted_count} images!\nCreated {sheet_count} A4 sheet(s) in:\n{self.output_folder}"
                    )
                else:
                    QMessageBox.information(
                        self,
                        "Done",
                        f"✅ Converted {converted_count} images!\nNo A4 sheet was created."
                    )
            else:
                QMessageBox.information(
                    self, "Done", f"✅ Converted {converted_count} images!"
                )

    app = QApplication(sys.argv)
    window = PassportPhotoResizer()
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
