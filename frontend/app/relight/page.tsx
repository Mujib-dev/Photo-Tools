import type { Metadata } from "next";
import { RelightTool } from "./relight-tool";

export const metadata: Metadata = {
  title: "AI Virtual Studio Relighter",
  description:
    "Cast realistic 3D directional studio lighting, cheekbone specular highlights, and studio rim glows onto portraits and photos with an interactive light controller.",
};

export default function RelightPage() {
  return <RelightTool />;
}
