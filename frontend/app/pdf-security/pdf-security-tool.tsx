"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCheck,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  Printer,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Upload,
} from "lucide-react";

import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { Input } from "@/components/ui/input";
import { submitPdf, getJob, downloadUrl } from "@/lib/api";
import type { JobRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { hasQueryInjection } from "@/lib/validation";

async function waitForJob(jobId: string, onProgress?: (pct: number) => void): Promise<JobRecord> {
  let attempts = 0;
  while (attempts < 120) {
    const job = await getJob(jobId);
    if (onProgress) {
      if (job.state === "queued") onProgress(30);
      else if (job.state === "processing") onProgress(Math.min(92, 50 + attempts * 5));
    }
    if (job.state === "completed") return job;
    if (job.state === "failed") throw new Error(job.error || "Processing failed.");
    await new Promise((r) => setTimeout(r, 600));
    attempts++;
  }
  throw new Error("Processing timed out. Please try again.");
}

export function PdfSecurityTool() {
  const [activeTab, setActiveTab] = React.useState<"protect" | "unlock">("protect");
  const [file, setFile] = React.useState<File | null>(null);

  // Protect tab state
  const [userPassword, setUserPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [ownerPassword, setOwnerPassword] = React.useState("");

  // Permissions state
  const [allowPrint, setAllowPrint] = React.useState(true);
  const [allowCopy, setAllowCopy] = React.useState(true);
  const [allowEdit, setAllowEdit] = React.useState(false);
  const [allowAnnotate, setAllowAnnotate] = React.useState(false);

  // Unlock tab state
  const [unlockPassword, setUnlockPassword] = React.useState("");
  const [showUnlockPassword, setShowUnlockPassword] = React.useState(false);

  // Processing state
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [completedJob, setCompletedJob] = React.useState<JobRecord | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleSelectFile = (f: File) => {
    setFile(f);
    setCompletedJob(null);
    setError(null);
  };

  const handleProtect = async () => {
    if (!file) return;
    if (!userPassword) {
      setError("Please enter a password to lock the PDF.");
      return;
    }
    if (hasQueryInjection(userPassword) || hasQueryInjection(confirmPassword) || (ownerPassword && hasQueryInjection(ownerPassword))) {
      setError("Password contains prohibited query tokens or injection sequences.");
      return;
    }
    if (userPassword.length < 4) {
      setError("PDF password must be at least 4 characters long.");
      return;
    }
    if (userPassword !== confirmPassword) {
      setError("Passwords do not match. Please verify both fields.");
      return;
    }

    setIsProcessing(true);
    setProgress(20);
    setError(null);

    try {
      const res = await submitPdf([file], "protect", undefined, {
        userPassword,
        ownerPassword: ownerPassword || userPassword,
        permissions: {
          print: allowPrint,
          copy: allowCopy,
          edit: allowEdit,
          annotate: allowAnnotate,
        },
      });

      setProgress(50);
      const job = await waitForJob(res.jobId, (prog) => {
        setProgress(Math.max(50, Math.min(95, prog)));
      });

      setCompletedJob(job);
      setProgress(100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to encrypt PDF.";
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlock = async () => {
    if (!file) return;
    if (!unlockPassword) {
      setError("Please enter the password to unlock this PDF.");
      return;
    }
    if (hasQueryInjection(unlockPassword)) {
      setError("Password contains prohibited query tokens or injection sequences.");
      return;
    }
    setIsProcessing(true);
    setProgress(20);
    setError(null);

    try {
      const res = await submitPdf([file], "unlock", undefined, {
        password: unlockPassword,
      });

      setProgress(50);
      const job = await waitForJob(res.jobId, (prog) => {
        setProgress(Math.max(50, Math.min(95, prog)));
      });

      setCompletedJob(job);
      setProgress(100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to decrypt PDF. Please verify password.";
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AuthGate>
      <div className="container max-w-5xl py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-xs text-primary mb-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            PDF Security &amp; Permissions Manager
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            PDF Security, Locker &amp; Permissions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base max-w-2xl">
            Protect confidential contracts and sensitive documents with military-grade AES-256 encryption.
            Restrict printing and copying, or permanently remove passwords from unlocked PDFs.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-3 mb-6 border-b border-outline-variant/20 pb-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab("protect");
              setCompletedJob(null);
              setError(null);
            }}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-semibold transition-all cursor-pointer",
              activeTab === "protect"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Lock className="h-3.5 w-3.5" />
            Protect &amp; Encrypt PDF
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("unlock");
              setCompletedJob(null);
              setError(null);
            }}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-semibold transition-all cursor-pointer",
              activeTab === "unlock"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Unlock className="h-3.5 w-3.5" />
            Unlock &amp; Decrypt PDF
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Column: File Dropzone & Document Inspector */}
          <div className="space-y-6 lg:col-span-6">
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-xs space-y-4">
              <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Select PDF Document
              </h2>

              {!file ? (
                <div>
                  <Dropzone
                    kind="pdf"
                    onFiles={(files) => {
                      if (files.length > 0) handleSelectFile(files[0]);
                    }}
                  />
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Upload any PDF document. Your file stays 100% private on your device.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-outline-variant/25 bg-muted/40 p-3.5 text-xs">
                    <div className="flex items-center gap-2.5 truncate">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="truncate">
                        <p className="font-semibold text-foreground truncate">{file.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setCompletedJob(null);
                        setError(null);
                      }}
                      className="font-mono text-[11px] text-muted-foreground hover:text-destructive cursor-pointer ml-2"
                    >
                      Change
                    </button>
                  </div>

                  {/* Security Specs Card */}
                  <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-4 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-mono">Encryption Standard</span>
                      <span className="font-mono font-bold text-primary">AES-256 (Military)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-mono">Process Location</span>
                      <span className="font-mono text-foreground">Local Host CPU (Zero Cloud)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-mono">Integrity Status</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        Ready to Process
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  {error}
                </div>
              )}
            </div>

            {/* Privacy Guarantee Note */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <ShieldCheck className="h-4 w-4" />
                <span>Zero Cloud Exposure</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                All cryptography keys and PDF streams are encrypted locally on this machine using
                high-speed native C++/Python binaries. Your confidential records are never transmitted externally.
              </p>
            </div>
          </div>

          {/* Right Column: Encryption / Decryption Controls */}
          <div className="space-y-6 lg:col-span-6">
            {activeTab === "protect" ? (
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-xs space-y-5">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-sm font-bold text-foreground">
                    Set Document Passwords
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block font-mono text-xs text-on-surface-variant">
                      User / Open Password <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={userPassword}
                        onChange={(e) => setUserPassword(e.target.value)}
                        preventQueryInjection
                        placeholder="Required to open the PDF"
                        className="bg-muted pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block font-mono text-xs text-on-surface-variant">
                      Confirm Password <span className="text-primary">*</span>
                    </label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      preventQueryInjection
                      placeholder="Re-enter password"
                      className="bg-muted"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-mono text-xs text-on-surface-variant">
                      Owner Password (Optional)
                    </label>
                    <Input
                      type="password"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      preventQueryInjection
                      placeholder="Required to modify security permissions"
                      className="bg-muted"
                    />
                  </div>
                </div>

                {/* Permissions Checkboxes */}
                <div className="space-y-3 pt-3 border-t border-outline-variant/15">
                  <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Recipient Permissions
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 rounded-lg border border-outline-variant/20 p-2.5 bg-muted/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowPrint}
                        onChange={(e) => setAllowPrint(e.target.checked)}
                        className="rounded border-outline-variant/40 text-primary"
                      />
                      <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Allow Printing</span>
                    </label>

                    <label className="flex items-center gap-2 rounded-lg border border-outline-variant/20 p-2.5 bg-muted/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowCopy}
                        onChange={(e) => setAllowCopy(e.target.checked)}
                        className="rounded border-outline-variant/40 text-primary"
                      />
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Allow Copying Text</span>
                    </label>

                    <label className="flex items-center gap-2 rounded-lg border border-outline-variant/20 p-2.5 bg-muted/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowEdit}
                        onChange={(e) => setAllowEdit(e.target.checked)}
                        className="rounded border-outline-variant/40 text-primary"
                      />
                      <FileCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Allow Modifying Pages</span>
                    </label>

                    <label className="flex items-center gap-2 rounded-lg border border-outline-variant/20 p-2.5 bg-muted/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowAnnotate}
                        onChange={(e) => setAllowAnnotate(e.target.checked)}
                        className="rounded border-outline-variant/40 text-primary"
                      />
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Allow Comments/Forms</span>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleProtect}
                  disabled={!file || !userPassword || isProcessing}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-semibold shadow-md transition-all cursor-pointer",
                    !file || !userPassword || isProcessing
                      ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/95 active:scale-[0.99]",
                  )}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Encrypting AES-256 PDF... {progress}%
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Encrypt &amp; Protect PDF
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Unlock Tab */
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-xs space-y-5">
                <div className="flex items-center gap-2">
                  <Unlock className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-sm font-bold text-foreground">
                    Unlock &amp; Remove Password
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block font-mono text-xs text-on-surface-variant">
                      Current PDF Password
                    </label>
                    <div className="relative">
                      <Input
                        type={showUnlockPassword ? "text" : "password"}
                        value={unlockPassword}
                        onChange={(e) => setUnlockPassword(e.target.value)}
                        preventQueryInjection
                        placeholder="Enter password to unlock"
                        className="bg-muted pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showUnlockPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="rounded-lg bg-surface-container-low p-3 text-xs leading-relaxed text-muted-foreground">
                    This permanently decrypts the PDF and removes all owner permission restrictions,
                    producing a clean, unlocked document copy ready for printing, editing, and sharing.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleUnlock}
                  disabled={!file || isProcessing}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-semibold shadow-md transition-all cursor-pointer",
                    !file || isProcessing
                      ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/95 active:scale-[0.99]",
                  )}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Decrypting PDF... {progress}%
                    </>
                  ) : (
                    <>
                      <Unlock className="h-4 w-4" />
                      Remove Password &amp; Unlock PDF
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Completed Job Download Card */}
            {completedJob && completedJob.outputFilename && (
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-display text-xs font-bold">
                      {activeTab === "protect" ? "PDF Encrypted Successfully!" : "PDF Unlocked Successfully!"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {completedJob.outputFilename}
                    </p>
                  </div>
                </div>

                <a
                  href={downloadUrl(completedJob.id)}
                  download={completedJob.outputFilename}
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-display text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
                >
                  <Download className="h-4 w-4" />
                  Download {completedJob.outputFilename}
                </a>
              </div>
            )}

            {/* Related PDF Tools */}
            <div className="rounded-xl border border-outline-variant/15 bg-muted/20 p-4 text-xs space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                More PDF Toolkit Tools
              </p>
              <div className="flex flex-col gap-1.5">
                <Link
                  href="/pdf"
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-muted text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span>📄 PDF Tools (Convert, Merge, Split &amp; Sign)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/redact"
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-muted text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span>🛡️ AI Smart Privacy Redactor (Blackout PII)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/ocr"
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-muted text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span>📝 AI Document &amp; Image OCR</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
