import type { Metadata } from "next";
import { AppStoreBuilderTool } from "./app-store-builder-tool";

export const metadata: Metadata = {
  title: "App Store & Google Play Screenshot Packager — PicTools",
  description:
    "Generate pixel-perfect Apple App Store (6.7\", 6.5\", iPad) and Google Play promotional screenshots with 3D device bezels, connected panoramic gradients, and automated ZIP export.",
};

export default function AppStoreBuilderPage() {
  return <AppStoreBuilderTool />;
}
