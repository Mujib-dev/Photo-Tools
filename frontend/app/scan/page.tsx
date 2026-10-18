import type { Metadata } from "next";
import { ScanTool } from "./scan-tool";

export const metadata: Metadata = {
  title: "Document Scanner",
  description: "Scan, straighten and clean documents with automatic edge detection.",
};

export default function ScanPage() {
  return <ScanTool />;
}
