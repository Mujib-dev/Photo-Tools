import type { Metadata } from "next";
import { OutfitStudioTool } from "./outfit-studio-tool";

export const metadata: Metadata = {
  title: "AI Virtual Outfit Swapper & Fashion Fitting Studio — PicTools",
  description:
    "Fit apparel over models with realistic fabric shading, customize colorways, and get AI styling recommendations for footwear, accessories, and coordinated palettes.",
};

export default function OutfitStudioPage() {
  return <OutfitStudioTool />;
}
