"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Crop,
  Download,
  FileText,
  FileUp,
  ImageIcon,
  Loader2,
  Monitor,
  Play,
  ShieldCheck,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { ZoomControls } from "@/components/zoom-controls";
import { RegionSelector, type CropRect } from "@/components/screenshot/region-selector";
import {
  DEFAULT_PDF_OPTIONS,
  PDF_ORIENTATIONS,
  PDF_PAGE_SIZES,
  canCaptureScreen,
  cropShot,
  downloadBlob,
  grabShotFromVideo,
  imagesToPdf,
  requestDisplayStream,
  stopStream,
  type CaptureShot,
  type PdfExportOptions,
} from "@/lib/screenshot";
import {
  DOCUMENT_ACCEPT,
  detectDocumentKind,
  importDocumentFiles,
  probePageCount,
} from "@/lib/document";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { useZoomPan } from "@/lib/use-zoom-pan";

type Busy = "idle" | "current" | "continuous" | "region";

const INTERVALS = [1, 2, 3, 5, 10] as const;
const IMPORT_DPIS = [96, 150, 200] as const;

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes(),
  )}${pad(d.getSeconds())}`;
}

function CaptureRow({
  shot,
  index,
  total,
  selected,
  onSelect,
  onRemove,
  onMove,
  onDownload,
}: {
  shot: CaptureShot;
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onDownload: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border-l-2 p-2.5 transition-colors",
        selected
          ? "border-primary-container bg-primary-container/10"
          : "border-transparent hover:bg-surface-container-high/60",
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-outline-variant/20 bg-surface-container-high">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.dataUrl} alt={shot.label} className="h-full w-full object-cover" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[13px] font-semibold text-foreground">{shot.label}</p>
        <p className="font-mono text-xs text-on-surface-variant">
          {shot.width} × {shot.height} px · {formatBytes(shot.blob.size)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label="Download capture"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Move up"
          disabled={index === 0}
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
          aria-label="Move down"
          disabled={index === total - 1}
          onClick={(e) => {
            e.stopPropagation();
            onMove(1);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-30"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Remove capture"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ScreenshotTool() {
  const [shots, setShots] = React.useState<CaptureShot[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<Busy>("idle");
  const [continuous, setContinuous] = React.useState(false);
  const [intervalSec, setIntervalSec] = React.useState<number>(2);
  const [regionSource, setRegionSource] = React.useState<CaptureShot | null>(null);
  const [pdfOptions, setPdfOptions] = React.useState<PdfExportOptions>(DEFAULT_PDF_OPTIONS);
  const [exporting, setExporting] = React.useState(false);
  const supported = canCaptureScreen();

  const [docFiles, setDocFiles] = React.useState<File[]>([]);
  const [docTotalPages, setDocTotalPages] = React.useState<number | null>(null);
  const [docRangeMode, setDocRangeMode] = React.useState<"all" | "custom">("all");
  const [docFrom, setDocFrom] = React.useState(1);
  const [docTo, setDocTo] = React.useState(1);
  const [docDpi, setDocDpi] = React.useState<number>(150);
  const [importing, setImporting] = React.useState(false);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const frameBusyRef = React.useRef(false);
  const shotsRef = React.useRef<CaptureShot[]>([]);
  shotsRef.current = shots;

  const addShot = React.useCallback((shot: CaptureShot) => {
    setShots((prev) => [...prev, shot]);
    setSelectedId(shot.id);
  }, []);

  const releaseStream = React.useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopContinuous = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setContinuous(false);
  }, []);

  const handleStreamEnded = React.useCallback(() => {
    stopContinuous();
    releaseStream();
  }, [stopContinuous, releaseStream]);

  const ensureStream = React.useCallback(async (): Promise<MediaStream> => {
    if (streamRef.current) return streamRef.current;
    const stream = await requestDisplayStream();
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay rejection is non-fatal; the frames are still available.
      }
    }
    stream.getVideoTracks()[0]?.addEventListener("ended", handleStreamEnded);
    return stream;
  }, [handleStreamEnded]);

  React.useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopStream(streamRef.current);
    },
    [],
  );

  React.useEffect(() => {
    const file = docFiles[0];
    if (!file) {
      setDocTotalPages(null);
      return;
    }
    let cancelled = false;
    setDocTotalPages(null);
    void probePageCount(file)
      .then((count) => {
        if (cancelled) return;
        setDocTotalPages(count);
        if (count) {
          setDocFrom(1);
          setDocTo(count);
        }
      })
      .catch(() => {
        if (!cancelled) setDocTotalPages(null);
      });
    return () => {
      cancelled = true;
    };
  }, [docFiles]);

  const captureFrame = React.useCallback(async () => {
    if (frameBusyRef.current) return;
    frameBusyRef.current = true;
    try {
      const video = videoRef.current;
      if (!video) return;
      const shot = await grabShotFromVideo(video, `Page ${shotsRef.current.length + 1}`);
      addShot(shot);
    } catch {
      // Skip a frame that could not be read; the next tick will try again.
    } finally {
      frameBusyRef.current = false;
    }
  }, [addShot]);

  const captureOnce = async (mode: "current" | "region") => {
    if (busy !== "idle") return;
    setBusy(mode);
    try {
      await ensureStream();
      const video = videoRef.current;
      if (!video) throw new Error("Screen capture is unavailable.");
      const shot = await grabShotFromVideo(video, `Page ${shotsRef.current.length + 1}`);
      if (mode === "current") {
        addShot(shot);
        toast.success("Screenshot captured.");
      } else {
        setRegionSource(shot);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Capture failed.");
    } finally {
      releaseStream();
      setBusy("idle");
    }
  };

  const startContinuous = async () => {
    if (busy !== "idle") return;
    setBusy("continuous");
    try {
      await ensureStream();
      setContinuous(true);
      await captureFrame();
      timerRef.current = setInterval(() => void captureFrame(), Math.max(1, intervalSec) * 1000);
      toast.success("Auto-capture started. Press Stop when you are done.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Capture failed.");
      releaseStream();
    } finally {
      setBusy("idle");
    }
  };

  const handleCropConfirm = async (rect: CropRect) => {
    const source = regionSource;
    setRegionSource(null);
    if (!source) return;
    try {
      const shot = await cropShot(source, rect, `Page ${shotsRef.current.length + 1}`);
      addShot(shot);
      toast.success("Region captured.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not crop the screenshot.");
    }
  };

  const handleDocFiles = (incoming: File[]) => {
    const docFile = incoming.find((f) => detectDocumentKind(f) !== "image");
    setDocFiles(docFile ? [docFile] : incoming);
    setDocRangeMode("all");
    setDocFrom(1);
    setDocTo(1);
  };

  const handleImport = async () => {
    if (docFiles.length === 0 || importing) return;
    setImporting(true);
    try {
      const range =
        docRangeMode === "custom" ? { from: docFrom, to: Math.max(docFrom, docTo) } : null;
      const { shots: imported, totalPages } = await importDocumentFiles(docFiles, {
        dpi: docDpi,
        range,
      });
      if (imported.length === 0) {
        toast.error(`No pages matched that range (1–${totalPages}).`);
        return;
      }
      setShots((prev) => [...prev, ...imported]);
      setSelectedId(imported[0]?.id ?? null);
      toast.success(
        `Added ${imported.length} ${imported.length === 1 ? "page" : "pages"} from ${
          docFiles[0]?.name ?? "file"
        }.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not import that file.");
    } finally {
      setImporting(false);
    }
  };

  const removeShot = (id: string) => {
    setShots((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setSelectedId((cur) => (cur === id ? (next[0]?.id ?? null) : cur));
      return next;
    });
  };

  const moveShot = (id: string, dir: -1 | 1) => {
    setShots((prev) => {
      const from = prev.findIndex((s) => s.id === id);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const clearAll = () => {
    stopContinuous();
    releaseStream();
    setShots([]);
    setSelectedId(null);
  };

  const exportPdf = async () => {
    if (shots.length === 0 || exporting) return;
    setExporting(true);
    try {
      const blob = await imagesToPdf(shots, pdfOptions);
      downloadBlob(blob, `screenshots-${timestamp()}.pdf`);
      toast.success("PDF created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build the PDF.");
    } finally {
      setExporting(false);
    }
  };

  const selected = shots.find((s) => s.id === selectedId) ?? shots[0] ?? null;
  const capturing = busy !== "idle";
  const zoomPan = useZoomPan(selected?.id);

  return (
    <AuthGate>
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
            Screenshot Studio
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Grab your screen, import a PDF, Word, text or image file and turn every page into a
            screenshot, crop a custom region and combine everything into a single PDF — all on this
            computer.
          </p>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-container/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" />
          <p className="text-sm text-on-surface-variant">
            <span className="font-display font-semibold text-foreground">Your screen stays private.</span>{" "}
            Captures are kept in this browser tab only — nothing is uploaded and closing the tab clears
            everything.
          </p>
        </div>

        {/* Hidden element that holds the live display stream. */}
        <video
          ref={videoRef}
          playsInline
          muted
          aria-hidden="true"
          className="pointer-events-none fixed -left-px -top-px h-px w-px opacity-0"
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: preview + captures */}
          <section className="flex flex-col gap-4 lg:col-span-8">
            <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <ImageIcon className="h-5 w-5 text-on-surface-variant" />
                  Preview
                </h2>
                {selected && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => downloadBlob(selected.blob, `${selected.label.replace(/\s+/g, "-").toLowerCase()}.png`)}
                  >
                    <Download className="h-4 w-4" />
                    Download PNG
                  </Button>
                )}
              </div>
              {selected ? (
                <div className="relative rounded-xl border border-outline-variant/10 bg-[repeating-conic-gradient(#00000010_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] p-3">
                  <div
                    ref={zoomPan.viewportRef}
                    onPointerDown={zoomPan.onPointerDown}
                    onPointerMove={zoomPan.onPointerMove}
                    onPointerUp={zoomPan.onPointerUp}
                    onPointerLeave={zoomPan.onPointerUp}
                    onDoubleClick={zoomPan.onDoubleClick}
                    className="relative flex h-[46vh] w-full items-center justify-center overflow-hidden"
                    style={zoomPan.viewportStyle}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selected.dataUrl}
                      alt={selected.label}
                      style={zoomPan.contentStyle}
                      className="max-h-full w-auto max-w-full rounded-lg object-contain"
                    />
                  </div>
                  <ZoomControls
                    className="absolute right-5 top-5 z-10"
                    zoom={zoomPan.zoom}
                    onZoomIn={() => zoomPan.zoomBy(1.25)}
                    onZoomOut={() => zoomPan.zoomBy(1 / 1.25)}
                    onReset={zoomPan.resetZoom}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant/30 bg-muted/40 px-6 py-16 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <Camera className="h-6 w-6 text-primary" />
                  </span>
                  <p className="font-display text-sm font-semibold text-foreground">No captures yet</p>
                  <p className="max-w-xs text-sm text-on-surface-variant">
                    Capture your screen or import a file above to add your first page.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <FileUp className="h-5 w-5 text-on-surface-variant" />
                  Import pages from a file
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Upload a PDF, Word (.docx), text or image file. Every page becomes a screenshot you
                  can reorder, download or combine into a PDF.
                </p>
              </div>

              <Dropzone
                kind="document"
                accept={DOCUMENT_ACCEPT}
                compact
                multiple={docFiles.length === 0 || detectDocumentKind(docFiles[0]) === "image"}
                onFiles={handleDocFiles}
                disabled={importing}
              />

              {docFiles.length > 0 && (
                <div className="flex flex-col gap-4">
                  <ul className="space-y-2 rounded-xl border border-outline-variant/10 bg-muted/30 p-3">
                    {docFiles.map((f) => (
                      <li key={`${f.name}-${f.size}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-on-surface-variant" />
                          <span className="truncate font-medium">{f.name}</span>
                          <span className="shrink-0 font-mono text-xs text-on-surface-variant">
                            {formatBytes(f.size)}
                          </span>
                        </span>
                        {!importing && (
                          <button
                            type="button"
                            onClick={() => setDocFiles([])}
                            aria-label={`Remove ${f.name}`}
                            className="shrink-0 rounded p-1 text-on-surface-variant transition-colors hover:bg-muted hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                        Pages
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["all", "custom"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            disabled={importing}
                            onClick={() => setDocRangeMode(mode)}
                            className={cn(
                              "flex h-9 items-center justify-center rounded-lg border font-mono text-xs font-semibold capitalize transition-colors disabled:opacity-50",
                              docRangeMode === mode
                                ? "border-primary bg-primary-container/15 text-primary"
                                : "border-outline-variant/30 text-foreground hover:border-primary/50",
                            )}
                          >
                            {mode === "all" ? "All" : "Custom"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                        Resolution
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {IMPORT_DPIS.map((dpi) => (
                          <button
                            key={dpi}
                            type="button"
                            disabled={importing}
                            onClick={() => setDocDpi(dpi)}
                            className={cn(
                              "flex h-9 items-center justify-center rounded-lg border font-mono text-xs font-semibold transition-colors disabled:opacity-50",
                              docDpi === dpi
                                ? "border-primary bg-primary-container/15 text-primary"
                                : "border-outline-variant/30 text-foreground hover:border-primary/50",
                            )}
                          >
                            {dpi}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {docRangeMode === "custom" && (
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
                        From page
                        <input
                          type="number"
                          min={1}
                          max={docTotalPages ?? undefined}
                          value={docFrom}
                          disabled={importing}
                          onChange={(e) => setDocFrom(Math.max(1, Number(e.target.value) || 1))}
                          className="h-9 w-24 rounded-md border border-outline-variant/30 bg-background px-2 font-mono text-xs shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
                        To page
                        <input
                          type="number"
                          min={docFrom}
                          max={docTotalPages ?? undefined}
                          value={docTo}
                          disabled={importing}
                          onChange={(e) => setDocTo(Math.max(1, Number(e.target.value) || 1))}
                          className="h-9 w-24 rounded-md border border-outline-variant/30 bg-background px-2 font-mono text-xs shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        />
                      </label>
                      <span className="pb-2 font-mono text-xs text-on-surface-variant">
                        {docTotalPages ? `of 1–${docTotalPages}` : "range applied on render"}
                      </span>
                    </div>
                  )}

                  <Button
                    onClick={() => void handleImport()}
                    disabled={importing}
                    className="w-full gap-2 rounded-xl"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Rendering pages…
                      </>
                    ) : (
                      <>
                        <FileUp className="h-4 w-4" />
                        Add pages
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-on-surface-variant">
                    {docTotalPages
                      ? `${docTotalPages} ${docTotalPages === 1 ? "page" : "pages"} detected.`
                      : "Page count is worked out while rendering."}
                  </p>
                </div>
              )}
            </div>

            {shots.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="mb-1 flex items-center gap-2 font-display text-xl font-medium">
                  <FileText className="h-5 w-5 text-on-surface-variant" />
                  Pages ({shots.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {shots.map((shot, i) => (
                    <CaptureRow
                      key={shot.id}
                      shot={shot}
                      index={i}
                      total={shots.length}
                      selected={shot.id === selected?.id}
                      onSelect={() => setSelectedId(shot.id)}
                      onRemove={() => removeShot(shot.id)}
                      onMove={(dir) => moveShot(shot.id, dir)}
                      onDownload={() =>
                        downloadBlob(shot.blob, `${shot.label.replace(/\s+/g, "-").toLowerCase()}.png`)
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Right: capture + export controls */}
          <aside className="lg:col-span-4">
            <div className="sticky top-24 flex flex-col gap-6 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm sm:p-6">
              <div>
                <h2 className="font-display text-xl font-medium">Capture screen</h2>
              </div>

              {!supported && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  Screen capture is not available in this browser.
                </p>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={!supported || capturing || continuous}
                  onClick={() => void captureOnce("current")}
                  className="flex items-start gap-3 rounded-xl border border-outline-variant/30 px-3 py-3 text-left transition-colors hover:border-primary/50 disabled:opacity-50"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    {busy === "current" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <Monitor className="h-4 w-4 text-primary" />
                    )}
                  </span>
                  <span>
                    <span className="block font-display text-[13px] font-semibold text-foreground">
                      Current screen
                    </span>
                    <span className="block text-xs text-on-surface-variant">
                      Capture the screen or window you are using right now.
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!supported || capturing}
                  onClick={() => (continuous ? stopContinuous() : void startContinuous())}
                  className="flex items-start gap-3 rounded-xl border border-outline-variant/30 px-3 py-3 text-left transition-colors hover:border-primary/50 disabled:opacity-50"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    {continuous ? (
                      <Square className="h-4 w-4 text-primary" />
                    ) : (
                      <Play className="h-4 w-4 text-primary" />
                    )}
                  </span>
                  <span>
                    <span className="block font-display text-[13px] font-semibold text-foreground">
                      {continuous ? "Stop auto-capture" : "Auto capture (timer)"}
                    </span>
                    <span className="block text-xs text-on-surface-variant">
                      Keep screenshotting your screen on a timer — one shot per tick, for scrolling
                      pages or live content.
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!supported || capturing || continuous}
                  onClick={() => void captureOnce("region")}
                  className="flex items-start gap-3 rounded-xl border border-outline-variant/30 px-3 py-3 text-left transition-colors hover:border-primary/50 disabled:opacity-50"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    {busy === "region" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <Crop className="h-4 w-4 text-primary" />
                    )}
                  </span>
                  <span>
                    <span className="block font-display text-[13px] font-semibold text-foreground">
                      Custom region
                    </span>
                    <span className="block text-xs text-on-surface-variant">
                      Capture the whole screen, then drag to keep just the part you need.
                    </span>
                  </span>
                </button>
              </div>

              <div className="space-y-2">
                <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Auto-capture interval
                </label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {INTERVALS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={continuous}
                      onClick={() => setIntervalSec(s)}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-lg border font-mono text-xs font-semibold transition-colors disabled:opacity-50",
                        intervalSec === s
                          ? "border-primary bg-primary-container/15 text-primary"
                          : "border-outline-variant/30 text-foreground hover:border-primary/50",
                      )}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 border-t border-outline-variant/10 pt-5">
                <h2 className="font-display text-xl font-medium">Images to PDF</h2>

                <div className="space-y-2">
                  <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    Page size
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {PDF_PAGE_SIZES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPdfOptions((o) => ({ ...o, pageSize: p.value }))}
                        className={cn(
                          "flex h-9 items-center justify-center rounded-lg border px-1 font-mono text-xs font-semibold transition-colors",
                          pdfOptions.pageSize === p.value
                            ? "border-primary bg-primary-container/15 text-primary"
                            : "border-outline-variant/30 text-foreground hover:border-primary/50",
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    Orientation
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {PDF_ORIENTATIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        disabled={pdfOptions.pageSize === "fit"}
                        onClick={() => setPdfOptions((prev) => ({ ...prev, orientation: o.value }))}
                        className={cn(
                          "flex h-9 items-center justify-center rounded-lg border px-1 font-mono text-xs font-semibold transition-colors disabled:opacity-40",
                          pdfOptions.orientation === o.value
                            ? "border-primary bg-primary-container/15 text-primary"
                            : "border-outline-variant/30 text-foreground hover:border-primary/50",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      Margin
                    </label>
                    <span className="font-mono text-xs text-on-surface-variant">{pdfOptions.margin} pt</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={72}
                    step={6}
                    value={pdfOptions.margin}
                    disabled={pdfOptions.pageSize === "fit"}
                    onChange={(e) => setPdfOptions((o) => ({ ...o, margin: Number(e.target.value) }))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-container-high accent-primary disabled:opacity-40"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      Quality
                    </label>
                    <span className="font-mono text-xs text-on-surface-variant">
                      {Math.round(pdfOptions.quality * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={1}
                    step={0.05}
                    value={pdfOptions.quality}
                    onChange={(e) => setPdfOptions((o) => ({ ...o, quality: Number(e.target.value) }))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-container-high accent-primary"
                  />
                </div>

                <Button
                  onClick={() => void exportPdf()}
                  disabled={shots.length === 0 || exporting}
                  className="w-full gap-2 rounded-xl py-4"
                  size="lg"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building PDF…
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      Images to PDF {shots.length > 0 ? `(${shots.length})` : ""}
                    </>
                  )}
                </Button>

                {shots.length > 0 && (
                  <Button variant="ghost" className="w-full gap-2 text-primary" onClick={clearAll}>
                    <Trash2 className="h-4 w-4" />
                    Clear captures
                  </Button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {regionSource && (
        <RegionSelector
          shot={regionSource}
          onCancel={() => setRegionSource(null)}
          onConfirm={(rect) => void handleCropConfirm(rect)}
        />
      )}
    </AuthGate>
  );
}
