import type { Metadata } from "next";
import { EraserTool } from "./eraser-tool";

export const metadata: Metadata = {
  title: "Smart Object Inpainting & Magic Eraser",
  description:
    "Erase unwanted objects, photobombers, power lines, and blemishes with content-aware inpainting. Seamlessly reconstructs natural backgrounds and textures.",
};

export default function EraserPage() {
  return <EraserTool />;
}
