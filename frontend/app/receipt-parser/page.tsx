import type { Metadata } from "next";
import { ReceiptParserTool } from "./receipt-parser-tool";

export const metadata: Metadata = {
  title: "AI Receipt & Invoice Financial Parser | PicTools",
  description:
    "Scan restaurant receipts, retail bills, and B2B invoices. Automatically extract vendor, date, line items, taxes, and totals into Excel, CSV, or structured JSON for effortless expense reporting.",
};

export default function ReceiptParserPage() {
  return <ReceiptParserTool />;
}
