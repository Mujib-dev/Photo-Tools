"use client";

import * as React from "react";
import {
  CheckCircle2,
  CloudUpload,
  Download,
  Film,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/dropzone";
import { RegionSelector } from "@/components/region-select";
import { ZoomControls } from "@/components/zoom-controls";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { downloadAllUrl, downloadUrl, getJob } from "@/lib/api";
import type { EnhanceRegion, JobRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useZoomPan } from "@/lib/use-zoom-pan";
import { formatBytes, formatFormat, formatPixels } from "@/lib/format";

export type JobUiState = "pending" | "queued" | "processing" | "completed" | "failed" | "downloaded";

export interface FileJob {
  key: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  duration: number;
  jobId: string | null;
  state: JobUiState;
  stage: string;
  error: string | null;
  result: JobRecord | null;
}

type MediaKind = "image" | "video";

interface ProcessorProps {
  operation: "resize" | "convert" | "enhance" | "removebg" | "compress" | "watermark" | "video";
  title: string;
  description: string;
  submit: (file: File, settings: unknown) => Promise<{ jobId: string }>;
  settings: unknown;
  settingsPanel: (meta: { count: number; running: boolean; duration: number }) => React.ReactNode;
  /** Which media the tool accepts and previews. Defaults to images. */
  mediaKind?: MediaKind;
  /** When provided, enables drag-a-rectangle selection on the image preview. */
  regionSelection?: {
    value: EnhanceRegion | null;
    onChange: (region: EnhanceRegion | null) => void;
  };
}

function readMediaMeta(
  file: File,
  kind: MediaKind,
): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    if (kind === "video") {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () =>
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
        });
      video.onerror = () => resolve({ width: 0, height: 0, duration: 0 });
      video.src = url;
    } else {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, duration: 0 });
      img.onerror = () => resolve({ width: 0, height: 0, duration: 0 });
      img.src = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}

const POLL_MS = 800;

const OPERATION_LABELS: Record<ProcessorProps["operation"], { done: string; panel: string; button: string }> = {
  resize: { done: "resized", panel: "Resize Settings", button: "Resize Image" },
  convert: { done: "converted", panel: "Convert Settings", button: "Convert Image" },
  enhance: { done: "enhanced", panel: "Enhance Settings", button: "Enhance Image" },
  removebg: { done: "processed", panel: "Remove BG Settings", button: "Remove Background" },
  compress: { done: "compressed", panel: "Compress Settings", button: "Compress Images" },
  watermark: { done: "watermarked", panel: "Watermark Settings", button: "Add Watermark" },
  video: { done: "processed", panel: "Video Settings", button: "Export Video" },
};

export function Processor({
  operation,
  title,
  description,
  submit,
  settings,
  settingsPanel,
  mediaKind = "image",
  regionSelection,
}: ProcessorProps) {
  const MediaIcon = mediaKind === "video" ? Film : ImageIcon;
  const mediaNoun = mediaKind === "video" ? "video" : "image";
  const mediaNounPlural = mediaKind === "video" ? "videos" : "images";
  const accept = mediaKind === "video" ? "video/*" : "image/*";

  const [jobs, setJobs] = React.useState<FileJob[]>([]);
  const [running, setRunning] = React.useState(false);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"split" | "after" | "before">("split");
  const hiddenInputRef = React.useRef<HTMLInputElement>(null);
  const previewImgRef = React.useRef<HTMLImageElement | null>(null);

  const jobsRef = React.useRef<FileJob[]>([]);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = React.useRef(false);

  jobsRef.current = jobs;

  const setRunningSafe = (v: boolean) => {
    runningRef.current = v;
    setRunning(v);
  };

  const stopPolling = React.useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = React.useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const active = jobsRef.current.filter(
        (j) => j.jobId && (j.state === "queued" || j.state === "processing"),
      );
      if (active.length === 0) {
        stopPolling();
        setRunningSafe(false);
        return;
      }

      const results: { key: string; record?: JobRecord; error?: string }[] = await Promise.all(
        active.map(async (j) => {
          try {
            return { key: j.key, record: await getJob(j.jobId as string) };
          } catch (err) {
            return {
              key: j.key,
              error: err instanceof Error ? err.message : "Could not reach the processing service.",
            };
          }
        }),
      );

      setJobs((prev) =>
        prev.map((j) => {
          const r = results.find((x) => x.key === j.key);
          if (!r) return j;
          if (r.error) return { ...j, state: "failed", error: r.error };
          const rec = r.record as JobRecord;
          if (rec.state === "completed") {
            return { ...j, state: "completed", stage: "Completed", result: rec };
          }
          if (rec.state === "failed") {
            return { ...j, state: "failed", error: rec.error ?? "Processing failed.", stage: rec.stage };
          }
          return { ...j, state: rec.state, stage: rec.stage };
        }),
      );

      const stillActive = jobsRef.current.some(
        (j) => j.state === "queued" || j.state === "processing",
      );
      if (!stillActive) {
        stopPolling();
        setRunningSafe(false);
      }
    }, POLL_MS);
  }, [stopPolling]);

  const addFiles = React.useCallback((files: File[]) => {
    const added = files.filter((f) => !jobsRef.current.some((j) => j.file === f));
    if (added.length === 0) return;

    const newJobs: FileJob[] = added.map((f) => ({
      key: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      width: 0,
      height: 0,
      duration: 0,
      jobId: null,
      state: "pending",
      stage: "Ready",
      error: null,
      result: null,
    }));
    setJobs((prev) => {
      const next = [...prev, ...newJobs];
      setSelectedKey((k) => k ?? newJobs[0].key);
      return next;
    });

    for (const f of added) {
      void readMediaMeta(f, mediaKind).then((meta) =>
        setJobs((prev) => prev.map((j) => (j.file === f ? { ...j, ...meta } : j))),
      );
    }
  }, [mediaKind]);

  const removeFile = (key: string) => {
    setJobs((prev) => {
      const target = prev.find((j) => j.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((j) => j.key !== key);
      setSelectedKey((k) => (k === key ? (next[0]?.key ?? null) : k));
      return next;
    });
  };

  const clearAll = () => {
    stopPolling();
    setRunningSafe(false);
    setJobs((prev) => {
      prev.forEach((j) => URL.revokeObjectURL(j.previewUrl));
      return [];
    });
    setSelectedKey(null);
  };

  React.useEffect(() => {
    return () => {
      stopPolling();
      jobsRef.current.forEach((j) => URL.revokeObjectURL(j.previewUrl));
    };
  }, [stopPolling]);

  const handleHiddenInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const start = async () => {
    if (runningRef.current) return;
    const pending = jobs.filter((j) => j.state === "pending" || j.state === "failed");
    if (pending.length === 0) {
      toast.info(`Add at least one ${mediaNoun} first.`);
      return;
    }

    setRunningSafe(true);

    for (const job of pending) {
      setJobs((prev) =>
        prev.map((x) => (x.key === job.key ? { ...x, state: "queued", stage: `Uploading ${mediaNoun}...` } : x)),
      );
      try {
        const res = await submit(job.file, settings);
        setJobs((prev) =>
          prev.map((x) => (x.key === job.key ? { ...x, jobId: res.jobId, state: "queued", stage: "Queued" } : x)),
        );
      } catch (err) {
        setJobs((prev) =>
          prev.map((x) =>
            x.key === job.key
              ? { ...x, state: "failed", error: err instanceof Error ? err.message : "Upload failed." }
              : x,
          ),
        );
        toast.error(err instanceof Error ? err.message : "Upload failed.");
      }
    }
    startPolling();
  };

  const download = (job: FileJob) => {
    if (!job.result) return;
    window.location.href = downloadUrl(job.result.id);
    setJobs((prev) => prev.map((x) => (x.key === job.key ? { ...x, state: "downloaded" } : x)));
    toast.success("Download started.");
  };

  const downloadAll = () => {
    const ids = jobs.filter((j) => j.state === "completed" && j.result).map((j) => (j.result as JobRecord).id);
    if (ids.length === 0) return;
    window.location.href = downloadAllUrl(ids);
    setJobs((prev) => prev.map((x) => (x.state === "completed" ? { ...x, state: "downloaded" } : x)));
    toast.success(`Downloading ${ids.length} ${mediaNounPlural} as a ZIP…`);
  };

  const pendingCount = jobs.filter((j) => j.state === "pending" || j.state === "failed").length;
  const completedCount = jobs.filter((j) => j.state === "completed").length;
  const activeCount = jobs.filter((j) => ["queued", "processing"].includes(j.state)).length;
  const selected = jobs.find((j) => j.key === selectedKey) ?? jobs[0] ?? null;
  const allSettled = jobs.length > 0 && activeCount === 0 && !running;

  const zoomPan = useZoomPan(selected?.key);
  const zoomable = mediaKind === "image";

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">{description}</p>
      </div>

      {allSettled && completedCount > 0 && (
        <div className="glass-panel mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border-primary/20 p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/20">
              <CheckCircle2 className="h-7 w-7 text-primary-container" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Processing Complete</h2>
              <p className="text-sm text-on-surface-variant">
                {completedCount} {completedCount === 1 ? mediaNoun : mediaNounPlural} successfully{" "}
                {OPERATION_LABELS[operation].done}
                {pendingCount > 0 && ` · ${pendingCount} failed`}.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={clearAll} className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Process Another {mediaKind === "video" ? "Video" : "Image"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: canvas + batch */}
        <section className="flex flex-col gap-4 lg:col-span-8">
          {/* Preview canvas */}
          <div className="relative flex min-h-[240px] flex-1 flex-col overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest shadow-[0_4px_12px_rgba(0,0,0,0.03)] sm:min-h-[380px]">
            {selected ? (
              <div className="group relative flex flex-1 items-center justify-center bg-canvas p-4">
                {/* View mode toggle for completed results */}
                {selected.state === "completed" && selected.result && mediaKind !== "video" && (
                  <div className="absolute left-4 top-4 z-10 flex items-center gap-1 rounded-lg border border-outline-variant/20 bg-background/90 p-1 backdrop-blur-md shadow-sm">
                    <button
                      type="button"
                      onClick={() => setViewMode("split")}
                      className={cn(
                        "rounded-md px-2.5 py-1 font-display text-xs font-semibold transition-colors",
                        viewMode === "split"
                          ? "bg-primary text-on-primary shadow-xs"
                          : "text-on-surface-variant hover:text-foreground",
                      )}
                    >
                      Split View
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("after")}
                      className={cn(
                        "rounded-md px-2.5 py-1 font-display text-xs font-semibold transition-colors",
                        viewMode === "after"
                          ? "bg-primary text-on-primary shadow-xs"
                          : "text-on-surface-variant hover:text-foreground",
                      )}
                    >
                      Result
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("before")}
                      className={cn(
                        "rounded-md px-2.5 py-1 font-display text-xs font-semibold transition-colors",
                        viewMode === "before"
                          ? "bg-primary text-on-primary shadow-xs"
                          : "text-on-surface-variant hover:text-foreground",
                      )}
                    >
                      Original
                    </button>
                  </div>
                )}

                {/* Overlay toolbar */}
                <div className="glass-panel absolute right-4 top-4 z-10 flex gap-1 rounded-lg border border-outline-variant/10 p-1 opacity-100 shadow-[0_12px_32px_rgba(0,0,0,0.2)] transition-opacity duration-300 focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    title="Replace image"
                    onClick={() => hiddenInputRef.current?.click()}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface-container-high/50 hover:text-primary"
                  >
                    <RefreshCcw className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    title="Remove image"
                    onClick={() => removeFile(selected.key)}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface-container-high/50 hover:text-destructive"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                <div
                  ref={zoomable ? zoomPan.viewportRef : undefined}
                  onPointerDown={zoomable ? zoomPan.onPointerDown : undefined}
                  onPointerMove={zoomable ? zoomPan.onPointerMove : undefined}
                  onPointerUp={zoomable ? zoomPan.onPointerUp : undefined}
                  onPointerLeave={zoomable ? zoomPan.onPointerUp : undefined}
                  onDoubleClick={zoomable ? zoomPan.onDoubleClick : undefined}
                  style={zoomable ? zoomPan.viewportStyle : undefined}
                  className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-white/5"
                >
                  {mediaKind === "video" ? (
                    <video
                      src={
                        selected.state === "completed" && selected.result
                          ? downloadUrl(selected.result.id)
                          : selected.previewUrl
                      }
                      controls
                      playsInline
                      className="h-auto max-h-[420px] w-auto max-w-full rounded-md object-contain"
                    />
                  ) : selected.state === "completed" && selected.result && viewMode === "split" ? (
                    <BeforeAfterSlider
                      beforeUrl={selected.previewUrl}
                      afterUrl={downloadUrl(selected.result.id)}
                      style={zoomable ? zoomPan.contentStyle : undefined}
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      ref={previewImgRef}
                      src={
                        selected.state === "completed" && selected.result && viewMode === "after"
                          ? downloadUrl(selected.result.id)
                          : selected.previewUrl
                      }
                      alt={selected.file.name}
                      style={zoomable ? zoomPan.contentStyle : undefined}
                      className="h-auto max-h-[420px] w-auto max-w-full rounded-md object-contain"
                    />
                  )}
                  {selected.state === "pending" && (
                    <div className="pointer-events-none absolute inset-6 border-2 border-dashed border-primary/50" />
                  )}
                  {zoomable && regionSelection && (
                    <RegionSelector
                      imgRef={previewImgRef}
                      value={regionSelection.value}
                      onChange={regionSelection.onChange}
                    />
                  )}
                  {zoomable && (
                    <ZoomControls
                      className="absolute bottom-4 right-4 z-10"
                      zoom={zoomPan.zoom}
                      onZoomIn={() => zoomPan.zoomBy(1.25)}
                      onZoomOut={() => zoomPan.zoomBy(1 / 1.25)}
                      onReset={zoomPan.resetZoom}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high">
                  <MediaIcon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-display text-xl font-medium">No {mediaNoun} selected</h3>
                <p className="mb-6 mt-1 max-w-sm text-on-surface-variant">
                  Drag and drop a {mediaNoun} here or click below to upload a {mediaNoun} to get
                  started.
                </p>
                <Button
                  onClick={() => hiddenInputRef.current?.click()}
                  className="gap-2 rounded-xl px-10 py-3"
                >
                  <Upload className="h-4 w-4" />
                  Upload {mediaKind === "video" ? "Video" : "Image"}
                </Button>
              </div>
            )}

            <input
              ref={hiddenInputRef}
              type="file"
              accept={accept}
              multiple
              className="hidden"
              onChange={handleHiddenInput}
            />
          </div>

          {/* Info bar */}
          {selected && (
            <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 text-on-surface-variant shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <MediaIcon className="h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate font-display text-[13px] font-semibold text-foreground">
                    {selected.file.name}
                  </div>
                  <div className="font-mono text-xs">{formatBytes(selected.file.size)}</div>
                </div>
              </div>
              <div className="flex flex-col text-left sm:items-end sm:text-right">
                {selected.width > 0 ? (
                  <>
                    <div className="font-display text-[13px] font-semibold text-primary">
                      Original: {formatPixels(selected.width, selected.height)}
                    </div>
                    {selected.result?.outputFormat && (
                      <div className="font-mono text-xs text-primary">
                        Output: {formatFormat(selected.result.outputFormat)} ·{" "}
                        {formatBytes(selected.result.outputSize)}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="font-mono text-xs">Reading dimensions…</div>
                )}
              </div>
            </div>
          )}

          {/* Add more */}
          {jobs.length > 0 && !running && (
            <Button variant="outline" onClick={() => hiddenInputRef.current?.click()} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Add {mediaKind === "video" ? "Videos" : "Images"}
            </Button>
          )}

          {/* Batch list */}
          {jobs.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="mb-1 flex items-center gap-2 font-display text-xl font-medium">
                <MediaIcon className="h-5 w-5 text-on-surface-variant" />
                Batch Queue
              </h3>
              {jobs.map((job) => (
                <FileJobCard
                  key={job.key}
                  job={job}
                  mediaKind={mediaKind}
                  running={running}
                  selected={job.key === selected?.key}
                  onSelect={() => setSelectedKey(job.key)}
                  onRemove={removeFile}
                  onDownload={download}
                />
              ))}
            </div>
          )}

          {running && <ProcessingStatus jobs={jobs} activeCount={activeCount} />}
        </section>

        {/* Right: settings */}
        <aside className="lg:col-span-4">
          <div className="flex flex-col rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-[0_4px_12px_rgba(0,0,0,0.03)] sm:p-6 lg:sticky lg:top-24">
            <div className="mb-6 border-b border-outline-variant/10 pb-4">
              <h2 className="font-display text-xl font-medium">
                {OPERATION_LABELS[operation].panel}
              </h2>
            </div>
            <div className="flex-1 space-y-8 overflow-y-auto pr-1 custom-scrollbar lg:max-h-[50vh]">
              {settingsPanel({ count: jobs.length, running, duration: selected?.duration ?? 0 })}
            </div>
            <div className="mt-6 space-y-2 border-t border-outline-variant/10 pt-5">
              <Button
                onClick={() => void start()}
                disabled={running || pendingCount === 0}
                className="w-full gap-2 rounded-xl py-4"
                size="lg"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <CloudUpload className="h-4 w-4" />
                    {pendingCount > 0
                      ? `Process ${pendingCount} ${pendingCount === 1 ? mediaNoun : mediaNounPlural}`
                      : OPERATION_LABELS[operation].button}
                  </>
                )}
              </Button>

              {completedCount > 0 && (
                <Button
                  variant="outline"
                  className="w-full gap-2 whitespace-normal text-center"
                  onClick={downloadAll}
                  disabled={running}
                >
                  <Download className="h-4 w-4" />
                  Download All ({completedCount}) — ZIP
                </Button>
              )}

              {jobs.length > 0 && !running && (
                <Button variant="ghost" className="w-full gap-2 text-primary" onClick={clearAll}>
                  <RefreshCcw className="h-4 w-4" />
                  Process Another
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FileJobCard({
  job,
  mediaKind,
  running,
  selected,
  onSelect,
  onRemove,
  onDownload,
}: {
  job: FileJob;
  mediaKind: MediaKind;
  running: boolean;
  selected: boolean;
  onSelect: () => void;
  onRemove: (key: string) => void;
  onDownload: (job: FileJob) => void;
}) {
  const isWorking = job.state === "queued" || job.state === "processing";
  const isDone = job.state === "completed";
  const isFailed = job.state === "failed";

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border-l-2 p-2.5 transition-colors",
        selected
          ? "border-primary-container bg-primary-container/10"
          : "border-transparent hover:bg-surface-container-high/60",
        isDone && selected && "border-l-2 border-emerald-500",
      )}
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-container-high">
        {mediaKind === "video" ? (
          <video src={job.previewUrl} muted playsInline className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={job.previewUrl} alt={job.file.name} className="h-full w-full object-cover" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[13px] font-semibold text-foreground">{job.file.name}</p>
        <p className="font-mono text-xs text-on-surface-variant">
          {isDone && job.result
            ? `Done • ${formatBytes(job.result.outputSize)}${job.result.outputFormat ? ` • ${formatFormat(job.result.outputFormat)}` : ""}`
            : isWorking
              ? job.stage
              : isFailed
                ? "Failed"
                : job.state === "downloaded"
                  ? "Saved"
                  : "Ready"}
        </p>
        {isWorking && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-outline-variant/20">
            <div className="h-full w-1/2 rounded-full bg-primary-container shimmer-indeterminate" />
          </div>
        )}
        {isFailed && job.error && (
          <p className="mt-1 truncate text-xs text-destructive">{job.error}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isDone && job.result && (
          <Button size="sm" variant="outline" onClick={() => onDownload(job)} className="gap-1.5 px-2.5">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        )}
        {isDone && (
          <span className="flex h-5 w-5 items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </span>
        )}
        {isWorking && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-outline" />}
        {isFailed && (
          <span className="flex h-5 w-5 items-center justify-center">
            <XCircle className="h-5 w-5 text-destructive" />
          </span>
        )}
        {!running && (
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Remove ${job.file.name}`}
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(job.key);
            }}
          >
            <Trash2 className="h-4 w-4 text-on-surface-variant" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ProcessingStatus({ jobs, activeCount }: { jobs: FileJob[]; activeCount: number }) {
  const message =
    activeCount > 0
      ? jobs.find((j) => j.state === "processing")?.stage ?? "Processing…"
      : "Processing…";
  return (
    <div className="rounded-xl border border-primary/30 bg-primary-container/5 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-display font-semibold text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary-container" />
          {message}
        </span>
        <span className="font-mono text-xs text-on-surface-variant">
          {activeCount} active job{activeCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="relative mt-3 h-1 w-full overflow-hidden rounded-full bg-outline-variant/20">
        <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-primary-container to-primary shimmer-indeterminate" />
      </div>
      <p className="mt-3 text-xs text-on-surface-variant">
        The desktop processing engine is working on your files — this can take a few seconds.
      </p>
    </div>
  );
}
