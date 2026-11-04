import type { Metadata } from "next";
import { SplitterTool } from "./splitter-tool";

export const metadata: Metadata = {
  title: "Social Carousel Slicer & Grid Splitter",
  description:
    "Slice panoramas into seamless swipe carousels (4:5, 1:1) and create 3x3 profile puzzle grids for Instagram, LinkedIn, and social media with instant ZIP export.",
};

export default function SplitterPage() {
  return <SplitterTool />;
}
