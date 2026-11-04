import type { Metadata } from "next";
import { SteganographyTool } from "./steganography-tool";

export const metadata: Metadata = {
  title: "Invisible Image Steganography & Anti-Theft Studio — PicTools",
  description:
    "Hide secret text, copyright signatures, or private keys invisibly inside image pixels (LSB) and decode hidden messages 100% in-browser.",
};

export default function SteganographyPage() {
  return <SteganographyTool />;
}
