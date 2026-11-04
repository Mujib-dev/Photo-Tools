import type { Metadata } from "next";
import { InvoiceGeneratorTool } from "./invoice-generator-tool";

export const metadata: Metadata = {
  title: "Smart In-Browser Invoice & Receipt Builder — PicTools",
  description:
    "Create and print client invoices and receipts with logo branding, automatic tax calculations, payment QR codes, and vector PDF export. 100% private in-browser.",
};

export default function InvoiceGeneratorPage() {
  return <InvoiceGeneratorTool />;
}
