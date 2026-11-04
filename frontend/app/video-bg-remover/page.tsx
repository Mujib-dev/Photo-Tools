import type { Metadata } from "next";
import { VideoBgRemoverTool } from "./video-bg-remover-tool";

export const metadata: Metadata = {
  title: "AI Video Background Remover (Auto-Rotoscoping) — PicTools",
  description:
    "Upload any MP4, MOV or WebM video and automatically remove or replace the background without a physical green screen. Export with alpha transparency or studio backdrops.",
};

export default function VideoBgRemoverPage() {
  return <VideoBgRemoverTool />;
}
