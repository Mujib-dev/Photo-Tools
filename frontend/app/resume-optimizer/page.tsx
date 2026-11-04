import type { Metadata } from "next";
import { ResumeOptimizerTool } from "./resume-optimizer-tool";

export const metadata: Metadata = {
  title: "AI Resume & ATS Score Optimizer | PicTools",
  description:
    "Scan your resume against any job description with enterprise ATS simulation. Identify missing keywords, get Google X-Y-Z formula bullet point rewrites, and boost interview callbacks.",
};

export default function ResumeOptimizerPage() {
  return <ResumeOptimizerTool />;
}
