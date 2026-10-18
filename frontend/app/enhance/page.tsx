import type { Metadata } from "next";
import { EnhanceTool } from "./enhance-tool";

export const metadata: Metadata = {
  title: "Enhance Photo",
  description: "Enhance your photos automatically or with fine manual control.",
};

export default function EnhancePage() {
  return <EnhanceTool />;
}
