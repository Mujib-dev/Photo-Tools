import type { Metadata } from "next";
import { ParallaxAnimatorTool } from "./parallax-animator-tool";

export const metadata: Metadata = {
  title: "3D Parallax & Living Photo Animator — PicTools",
  description:
    "Turn flat 2D still images into subtle 3D parallax looping cinemagraphs, zoom-bursts, or camera orbit MP4s/GIFs with depth estimation.",
};

export default function ParallaxAnimatorPage() {
  return <ParallaxAnimatorTool />;
}
