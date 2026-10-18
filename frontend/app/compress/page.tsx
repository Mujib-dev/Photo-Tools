import type { Metadata } from "next";
import { CompressTool } from "./compress-tool";

export const metadata: Metadata = {
  title: "Compress Image",
  description: "Shrink images to an exact target file size for uploads.",
};

export default function CompressPage() {
  return <CompressTool />;
}
