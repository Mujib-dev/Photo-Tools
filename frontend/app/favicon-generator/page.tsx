import type { Metadata } from "next";
import { FaviconGeneratorTool } from "./favicon-generator-tool";

export const metadata: Metadata = {
  title: "Favicon & Complete App Icon Generator — PicTools",
  description:
    "Upload 1 logo and generate the complete favicon package: favicon.ico, Apple Touch Icon (180x180), Android 192/512px, and site.webmanifest in 1 click.",
};

export default function FaviconGeneratorPage() {
  return <FaviconGeneratorTool />;
}
