import type { Metadata } from "next";
import { FloorplanStagerTool } from "./floorplan-stager-tool";

export const metadata: Metadata = {
  title: "AI Floor Plan to 3D Interior Stager — PicTools",
  description:
    "Drop a 2D architectural blueprint, floor sketch, or empty room photo and generate a photorealistic 3D interior render (Japandi, Scandinavian, Modern Luxury).",
};

export default function FloorplanStagerPage() {
  return <FloorplanStagerTool />;
}
