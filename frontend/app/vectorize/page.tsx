import type { Metadata } from "next";
import { VectorizeTool } from "./vectorize-tool";

export const metadata: Metadata = {
  title: "Bitmap to SVG Vectorizer & Tracer",
  description:
    "Convert raster images, logos, icons, sketches, and signatures into clean, infinitely scalable SVG vector graphics.",
};

export default function VectorizePage() {
  return <VectorizeTool />;
}
