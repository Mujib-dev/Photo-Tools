import type { Metadata } from "next";
import { DocumentRedactorTool } from "./document-redactor-tool";

export const metadata: Metadata = {
  title: "Smart PII Document Sanitizer & Compliance Redactor — PicTools",
  description:
    "Permanently redact SSNs, bank info, and private data with irreversible pixel destruction, AI PII auto-detection, and official FOIA/HIPAA compliance audit stamps.",
};

export default function DocumentRedactorPage() {
  return <DocumentRedactorTool />;
}
