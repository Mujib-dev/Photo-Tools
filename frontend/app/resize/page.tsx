import type { Metadata } from "next";
import { ResizeTool } from "./resize-tool";

export const metadata: Metadata = {
  title: "Resize Image",
  description: "Resize your photos to any dimensions while maintaining quality.",
};

export default function ResizePage() {
  return <ResizeTool />;
}
