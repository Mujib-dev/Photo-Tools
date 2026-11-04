import type { Metadata } from "next";
import { BatchTool } from "./batch-tool";

export const metadata: Metadata = {
  title: "Batch Watermarking & Bulk Photo Rename Engine",
  description:
    "Process dozens of photos at once: bulk watermark with text or custom logos, rename files with dynamic tokens, resize, and export directly into a ZIP file.",
};

export default function BatchPage() {
  return <BatchTool />;
}
