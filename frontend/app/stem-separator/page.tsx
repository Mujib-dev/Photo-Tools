import type { Metadata } from "next";
import { StemSeparatorTool } from "./stem-separator-tool";

export const metadata: Metadata = {
  title: "AI Vocal Remover & Karaoke Stem Separator | PicTools",
  description:
    "Isolate crystal-clear vocals (acapella) and backing tracks (karaoke) from any audio or video file. Real-time dual-track live faders, solo/mute auditioning, and high-fidelity MP3/WAV export.",
};

export default function StemSeparatorPage() {
  return <StemSeparatorTool />;
}
