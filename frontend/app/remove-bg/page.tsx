import type { Metadata } from "next";
import { RemoveBgTool } from "./remove-bg-tool";

export const metadata: Metadata = {
  title: "Remove Background",
  description: "Remove image backgrounds with AI — transparent, white or black.",
};

export default function RemoveBgPage() {
  return <RemoveBgTool />;
}
