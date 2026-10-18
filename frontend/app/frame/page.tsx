import type { Metadata } from "next";
import { FrameTool } from "./frame-tool";

export const metadata: Metadata = {
  title: "Borders & Text",
  description:
    "Add borders, rounded corners and captions or watermarks to photos, then export PNG, JPG or WEBP — entirely in your browser.",
};

export default function FramePage() {
  return <FrameTool />;
}
