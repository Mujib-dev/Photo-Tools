import type { Metadata } from "next";
import { VideoEnhanceTool } from "./video-enhance-tool";

export const metadata: Metadata = {
  title: "AI Video Enhancer & Remini Face Clarity — PicTools",
  description:
    "Transform blurry, low-resolution portrait videos into crystal-clear HD. Remini-grade face restoration, contrast adaptive sharpening (CAS), deblur, and direct high-bitrate video export.",
};

export default function VideoEnhancePage() {
  return <VideoEnhanceTool />;
}
