import type { Metadata } from "next";
import { TextToSpeechTool } from "./text-to-speech-tool";

export const metadata: Metadata = {
  title: "Text to Speech",
  description:
    "Convert text into spoken audio with the voices installed on your Windows PC. Download MP3 or WAV.",
};

export default function TextToSpeechPage() {
  return <TextToSpeechTool />;
}
