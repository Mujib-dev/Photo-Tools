import type { Metadata } from "next";
import { HeadshotTool } from "./headshot-tool";

export const metadata: Metadata = {
  title: "AI Professional Headshot Studio | PicTools",
  description:
    "Turn everyday selfies and phone portraits into LinkedIn-ready executive headshots. Includes architectural studio backdrops, directional rim lighting, and business framing.",
};

export default function HeadshotPage() {
  return <HeadshotTool />;
}
