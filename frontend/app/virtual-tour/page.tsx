import type { Metadata } from "next";
import { VirtualTourTool } from "./virtual-tour-tool";

export const metadata: Metadata = {
  title: "360° Virtual Tour & Panoramas Viewer Studio — PicTools",
  description:
    "Build interactive multi-room 360° virtual tours with equirectangular spherical views, clickable teleport hotspots, AI room feature analysis, and standalone HTML export.",
};

export default function VirtualTourPage() {
  return <VirtualTourTool />;
}
