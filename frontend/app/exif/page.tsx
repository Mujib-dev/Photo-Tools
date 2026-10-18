import type { Metadata } from "next";
import { ExifTool } from "./exif-tool";

export const metadata: Metadata = {
  title: "Metadata & EXIF",
  description:
    "Inspect and remove photo EXIF metadata — camera, settings, timestamps and GPS — losslessly in your browser.",
};

export default function ExifPage() {
  return <ExifTool />;
}
