import type { Metadata } from "next";
import { VoiceEnhancerTool } from "./voice-enhancer-tool";

export const metadata: Metadata = {
  title: "AI Voice Isolator & Podcast Audio Enhancer — PicTools",
  description:
    "Isolate vocals, remove background hiss and mic rumble, and apply broadcast dynamics compression and presence EQ 100% in-browser with zero latency.",
};

export default function VoiceEnhancerPage() {
  return <VoiceEnhancerTool />;
}
