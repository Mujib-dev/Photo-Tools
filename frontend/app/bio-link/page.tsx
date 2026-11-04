import type { Metadata } from "next";
import { BioLinkTool } from "./bio-link-tool";

export const metadata: Metadata = {
  title: "Dynamic Link-in-Bio & Smart QR Code Studio — PicTools",
  description:
    "Design mobile micro-site link pages with Apple glassmorphism and obsidian themes, generate custom vector QR codes, and export standalone single-file HTML sites.",
};

export default function BioLinkPage() {
  return <BioLinkTool />;
}
