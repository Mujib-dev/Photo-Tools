import type { Metadata } from "next";
import { LutStudioTool } from "./lut-studio-tool";

export const metadata: Metadata = {
  title: "AI Film LUT & Color Grade Transfer Studio — PicTools",
  description:
    "Apply cinematic 3D Film LUTs (Kodak Portra, Teal & Orange, Fuji Velvia) or transfer the color palette from any reference image onto your photos. Export photos and standard .cube LUT files.",
};

export default function LutStudioPage() {
  return <LutStudioTool />;
}
