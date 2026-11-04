import type { Metadata } from "next";
import { DocumentTranslatorTool } from "./translator-tool";

export const metadata: Metadata = {
  title: "AI Document & PDF Language Translator — PicTools",
  description:
    "Upload PDFs, Word documents, contracts, and text files and translate them side-by-side into 20+ world languages with preserved paragraph layout.",
};

export default function TranslatorPage() {
  return <DocumentTranslatorTool />;
}
