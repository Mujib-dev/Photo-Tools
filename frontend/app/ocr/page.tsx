import type { Metadata } from "next";
import { OcrTool } from "./ocr-tool";

export const metadata: Metadata = {
  title: "AI OCR Document & Image Text Extractor",
  description:
    "Extract editable text, invoices, receipts, and tables from images and PDF documents with neural OCR, word bounding boxes, and Word/TXT export.",
};

export default function OcrPage() {
  return <OcrTool />;
}
