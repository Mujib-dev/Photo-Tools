import type { Metadata } from "next";
import { VideoTool } from "./video-tool";

export const metadata: Metadata = {
  title: "Video Studio",
  description: "Compress, trim and export videos, animated GIFs, thumbnails, audio and frame sets.",
};

export default function VideoPage() {
  return <VideoTool />;
}
