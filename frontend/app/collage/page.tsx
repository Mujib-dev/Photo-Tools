import type { Metadata } from "next";
import { CollageTool } from "./collage-tool";

export const metadata: Metadata = {
  title: "Collage & Combine",
  description:
    "Combine several photos into a grid, row or stacked strip — adjust spacing, corners and background, then export PNG, JPG or WEBP in your browser.",
};

export default function CollagePage() {
  return <CollageTool />;
}
