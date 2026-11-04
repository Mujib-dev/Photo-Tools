import type { Metadata } from "next";
import { ViralClipsTool } from "./viral-clips-tool";

export const metadata: Metadata = {
  title: "Viral Short-Form Video Clipper & Subtitles — PicTools",
  description:
    "Re-frame widescreen videos into 9:16 vertical shorts with blurred letterbox backgrounds, animated karaoke subtitles, and hook headlines.",
};

export default function ViralClipsPage() {
  return <ViralClipsTool />;
}
