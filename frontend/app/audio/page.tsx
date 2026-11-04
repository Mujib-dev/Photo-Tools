import type { Metadata } from "next";
import { ExtractAudioTool } from "@/app/extract-audio/extract-audio-tool";

export const metadata: Metadata = {
  title: "Audio Studio & Video Sound Extractor — PicTools",
  description:
    "Extract, convert, trim, and normalize audio tracks across MP3, WAV, AAC, FLAC, M4A, OGG, and OPUS from video and audio files.",
};

export default function AudioPage() {
  return <ExtractAudioTool />;
}
