"use client";

import React, { useState, useRef, useId } from "react";
import {
  FileText,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  GitCompare,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { extractTextFromFile } from "@/lib/file-text-extractor";
import {
  compareDocuments,
  DocumentDiffResult,
} from "@/lib/document-diff-engine";

export function DocumentDiffTool() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [textA, setTextA] = useState<string>("");
  const [fileB, setFileB] = useState<File | null>(null);
  const [textB, setTextB] = useState<string>("");

  const [isLoadingA, setIsLoadingA] = useState<boolean>(false);
  const [isLoadingB, setIsLoadingB] = useState<boolean>(false);
  const [diffResult, setDiffResult] = useState<DocumentDiffResult | null>(null);
  const [viewMode, setViewMode] = useState<"side-by-side" | "unified">("side-by-side");

  const fileInputARef = useRef<HTMLInputElement | null>(null);
  const fileInputBRef = useRef<HTMLInputElement | null>(null);
  const inputAId = useId();
  const inputBId = useId();

  // Load Document A
  const handleSelectA = async (file: File) => {
    try {
      setIsLoadingA(true);
      const res = await extractTextFromFile(file);
      setFileA(file);
      setTextA(res.text);
      setDiffResult(null);
      toast.success(`Loaded Original: ${file.name} (${res.wordCount} words)`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to read Document A");
    } finally {
      setIsLoadingA(false);
    }
  };

  // Load Document B
  const handleSelectB = async (file: File) => {
    try {
      setIsLoadingB(true);
      const res = await extractTextFromFile(file);
      setFileB(file);
      setTextB(res.text);
      setDiffResult(null);
      toast.success(`Loaded Revised: ${file.name} (${res.wordCount} words)`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to read Document B");
    } finally {
      setIsLoadingB(false);
    }
  };

  // Run Diff Comparison
  const handleRunDiff = () => {
    if (!textA.trim() || !textB.trim()) {
      toast.error("Please upload or type content for both documents.");
      return;
    }

    const res = compareDocuments(textA, textB);
    setDiffResult(res);
    toast.success(
      `Comparison complete: ${res.similarityScore}% match with ${res.modifiedLinesCount + res.addedLinesCount} revisions.`
    );
  };

  // Export Audit Report
  const handleExportReport = () => {
    if (!diffResult) return;

    let md = `# Document Comparison & Contract Diff Audit Report\n\n`;
    md += `* **Document A (Original):** ${fileA?.name || "Original Text"}\n`;
    md += `* **Document B (Revised):** ${fileB?.name || "Revised Text"}\n`;
    md += `* **Similarity Score:** ${diffResult.similarityScore}%\n`;
    md += `* **Revisions:** +${diffResult.addedLinesCount} added, -${diffResult.removedLinesCount} removed, ~${diffResult.modifiedLinesCount} modified\n\n`;

    if (diffResult.riskAlerts.length > 0) {
      md += `## Critical Contract Risk Alerts\n\n`;
      diffResult.riskAlerts.forEach((alert, i) => {
        md += `### ${i + 1}. [${alert.severity.toUpperCase()}] ${alert.category.toUpperCase()}\n`;
        md += `* ${alert.description}\n`;
        if (alert.snippetA) md += `  - **Original:** \`${alert.snippetA}\`\n`;
        if (alert.snippetB) md += `  - **Revised:** \`${alert.snippetB}\`\n\n`;
      });
    }

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `document-diff-audit-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded Diff Audit Report (.md)!");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          <GitCompare className="h-3.5 w-3.5" />
          Legal & Agreement Verification
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Smart Document Compare & Contract Diff Studio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Compare two versions of any PDF, Word (.docx), or contract. Instantly spot sneaky clause changes, altered payment amounts, and date modifications.
        </p>
      </div>

      {/* Two Document Dropzones */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-6">
        {/* Document A (Original) */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Document A (Original Version)
            </span>
            {fileA && (
              <span className="text-[11px] font-mono text-emerald-400 font-semibold truncate max-w-[180px]">
                {fileA.name}
              </span>
            )}
          </div>

          <div
            onClick={() => fileInputARef.current?.click()}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-background/50 p-6 text-center cursor-pointer hover:border-primary/60 transition"
          >
            <Upload className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-xs font-semibold text-foreground">
              {isLoadingA ? "Extracting text..." : "Drop Original PDF, Word, or TXT"}
            </p>
            <input
              id={inputAId}
              ref={fileInputARef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleSelectA(e.target.files[0])}
            />
          </div>

          <textarea
            rows={5}
            value={textA}
            onChange={(e) => setTextA(e.target.value)}
            placeholder="Or paste original text here..."
            className="w-full rounded-xl border border-border/60 bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
          />
        </div>

        {/* Document B (Revised) */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Document B (Revised / Altered)
            </span>
            {fileB && (
              <span className="text-[11px] font-mono text-sky-400 font-semibold truncate max-w-[180px]">
                {fileB.name}
              </span>
            )}
          </div>

          <div
            onClick={() => fileInputBRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-background/50 p-6 text-center cursor-pointer hover:border-primary/60 transition"
          >
            <Upload className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-xs font-semibold text-foreground">
              {isLoadingB ? "Extracting text..." : "Drop Revised PDF, Word, or TXT"}
            </p>
            <input
              id={inputBId}
              ref={fileInputBRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleSelectB(e.target.files[0])}
            />
          </div>

          <textarea
            rows={5}
            value={textB}
            onChange={(e) => setTextB(e.target.value)}
            placeholder="Or paste revised text here..."
            className="w-full rounded-xl border border-border/60 bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
          />
        </div>
      </div>

      {/* Compare Action Button */}
      <div className="flex justify-center mb-8">
        <button
          type="button"
          onClick={handleRunDiff}
          disabled={!textA.trim() || !textB.trim()}
          className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3 text-sm font-bold text-white shadow-xl hover:bg-emerald-500 transition hover:scale-105 disabled:opacity-40"
        >
          <GitCompare className="h-4 w-4" />
          Compare Documents & Detect Changes
        </button>
      </div>

      {/* Comparison Results Card */}
      {diffResult && (
        <div className="space-y-6 animate-in fade-in">
          {/* Summary Metric Badges */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <span className="text-xs text-muted-foreground">Similarity Score</span>
              <div className="mt-1 text-2xl font-black font-mono text-emerald-400">
                {diffResult.similarityScore}%
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <span className="text-xs text-muted-foreground">Clauses Added</span>
              <div className="mt-1 text-2xl font-black font-mono text-emerald-500">
                +{diffResult.addedLinesCount}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <span className="text-xs text-muted-foreground">Clauses Deleted</span>
              <div className="mt-1 text-2xl font-black font-mono text-red-500">
                -{diffResult.removedLinesCount}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <span className="text-xs text-muted-foreground">Clauses Modified</span>
              <div className="mt-1 text-2xl font-black font-mono text-amber-400">
                ~{diffResult.modifiedLinesCount}
              </div>
            </div>
          </div>

          {/* Risk Alerts Section */}
          {diffResult.riskAlerts.length > 0 && (
            <div className="rounded-3xl border border-amber-500/40 bg-amber-500/5 p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-amber-500">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="text-sm font-bold">
                  High-Impact Contract Changes Detected ({diffResult.riskAlerts.length})
                </h3>
              </div>

              <div className="space-y-2">
                {diffResult.riskAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border/60 bg-card p-3 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">
                        {alert.description}
                      </span>
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 uppercase">
                        {alert.category}
                      </span>
                    </div>

                    {alert.snippetA && (
                      <p className="text-red-400/90 font-mono">
                        <span className="font-bold">Original:</span> {alert.snippetA}
                      </p>
                    )}
                    {alert.snippetB && (
                      <p className="text-emerald-400 font-mono">
                        <span className="font-bold">Revised:</span> {alert.snippetB}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diff Viewer Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("side-by-side")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === "side-by-side"
                    ? "bg-primary text-primary-foreground shadow"
                    : "border border-border/60 bg-card text-muted-foreground"
                }`}
              >
                Side-by-Side
              </button>
              <button
                type="button"
                onClick={() => setViewMode("unified")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === "unified"
                    ? "bg-primary text-primary-foreground shadow"
                    : "border border-border/60 bg-card text-muted-foreground"
                }`}
              >
                Unified Diff
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportReport}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
            >
              <Download className="h-3.5 w-3.5" />
              Download Audit Report (.md)
            </button>
          </div>

          {/* Visual Diff Canvas */}
          <div className="rounded-3xl border border-border/80 bg-neutral-950 p-6 shadow-2xl font-mono text-xs overflow-x-auto space-y-2">
            {diffResult.diffLines.map((line, idx) => {
              if (line.type === "unchanged") {
                return (
                  <div key={idx} className="flex gap-4 text-muted-foreground/80 py-1">
                    <span className="w-8 select-none text-neutral-600 text-right">{idx + 1}</span>
                    <span className="flex-1 whitespace-pre-wrap">{line.lineA}</span>
                  </div>
                );
              }

              if (line.type === "added") {
                return (
                  <div key={idx} className="flex gap-4 bg-emerald-950/40 text-emerald-300 py-1 px-2 rounded border-l-4 border-emerald-500">
                    <span className="w-8 select-none text-emerald-600 text-right">+</span>
                    <span className="flex-1 whitespace-pre-wrap">{line.lineB}</span>
                  </div>
                );
              }

              if (line.type === "removed") {
                return (
                  <div key={idx} className="flex gap-4 bg-red-950/40 text-red-300 line-through py-1 px-2 rounded border-l-4 border-red-500 opacity-70">
                    <span className="w-8 select-none text-red-600 text-right">-</span>
                    <span className="flex-1 whitespace-pre-wrap">{line.lineA}</span>
                  </div>
                );
              }

              if (line.type === "modified") {
                return (
                  <div key={idx} className="rounded border-l-4 border-amber-500 bg-amber-950/20 p-2 space-y-1">
                    <div className="flex gap-4 text-red-400/80 line-through">
                      <span className="w-8 select-none text-red-600 text-right">-</span>
                      <span className="flex-1 whitespace-pre-wrap">{line.lineA}</span>
                    </div>
                    <div className="flex gap-4 text-emerald-300">
                      <span className="w-8 select-none text-emerald-600 text-right">+</span>
                      <span className="flex-1 whitespace-pre-wrap">{line.lineB}</span>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
