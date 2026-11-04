import type { Metadata } from "next";
import { UrlDownloadTool } from "./url-download-tool";

export const metadata: Metadata = {
  title: "Media Link Downloader",
  description: "Save direct media files and public HLS (.m3u8) streams as MP4, WEBM, MP3 or M4A.",
};

export default function UrlDownloadPage() {
  return <UrlDownloadTool />;
}
