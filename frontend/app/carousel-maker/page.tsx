import type { Metadata } from "next";
import { CarouselMakerTool } from "./carousel-maker-tool";

export const metadata: Metadata = {
  title: "Seamless Panoramic Carousel Maker — PicTools",
  description:
    "Design seamless continuous multi-slide carousels for Instagram, LinkedIn, and Twitter. Connect graphics across seams, slice to high-res ZIP, and export LinkedIn document PDFs.",
};

export default function CarouselMakerPage() {
  return <CarouselMakerTool />;
}
