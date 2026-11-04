import type { Metadata } from "next";
import { BokehTool } from "./bokeh-tool";

export const metadata: Metadata = {
  title: "AI Portrait Bokeh & Depth Studio",
  description:
    "Simulate DSLR lens aperture, interactive tap-to-focus depth-of-field, specular highlight bloom, and tilt-shift miniature optics.",
};

export default function BokehPage() {
  return <BokehTool />;
}
