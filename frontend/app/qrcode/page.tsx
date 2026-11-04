import type { Metadata } from "next";
import { QrCodeTool } from "./qrcode-tool";

export const metadata: Metadata = {
  title: "QR Code & Smart Barcode Studio",
  description:
    "Generate branded vector QR codes for websites, Wi-Fi networks, vCard contacts, and scan QR codes directly from photos.",
};

export default function QrCodePage() {
  return <QrCodeTool />;
}
