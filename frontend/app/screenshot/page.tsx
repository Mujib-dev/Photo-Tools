import type { Metadata } from "next";
import { ScreenshotTool } from "./screenshot-tool";

export const metadata: Metadata = {
  title: "Screenshot Studio",
  description:
    "Capture your screen, long documents and custom regions, then combine the shots into a PDF — entirely in your browser.",
};

export default function ScreenshotPage() {
  return <ScreenshotTool />;
}
