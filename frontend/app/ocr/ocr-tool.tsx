"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  Languages,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { OcrPreview } from "@/components/ocr-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analyzeOcr, downloadUrl, getJob, getOcrLanguages, submitOcr } from "@/lib/api";
import { cn } from "@/lib/utils";
import { parseReceiptAndForm, receiptToCsv } from "@/lib/receipt-parser";
import { downloadBlob } from "@/lib/screenshot";
import type { OcrAnalysisResult, OcrLanguage, OcrOutputFormat } from "@/lib/types";

export function OcrTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analysis, setAnalysis] = React.useState<OcrAnalysisResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [hoveredWord, setHoveredWord] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [searchText, setSearchText] = React.useState("");

  const [languages, setLanguages] = React.useState<OcrLanguage[]>([]);
  const [selectedLanguage, setSelectedLanguage] = React.useState<string>("auto");

  const [activeTab, setActiveTab] = React.useState<"text" | "pages" | "receipt" | "json">("text");
  const [exportingDocx, setExportingDocx] = React.useState(false);

  const parsedReceipt = React.useMemo(() => {
    if (!analysis) return null;
    return parseReceiptAndForm(analysis.fullText);
  }, [analysis]);

  // Load available OCR languages once
  React.useEffect(() => {
    getOcrLanguages()
      .then((langs) => setLanguages(langs))
      .catch(() => undefined);
  }, []);

  const handleFiles = async (files: File[]) => {
    const picked = files[0];
    if (!picked) return;
    setFile(picked);
    setAnalysis(null);
    setError(null);
    setCurrentPage(1);
    setAnalyzing(true);

    try {
      const lang = selectedLanguage !== "auto" ? selectedLanguage : undefined;
      const res = await analyzeOcr(picked, lang);
      setAnalysis(res);
      toast.success(
        `Extracted ${res.totalWords} words across ${res.totalPages} page${res.totalPages === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not perform OCR on this document.";
      setError(msg);
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const copyFullText = () => {
    if (!analysis) return;
    void navigator.clipboard.writeText(analysis.fullText);
    setCopied(true);
    toast.success("Text copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTextFile = () => {
    if (!analysis || !file) return;
    const blob = new Blob([analysis.fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = file.name.replace(/\.[^/.]+$/, "");
    a.href = url;
    a.download = `${base}-ocr.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Text file downloaded.");
  };

  const downloadJsonFile = () => {
    if (!analysis || !file) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = file.name.replace(/\.[^/.]+$/, "");
    a.href = url;
    a.download = `${base}-ocr.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON file downloaded.");
  };

  const exportDocx = async () => {
    if (!file || exportingDocx) return;
    setExportingDocx(true);
    try {
      const res = await submitOcr(file, { format: "docx", language: selectedLanguage !== "auto" ? selectedLanguage : undefined });
      // Poll job
      const poll = setInterval(async () => {
        try {
          const rec = await getJob(res.jobId);
          if (rec.state === "completed") {
            clearInterval(poll);
            setExportingDocx(false);
            window.location.href = downloadUrl(rec.id);
            toast.success("Word document (.docx) ready!");
          } else if (rec.state === "failed") {
            clearInterval(poll);
            setExportingDocx(false);
            toast.error(rec.error ?? "Failed to export Word document.");
          }
        } catch {
          clearInterval(poll);
          setExportingDocx(false);
        }
      }, 1000);
    } catch (err) {
      setExportingDocx(false);
      toast.error(err instanceof Error ? err.message : "Could not export docx.");
    }
  };

  const charCount = analysis?.fullText.length ?? 0;
  const wordCount = analysis?.totalWords ?? 0;
  const readMinutes = Math.ceil(wordCount / 200);

  return (
    <AuthGate>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 md:py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3 w-3" />
              Windows Neural OCR
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
            AI Document &amp; Image Text Extractor
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Extract text, invoices, receipts, and tables from images and multi-page PDFs. Inspect
            interactive word bounding boxes, copy with one click, or export to TXT, DOCX, and JSON.
          </p>
        </div>

        {!file && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-primary" />
                <span className="font-display text-xs font-semibold text-foreground">
                  Recognition Language:
                </span>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="h-8 w-48 text-xs bg-muted">
                    <SelectValue placeholder="Auto (System Default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (System Default)</SelectItem>
                    {languages.map((l) => (
                      <SelectItem key={l.languageTag} value={l.languageTag}>
                        {l.displayName} ({l.languageTag})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs text-on-surface-variant">
                Supports PNG, JPG, WebP, HEIC, TIFF, and PDF
              </span>
            </div>

            <Dropzone
              kind="document"
              accept=".png,.jpg,.jpeg,.webp,.heic,.tif,.tiff,.pdf,image/*,application/pdf"
              onFiles={handleFiles}
            />
          </div>
        )}

        {analyzing && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-12 text-center shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <h3 className="font-display text-lg font-semibold">Extracting text with AI OCR…</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Analyzing document structure, detecting lines, and bounding character regions.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">OCR Analysis Failed: </span>
              <span>{error}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFile(null);
                setError(null);
              }}
              className="h-8 gap-1"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        )}

        {analysis && file && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-semibold text-foreground">
                    {file.name}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-on-surface-variant">
                    <span>{analysis.totalPages} page{analysis.totalPages === 1 ? "" : "s"}</span>
                    <span>·</span>
                    <span>{wordCount} words</span>
                    <span>·</span>
                    <span>{charCount} characters</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> ~{readMinutes} min
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={copyFullText}
                  className="gap-1.5"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy text"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={downloadTextFile}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  .TXT
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={exportDocx}
                  disabled={exportingDocx}
                  className="gap-1.5"
                >
                  {exportingDocx ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  )}
                  .DOCX
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFile(null);
                    setAnalysis(null);
                  }}
                  className="gap-1.5"
                >
                  <RefreshCcw className="h-4 w-4" />
                  New file
                </Button>
              </div>
            </div>

            {/* Split Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Visual Preview */}
              <div className="lg:col-span-6">
                <OcrPreview
                  file={file}
                  pages={analysis.pages}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  hoveredWord={hoveredWord}
                  onWordHover={setHoveredWord}
                />
              </div>

              {/* Right Column: Extracted Text & Tabs */}
              <div className="flex flex-col rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm lg:col-span-6">
                <div className="mb-3 flex items-center justify-between border-b border-outline-variant/10 pb-3">
                  <div className="flex gap-1 rounded-lg border border-outline-variant/20 bg-surface-container-low p-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab("text")}
                      className={cn(
                        "rounded px-2.5 py-1 text-xs font-semibold transition-all",
                        activeTab === "text"
                          ? "bg-surface-container-lowest text-primary shadow-sm"
                          : "text-on-surface-variant hover:text-foreground",
                      )}
                    >
                      Full text
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("pages")}
                      className={cn(
                        "rounded px-2.5 py-1 text-xs font-semibold transition-all",
                        activeTab === "pages"
                          ? "bg-surface-container-lowest text-primary shadow-sm"
                          : "text-on-surface-variant hover:text-foreground",
                      )}
                    >
                      Page by page
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("receipt")}
                      className={cn(
                        "rounded px-2.5 py-1 text-xs font-semibold transition-all flex items-center gap-1",
                        activeTab === "receipt"
                          ? "bg-surface-container-lowest text-primary shadow-sm"
                          : "text-on-surface-variant hover:text-foreground",
                      )}
                    >
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      Receipt / Form
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("json")}
                      className={cn(
                        "rounded px-2.5 py-1 text-xs font-semibold transition-all",
                        activeTab === "json"
                          ? "bg-surface-container-lowest text-primary shadow-sm"
                          : "text-on-surface-variant hover:text-foreground",
                      )}
                    >
                      JSON
                    </button>
                  </div>

                  <div className="relative w-40 sm:w-52">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant" />
                    <Input
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Find in text…"
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>

                {/* Tab 1: Full Text */}
                {activeTab === "text" && (
                  <div className="flex flex-1 flex-col">
                    <textarea
                      value={analysis.fullText}
                      readOnly
                      rows={16}
                      className="h-full min-h-[420px] w-full resize-none rounded-xl border border-outline-variant/20 bg-muted/20 p-3 font-sans text-sm leading-relaxed text-foreground focus:outline-none"
                    />
                  </div>
                )}

                {/* Tab 2: Page by Page */}
                {activeTab === "pages" && (
                  <div className="flex flex-1 flex-col space-y-3 overflow-auto max-h-[520px]">
                    {analysis.pages.map((p) => (
                      <div
                        key={p.page}
                        className={cn(
                          "rounded-xl border p-3 transition-colors",
                          p.page === currentPage
                            ? "border-primary/40 bg-primary/5"
                            : "border-outline-variant/20 bg-muted/10",
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-display text-xs font-semibold text-primary">
                            Page {p.page} ({p.lines.length} lines)
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              void navigator.clipboard.writeText(p.text);
                              toast.success(`Page ${p.page} text copied!`);
                            }}
                            className="h-6 px-2 text-xs gap-1"
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </Button>
                        </div>
                        <p className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
                          {p.text || "(No text recognized on this page)"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 3: Receipt & Form AI Extraction */}
                {activeTab === "receipt" && parsedReceipt && (
                  <div className="flex flex-1 flex-col space-y-4 overflow-auto max-h-[520px] pr-1">
                    {/* Header info */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant/20 bg-muted/20 p-3">
                      <div>
                        <span className="text-[11px] font-medium text-muted-foreground">Vendor / Merchant</span>
                        <p className="font-display text-sm font-bold text-foreground">
                          {parsedReceipt.vendor || "Unknown Vendor"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void navigator.clipboard.writeText(JSON.stringify(parsedReceipt, null, 2));
                            toast.success("Receipt JSON copied to clipboard!");
                          }}
                          className="h-7 text-xs gap-1"
                        >
                          <Copy className="h-3 w-3" />
                          Copy JSON
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const csv = receiptToCsv(parsedReceipt);
                            downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "receipt-data.csv");
                            toast.success("Exported receipt CSV!");
                          }}
                          className="h-7 text-xs gap-1"
                        >
                          <Download className="h-3 w-3" />
                          Export CSV
                        </Button>
                      </div>
                    </div>

                    {/* Key Attributes Grid */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                      <div className="rounded-lg border border-outline-variant/15 bg-muted/10 p-2.5">
                        <span className="text-[10px] text-muted-foreground block">Date</span>
                        <span className="font-semibold">{parsedReceipt.date || "Not detected"}</span>
                      </div>
                      <div className="rounded-lg border border-outline-variant/15 bg-muted/10 p-2.5">
                        <span className="text-[10px] text-muted-foreground block">Invoice / Receipt #</span>
                        <span className="font-mono font-medium">{parsedReceipt.receiptNumber || "N/A"}</span>
                      </div>
                      <div className="rounded-lg border border-outline-variant/15 bg-muted/10 p-2.5">
                        <span className="text-[10px] text-muted-foreground block">Payment</span>
                        <span className="font-semibold">{parsedReceipt.paymentMethod || "N/A"}</span>
                      </div>
                      <div className="rounded-lg border border-outline-variant/15 bg-muted/10 p-2.5">
                        <span className="text-[10px] text-muted-foreground block">Currency</span>
                        <span className="font-semibold">{parsedReceipt.currency}</span>
                      </div>
                    </div>

                    {/* Totals Summary */}
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1.5 text-xs">
                      {parsedReceipt.subtotal !== null && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Subtotal</span>
                          <span className="font-mono">{parsedReceipt.currency}{parsedReceipt.subtotal.toFixed(2)}</span>
                        </div>
                      )}
                      {parsedReceipt.tax !== null && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Tax / VAT</span>
                          <span className="font-mono">{parsedReceipt.currency}{parsedReceipt.tax.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-base text-foreground pt-1 border-t border-primary/20">
                        <span>Total Amount</span>
                        <span className="font-mono text-primary">
                          {parsedReceipt.total !== null
                            ? `${parsedReceipt.currency}${parsedReceipt.total.toFixed(2)}`
                            : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="rounded-xl border border-outline-variant/20 bg-muted/10 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground pb-1 border-b border-outline-variant/10">
                        <span>Detected Line Items ({parsedReceipt.lineItems.length})</span>
                      </div>
                      {parsedReceipt.lineItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">
                          No distinct line items detected. (See Full Text tab for unparsed text).
                        </p>
                      ) : (
                        <div className="space-y-1 text-xs">
                          {parsedReceipt.lineItems.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1 border-b border-outline-variant/10 last:border-0">
                              <span className="truncate max-w-[220px]">
                                {item.quantity && item.quantity > 1 ? `${item.quantity}× ` : ""}
                                {item.description}
                              </span>
                              <span className="font-mono font-medium">
                                {parsedReceipt.currency}{item.total.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 4: JSON Inspection */}
                {activeTab === "json" && (
                  <div className="flex flex-1 flex-col">
                    <div className="mb-2 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={downloadJsonFile}
                        className="h-7 text-xs gap-1"
                      >
                        <Download className="h-3 w-3" />
                        Download JSON
                      </Button>
                    </div>
                    <pre className="h-full min-h-[420px] max-h-[500px] overflow-auto rounded-xl border border-outline-variant/20 bg-muted/30 p-3 font-mono text-[11px] text-foreground">
                      {JSON.stringify(analysis, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
