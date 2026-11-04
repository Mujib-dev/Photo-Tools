import type { Metadata } from "next";
import { PaletteTool } from "./palette-tool";

export const metadata: Metadata = {
  title: "Image Color Palette & Gradient Studio",
  description:
    "Extract dominant color palettes, inspect WCAG accessibility contrast ratios, generate color harmonies, and synthesize CSS gradients from any photo.",
};

export default function PalettePage() {
  return <PaletteTool />;
}
