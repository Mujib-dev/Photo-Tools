import type { Metadata } from "next";
import { RedactTool } from "./redact-tool";

export const metadata: Metadata = {
  title: "AI Smart Privacy Redactor",
  description:
    "Automatically detect and irreversibly blur or black out faces, car license plates, credit cards, and confidential text before public sharing.",
};

export default function RedactPage() {
  return <RedactTool />;
}
