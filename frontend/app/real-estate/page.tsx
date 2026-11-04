import type { Metadata } from "next";
import { VirtualStagingTool } from "@/app/virtual-staging/virtual-staging-tool";

export const metadata: Metadata = {
  title: "AI Real Estate Staging & Exterior Twilight Studio — PicTools",
  description:
    "Transform overcast property listings into sunny, golden-hour, or luxury twilight dusk photos with virtual furniture staging, AI sky replacement, and lawn greening.",
};

export default function RealEstatePage() {
  return <VirtualStagingTool />;
}
