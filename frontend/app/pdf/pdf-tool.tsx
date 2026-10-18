"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Scissors,
  FileImage,
  Combine,
  PencilRuler,
  XCircle,
} from "lucide-react";

import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { PdfEditor } from "@/components/pdf-editor";
import { Button } from "@/components/ui/button";
import { downloadUrl, getJob, submitPdf } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { PDF_TOOLS, type JobRecord, type PdfEditPlan, type PdfOp } from "@/lib/types";

const POLL_MS = 1200;
const MAX_PDFS = 10;

const OP_ICONS: Record<PdfOp, React.ComponentType<{ className?: string }>> = {
  convert: FileText,
  merge: Combine,
  split: Scissors,
  tojpg: FileImage,
  edit: PencilRuler,
};

export function PdfTool() {
  const [files, setFiles] = React.useState<File[]>([]);
  const [op, setOp] = React.useState<PdfOp>("convert");
  const [jobState, setJobState] = React.useState<"idle" | "submitting" | "queued" | "processing" | "completed" | "failed">("idle");
  const [jobError, setJobError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<JobRecord | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = React.useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = React.useCallback(
    (jobId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const rec = await getJob(jobId);
          if (rec.state === "completed") {
            stopPolling();
            setResult(rec);
            setJobState("completed");
            toast.success("Done! Your file is ready to download.");
            return;
          }
          if (rec.state === "failed") {
            stopPolling();
            setJobError(rec.error ?? "The operation failed.");
            setJobState("failed");
            return;
          }
          setJobState(rec.state === "queued" ? "queued" : "processing");
        } catch (err) {
          stopPolling();
          setJobError(err instanceof Error ? err.message : "Could not reach the processing service.");
          setJobState("failed");
        }
      }, POLL_MS);
    },
    [stopPolling],
  );

  React.useEffect(() => () => stopPolling(), [stopPolling]);

  const running = jobState === "submitting" || jobState === "queued" || jobState === "processing";

  const addFiles = (incoming: File[]) => {
    setFiles((prev) => (prev.length + incoming.length > MAX_PDFS ? prev : [...prev, ...incoming]));
  };

  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name));

  const run = async (plan?: PdfEditPlan, assets: File[] = []) => {
    if (files.length === 0 || running) return;
    setJobError(null);
    setResult(null);
    setJobState("submitting");
    try {
      // "edit" needs the document first, then any overlay images.
      const payload = plan ? [files[0], ...assets] : files;
      const res = await submitPdf(payload, op, plan);
      setJobState("queued");
      startPolling(res.jobId);
    } catch (err) {
      setJobState("failed");
      setJobError(err instanceof Error ? err.message : "Upload failed.");
    }
  };

  const reset = () => {
    stopPolling();
    setFiles([]);
    setResult(null);
    setJobError(null);
    setJobState("idle");
  };

  return (
    <AuthGate>
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
            PDF Tools
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Convert PDF to Word, merge documents, split pages, export JPGs or edit pages, text and overlays —
            everything runs on this computer.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: upload */}
          <section className="flex flex-col gap-4 lg:col-span-8">
            {op === "edit" ? (
              files[0] ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex min-w-0 items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-on-surface-variant" />
                      <span className="truncate font-medium">{files[0].name}</span>
                      <span className="font-mono text-xs text-on-surface-variant">
                        {formatBytes(files[0].size)}
                      </span>
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={running}
                      onClick={reset}
                    >
                      Change PDF
                    </Button>
                  </div>
                  <PdfEditor file={files[0]} running={running} onApply={(plan, assets) => void run(plan, assets)} />
                </>
              ) : (
                <>
                  <Dropzone onFiles={addFiles} accept="application/pdf,.pdf" multiple={false} kind="pdf" disabled={running} />
                  <p className="text-sm text-on-surface-variant">
                    Choose one PDF to open it in the editor, where you can reorder, rotate or delete pages and
                    add text, images and drawings.
                  </p>
                </>
              )
            ) : (
              <>
                <Dropzone onFiles={addFiles} accept="application/pdf,.pdf" multiple kind="pdf" disabled={running} />

                {files.length > 0 && (
                  <ul className="space-y-2 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                    {files.map((f) => (
                      <li key={f.name} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-on-surface-variant" />
                          <span className="truncate font-medium">{f.name}</span>
                          <span className="font-mono text-xs text-on-surface-variant">{formatBytes(f.size)}</span>
                        </span>
                        {!running && (
                          <button
                            type="button"
                            onClick={() => removeFile(f.name)}
                            className="rounded p-1 text-on-surface-variant transition-colors hover:bg-muted hover:text-destructive"
                            aria-label={`Remove ${f.name}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {jobState === "completed" && result?.outputFilename && (
              <div className="glass-panel rounded-2xl border-primary/20 p-5">
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                      <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-semibold">Ready to download</h2>
                      <p className="font-mono text-sm text-on-surface-variant">
                        {result.outputFilename}
                        {result.outputSize != null && <> · {formatBytes(result.outputSize)}</>}
                      </p>
                    </div>
                  </div>
                  <Button asChild className="gap-2">
                    <a href={downloadUrl(result.id)}>
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {jobState === "failed" && jobError && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                <div className="flex-1">
                  <p className="font-display text-sm font-semibold text-foreground">The operation failed</p>
                  <p className="text-sm text-on-surface-variant">{jobError}</p>
                </div>
                <Button variant="outline" size="sm" onClick={reset}>
                  Reset
                </Button>
              </div>
            )}

            {(jobState === "queued" || jobState === "processing") && (
              <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm text-on-surface-variant">
                  Processing your document — this can take a moment for large PDFs.
                </p>
              </div>
            )}
          </section>

          {/* Right: tool picker */}
          <aside className="flex flex-col gap-4 lg:col-span-4">
            <div className="space-y-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4">
              <h3 className="font-display text-lg font-semibold">Choose an operation</h3>
              <div className="space-y-2">
                {PDF_TOOLS.map((tool) => {
                  const Icon = OP_ICONS[tool.op];
                  const active = op === tool.op;
                  return (
                    <button
                      key={tool.op}
                      type="button"
                      onClick={() => !running && setOp(tool.op)}
                      className={
                        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors " +
                        (active
                          ? "border-primary bg-primary-container/10"
                          : "border-outline-variant/20 hover:border-primary/40")
                      }
                    >
                      <Icon className={"mt-0.5 h-5 w-5 shrink-0 " + (active ? "text-primary" : "text-on-surface-variant")} />
                      <span>
                        <span className="block font-display text-sm font-semibold">{tool.label}</span>
                        <span className="block text-xs text-on-surface-variant">{tool.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {op === "edit" ? null : (
                <>
                  {op !== "merge" && files.length > 1 && (
                    <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
                      Only the first PDF will be processed for this operation.
                    </p>
                  )}
                  {op === "merge" && files.length < 2 && (
                    <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
                      Add at least two PDFs to merge them.
                    </p>
                  )}

                  <Button className="w-full gap-2" disabled={files.length === 0 || running} onClick={() => void run()}>
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Run
                  </Button>
                </>
              )}
            </div>

            <p className="px-1 text-xs text-on-surface-variant">
              Files are processed locally and automatically deleted shortly after the job finishes.
            </p>
          </aside>
        </div>
      </div>
    </AuthGate>
  );
}
