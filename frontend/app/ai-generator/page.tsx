import type { Metadata } from "next";
import { AiGeneratorTool } from "./ai-generator-tool";

export const metadata: Metadata = {
  title: "AI Text to Image & Video Studio — PicTools",
  description:
    "Generate photorealistic 8K images with FLUX.1, animate still photos into motion videos with 3D camera kinetics, and create full AI video clips from text prompts 100% free.",
};

export default function AiGeneratorPage() {
  return <AiGeneratorTool />;
}
