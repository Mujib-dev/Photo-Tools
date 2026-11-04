import type { Metadata } from "next";
import { MemeGeneratorTool } from "./meme-generator-tool";

export const metadata: Metadata = {
  title: "AI Animated GIF & Viral Meme Studio — PicTools",
  description:
    "Create viral memes with AI-suggested punchlines, classic Impact font with black borders, or modern Twitter social card styling 100% in-browser.",
};

export default function MemeGeneratorPage() {
  return <MemeGeneratorTool />;
}
