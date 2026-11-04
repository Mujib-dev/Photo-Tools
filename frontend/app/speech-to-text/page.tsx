import type { Metadata } from "next";
import { SpeechToTextTool } from "./speech-to-text-tool";

export const metadata: Metadata = {
  title: "Speech to Text",
  description:
    "Transcribe audio files or microphone recordings into editable text with the Windows speech recognizer.",
};

export default function SpeechToTextPage() {
  return <SpeechToTextTool />;
}
