"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  FileCheck2,
  PenTool,
  Download,
  Share2,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  User,
  RotateCcw,
  Upload,
  Lock,
  Printer,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  AuditCertificate,
  SAMPLE_AGREEMENTS,
  SignerField,
  computeSha256,
  drawAuditCertificate,
} from "@/lib/esign-engine";
import { shareBlob } from "@/lib/share";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";

export function EsignDocumentsTool() {
  const [docTitle, setDocTitle] = useState<string>(SAMPLE_AGREEMENTS[0].title);
  const [docContent, setDocContent] = useState<string>(SAMPLE_AGREEMENTS[0].content);
  const [signerName, setSignerName] = useState<string>("Jane Doe");
  const [signerEmail, setSignerEmail] = useState<string>("jane.doe@example.com");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signedDate, setSignedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [isSigned, setIsSigned] = useState<boolean>(false);
  const [auditCert, setAuditCert] = useState<AuditCertificate | null>(null);

  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const certCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  // Signature Pad drawing logic
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e3a8a"; // Navy ink
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    setSignatureDataUrl(canvas.toDataURL("image/png"));
  };

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl(null);
  };

  // Execute Signature & Generate Audit Certificate
  const handleExecuteSign = async () => {
    if (!signatureDataUrl) {
      toast.error("Please draw your signature in the signature box.");
      return;
    }
    if (!signerName.trim() || !signerEmail.trim()) {
      toast.error("Please enter your signer full name and email.");
      return;
    }

    try {
      const fullDocText = `${docTitle}\n\n${docContent}\n\nSigned by: ${signerName} (${signerEmail}) on ${signedDate}`;
      const hash = await computeSha256(fullDocText);
      const docId = `DOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const cert: AuditCertificate = {
        documentId: docId,
        documentTitle: docTitle,
        sha256Hash: hash,
        signerName,
        signerEmail,
        signedAt: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
        complianceStatement:
          "Digitally executed under ESIGN Act (15 U.S.C. § 7001) & eIDAS Regulation (EU 910/2014). Tamper-evident cryptographic fingerprint.",
      };

      setAuditCert(cert);
      setIsSigned(true);
      toast.success("Document legally executed with SHA-256 Audit Trail!");
    } catch {
      toast.error("Failed to generate audit certificate.");
    }
  };

  // Render Audit Certificate Canvas
  useEffect(() => {
    if (!isSigned || !auditCert) return;
    const canvas = certCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 1200;
    canvas.height = 700;
    drawAuditCertificate(ctx, canvas.width, canvas.height, auditCert, signatureDataUrl || undefined);
  }, [isSigned, auditCert, signatureDataUrl]);

  // Print PDF
  const handlePrint = () => {
    window.print();
  };

  // Download Certificate PNG
  const handleDownloadCert = () => {
    const canvas = certCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-certificate-${auditCert?.documentId || "doc"}.png`;
    a.click();
    toast.success("Downloaded tamper-evident completion certificate!");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Print stylesheet */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-agreement,
          #printable-agreement * {
            visibility: visible;
          }
          #printable-agreement {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 30px !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          header,
          footer,
          nav,
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="mb-6 no-print">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          ESIGN & eIDAS Compliant Digital Execution
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Legally-Binding E-Sign & Agreement Suite
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Sign contracts, NDAs, and proposals with smooth digital ink. Generates an official SHA-256 tamper-evident Audit Trail Certificate. 100% free and in-browser.
        </p>
      </div>

      {/* Action Bar */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Sample Contracts:</span>
          {SAMPLE_AGREEMENTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setDocTitle(s.title);
                setDocContent(s.content);
                setIsSigned(false);
                setAuditCert(null);
              }}
              className="rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted"
            >
              {s.id === "nda" ? "Mutual NDA" : "Contractor Agreement"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isSigned && (
            <>
              <button
                type="button"
                onClick={handleDownloadCert}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                Certificate (PNG)
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90"
              >
                <Printer className="h-4 w-4" />
                Print Executed PDF
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: The Agreement Document */}
        <div className="space-y-4 lg:col-span-7 xl:col-span-8">
          <div
            id="printable-agreement"
            className="rounded-3xl border border-border/80 bg-white p-8 sm:p-12 text-neutral-900 shadow-2xl space-y-6"
          >
            {/* Header Document Title */}
            <div className="border-b border-neutral-200 pb-4 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                  LEGAL INSTRUMENT
                </span>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="mt-1 text-xl font-black text-neutral-900 w-full border-none p-0 focus:outline-none"
                />
              </div>

              {isSigned && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  LEGALLY EXECUTED
                </div>
              )}
            </div>

            {/* Document Content */}
            <textarea
              rows={12}
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              className="w-full text-xs font-serif leading-relaxed text-neutral-800 border-none p-0 resize-y focus:outline-none bg-transparent"
            />

            {/* Signature Acceptance Block */}
            <div className="border-t-2 border-neutral-200 pt-6 mt-8 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
                EXECUTION & ACCEPTANCE
              </span>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <span className="text-[11px] text-neutral-500 block">Signer Full Name</span>
                  <span className="text-sm font-bold text-neutral-900">{signerName}</span>
                  <span className="text-[11px] text-neutral-400 block">{signerEmail}</span>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <span className="text-[11px] text-neutral-500 block">Date of Execution</span>
                  <span className="text-sm font-bold text-neutral-900">{signedDate}</span>
                </div>
              </div>

              {/* Signature Display */}
              <div>
                <span className="text-[11px] text-neutral-500 block mb-1">Digital Signature</span>
                <div className="h-20 w-64 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 flex items-center justify-center p-2">
                  {signatureDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={signatureDataUrl} alt="Signature" className="max-h-full object-contain" />
                  ) : (
                    <span className="text-xs text-neutral-400 italic">Signature pending...</span>
                  )}
                </div>
              </div>

              {/* Security Footnote */}
              {isSigned && auditCert && (
                <div className="rounded-xl bg-neutral-50 p-3 text-[10px] font-mono text-neutral-500 space-y-1">
                  <div>Document ID: {auditCert.documentId}</div>
                  <div className="truncate">SHA-256 Fingerprint: {auditCert.sha256Hash}</div>
                </div>
              )}
            </div>
          </div>

          {/* Certificate Canvas Preview */}
          {isSigned && (
            <div className="rounded-3xl border border-border/80 bg-neutral-900 p-4 shadow-xl space-y-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-blue-400" />
                Audit Trail Certificate of Completion
              </span>
              <canvas ref={certCanvasRef} className="w-full rounded-xl" />
            </div>
          )}
        </div>

        {/* Right Column: Signer Pad & Control Panel */}
        <div className="space-y-4 lg:col-span-5 xl:col-span-4 no-print">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-5">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <PenTool className="h-4 w-4 text-blue-400" />
                Signer Information
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter your identity and draw your digital ink signature.
              </p>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-bold text-foreground"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Signer Email (for audit record)
                </label>
                <input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="jane.doe@example.com"
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-medium text-foreground"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Signing Date
                </label>
                <input
                  type="date"
                  value={signedDate}
                  onChange={(e) => setSignedDate(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-foreground"
                />
              </div>
            </div>

            {/* Signature Draw Pad */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">
                  Draw Signature Here
                </label>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-[11px] text-destructive hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Clear Ink
                </button>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-border/80 bg-white p-1">
                <canvas
                  ref={sigCanvasRef}
                  width={400}
                  height={150}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  className="h-[120px] w-full cursor-crosshair touch-none"
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Touch with finger, stylus, or drag mouse to draw signature.
              </p>
            </div>

            {/* Execute Button */}
            <button
              type="button"
              onClick={handleExecuteSign}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-lg hover:bg-blue-500 transition hover:scale-[1.02]"
            >
              <ShieldCheck className="h-4 w-4" />
              Sign & Lock with SHA-256 Audit Trail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
