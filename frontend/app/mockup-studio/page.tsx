import type { Metadata } from "next";
import { MockupStudioTool } from "./mockup-studio-tool";

export const metadata: Metadata = {
  title: "3D Device Mockup Studio — PicTools",
  description:
    "Wrap app screenshots inside realistic iPhone 16 Pro, MacBook Pro, and browser frames with realistic shadows and gradient backdrops. 100% in-browser.",
};

export default function MockupStudioPage() {
  return <MockupStudioTool />;
}
