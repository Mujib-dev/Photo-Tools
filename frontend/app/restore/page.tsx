import type { Metadata } from "next";
import { RestoreTool } from "./restore-tool";

export const metadata: Metadata = {
  title: "AI Vintage Scratch & Tear Restorer",
  description:
    "Heal physical scratches, paper tears, dust speckles, and fold creases on vintage family photos with neural fast marching boundary inpainting.",
};

export default function RestorePage() {
  return <RestoreTool />;
}
