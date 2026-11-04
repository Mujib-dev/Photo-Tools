"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  Share2,
  Sparkles,
  Upload,
  RotateCcw,
  Sliders,
  Check,
  FileText,
  Lock,
  Trash2,
  Stamp,
} from "lucide-react";
import { toast } from "sonner";
import {
  RedactBox,
  ComplianceStampType,
  COMPLIANCE_STAMPS,
  scanDocumentForPii,
  burnRedactionsToCanvas,
} from "@/lib/document-redactor-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function DocumentRedactorTool() {
  const [docImg, setDocImg] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState<string>("tax_document.png");
  const [boxes, setBoxes] = useState<RedactBox[]>([]);
  const [stamp, setStamp] = useState<ComplianceStampType>("none");
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "document-redactor",
    { boxCount: boxes.length, stamp },
    (saved) => {
      if (saved.stamp) setStamp(saved.stamp as ComplianceStampType);
      toast.success("Draft redactions restored!");
    }
  );

  // Load document image
  const handleDocUpload = (file: File) => {
    setFileName(file.name);
    setBoxes([]);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setDocImg(img);
      toast.success("Document loaded! Drag boxes or use AI PII Auto-Scanner.");
    };
    img.src = url;
  };

  // Re-render Canvas with burned redactions
  const renderCanvas = useCallback(() => {
    if (!docImg) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = docImg.naturalWidth;
    canvas.height = docImg.naturalHeight;

    // Draw document original
    ctx.drawImage(docImg, 0, 0);

    // Burn redaction boxes
    burnRedactionsToCanvas(ctx, boxes, stamp);
  }, [docImg, boxes, stamp]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // AI PII Auto-Scanner
  const handleAiScanPii = () => {
    if (!docImg) return;
    toast.info("AI scanning document for SSNs, credit cards, and sensitive identifiers...");
    const matches = scanDocumentForPii();

    const newBoxes: RedactBox[] = matches.map((m) => {
      const z = m.approxZone;
      return {
        id: Math.random().toString(36).slice(2, 9),
        x: (z.xPercent / 100) * docImg.naturalWidth,
        y: (z.yPercent / 100) * docImg.naturalHeight,
        width: (z.wPercent / 100) * docImg.naturalWidth,
        height: (z.hPercent / 100) * docImg.naturalHeight,
        label: m.label,
        type: "compliance-stamp",
      };
    });

    setBoxes((prev) => [...prev, ...newBoxes]);
    toast.success(`AI flagged ${matches.length} sensitive PII zones and applied redactions!`);
  };

  // Mouse Drag Box Drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    setDrawStart({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    });
    setIsDrawing(true);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    const x = Math.min(drawStart.x, currentX);
    const y = Math.min(drawStart.y, currentY);
    const width = Math.abs(currentX - drawStart.x);
    const height = Math.abs(currentY - drawStart.y);

    if (width > 15 && height > 10) {
      const newBox: RedactBox = {
        id: Math.random().toString(36).slice(2, 9),
        x,
        y,
        width,
        height,
        type: "blackout",
      };
      setBoxes((prev) => [...prev, newBox]);
      toast.success("Redaction blackout box applied!");
    }
    setIsDrawing(false);
  };

  // Download Sanitized Image
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const base = fileName.replace(/\.[^/.]+$/, "");
        link.download = `${base}_sanitized_redacted.png`;
        link.click();
        toast.success("Downloaded permanently sanitized document!");
      }
    }, "image/png");
  };

  // Share
  const handleShare = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (blob) {
        await shareBlob(blob, "sanitized_doc.png", {
          title: "Sanitized Document",
          text: "Redacted compliant document",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      {/* Header controls & stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2.5">
            <Lock className="h-6 w-6 text-indigo-500" />
            Smart PII Document Sanitizer &amp; Compliance Redactor
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            True irreversible pixel-level redaction for tax forms, bank statements, and IDs with AI PII auto-detection and FOIA/HIPAA audit stamps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!docImg}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition shadow-md hover:shadow-indigo-500/20"
          >
            <Download className="h-4 w-4" />
            Download Sanitized Document
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={!docImg}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Document Canvas & Box Painting (7 Cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-6 shadow-inner flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800 mb-4 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">
              {boxes.length} Active Redactions • Drag on page to redact
            </span>
            <span className="font-mono text-emerald-400">Irreversible Pixel Destruction</span>
          </div>

          {!docImg ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-zinc-800 hover:border-indigo-500/60 rounded-2xl p-16 text-center cursor-pointer transition bg-zinc-900/40 hover:bg-zinc-900/80 group my-8"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleDocUpload(f);
                }}
              />
              <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition mb-4">
                <Upload className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">Upload Document / Tax Form</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                W-2, 1099, bank statement, medical bill, or passport photo.
              </p>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-white shadow-2xl flex items-center justify-center select-none cursor-crosshair">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  className="max-h-[500px] w-auto block object-contain"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleAiScanPii}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold text-xs shadow-sm hover:bg-indigo-100 transition"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI PII Auto-Scanner
                </button>

                <button
                  type="button"
                  onClick={() => setBoxes([])}
                  className="px-3 py-2 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-semibold hover:bg-zinc-800 transition"
                >
                  Clear All Boxes
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Compliance Stamps & Redaction List (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Compliance Audit Stamp */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Stamp className="h-4 w-4 text-indigo-500" />
              Compliance Audit Header Stamp
            </label>

            <select
              value={stamp}
              onChange={(e) => setStamp(e.target.value as ComplianceStampType)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs"
            >
              <option value="none">No Audit Banner</option>
              <option value="foia">FOIA Privacy (5 U.S.C. § 552)</option>
              <option value="hipaa">HIPAA Confidential Medical Record</option>
              <option value="gdpr">EU GDPR Compliance (Art. 17)</option>
              <option value="privileged">Attorney-Client Privileged</option>
            </select>

            {stamp !== "none" && (
              <p className="text-[11px] font-mono text-rose-600 dark:text-rose-400 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50">
                {COMPLIANCE_STAMPS[stamp]}
              </p>
            )}
          </div>

          {/* Active Redaction Boxes */}
          {boxes.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Redacted Fields ({boxes.length})
              </span>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {boxes.map((box, idx) => (
                  <div
                    key={box.id}
                    className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                      {box.label || `Redaction Zone #${idx + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBoxes((prev) => prev.filter((b) => b.id !== box.id))}
                      className="text-zinc-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
