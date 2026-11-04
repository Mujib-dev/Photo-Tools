import type { Metadata } from "next";
import { LabelPrinterTool } from "./label-printer-tool";

export const metadata: Metadata = {
  title: "Amazon FBA & Thermal Shipping Label Generator — PicTools",
  description:
    "Generate scannable Amazon FNSKU barcodes, Avery 5160 30-up sticker sheets, and 4x6 inch thermal labels for Rollo, Zebra, and Munbyn printers.",
};

export default function LabelPrinterPage() {
  return <LabelPrinterTool />;
}
