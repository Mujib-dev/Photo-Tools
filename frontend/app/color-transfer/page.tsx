import type { Metadata } from "next";
import { ColorTransferTool } from "./color-transfer-tool";

export const metadata: Metadata = {
  title: "Cinematic Color Match & Mood Transfer — PicTools",
  description:
    "Match colors, lighting, and mood between images using Reinhard CIE L*a*b* statistical transfer. Includes skin-tone protection, 35mm film grain, and standard .CUBE 3D LUT export for DaVinci Resolve & Premiere.",
};

export default function ColorTransferPage() {
  return <ColorTransferTool />;
}
