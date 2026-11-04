"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CloudUpload,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/dropzone";
import { AuthGate } from "@/components/auth-gate";
import { CornerEditor } from "@/components/scan/corner-editor";
import { CameraCapture } from "@/components/scan/camera-capture";
import { downloadUrl, getJob, scanDownloadUrl, submitScan, submitScanDetect } from "@/lib/api";
import { SCAN_FORMATS, SCAN_MODES, type JobRecord, type ScanMode, type ScanOutputFormat, type ScanRotation } from "@/lib/types";
import { fullCorners, rotateCorners } from "@/lib/scan";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";

type JobState = "idle" | "submitting" | "queued" | "processing" | "completed" | "failed";

interface ScanPage {
  key: string;
  file: File;
  previewUrl: string;
  srcWidth: number;
  srcHeight: number;
  rotate: ScanRotation;
  corners: [number, number][] | null;
  mode: ScanMode | null;
  detecting: boolean;
  detectError: string | null;
}

function displayDims(p: ScanPage): { w: number; h: number } {
  const swapped = p.rotate % 180 !== 0;
  return swapped ? { w: p.srcHeight, h: p.srcWidth } : { w: p.srcWidth, h: p.srcHeight };
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}

const POLL_MS = 900;

function ScanPageCard({
  page,
  index,
  total,
  running,
  selected,
  onSelect,
  onRotate,
  onRemove,
  onMove,
  onMode,
}: {
  page: ScanPage;
  index: number;
  total: number;
  running: boolean;
  selected: boolean;
  onSelect: () => void;
  onRotate: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onMode: (mode: ScanMode | null) => void;
}) {
  const dims = displayDims(page);
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border-l-2 p-2.5 transition-colors",
        selected ? "border-primary-container bg-primary-container/10" : "border-transparent hover:bg-surface-container-high/60",
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-container-high">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={page.previewUrl} alt={page.file.name} className="h-full w-full object-cover" />
        {page.detecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[13px] font-semibold text-foreground">
          Page {index + 1}
          <span className="ml-2 font-mono text-xs font-normal text-on-surface-variant">{page.file.name}</span>
        </p>
        <p className="font-mono text-xs text-on-surface-variant">
          {dims.w} × {dims.h} px{page.rotate !== 0 && ` · rotated ${page.rotate}°`}
          {page.corners ? "" : " · not detected"}
        </p>
        {page.detectError && <p className="mt-1 truncate text-xs text-destructive">{page.detectError}</p>}
        <select
          value={page.mode ?? ""}
          disabled={running}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onMode(e.target.value === "" ? null : (e.target.value as ScanMode))}
          className="mt-1.5 h-7 w-full max-w-[180px] rounded-md border border-outline-variant/30 bg-surface-container-lowest px-1.5 font-mono text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Use global mode ({SCAN_MODES.find((m) => m.value === "auto")?.label})</option>
          {SCAN_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Rotate page"
            disabled={running}
            onClick={(e) => {
              e.stopPropagation();
              onRotate();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Remove page"
            disabled={running}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-destructive disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Move page up"
            disabled={running || index === 0}
            onClick={(e) => {
              e.stopPropagation();
              onMove(-1);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Move page down"
            disabled={running || index === total - 1}
            onClick={(e) => {
              e.stopPropagation();
              onMove(1);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-30"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ScanTool() {
  const [pages, setPages] = React.useState<ScanPage[]>([]);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<ScanMode>("auto");
  const [format, setFormat] = React.useState<ScanOutputFormat>("png");
  const [jobState, setJobState] = React.useState<JobState>("idle");
  const [result, setResult] = React.useState<JobRecord | null>(null);
  const [resultFormat, setResultFormat] = React.useState<ScanOutputFormat>("png");
  const [jobError, setJobError] = React.useState<string | null>(null);

  const pagesRef = React.useRef<ScanPage[]>([]);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  pagesRef.current = pages;

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
            toast.success("Scan complete! Your document is ready to download.");
            return;
          }
          if (rec.state === "failed") {
            stopPolling();
            setJobError(rec.error ?? "The scan failed.");
            setJobState("failed");
            return;
          }
          setJobState(rec.state);
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

  const patchPage = (key: string, patch: Partial<ScanPage>) =>
    setPages((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const runDetection = React.useCallback(async (page: ScanPage) => {
    patchPage(page.key, { detecting: true, detectError: null });
    try {
      const det = await submitScanDetect(page.file, page.rotate);
      patchPage(page.key, { corners: det.corners, detecting: false });
    } catch (err) {
      patchPage(page.key, {
        detecting: false,
        detectError: err instanceof Error ? err.message : "Auto-detect failed.",
      });
    }
  }, []);

  const addFiles = React.useCallback(
    (files: File[], preDetectedCorners?: [number, number][] | null) => {
      const added = files.filter((f) => !pagesRef.current.some((p) => p.file === f));
      if (added.length === 0) return;
      const newPages: ScanPage[] = added.map((f) => ({
        key: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        srcWidth: 0,
        srcHeight: 0,
        rotate: 0,
        corners: preDetectedCorners ?? null,
        mode: null,
        detecting: false,
        detectError: null,
      }));
      setPages((prev) => {
        const next = [...prev, ...newPages];
        setSelectedKey((k) => k ?? newPages[0].key);
        return next;
      });

      for (const np of newPages) {
        void readImageDimensions(np.file).then((dims) => {
          const patch: Partial<ScanPage> = { srcWidth: dims.width, srcHeight: dims.height };
          if (!preDetectedCorners && dims.width > 0) {
            patch.corners = fullCorners(dims.width, dims.height);
          }
          if (dims.width === 0) {
            patch.detectError = "Could not read the image dimensions.";
          }
          patchPage(np.key, patch);
        });
      }
    },
    [],
  );

  const removePage = (key: string) => {
    setPages((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((p) => p.key !== key);
      setSelectedKey((k) => (k === key ? (next[0]?.key ?? null) : k));
      return next;
    });
  };

  const clearAll = React.useCallback(() => {
    stopPolling();
    setPages((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
    setSelectedKey(null);
    setResult(null);
    setJobError(null);
    setJobState("idle");
  }, [stopPolling]);

  const rotatePage = (key: string) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p;
        const dims = displayDims(p);
        const nextRotate = ((p.rotate + 90) % 360) as ScanRotation;
        return {
          ...p,
          rotate: nextRotate,
          corners: p.corners ? rotateCorners(p.corners, dims.w, dims.h, 90) : null,
        };
      }),
    );
  };

  const selected = pages.find((p) => p.key === selectedKey) ?? pages[0] ?? null;
  const dims = selected ? displayDims(selected) : { w: 0, h: 0 };
  const running = jobState === "submitting" || jobState === "queued" || jobState === "processing";

  const scan = async () => {
    if (pages.length === 0 || pages.length > 10) return;
    if (running) return;
    setJobError(null);
    setResult(null);
    setJobState("submitting");
    try {
      const settings = {
        mode,
        format,
        pages: pages.map((p) => {
          const d = displayDims(p);
          return {
            corners: p.corners ?? fullCorners(d.w, d.h),
            rotate: p.rotate,
            mode: p.mode ?? mode,
          };
        }),
      };
      const res = await submitScan(
        pages.map((p) => p.file),
        settings,
      );
      setResultFormat(format);
      setJobState("queued");
      startPolling(res.jobId);
    } catch (err) {
      setJobState("failed");
      setJobError(err instanceof Error ? err.message : "Upload failed.");
    }
  };

  const handleDrop = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length + pagesRef.current.length > 10) {
      toast.error("A scan supports up to 10 pages.");
      return;
    }
    addFiles(images);
  };

  const pageFiles = Array.from({ length: pages.length }, (_, i) => `page-${i + 1}.${resultFormat}`);

  return (
    <AuthGate>
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
            Document Scanner
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Automatically find the document, straighten the perspective and clean the page.
          </p>
        </div>

        {/* Privacy banner */}
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-container/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" />
          <p className="text-sm text-on-surface-variant">
            <span className="font-display font-semibold text-foreground">Your documents stay private.</span>{" "}
            Everything runs on this computer — files are never uploaded to a cloud and are automatically deleted shortly after
            scanning.
          </p>
        </div>

        {jobState === "completed" && result && (
          <div className="glass-panel mb-6 rounded-2xl border-primary/20 p-5">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold">Scan complete</h2>
                  <p className="text-sm text-on-surface-variant">
                    {pages.length} page{pages.length === 1 ? "" : "s"} · PDF size:{" "}
                    <span className="font-mono font-semibold text-foreground">{formatBytes(result.outputSize)}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="gap-2">
                  <a href={downloadUrl(result.id)}>
                    <Download className="h-4 w-4" />
                    Download PDF
                  </a>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <a href={scanDownloadUrl(result.id, "scan.zip")}>
                    <Download className="h-4 w-4" />
                    Download Images (ZIP)
                  </a>
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
              {pageFiles.map((name, i) => (
                <a
                  key={name}
                  href={scanDownloadUrl(result.id, name)}
                  className="group block overflow-hidden rounded-lg border border-outline-variant/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scanDownloadUrl(result.id, name)}
                    alt={`Page ${i + 1}`}
                    loading="lazy"
                    className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="border-t border-outline-variant/10 px-1.5 py-1 text-center font-mono text-[10px] text-on-surface-variant">
                    Page {i + 1}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {jobState === "failed" && jobError && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <XCircle className="h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="font-display text-sm font-semibold text-foreground">The scan failed</p>
              <p className="text-sm text-on-surface-variant">{jobError}</p>
            </div>
            <Button variant="outline" size="sm" onClick={clearAll}>
              Reset
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: editor + pages */}
          <section className="flex flex-col gap-4 lg:col-span-8">
            {selected ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold">
                    <ImageIcon className="h-5 w-5 text-on-surface-variant" />
                    Document preview
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={selected.detecting || running}
                    onClick={() => void runDetection(selected)}
                  >
                    {selected.detecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ScanSearch className="h-4 w-4" />
                    )}
                    Auto Detect
                  </Button>
                </div>

                <div className="mx-auto w-full max-w-sm">
                  <CornerEditor
                    src={selected.previewUrl}
                    alt={selected.file.name}
                    width={dims.w}
                    height={dims.h}
                    rotate={selected.rotate}
                    corners={selected.corners ?? []}
                  />
                </div>
                <p className="text-center font-mono text-xs text-on-surface-variant">
                  Full picture is selected by default — use Auto Detect to trace the document. Rotation is preserved for
                  every page.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Dropzone onFiles={handleDrop} />
                <div className="space-y-2 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                  <h3 className="font-display text-sm font-semibold text-foreground">Use your camera</h3>
                  <CameraCapture onCapture={(file, c) => addFiles([file], c)} />
                </div>
              </div>
            )}

            {pages.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="mb-1 flex items-center gap-2 font-display text-xl font-medium">
                  <FileText className="h-5 w-5 text-on-surface-variant" />
                  Pages ({pages.length}/10)
                </h3>
                <Dropzone onFiles={handleDrop} compact disabled={running || pages.length >= 10} />
                <div className="flex flex-col gap-2">
                  {pages.map((p, i) => (
                    <ScanPageCard
                      key={p.key}
                      page={p}
                      index={i}
                      total={pages.length}
                      running={running}
                      selected={p.key === selected?.key}
                      onSelect={() => setSelectedKey(p.key)}
                      onRotate={() => rotatePage(p.key)}
                      onRemove={() => removePage(p.key)}
                      onMove={(dir) =>
                        setPages((prev) => {
                          const j = prev.findIndex((x) => x.key === p.key);
                          const k = j + dir;
                          if (j < 0 || k < 0 || k >= prev.length) return prev;
                          const next = prev.slice();
                          const [item] = next.splice(j, 1);
                          next.splice(k, 0, item);
                          return next;
                        })
                      }
                      onMode={(m) => patchPage(p.key, { mode: m })}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Right: settings + scan */}
          <aside className="lg:col-span-4">
            <div className="sticky top-24 flex flex-col gap-6 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm sm:p-6">
              <div className="border-b border-outline-variant/10 pb-4">
                <h2 className="font-display text-xl font-medium">Scan Settings</h2>
              </div>

              {/* AI Shadow Remover & Clean-Scan Quick Action */}
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">✨</span>
                    <span className="text-xs font-semibold text-foreground">AI Shadow Remover &amp; Paper Whitener</span>
                  </div>
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/30">
                    Neural Scan
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Eliminates hand &amp; smartphone camera shadows, whitens yellowed paper, and flattens paper creases.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "magic" ? "default" : "outline"}
                    className={cn("h-8 text-xs flex-1", mode === "magic" ? "bg-blue-600 text-white hover:bg-blue-700" : "")}
                    onClick={() => setMode("magic")}
                  >
                    Shadow Removal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "removebg" ? "default" : "outline"}
                    className={cn("h-8 text-xs flex-1", mode === "removebg" ? "bg-blue-600 text-white hover:bg-blue-700" : "")}
                    onClick={() => setMode("removebg")}
                  >
                    Clean White Paper
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Scan mode
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {SCAN_MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMode(m.value)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition-colors",
                        mode === m.value
                          ? "border-primary bg-primary-container/15"
                          : "border-outline-variant/30 hover:border-primary/50",
                      )}
                    >
                      <span
                        className={cn(
                          "block font-display text-[13px] font-semibold",
                          mode === m.value ? "text-primary" : "text-foreground",
                        )}
                      >
                        {m.label}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
                  {SCAN_MODES.find((m) => m.value === mode)?.desc}
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Output format
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {SCAN_FORMATS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFormat(f.value)}
                      className={cn(
                        "flex h-10 items-center justify-center rounded-lg border font-mono text-sm font-semibold transition-colors",
                        format === f.value
                          ? "border-primary bg-primary-container/15 text-primary"
                          : "border-outline-variant/30 text-foreground hover:border-primary/50",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
                  A single PDF is always produced, plus individual {format.toUpperCase()} pages in a ZIP.
                </p>
              </div>

              <div className="space-y-2 border-t border-outline-variant/10 pt-5">
                <Button
                  onClick={() => void scan()}
                  disabled={pages.length === 0 || running || pages.length > 10}
                  className="w-full gap-2 rounded-xl py-4"
                  size="lg"
                >
                  {running ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {jobState === "submitting" ? "Uploading…" : "Scanning…"}
                    </>
                  ) : (
                    <>
                      <CloudUpload className="h-4 w-4" />
                      Scan {pages.length > 0 ? `${pages.length} page${pages.length === 1 ? "" : "s"}` : ""}
                    </>
                  )}
                </Button>
                {pages.length > 0 && !running && (
                  <Button variant="ghost" className="w-full gap-2 text-primary" onClick={clearAll}>
                    <Trash2 className="h-4 w-4" />
                    Start Over
                  </Button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AuthGate>
  );
}
