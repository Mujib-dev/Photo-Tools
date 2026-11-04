import type { Metadata } from "next";
import { GeotagInspectorTool } from "./geotag-inspector-tool";

export const metadata: Metadata = {
  title: "Multi-Photo Trip Route & GPS Geotag Map Studio — PicTools",
  description:
    "Plot multi-photo travel routes, inspect EXIF GPS coordinates, generate AI travelogue stories, and strip sensitive location tags before sharing.",
};

export default function GeotagInspectorPage() {
  return <GeotagInspectorTool />;
}
