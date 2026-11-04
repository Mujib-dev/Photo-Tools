"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FileUp,
  Gavel,
  HelpCircle,
  Info,
  Loader2,
  Lock,
  RotateCcw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AuthGate } from "@/components/auth-gate";
import {
  analyzeLegalAgreement,
  SAMPLE_CONTRACT_TEXT,
  type LegalAnalysisResult,
  type LegalRiskItem,
} from "@/lib/legal-analyzer";
import {
  extractTextFromFile,
  RESUME_ACCEPTED_EXTENSIONS,
  type ExtractedFileResult,
} from "@/lib/file-text-extractor";
import { cn } from "@/lib/utils";

export function LegalAnalyzerTool() {
  const [contractText, setContractText] = React.useState<string>(SAMPLE_CONTRACT_TEXT);
  const [isAnalyzing, setIsAnalyzing] = React.useState<boolean>(false);
  const [analysis, setAnalysis] = React.useState<LegalAnalysisResult | null>(null);

  // File metadata & extraction state
  const [contractFileMeta, setContractFileMeta] = React.useState<ExtractedFileResult | null>(null);
  const [isExtractingContract, setIsExtractingContract] = React.useState<boolean>(false);
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const contractFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = React.useState<"risks" | "summary" | "obligations">("risks");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Auto-run analysis on mount with the sample contract
  React.useEffect(() => {
    runAnalysis();
  }, []);

  const runAnalysis = () => {
    if (!contractText.trim()) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      const res = analyzeLegalAgreement(contractText);
      setAnalysis(res);
      setIsAnalyzing(false);
    }, 450);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const processUploadedContract = async (file: File) => {
    setIsExtractingContract(true);
    try {
      const result = await extractTextFromFile(file);
      setContractText(result.text);
      setContractFileMeta(result);
      toast.success(
        `Parsed ${result.fileName} (${result.wordCount} words${
          result.pageCount ? ` · ${result.pageCount} pages` : ""
        })`
      );
      setTimeout(() => {
        const res = analyzeLegalAgreement(result.text);
        setAnalysis(res);
      }, 150);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to extract text from legal document.");
    } finally {
      setIsExtractingContract(false);
    }
  };

  const onContractDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processUploadedContract(file);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-400">
          <Scale className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
          AI Legal Audit & Gotcha Detector
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          Smart Contract & <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">Legal Agreement Analyzer</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-muted-foreground">
          Never sign a bad agreement. Instantly identify uncapped liability, sneaky auto-renewals, broad IP forfeiture, and get plain-English counter-proposals to negotiate safely.
        </p>
      </div>

      {/* Main Contract Input */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onContractDrop}
        className={cn(
          "relative mt-8 rounded-2xl border bg-card p-6 shadow-sm transition-all",
          isDragging
            ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/30"
            : "border-border"
        )}
      >
        {/* Drag Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-card/95 backdrop-blur-xs border-2 border-dashed border-amber-500 animate-in fade-in-50">
            <FileUp className="h-10 w-10 text-amber-400 animate-bounce" />
            <p className="mt-2 text-sm font-bold text-foreground">Drop Legal Agreement File Here</p>
            <p className="text-xs text-muted-foreground">Supports PDF (.pdf), Word (.docx, .doc), TXT, RTF</p>
          </div>
        )}

        {/* Loading Extraction Overlay */}
        {isExtractingContract && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-card/90 backdrop-blur-xs animate-in fade-in-50">
            <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
            <p className="mt-2 text-xs font-semibold text-foreground">Extracting contract text in-browser...</p>
            <p className="text-[11px] text-muted-foreground">Parsing structure, pages & clauses securely</p>
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-400" />
            <label htmlFor="contract-input" className="text-sm font-bold text-foreground">
              Agreement, NDA, or Contract Text
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setContractText(SAMPLE_CONTRACT_TEXT);
                setContractFileMeta(null);
                toast.info("Reset to sample risky consulting agreement.");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-2 cursor-pointer"
            >
              Load Sample Risky Agreement
            </button>
            <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 transition">
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Agreement (PDF, Word, TXT)</span>
              <input
                ref={contractFileInputRef}
                type="file"
                accept={RESUME_ACCEPTED_EXTENSIONS}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void processUploadedContract(f);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Active File Pill Badge */}
        {contractFileMeta && (
          <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
            <div className="flex items-center gap-2 min-w-0">
              <FileCheck2 className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="font-semibold truncate">{contractFileMeta.fileName}</span>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-amber-300 shrink-0">
                {contractFileMeta.kind.toUpperCase()}
                {contractFileMeta.pageCount ? ` · ${contractFileMeta.pageCount} pg` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setContractFileMeta(null)}
              className="rounded p-0.5 text-amber-300 hover:bg-amber-500/20 hover:text-amber-100 cursor-pointer"
              title="Dismiss file pill"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <textarea
          id="contract-input"
          value={contractText}
          onChange={(e) => {
            setContractText(e.target.value);
            if (contractFileMeta) setContractFileMeta(null);
          }}
          placeholder="Paste agreement text here or drag & drop a PDF / Word DOCX contract..."
          rows={12}
          className="w-full resize-y rounded-xl border border-border bg-background/80 p-3.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground flex items-center gap-4">
            <span>{contractText.split(/\s+/).filter(Boolean).length} words</span>
            <span>{contractText.length} characters</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" /> 100% In-Memory & Confidential
            </span>
          </div>

          <button
            type="button"
            onClick={runAnalysis}
            disabled={isAnalyzing || !contractText.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/20 transition hover:opacity-95 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            Run Deep Legal Risk Audit
          </button>
        </div>
      </div>

      {/* Analysis Results View */}
      {analysis && (
        <div className="mt-10 space-y-8 animate-in fade-in-50 duration-300">
          {/* Header Metadata & Risk Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Contract Classification Card */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Contract Classification
                </span>
                <Gavel className="h-4 w-4 text-amber-400" />
              </div>
              <h3 className="font-extrabold text-base text-foreground leading-snug">
                {analysis.contractType}
              </h3>
              <p className="text-xs text-muted-foreground">
                Governing Law: <strong className="text-foreground">{analysis.governingLaw || "Delaware, USA"}</strong>
              </p>
              {analysis.partiesDetected.length > 0 && (
                <div className="pt-1 text-[11px] text-muted-foreground">
                  Parties: {analysis.partiesDetected.join(" & ")}
                </div>
              )}
            </div>

            {/* Risk Rating Card */}
            <div
              className={cn(
                "rounded-2xl border p-5 space-y-2",
                analysis.riskRating === "critical"
                  ? "border-rose-500/40 bg-rose-950/15"
                  : analysis.riskRating === "high"
                  ? "border-orange-500/40 bg-orange-950/15"
                  : "border-emerald-500/40 bg-emerald-950/15"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Overall Risk Score
                </span>
                <AlertTriangle
                  className={cn(
                    "h-4 w-4",
                    analysis.riskRating === "critical"
                      ? "text-rose-400"
                      : analysis.riskRating === "high"
                      ? "text-orange-400"
                      : "text-emerald-400"
                  )}
                />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-foreground">
                  {analysis.overallRiskScore} / 100
                </span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase",
                    analysis.riskRating === "critical"
                      ? "bg-rose-500 text-white"
                      : analysis.riskRating === "high"
                      ? "bg-orange-500 text-white"
                      : "bg-emerald-500 text-white"
                  )}
                >
                  {analysis.riskRating} Risk
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {analysis.risks.length} legal liabilities & red flags detected requiring review.
              </p>
            </div>

            {/* Fairness Rating Card */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Fairness Index
                </span>
                <Scale className="h-4 w-4 text-sky-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-foreground">
                  {analysis.fairnessScore}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {analysis.fairnessScore >= 70
                    ? "Well Balanced"
                    : analysis.fairnessScore >= 45
                    ? "One-Sided"
                    : "Extremely Prejudicial"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    analysis.fairnessScore >= 70
                      ? "bg-emerald-500"
                      : analysis.fairnessScore >= 45
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  )}
                  style={{ width: `${analysis.fairnessScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex overflow-x-auto border-b border-border/70 pb-px gap-2">
            {[
              { id: "risks", label: "🚨 Red Flags & Negotiation Clauses", count: analysis.risks.length },
              { id: "summary", label: "📝 Plain-English Executive Summary", count: analysis.executiveSummary.length },
              { id: "obligations", label: "⏱️ Deadlines & Obligations Table", count: analysis.obligations.length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-bold transition",
                  activeTab === tab.id
                    ? "border-amber-500 text-amber-400 bg-amber-500/5"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <span>{tab.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* TAB 1: Red Flags & Counter Proposals */}
          {activeTab === "risks" && (
            <div className="space-y-4">
              {analysis.risks.map((risk, idx) => (
                <div
                  key={risk.id}
                  className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold",
                          risk.severity === "critical"
                            ? "bg-rose-500/20 text-rose-400"
                            : risk.severity === "high"
                            ? "bg-orange-500/20 text-orange-400"
                            : "bg-amber-500/20 text-amber-400"
                        )}
                      >
                        #{idx + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                          {risk.title}
                        </h4>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                          Category: {risk.category.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase",
                        risk.severity === "critical"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : risk.severity === "high"
                          ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      )}
                    >
                      {risk.severity} Severity
                    </span>
                  </div>

                  {/* Offending Clause Quote */}
                  <div className="rounded-xl border border-rose-500/25 bg-rose-950/10 p-3.5 text-xs">
                    <span className="block font-bold text-rose-400 text-[10px] uppercase mb-1">
                      Offending Contract Clause
                    </span>
                    <p className="font-mono text-foreground italic leading-relaxed">
                      "{risk.excerpt}"
                    </p>
                  </div>

                  {/* Plain English Explanation */}
                  <div className="text-xs text-foreground leading-relaxed">
                    <strong className="text-muted-foreground block mb-1">Why this is dangerous for you:</strong>
                    {risk.explanation}
                  </div>

                  {/* Negotiation Counter-Clause */}
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400 text-[10px] uppercase flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Recommended Counter-Proposal (Send to Client / Lawyer)
                      </span>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(risk.recommendation, risk.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition"
                      >
                        {copiedId === risk.id ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> Copied Clause!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" /> Copy Counter-Clause
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-foreground font-mono leading-relaxed bg-background/50 p-2.5 rounded-lg border border-border/50">
                      {risk.recommendation}
                    </p>
                  </div>
                </div>
              ))}

              {analysis.risks.length === 0 && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
                  <ShieldCheck className="mx-auto h-8 w-8 text-emerald-400" />
                  <h4 className="mt-2 text-sm font-bold text-foreground">Clean Agreement!</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    No critical red flags, uncapped liabilities, or sneaky auto-renewals detected.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Executive Summary */}
          {activeTab === "summary" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-400" />
                  Plain-English Executive Translation
                </h3>
                <div className="space-y-2 text-xs text-foreground leading-relaxed">
                  {analysis.executiveSummary.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <span className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pros vs Cons Grid */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-500/30 bg-card p-5 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Protective Elements (Pros)
                  </h4>
                  <div className="space-y-2 text-xs text-foreground">
                    {analysis.pros.map((p, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-500/30 bg-card p-5 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4" /> Dangerous Elements (Cons)
                  </h4>
                  <div className="space-y-2 text-xs text-foreground">
                    {analysis.cons.map((c, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Obligations & Deadlines */}
          {activeTab === "obligations" && (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-400" />
                Key Payment Terms, Deliverables & Deadlines
              </h3>
              <p className="text-xs text-muted-foreground">
                Extracted operational commitments, payment milestones, and notice windows.
              </p>

              <div className="space-y-3 pt-2">
                {analysis.obligations.map((ob, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border bg-background/60 p-4 text-xs"
                  >
                    <div>
                      <span className="font-bold text-foreground block mb-0.5">{ob.party}</span>
                      <p className="text-muted-foreground font-mono">{ob.description}</p>
                    </div>
                    <span className="self-start sm:self-center rounded-md bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {ob.type}
                    </span>
                  </div>
                ))}

                {analysis.obligations.length === 0 && (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    No specific payment or deadline clauses parsed from the input text.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Export & Action Hub */}
          <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm text-foreground">Export Legal Risk Report</h4>
              <p className="text-xs text-muted-foreground">Download comprehensive legal audit or copy counter-proposals</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const clauses = analysis.risks
                    .map((r, i) => `### Counter-Proposal #${i + 1}: ${r.title}\n${r.recommendation}\n`)
                    .join("\n");
                  copyToClipboard(clauses, "all-clauses");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
              >
                {copiedId === "all-clauses" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" /> Clauses Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy All Counter-Clauses
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  const report = `# Legal Agreement Risk Audit Report
Contract Type: ${analysis.contractType}
Overall Risk Score: ${analysis.overallRiskScore}/100 (${analysis.riskRating.toUpperCase()})
Fairness Index: ${analysis.fairnessScore}%
Governing Jurisdiction: ${analysis.governingLaw || "N/A"}

## Executive Summary
${analysis.executiveSummary.map((s) => `- ${s}`).join("\n")}

## Identified Red Flags & Risks
${analysis.risks
  .map(
    (r, i) =>
      `### ${i + 1}. ${r.title} [${r.severity.toUpperCase()}]
Excerpt: "${r.excerpt}"
Risk: ${r.explanation}
Recommended Counter-Proposal: ${r.recommendation}
`
  )
  .join("\n")}

## Obligations & Deadlines
${analysis.obligations.map((o) => `- [${o.party}] (${o.type}): ${o.description}`).join("\n")}
`;
                  const blob = new Blob([report], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "legal_agreement_risk_audit.md";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 transition shadow-md shadow-amber-600/20"
              >
                <Download className="h-3.5 w-3.5" /> Download Full Legal Audit (.md)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pro Features Promo */}
      <div className="mt-12">
        <AuthGate>
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center text-xs text-muted-foreground">
            Pro subscribers get unlimited legal audits, custom addendum generation, and multi-document comparisons.
          </div>
        </AuthGate>
      </div>
    </div>
  );
}
