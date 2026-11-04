import type { Metadata } from "next";
import { LegalAnalyzerTool } from "./legal-analyzer-tool";

export const metadata: Metadata = {
  title: "Smart Contract & Legal Agreement Analyzer | PicTools",
  description:
    "AI legal agreement and contract risk analyzer. Automatically detect hidden gotchas, uncapped liabilities, non-competes, evergreen auto-renewals, and unfair clauses before signing.",
};

export default function LegalAnalyzerPage() {
  return <LegalAnalyzerTool />;
}
