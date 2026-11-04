import type { Metadata } from "next";
import { PassportTool } from "./passport-tool";

export const metadata: Metadata = {
  title: "Biometric Passport & Visa Photo Studio",
  description:
    "Official passport, visa and ID photo studio for 50+ countries. Biometric head and eye alignment guides, auto background removal, and 4x6 inch print sheets.",
};

export default function PassportPage() {
  return <PassportTool />;
}
