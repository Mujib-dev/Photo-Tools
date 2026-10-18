import type { Metadata } from "next";
import { WatermarkTool } from "./watermark-tool";

export const metadata: Metadata = {
  title: "Photo Watermark",
  description: "Stamp text watermarks over your photos.",
};

export default function WatermarkPage() {
  return <WatermarkTool />;
}
