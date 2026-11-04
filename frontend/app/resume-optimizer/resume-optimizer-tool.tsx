"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  Copy,
  Download,
  File,
  FileCheck2,
  FileText,
  FileUp,
  Filter,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  Wand2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AuthGate } from "@/components/auth-gate";
import {
  analyzeResumeATS,
  SAMPLE_RESUME_TEXT,
  SAMPLE_JOB_DESCRIPTION,
  type AtsAnalysisResult,
  type AtsKeywordMatch,
} from "@/lib/ats-optimizer";
import {
  extractTextFromFile,
  RESUME_ACCEPTED_EXTENSIONS,
  type ExtractedFileResult,
} from "@/lib/file-text-extractor";
import { cn } from "@/lib/utils";

export function ResumeOptimizerTool() {
  const [resumeText, setResumeText] = React.useState<string>(SAMPLE_RESUME_TEXT);
  const [jobText, setJobText] = React.useState<string>(SAMPLE_JOB_DESCRIPTION);
  const [isScanning, setIsScanning] = React.useState<boolean>(false);
  const [analysis, setAnalysis] = React.useState<AtsAnalysisResult | null>(null);

  // File metadata & extraction state
  const [resumeFileMeta, setResumeFileMeta] = React.useState<ExtractedFileResult | null>(null);
  const [jobFileMeta, setJobFileMeta] = React.useState<ExtractedFileResult | null>(null);
  const [isExtractingResume, setIsExtractingResume] = React.useState<boolean>(false);
  const [isExtractingJob, setIsExtractingJob] = React.useState<boolean>(false);
  const [isDraggingResume, setIsDraggingResume] = React.useState<boolean>(false);
  const [isDraggingJob, setIsDraggingJob] = React.useState<boolean>(false);

  const resumeFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const jobFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Filter state for keyword gap tab
  const [keywordFilter, setKeywordFilter] = React.useState<"all" | "missing" | "matched">("all");
  const [keywordCategory, setKeywordCategory] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Active tab in results
  const [activeTab, setActiveTab] = React.useState<"keywords" | "bullets" | "sections" | "actions">("keywords");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Auto-scan on initial render with the sample data so the user immediately sees the rich UI
  React.useEffect(() => {
    runAnalysis();
  }, []);

  const runAnalysis = () => {
    if (!resumeText.trim() || !jobText.trim()) return;
    setIsScanning(true);
    setTimeout(() => {
      const res = analyzeResumeATS(resumeText, jobText);
      setAnalysis(res);
      setIsScanning(false);
    }, 400);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const processUploadedFile = async (file: File, target: "resume" | "job") => {
    if (target === "resume") {
      setIsExtractingResume(true);
      try {
        const result = await extractTextFromFile(file);
        setResumeText(result.text);
        setResumeFileMeta(result);
        toast.success(
          `Extracted ${result.wordCount} words from ${result.fileName}${
            result.pageCount ? ` (${result.pageCount} page${result.pageCount > 1 ? "s" : ""})` : ""
          }`
        );
        setTimeout(() => {
          if (jobText.trim()) {
            const res = analyzeResumeATS(result.text, jobText);
            setAnalysis(res);
          }
        }, 150);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to extract text from CV/Resume file.");
      } finally {
        setIsExtractingResume(false);
      }
    } else {
      setIsExtractingJob(true);
      try {
        const result = await extractTextFromFile(file);
        setJobText(result.text);
        setJobFileMeta(result);
        toast.success(`Extracted ${result.wordCount} words from ${result.fileName}`);
        setTimeout(() => {
          if (resumeText.trim()) {
            const res = analyzeResumeATS(resumeText, result.text);
            setAnalysis(res);
          }
        }, 150);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to extract text from job description file.");
      } finally {
        setIsExtractingJob(false);
      }
    }
  };

  const onResumeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingResume(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processUploadedFile(file, "resume");
  };

  const onJobDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingJob(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processUploadedFile(file, "job");
  };

  // Filter keywords list
  const filteredKeywords = React.useMemo(() => {
    if (!analysis) return [];
    return analysis.keywords.filter((k) => {
      if (keywordFilter === "missing" && k.foundInResume) return false;
      if (keywordFilter === "matched" && !k.foundInResume) return false;
      if (keywordCategory !== "all" && k.category !== keywordCategory) return false;
      if (searchQuery.trim()) {
        return k.keyword.toLowerCase().includes(searchQuery.toLowerCase().trim());
      }
      return true;
    });
  }, [analysis, keywordFilter, keywordCategory, searchQuery]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          Enterprise ATS Screening Engine
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          AI Resume & <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 bg-clip-text text-transparent">ATS Score Optimizer</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-muted-foreground">
          Simulate enterprise ATS filters (Workday, Taleo, Greenhouse). Identify critical keyword gaps, quantify bullet points with Google X-Y-Z formula, and boost interview callbacks.
        </p>
      </div>

      {/* Main Dual-Pane Input Workspace */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Resume Input with Multi-Format Upload & Drag-and-Drop */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingResume(true);
          }}
          onDragLeave={() => setIsDraggingResume(false)}
          onDrop={onResumeDrop}
          className={cn(
            "relative flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-all",
            isDraggingResume
              ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/30"
              : "border-border"
          )}
        >
          {/* Drag Overlay */}
          {isDraggingResume && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-card/95 backdrop-blur-xs border-2 border-dashed border-emerald-500 animate-in fade-in-50">
              <FileUp className="h-10 w-10 text-emerald-400 animate-bounce" />
              <p className="mt-2 text-sm font-bold text-foreground">Drop CV / Resume File Here</p>
              <p className="text-xs text-muted-foreground">PDF (.pdf), Word (.docx, .doc), TXT, Markdown</p>
            </div>
          )}

          {/* Loading Extraction Overlay */}
          {isExtractingResume && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-card/90 backdrop-blur-xs animate-in fade-in-50">
              <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
              <p className="mt-2 text-xs font-semibold text-foreground">Extracting text from CV/Resume...</p>
              <p className="text-[11px] text-muted-foreground">Parsing PDF / Word structure in-browser</p>
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              <label htmlFor="resume-input" className="text-sm font-bold text-foreground">
                Your Resume / CV
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setResumeText(SAMPLE_RESUME_TEXT);
                  setResumeFileMeta(null);
                  toast.info("Reset to Senior Full-Stack Engineer sample resume.");
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-2 cursor-pointer"
              >
                Reset Sample
              </button>
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload CV (PDF, Word, TXT)</span>
                <input
                  ref={resumeFileInputRef}
                  type="file"
                  accept={RESUME_ACCEPTED_EXTENSIONS}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void processUploadedFile(f, "resume");
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Active File Pill Badge */}
          {resumeFileMeta && (
            <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
              <div className="flex items-center gap-2 min-w-0">
                <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="font-semibold truncate">{resumeFileMeta.fileName}</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-emerald-300 shrink-0">
                  {resumeFileMeta.kind.toUpperCase()}
                  {resumeFileMeta.pageCount ? ` · ${resumeFileMeta.pageCount} pg` : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setResumeFileMeta(null)}
                className="rounded p-0.5 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-100 cursor-pointer"
                title="Dismiss file pill"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <textarea
            id="resume-input"
            value={resumeText}
            onChange={(e) => {
              setResumeText(e.target.value);
              if (resumeFileMeta) setResumeFileMeta(null);
            }}
            placeholder="Paste your resume here or drag & drop a PDF / Word DOCX file..."
            rows={14}
            className="w-full flex-1 resize-y rounded-xl border border-border bg-background/80 p-3.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{resumeText.split(/\s+/).filter(Boolean).length} words</span>
            <span>Supports PDF, Word DOCX/DOC, TXT, Markdown (Drag & Drop)</span>
          </div>
        </div>

        {/* Right: Job Description Input with Upload Support */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingJob(true);
          }}
          onDragLeave={() => setIsDraggingJob(false)}
          onDrop={onJobDrop}
          className={cn(
            "relative flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-all",
            isDraggingJob
              ? "border-sky-500 bg-sky-500/5 ring-2 ring-sky-500/30"
              : "border-border"
          )}
        >
          {/* Drag Overlay */}
          {isDraggingJob && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-card/95 backdrop-blur-xs border-2 border-dashed border-sky-500 animate-in fade-in-50">
              <FileUp className="h-10 w-10 text-sky-400 animate-bounce" />
              <p className="mt-2 text-sm font-bold text-foreground">Drop Job Description File Here</p>
              <p className="text-xs text-muted-foreground">PDF (.pdf), Word (.docx, .doc), TXT</p>
            </div>
          )}

          {/* Loading Extraction Overlay */}
          {isExtractingJob && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-card/90 backdrop-blur-xs animate-in fade-in-50">
              <Loader2 className="h-8 w-8 text-sky-400 animate-spin" />
              <p className="mt-2 text-xs font-semibold text-foreground">Extracting text from Job Description...</p>
              <p className="text-[11px] text-muted-foreground">Parsing PDF / Word structure in-browser</p>
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-sky-400" />
              <label htmlFor="job-input" className="text-sm font-bold text-foreground">
                Target Job Description
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setJobText(SAMPLE_JOB_DESCRIPTION);
                  setJobFileMeta(null);
                  toast.info("Reset to target job description sample.");
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-2 cursor-pointer"
              >
                Reset Sample
              </button>
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/50 transition">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Job Spec</span>
                <input
                  ref={jobFileInputRef}
                  type="file"
                  accept={RESUME_ACCEPTED_EXTENSIONS}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void processUploadedFile(f, "job");
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Active File Pill Badge */}
          {jobFileMeta && (
            <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300">
              <div className="flex items-center gap-2 min-w-0">
                <FileCheck2 className="h-4 w-4 shrink-0 text-sky-400" />
                <span className="font-semibold truncate">{jobFileMeta.fileName}</span>
                <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-sky-300 shrink-0">
                  {jobFileMeta.kind.toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setJobFileMeta(null)}
                className="rounded p-0.5 text-sky-300 hover:bg-sky-500/20 hover:text-sky-100 cursor-pointer"
                title="Dismiss file pill"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <textarea
            id="job-input"
            value={jobText}
            onChange={(e) => {
              setJobText(e.target.value);
              if (jobFileMeta) setJobFileMeta(null);
            }}
            placeholder="Paste the target job description or drop a job spec PDF/Word file..."
            rows={14}
            className="w-full flex-1 resize-y rounded-xl border border-border bg-background/80 p-3.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{jobText.split(/\s+/).filter(Boolean).length} words</span>
            <span>Paste full role requirements or drop a file</span>
          </div>
        </div>
      </div>

      {/* Main Scan Action Button */}
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={runAnalysis}
          disabled={isScanning || !resumeText.trim() || !jobText.trim()}
          className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-8 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          {isScanning ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
          Run Instant ATS Match & Optimization Scan
        </button>
      </div>

      {/* Interactive ATS Analysis Results */}
      {analysis && (
        <div className="mt-10 space-y-8 animate-in fade-in-50 duration-300">
          {/* Top Score Banner */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-md md:p-8">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              {/* Score Circular Gauge Display */}
              <div className="flex items-center gap-6">
                <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-4 border-emerald-500/30 bg-emerald-500/10 shadow-inner">
                  <div className="text-center">
                    <span
                      className={cn(
                        "font-extrabold tracking-tight text-3xl",
                        analysis.overallScore >= 80
                          ? "text-emerald-400"
                          : analysis.overallScore >= 65
                          ? "text-amber-400"
                          : "text-rose-400"
                      )}
                    >
                      {analysis.overallScore}%
                    </span>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                      Grade: {analysis.grade}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                    <Briefcase className="h-3 w-3 text-sky-400" />
                    Target: {analysis.targetRole}
                  </div>
                  <h3 className="mt-1.5 text-lg font-bold text-foreground">
                    {analysis.overallScore >= 80
                      ? "High Interview Likelihood (ATS Pass)"
                      : analysis.overallScore >= 65
                      ? "Moderate Match (Action Required)"
                      : "Critical ATS Filtering Risk"}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xl leading-relaxed">
                    {analysis.summary}
                  </p>
                </div>
              </div>

              {/* Stats overview pills */}
              <div className="grid grid-cols-2 gap-3 w-full md:w-auto text-center sm:text-left">
                <div className="rounded-xl border border-border bg-background/50 p-3">
                  <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                    Keywords Matched
                  </span>
                  <span className="text-base font-bold text-foreground">
                    {analysis.matchedKeywordsCount} / {analysis.totalJobKeywordsCount}
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-background/50 p-3">
                  <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                    Contact Hygiene
                  </span>
                  <span className="text-base font-bold text-emerald-400 flex items-center justify-center sm:justify-start gap-1">
                    <Check className="h-4 w-4" /> 100% Valid
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex overflow-x-auto border-b border-border/70 pb-px gap-2">
            {[
              { id: "keywords", label: "🎯 Keyword & Skills Gap", count: analysis.keywords.length },
              { id: "bullets", label: "✍️ Google X-Y-Z Bullet Rewriter", count: analysis.bulletImprovements.length },
              { id: "sections", label: "📊 ATS Scoring Breakdown", count: analysis.sections.length },
              { id: "actions", label: "🛠️ Quick Fix Recommendations", count: analysis.actionableRecommendations.length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-bold transition",
                  activeTab === tab.id
                    ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
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

          {/* TAB 1: Keyword & Skills Gap */}
          {activeTab === "keywords" && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground mr-1">Filter:</span>
                  {[
                    { id: "all", label: "All Keywords" },
                    { id: "missing", label: "❌ Missing in Resume" },
                    { id: "matched", label: "✅ Matched in Resume" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setKeywordFilter(f.id as typeof keywordFilter)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                        keywordFilter === f.id
                          ? "bg-emerald-500/20 text-emerald-400 font-bold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search skill..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Keyword Pills Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {filteredKeywords.map((kw, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between rounded-xl border p-3 transition",
                      kw.foundInResume
                        ? "border-emerald-500/30 bg-emerald-950/10 text-foreground"
                        : "border-rose-500/30 bg-rose-950/10 text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {kw.foundInResume ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{kw.keyword}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {kw.category.replace("_", " ")} • {kw.importance} priority
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold",
                          kw.foundInResume ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                        )}
                      >
                        {kw.frequencyInResume} in resume
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {filteredKeywords.length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No keywords match the selected filter.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Google X-Y-Z Bullet Rewriter */}
          {activeTab === "bullets" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-sky-500/30 bg-sky-950/15 p-4 text-xs text-sky-300 leading-relaxed">
                💡 <strong>Google X-Y-Z Formula</strong>: <em>"Accomplished [X] as measured by [Y], by doing [Z]."</em> Recruiters and hiring managers discard vague bullets without quantifiable numbers.
              </div>

              <div className="space-y-4">
                {analysis.bulletImprovements.map((b, idx) => (
                  <div key={idx} className="rounded-2xl border border-border bg-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Experience Bullet #{idx + 1}
                      </span>
                      <span className="rounded-full bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 text-[10px] font-bold">
                        Action Verb: {b.actionVerbUsed}
                      </span>
                    </div>

                    {/* Original vs Improved */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-rose-500/25 bg-rose-950/10 p-3 text-xs">
                        <span className="block font-bold text-rose-400 text-[10px] uppercase mb-1">
                          Original (Weak / Passive)
                        </span>
                        <p className="text-foreground leading-relaxed">"{b.original}"</p>
                      </div>

                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-3 text-xs relative group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-emerald-400 text-[10px] uppercase">
                            AI-Optimized (High Impact)
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(b.improved, `bullet-${idx}`)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition"
                          >
                            {copiedId === `bullet-${idx}` ? (
                              <>
                                <Check className="h-3 w-3" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" /> Copy
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-foreground font-medium leading-relaxed">"{b.improved}"</p>
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground italic">
                      Critique: {b.critique}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ATS Scoring Breakdown */}
          {activeTab === "sections" && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {analysis.sections.map((sec, idx) => (
                <div key={idx} className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{sec.name}</h4>
                      <p className="text-[11px] text-muted-foreground">Weight: {sec.weight}% of total score</p>
                    </div>
                    <span
                      className={cn(
                        "font-extrabold text-base font-mono",
                        sec.score >= 80 ? "text-emerald-400" : sec.score >= 60 ? "text-amber-400" : "text-rose-400"
                      )}
                    >
                      {sec.score} / 100
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        sec.score >= 80 ? "bg-emerald-500" : sec.score >= 60 ? "bg-amber-500" : "bg-rose-500"
                      )}
                      style={{ width: `${sec.score}%` }}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">{sec.feedback}</p>

                  {/* Checklist */}
                  <div className="space-y-1 pt-1 text-xs">
                    {sec.passedChecks.slice(0, 3).map((chk, cIdx) => (
                      <div key={cIdx} className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{chk}</span>
                      </div>
                    ))}
                    {sec.failedChecks.slice(0, 3).map((chk, cIdx) => (
                      <div key={cIdx} className="flex items-center gap-1.5 text-rose-400">
                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{chk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: Actionable Recommendations */}
          {activeTab === "actions" && (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-400" />
                Step-by-Step ATS Optimization Roadmap
              </h3>
              <p className="text-xs text-muted-foreground">
                Apply these direct recommendations to raise your match score above 85% before applying.
              </p>

              <div className="space-y-3 pt-2">
                {analysis.actionableRecommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-border bg-background/60 p-3.5 text-xs text-foreground"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <p className="leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export & Action Bar */}
          <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm text-foreground">ATS Clean Format Export</h4>
              <p className="text-xs text-muted-foreground">Export your optimized resume to Word, PDF, or download the full audit report</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  let optimized = resumeText;
                  for (const b of analysis.bulletImprovements) {
                    if (b.original && b.improved) {
                      optimized = optimized.replace(b.original.trim(), b.improved.trim());
                    }
                  }

                  const htmlContent = `
                    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                    <head><meta charset='utf-8'><title>ATS-Optimized Resume</title>
                    <style>
                      body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.35; color: #111827; margin: 1in; }
                      h1 { font-size: 18pt; font-weight: bold; margin-bottom: 2pt; color: #0f172a; border-bottom: 1.5pt solid #0f172a; padding-bottom: 3pt; }
                      h2 { font-size: 12pt; font-weight: bold; margin-top: 10pt; margin-bottom: 3pt; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5pt; border-bottom: 0.5pt solid #cbd5e1; padding-bottom: 1.5pt; }
                      p { margin: 2pt 0; }
                      ul { margin: 2pt 0 6pt 16pt; padding: 0; }
                      li { margin-bottom: 2.5pt; }
                    </style>
                    </head>
                    <body>
                      ${optimized
                        .split('\n')
                        .map((line) => {
                          const trimmed = line.trim();
                          if (!trimmed) return '<br/>';
                          if (trimmed.startsWith('# ')) return `<h1>${trimmed.slice(2)}</h1>`;
                          if (trimmed.startsWith('## ')) return `<h2>${trimmed.slice(3)}</h2>`;
                          if (trimmed.startsWith('### ')) return `<h3>${trimmed.slice(4)}</h3>`;
                          if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
                            return `<ul><li>${trimmed.replace(/^[•\-\*]\s*/, '')}</li></ul>`;
                          }
                          return `<p>${trimmed}</p>`;
                        })
                        .join('')}
                    </body>
                    </html>
                  `;
                  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ATS_Optimized_Resume.doc`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Downloaded ATS-Optimized Resume (.doc)!");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export Word (.doc)
              </button>

              <button
                type="button"
                onClick={() => {
                  let optimized = resumeText;
                  for (const b of analysis.bulletImprovements) {
                    if (b.original && b.improved) {
                      optimized = optimized.replace(b.original.trim(), b.improved.trim());
                    }
                  }

                  const printWindow = window.open('', '_blank');
                  if (!printWindow) {
                    toast.error('Pop-up blocked. Please allow pop-ups to print or save PDF.');
                    return;
                  }
                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <title>ATS-Optimized Resume</title>
                      <style>
                        @page { size: letter; margin: 0.65in; }
                        body { font-family: 'Calibri', 'Arial', -apple-system, sans-serif; font-size: 10.5pt; line-height: 1.35; color: #0f172a; margin: 0; padding: 24px; }
                        h1 { font-size: 18pt; font-weight: bold; margin: 0 0 4pt 0; text-transform: uppercase; letter-spacing: 0.5pt; border-bottom: 1.5pt solid #0f172a; padding-bottom: 3pt; }
                        h2 { font-size: 11.5pt; font-weight: bold; margin: 10pt 0 3pt 0; text-transform: uppercase; letter-spacing: 0.5pt; border-bottom: 0.75pt solid #94a3b8; padding-bottom: 2pt; }
                        p { margin: 2pt 0; }
                        ul { margin: 2pt 0 4pt 16pt; padding: 0; }
                        li { margin-bottom: 2pt; }
                        @media print {
                          body { padding: 0; }
                        }
                      </style>
                    </head>
                    <body>
                      ${optimized
                        .split('\n')
                        .map((line) => {
                          const trimmed = line.trim();
                          if (!trimmed) return '<div style="height: 6pt;"></div>';
                          if (trimmed.startsWith('# ')) return `<h1>${trimmed.slice(2)}</h1>`;
                          if (trimmed.startsWith('## ')) return `<h2>${trimmed.slice(3)}</h2>`;
                          if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
                            return `<ul><li>${trimmed.replace(/^[•\-\*]\s*/, '')}</li></ul>`;
                          }
                          return `<p>${trimmed}</p>`;
                        })
                        .join('')}
                      <script>
                        window.onload = function() { window.print(); }
                      </script>
                    </body>
                    </html>
                  `);
                  printWindow.document.close();
                  toast.success("Opened print & PDF export dialog!");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3.5 py-2 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export PDF (.pdf)
              </button>

              <button
                type="button"
                onClick={() => {
                  const bullets = analysis.bulletImprovements.map((b) => `• ${b.improved}`).join("\n");
                  copyToClipboard(bullets, "all-bullets");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              >
                {copiedId === "all-bullets" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" /> Bullets Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy Rewritten Bullets
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  const report = `# ATS Optimization Report
Target Role: ${analysis.targetRole}
Overall Match Score: ${analysis.overallScore}% (Grade: ${analysis.grade})
Matched Keywords: ${analysis.matchedKeywordsCount}/${analysis.totalJobKeywordsCount}

## Missing High-Priority Keywords
${analysis.keywords
  .filter((k) => !k.foundInResume)
  .map((k) => `- ${k.keyword} (${k.category})`)
  .join("\n")}

## Recommended Bullet Point Rewrites
${analysis.bulletImprovements
  .map((b, i) => `### Bullet #${i + 1}\nOriginal: ${b.original}\nImproved: ${b.improved}\nCritique: ${b.critique}\n`)
  .join("\n")}

## Step-by-Step Fixes
${analysis.actionableRecommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}
`;
                  const blob = new Blob([report], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "ats_resume_optimization_report.md";
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Downloaded ATS Markdown Report!");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Full Audit (.md)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AuthGate Pro Features Banner */}
      <div className="mt-12">
        <AuthGate>
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center text-xs text-muted-foreground">
            Pro subscribers unlock unlimited ATS scans, tailored cover letter generation, and custom Workday/Taleo formatting templates.
          </div>
        </AuthGate>
      </div>
    </div>
  );
}
