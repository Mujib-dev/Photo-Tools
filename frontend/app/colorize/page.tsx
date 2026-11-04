import type { Metadata } from "next";
import { ColorizeTool } from "./colorize-tool";

export const metadata: Metadata = {
  title: "AI Vintage Photo Colorizer",
  description:
    "Automatically colorize black-and-white family photos, historical scans, and vintage portraits with natural skin tones, foliage, and skies.",
};

export default function ColorizePage() {
  return <ColorizeTool />;
}
