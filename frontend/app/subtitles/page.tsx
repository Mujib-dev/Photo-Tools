import type { Metadata } from "next";
import { SubtitlesTool } from "./subtitles-tool";

export const metadata: Metadata = {
  title: "Auto Video Subtitle & Animated Caption Studio — PicTools",
  description:
    "Generate, edit, and burn viral TikTok, Reels, and YouTube Shorts captions onto videos. Export standard .SRT and .VTT subtitle files 100% in-browser.",
};

export default function SubtitlesPage() {
  return <SubtitlesTool />;
}
