import type { Metadata } from "next";
import { ThumbnailStudioTool } from "./thumbnail-studio-tool";

export const metadata: Metadata = {
  title: "YouTube Thumbnail Studio & Feed CTR Simulator - PicTools",
  description:
    "Design high-clickability YouTube, Shorts, Reels and square thumbnails with sticker cutout borders, bold typography, background effects, a CTR readiness score and a mobile/desktop feed simulator.",
};

export default function ThumbnailStudioPage() {
  return <ThumbnailStudioTool />;
}
