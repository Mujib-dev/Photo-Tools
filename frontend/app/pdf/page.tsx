import type { Metadata } from "next";
import { PdfTool } from "./pdf-tool";

export const metadata: Metadata = {
  title: "PDF Tools",
  description:
    "Convert PDF to Word, merge, split, edit pages and export PDF pages as JPG — all offline.",
};

export default function PdfPage() {
  return <PdfTool />;
}
