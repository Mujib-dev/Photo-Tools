import type { Metadata } from "next";
import { AdjustTool } from "./adjust-tool";

export const metadata: Metadata = {
  title: "Adjust & Filters",
  description:
    "Auto-tune or fine-tune brightness, contrast, saturation, warmth, hue and vignette — then export PNG, JPG or WEBP in your browser.",
};

export default function AdjustPage() {
  return <AdjustTool />;
}
