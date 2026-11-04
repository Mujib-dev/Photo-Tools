import type { Metadata } from "next";
import { GlassGeneratorTool } from "./glass-generator-tool";

export const metadata: Metadata = {
  title: "CSS Box Shadow, Mesh Gradient & 3D Glass Studio — PicTools",
  description:
    "Design Apple VisionOS frosted glassmorphism, Josh Comeau harmonic diffuse shadows, and vibrant mesh gradients with instant 1-click Tailwind and CSS code export.",
};

export default function GlassGeneratorPage() {
  return <GlassGeneratorTool />;
}
