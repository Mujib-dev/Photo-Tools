import type { Metadata } from "next";
import { MotionStudioTool } from "./motion-studio-tool";

export const metadata: Metadata = {
  title: "Cinematic Video Speed Ramp & Motion Studio — PicTools",
  description:
    "Create Hollywood bullet-time speed ramps, dramatic slow-mo drops, and boomerang ping-pong loops with AI action climax detection 100% in-browser.",
};

export default function MotionStudioPage() {
  return <MotionStudioTool />;
}
