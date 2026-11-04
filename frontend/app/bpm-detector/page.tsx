import type { Metadata } from "next";
import { BpmDetectorTool } from "./bpm-detector-tool";

export const metadata: Metadata = {
  title: "AI Audio BPM, Musical Key & Tempo Detector — PicTools",
  description:
    "Detect song BPM (tempo) and musical key (Camelot Wheel) using spectral transient onset analysis. Includes live interactive tap-tempo metronome 100% in-browser.",
};

export default function BpmDetectorPage() {
  return <BpmDetectorTool />;
}
