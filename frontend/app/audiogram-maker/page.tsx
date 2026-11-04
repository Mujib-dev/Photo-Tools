import type { Metadata } from "next";
import { AudiogramMakerTool } from "./audiogram-maker-tool";

export const metadata: Metadata = {
  title: "Viral Podcast Audiogram & Waveform Video Studio — PicTools",
  description:
    "Convert podcast clips and voice notes into viral dancing waveform audiograms for TikTok, Reels, and Shorts with AI climax hook detection and in-browser rendering.",
};

export default function AudiogramMakerPage() {
  return <AudiogramMakerTool />;
}
