import type { Metadata } from "next";
import { DocumentDiffTool } from "./document-diff-tool";

export const metadata: Metadata = {
  title: "Smart Document Compare & Contract Diff Studio — PicTools",
  description:
    "Compare two versions of any PDF, Word (.docx), or contract. Instantly spot sneaky clause changes, altered payment amounts, and date modifications. 100% in-browser.",
};

export default function DocumentDiffPage() {
  return <DocumentDiffTool />;
}
