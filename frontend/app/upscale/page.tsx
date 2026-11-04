import type { Metadata } from "next";
import { UpscaleTool } from "./upscale-tool";

export const metadata: Metadata = {
  title: "AI Image Upscaler & Super-Resolution (2x / 4x) — PicTools",
  description:
    "Upscale images, photos, and digital art to 2x or 4x resolution using in-browser edge-preserving super-resolution. Restore clarity to pixelated and low-res photos.",
};

export default function UpscalePage() {
  return <UpscaleTool />;
}
