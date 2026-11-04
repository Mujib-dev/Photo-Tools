import type { Metadata } from "next";
import { EsignDocumentsTool } from "./esign-documents-tool";

export const metadata: Metadata = {
  title: "Legally-Binding E-Sign & Agreement Suite — PicTools",
  description:
    "Sign contracts, NDAs, and agreements with digital ink signatures and generate tamper-evident SHA-256 Audit Trail Certificates conforming to ESIGN and eIDAS.",
};

export default function EsignDocumentsPage() {
  return <EsignDocumentsTool />;
}
