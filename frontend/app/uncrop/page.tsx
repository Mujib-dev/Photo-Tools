import type { Metadata } from "next";
import { UncropTool } from "./uncrop-tool";

export const metadata: Metadata = {
  title: "AI Canvas Expander & Generative Uncrop",
  description:
    "Expand photo canvas boundaries beyond original borders with generative texture synthesis, seamless multi-layer blending, and social aspect ratio outpainting presets.",
};

export default function UncropPage() {
  return <UncropTool />;
}
