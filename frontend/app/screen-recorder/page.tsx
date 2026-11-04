import type { Metadata } from "next";
import { ScreenRecorderTool } from "./screen-recorder-tool";

export const metadata: Metadata = {
  title: "Studio Screen & Webcam Recorder + Teleprompter — PicTools",
  description:
    "Record high-resolution screen presentations with circular webcam PiP, microphone mixing, and an auto-scrolling teleprompter. 100% in-browser, private, and free.",
};

export default function ScreenRecorderPage() {
  return <ScreenRecorderTool />;
}
