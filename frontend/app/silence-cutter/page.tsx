import type { Metadata } from "next";
import { SilenceCutterTool } from "./silence-cutter-tool";

export const metadata: Metadata = {
  title: "Automatic Audio Silence & Dead Air Cutter — PicTools",
  description:
    "Detect awkward pauses, room silence, and dead air in voice recordings, lectures, and podcasts. Cut gaps seamlessly with micro-crossfades 100% in-browser.",
};

export default function SilenceCutterPage() {
  return <SilenceCutterTool />;
}
