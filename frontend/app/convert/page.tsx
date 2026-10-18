import type { Metadata } from "next";
import { ConvertTool } from "./convert-tool";

export const metadata: Metadata = {
  title: "Convert Image",
  description: "Convert your images to crisp, multi-size .ico icons.",
};

export default function ConvertPage() {
  return <ConvertTool />;
}
