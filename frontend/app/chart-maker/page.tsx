import type { Metadata } from "next";
import { ChartMakerTool } from "./chart-maker-tool";

export const metadata: Metadata = {
  title: "Quick Chart & Infographic Studio — PicTools",
  description:
    "Generate publication-ready Bar, Donut, Line, and Area vector charts from spreadsheet numbers. Export 4K PNG charts 100% in-browser.",
};

export default function ChartMakerPage() {
  return <ChartMakerTool />;
}
