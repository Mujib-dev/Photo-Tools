import type { Metadata } from "next";
import { VoiceChangerTool } from "./voice-changer-tool";

export const metadata: Metadata = {
  title: "AI Voice Changer & Character Morpher | PicTools",
  description:
    "Transform voice recordings and video clips into different characters: Man to Girl, Woman to Deep Man, Baby & Kid, Robot, Monster, Chipmunk, Helium, Radio & Cathedral Reverb.",
};

export default function VoiceChangerPage() {
  return <VoiceChangerTool />;
}
