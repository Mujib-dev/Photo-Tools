"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  FileText,
  FileUp,
  Globe,
  Languages,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  SUPPORTED_LANGUAGES,
  translateDocument,
  isRtlLanguage,
  type SupportedLanguage,
} from "@/lib/document-translator";
import {
  extractTextFromFile,
  RESUME_ACCEPTED_EXTENSIONS,
  type ExtractedFileResult,
} from "@/lib/file-text-extractor";
import { cn } from "@/lib/utils";

const SAMPLE_DOCUMENT_TEXT = `Independent Contractor Agreement

1. Scope of Work
The Contractor agrees to provide web development and digital imaging software services to the Client in accordance with project milestones.

2. Confidentiality & Non-Disclosure
Both parties agree to treat all proprietary source code, user data, trade secrets, and technical documentation as confidential.

3. Payment Terms
Invoices shall be payable within 30 days of receipt (Net 30). Late payments may accrue interest at 1.5% per month.

4. Governing Law
This Agreement shall be governed by and construed in accordance with the laws of Delaware.`;

export function DocumentTranslatorTool() {
  const [sourceText, setSourceText] = React.useState<string>(SAMPLE_DOCUMENT_TEXT);
  const [translatedText, setTranslatedText] = React.useState<string>("");

  const [fromLang, setFromLang] = React.useState<string>("en");
  const [toLang, setToLang] = React.useState<string>("es");

  const [isTranslating, setIsTranslating] = React.useState<boolean>(false);
  const [progressPercent, setProgressPercent] = React.useState<number>(0);
  const [progressDetail, setProgressDetail] = React.useState<string>("");

  const [fileMeta, setFileMeta] = React.useState<ExtractedFileResult | null>(null);
  const [isExtracting, setIsExtracting] = React.useState<boolean>(false);
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [copied, setCopied] = React.useState<boolean>(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Auto-translate on mount
  React.useEffect(() => {
    runTranslation();
  }, []);

  const runTranslation = async () => {
    if (!sourceText.trim()) return;
    setIsTranslating(true);
    setProgressPercent(10);
    setProgressDetail("Preparing document chunks...");

    try {
      const res = await translateDocument(
        sourceText,
        fromLang,
        toLang,
        (percent, current, total) => {
          setProgressPercent(percent);
          setProgressDetail(`Translating chunk ${current} of ${total}...`);
        }
      );

      setTranslatedText(res.translatedText);
      toast.success("Document translated successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Translation failed.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsExtracting(true);
    try {
      const result = await extractTextFromFile(file);
      setSourceText(result.text);
      setFileMeta(result);
      toast.success(
        `Loaded ${result.fileName} (${result.wordCount} words${
          result.pageCount ? ` · ${result.pageCount} pages` : ""
        })`
      );
      setTimeout(() => {
        runTranslation();
      }, 100);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to extract text from document.");
    } finally {
      setIsExtracting(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileUpload(f);
  };

  const swapLanguages = () => {
    const temp = fromLang;
    setFromLang(toLang);
    setToLang(temp);
    if (translatedText.trim()) {
      setSourceText(translatedText);
      setTranslatedText(sourceText);
    }
  };

  const copyTranslated = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    toast.success("Translated text copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadWordDoc = () => {
    if (!translatedText) return;
    const toName = SUPPORTED_LANGUAGES.find((l) => l.code === toLang)?.name || toLang;
    const targetRtl = isRtlLanguage(toLang);
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40' dir='${targetRtl ? "rtl" : "ltr"}'>
      <head><meta charset='utf-8'><title>Translated Document (${toName})</title>
      <style>
        body {
          font-family: ${targetRtl ? "'Noto Nastaliq Urdu', 'Noto Sans Arabic', 'Segoe UI', Arial, sans-serif" : "Arial, sans-serif"};
          font-size: ${targetRtl ? "13pt" : "11pt"};
          line-height: ${targetRtl ? "2.0" : "1.4"};
          direction: ${targetRtl ? "rtl" : "ltr"};
          text-align: ${targetRtl ? "right" : "left"};
          color: #111827;
          margin: 1in;
        }
        p {
          margin: 6pt 0;
          direction: ${targetRtl ? "rtl" : "ltr"};
          text-align: ${targetRtl ? "right" : "left"};
        }
      </style>
      </head>
      <body dir='${targetRtl ? "rtl" : "ltr"}'>
        ${translatedText
          .split("\n")
          .map((line) => (line.trim() ? `<p dir='${targetRtl ? "rtl" : "ltr"}'>${line.trim()}</p>` : "<br/>"))
          .join("")}
      </body>
      </html>
    `;
    const blob = new Blob(["\ufeff" + htmlContent], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translated_${toLang}_document.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded translated Word document (.doc)!");
  };

  const isSourceRtl = isRtlLanguage(fromLang);
  const isTargetRtl = isRtlLanguage(toLang);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-sky-400">
          <Languages className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
          AI Document & PDF Language Translator
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          Multi-Language <span className="bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">Document Translator</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-muted-foreground">
          Upload PDF contracts, Word documents, and text files. Translate side-by-side into 20+ languages while preserving layout and paragraph breaks.
        </p>
      </div>

      {/* Language Switcher Bar */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            From:
          </label>
          <select
            value={fromLang}
            onChange={(e) => setFromLang(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:border-sky-500 focus:outline-none"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={swapLanguages}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            title="Swap Languages"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </button>

          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            To:
          </label>
          <select
            value={toLang}
            onChange={(e) => setToLang(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:border-sky-500 focus:outline-none"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={runTranslation}
            disabled={isTranslating || !sourceText.trim()}
            className="gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 text-xs font-bold text-white shadow-md shadow-sky-500/20"
          >
            {isTranslating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Translate Document
          </Button>
        </div>
      </div>

      {/* Main Dual-Pane Side-by-Side Workspace */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Original Source Document */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            "relative flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-all",
            isDragging ? "border-sky-500 bg-sky-500/5 ring-2 ring-sky-500/30" : "border-border"
          )}
        >
          {isDragging && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-card/95 backdrop-blur-xs border-2 border-dashed border-sky-500 animate-in fade-in-50">
              <FileUp className="h-10 w-10 text-sky-400 animate-bounce" />
              <p className="mt-2 text-sm font-bold text-foreground">Drop Document File Here</p>
              <p className="text-xs text-muted-foreground">PDF, Word (.docx, .doc), TXT, Markdown</p>
            </div>
          )}

          {isExtracting && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-card/90 backdrop-blur-xs animate-in fade-in-50">
              <Loader2 className="h-8 w-8 text-sky-400 animate-spin" />
              <p className="mt-2 text-xs font-semibold text-foreground">Extracting document in-browser...</p>
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-sky-400" />
              <span className="text-sm font-bold text-foreground">Original Source Document</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSourceText(SAMPLE_DOCUMENT_TEXT);
                  setFileMeta(null);
                  toast.info("Reset to sample agreement.");
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-2 cursor-pointer"
              >
                Reset Sample
              </button>
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload PDF/Word</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={RESUME_ACCEPTED_EXTENSIONS}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {fileMeta && (
            <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300">
              <span className="font-semibold truncate">{fileMeta.fileName}</span>
              <button type="button" onClick={() => setFileMeta(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            rows={15}
            dir={isSourceRtl ? "rtl" : "ltr"}
            style={{
              direction: isSourceRtl ? "rtl" : "ltr",
              textAlign: isSourceRtl ? "right" : "left",
              letterSpacing: isSourceRtl ? "0" : undefined,
            }}
            className={cn(
              "w-full flex-1 resize-y rounded-xl border border-border bg-background/80 p-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-sky-500 focus:outline-none transition-all",
              isSourceRtl
                ? "font-urdu text-right text-base leading-[2.4] tracking-normal"
                : "font-mono text-left leading-relaxed"
            )}
            placeholder="Type or paste text, or drag & drop a PDF / Word document..."
          />

          <div className="mt-2 text-xs text-muted-foreground flex justify-between">
            <span>{sourceText.split(/\s+/).filter(Boolean).length} words</span>
            <span>Supports PDF, Word, TXT, RTF</span>
          </div>
        </div>

        {/* Right: Translated Output */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-bold text-foreground">
                Translated (
                {SUPPORTED_LANGUAGES.find((l) => l.code === toLang)?.name || toLang})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-lg px-2 py-0.5 text-[10px] font-bold font-mono tracking-wider border",
                  isTargetRtl
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-muted text-muted-foreground border-border"
                )}
                title={isTargetRtl ? "Right-to-Left writing direction (RTL)" : "Left-to-Right writing direction (LTR)"}
              >
                {isTargetRtl ? "RTL (دائیں)" : "LTR"}
              </span>

              <button
                type="button"
                onClick={copyTranslated}
                disabled={!translatedText}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition disabled:opacity-50 cursor-pointer"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>

              <button
                type="button"
                onClick={downloadWordDoc}
                disabled={!translatedText}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50 cursor-pointer"
              >
                <Download className="h-3 w-3" />
                Export Word (.doc)
              </button>
            </div>
          </div>

          {isTranslating ? (
            <div className="flex flex-col items-center justify-center flex-1 py-16 text-center">
              <Loader2 className="h-8 w-8 text-sky-400 animate-spin" />
              <p className="mt-3 text-xs font-bold text-foreground">{progressDetail}</p>
              <div className="mt-2 w-40 rounded-full bg-muted overflow-hidden h-1.5">
                <div
                  className="h-full bg-sky-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="mt-1 text-[10px] text-muted-foreground font-mono">{progressPercent}%</span>
            </div>
          ) : (
            <textarea
              value={translatedText}
              onChange={(e) => setTranslatedText(e.target.value)}
              rows={15}
              dir={isTargetRtl ? "rtl" : "ltr"}
              style={{
                direction: isTargetRtl ? "rtl" : "ltr",
                textAlign: isTargetRtl ? "right" : "left",
                letterSpacing: isTargetRtl ? "0" : undefined,
              }}
              className={cn(
                "w-full flex-1 resize-y rounded-xl border border-border bg-background/80 p-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none transition-all",
                isTargetRtl
                  ? "font-urdu text-right text-base leading-[2.4] tracking-normal"
                  : "font-mono text-left leading-relaxed"
              )}
              placeholder="Translation will appear here..."
            />
          )}

          <div className="mt-2 text-xs text-muted-foreground flex justify-between">
            <span>{translatedText.split(/\s+/).filter(Boolean).length} words</span>
            <span className="text-emerald-400 font-medium">Neural Translation Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
}
