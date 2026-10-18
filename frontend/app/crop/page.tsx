import type { Metadata } from "next";
import { CropTool } from "./crop-tool";

export const metadata: Metadata = {
  title: "Crop & Rotate",
  description:
    "Rotate, flip and crop photos with aspect-ratio presets and export PNG, JPG or WEBP — entirely in your browser.",
};

export default function CropPage() {
  return <CropTool />;
}
