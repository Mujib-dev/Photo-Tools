import type { Metadata } from "next";
import { PdfSecurityTool } from "./pdf-security-tool";

export const metadata: Metadata = {
  title: "PDF Security, Locker & Permission Manager | PicTools",
  description:
    "Protect confidential contracts and sensitive documents with military-grade AES-256 encryption. Restrict printing and copying, or permanently remove passwords from unlocked PDFs.",
};

export default function PdfSecurityPage() {
  return <PdfSecurityTool />;
}
