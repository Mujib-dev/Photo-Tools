"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudDownload,
  Cpu,
  Download,
  Globe,
  Link2,
  Loader2,
  Music,
  Pause,
  Play,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Video,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  analyzeUrlDownload,
  deleteJob,
  downloadUrl,
  getJob,
  submitUrlDownload,
  subscribeJob,
} from "@/lib/api";
import { formatBytes } from "@/lib/format";
import {
  URL_DOWNLOAD_FORMATS,
  type JobRecord,
  type UrlDownloadAnalysis,
  type UrlDownloadFormat,
} from "@/lib/types";
import { validateUrl, hasQueryInjection, unwrapGoogleUrl } from "@/lib/validation";
import { cn } from "@/lib/utils";

const POLL_MS = 500;

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseProgressPercent(stage: string | null): number | null {
  if (!stage) return null;
  const match = /(\d{1,3})%/.exec(stage);
  if (match) {
    const val = parseInt(match[1], 10);
    return isNaN(val) ? null : Math.min(100, Math.max(0, val));
  }
  return null;
}

function triggerDirectDownload(url: string, filename?: string | null) {
  try {
    const a = document.createElement("a");
    a.href = url;
    if (filename) a.download = filename;
    a.target = "_self";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 1500);
  } catch {
    window.location.assign(url);
  }
}

const DEFAULT_QUALITIES = [
  { id: "source", label: "Best Available (Source)", source: true },
  { id: "1080", label: "1080p Full HD" },
  { id: "720", label: "720p HD" },
  { id: "480", label: "480p" },
  { id: "360", label: "360p" },
];

export function UrlDownloadTool() {
  const [url, setUrl] = React.useState("");
  const [analysis, setAnalysis] = React.useState<UrlDownloadAnalysis | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [quality, setQuality] = React.useState("source");
  const [format, setFormat] = React.useState<UrlDownloadFormat>("mp4");
  const [cpuThreads, setCpuThreads] = React.useState<string>("0");
  const [proxyMode, setProxyMode] = React.useState<string>("auto");
  const [customProxy, setCustomProxy] = React.useState<string>("");
  const [thumbError, setThumbError] = React.useState(false);

  const [running, setRunning] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [currentJobId, setCurrentJobId] = React.useState<string | null>(null);
  const [stage, setStage] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [jobError, setJobError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<JobRecord | null>(null);
  const [elapsedSec, setElapsedSec] = React.useState(0);

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubRef = React.useRef<(() => void) | null>(null);
  const downloadedJobIdRef = React.useRef<string | null>(null);

  const stopTracking = React.useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
  }, []);

  React.useEffect(() => stopTracking, [stopTracking]);

  // Live elapsed seconds counter for active download
  React.useEffect(() => {
    if (!running || isPaused) return;
    const interval = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [running, isPaused]);

  // Dynamic estimated remaining time
  const estimatedRemainingSec = React.useMemo(() => {
    if (!progress || progress <= 4 || elapsedSec < 2) return null;
    const fraction = progress / 100;
    const totalEst = elapsedSec / fraction;
    return Math.max(0, Math.round(totalEst - elapsedSec));
  }, [progress, elapsedSec]);

  const handleJobUpdate = React.useCallback(
    (record: JobRecord) => {
      setStage(record.stage);
      const pct = parseProgressPercent(record.stage);
      if (pct !== null) {
        setProgress(pct);
      }

      if (record.state === "completed") {
        setProgress(100);
        setResult(record);
        setRunning(false);
        setIsPaused(false);
        stopTracking();

        // Guard: ensure auto-download triggers exactly ONCE per completed job
        if (downloadedJobIdRef.current !== record.id) {
          downloadedJobIdRef.current = record.id;
          triggerDirectDownload(downloadUrl(record.id), record.outputFilename);
          toast.success("Download complete! Saving file to device.");
        }
      } else if (record.state === "failed") {
        setJobError(record.error ?? "The download failed.");
        setRunning(false);
        setIsPaused(false);
        stopTracking();
        toast.error(record.error ?? "The download failed.");
      }
    },
    [stopTracking],
  );

  const track = React.useCallback(
    (id: string, isNew = true) => {
      stopTracking();
      setCurrentJobId(id);
      setIsPaused(false);
      if (isNew) {
        setProgress(5);
        setElapsedSec(0);
      }

      // 1. Subscribe to real-time Server-Sent Events (SSE)
      try {
        unsubRef.current = subscribeJob(
          id,
          (record) => handleJobUpdate(record),
          () => {
            // If SSE connection drops or is blocked, poll as fallback
          },
        );
      } catch {
        // SSE not supported
      }

      // 2. Poll as guaranteed fallback
      pollRef.current = setInterval(async () => {
        try {
          const record = await getJob(id);
          handleJobUpdate(record);
        } catch (err) {
          setJobError(err instanceof Error ? err.message : "Lost connection to the server.");
          setRunning(false);
          setIsPaused(false);
          stopTracking();
        }
      }, POLL_MS);
    },
    [stopTracking, handleJobUpdate],
  );

  const resetJob = React.useCallback(() => {
    stopTracking();
    downloadedJobIdRef.current = null;
    setRunning(false);
    setIsPaused(false);
    setCurrentJobId(null);
    setStage(null);
    setProgress(null);
    setJobError(null);
    setResult(null);
    setElapsedSec(0);
  }, [stopTracking]);

  const handleTogglePause = () => {
    if (!running) return;
    if (isPaused) {
      setIsPaused(false);
      if (currentJobId) {
        track(currentJobId, false);
      }
      toast.success("Download resumed.");
    } else {
      setIsPaused(true);
      stopTracking();
      toast.info("Download paused.");
    }
  };

  const handleCancel = async () => {
    const idToDelete = currentJobId;
    resetJob();
    if (idToDelete) {
      try {
        await deleteJob(idToDelete);
      } catch {
        // quiet fallback
      }
    }
    toast.info("Download cancelled and deleted.");
  };

  const handleRestart = async () => {
    const idToDelete = currentJobId;
    resetJob();
    if (idToDelete) {
      try {
        await deleteJob(idToDelete);
      } catch {
        // quiet fallback
      }
    }
    await start();
  };

  const analyze = async (explicitUrl?: string) => {
    const rawVal = explicitUrl ?? url;
    const unwrapped = unwrapGoogleUrl(rawVal).trim();
    if (unwrapped !== url && !explicitUrl) {
      setUrl(unwrapped);
    }
    const value = unwrapped;
    if (hasQueryInjection(value)) {
      toast.error("URL contains prohibited query injection tokens or malicious characters.");
      return;
    }
    const urlValidation = validateUrl(value);
    if (!urlValidation.isValid) {
      toast.error(urlValidation.error || "Enter a full http(s) link.");
      return;
    }
    setAnalyzing(true);
    setThumbError(false);
    try {
      const info = await analyzeUrlDownload(value);
      setAnalysis(info);
      setThumbError(false);
      if (info.qualities?.[0]?.id) {
        setQuality(info.qualities[0].id);
      }
      toast.success(
        info.kind === "stream"
          ? "Found online video stream."
          : info.kind === "hls"
            ? "Found an HLS stream."
            : "Found a media file.",
      );
    } catch (err) {
      if (!explicitUrl) {
        toast.error(err instanceof Error ? err.message : "Could not inspect that link.");
      }
    } finally {
      setAnalyzing(false);
    }
  };

  // Background auto-detection when user pastes a valid media link
  React.useEffect(() => {
    const unwrapped = unwrapGoogleUrl(url);
    if (unwrapped !== url) {
      setUrl(unwrapped);
      return;
    }
    const trimmed = unwrapped.trim();
    if (!trimmed || running) return;
    if (analysis && (analysis.url === trimmed || trimmed.includes(analysis.title))) return;
    if (hasQueryInjection(trimmed)) return;
    const validation = validateUrl(trimmed);
    if (!validation.isValid) return;

    const timer = setTimeout(async () => {
      try {
        setAnalyzing(true);
        setThumbError(false);
        const info = await analyzeUrlDownload(trimmed);
        setAnalysis(info);
        setThumbError(false);
        if (info.qualities?.[0]?.id) {
          setQuality((prev) => (prev === "source" ? info.qualities[0].id : prev));
        }
      } catch {
        // quiet fallback for auto-detect
      } finally {
        setAnalyzing(false);
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [url, running, analysis]);

  const start = async () => {
    const rawTarget = (analysis?.url || url).trim();
    const targetUrl = unwrapGoogleUrl(rawTarget).trim();
    if (!targetUrl || running) return;

    if (hasQueryInjection(targetUrl)) {
      toast.error("URL contains prohibited query injection tokens or malicious characters.");
      return;
    }
    const urlValidation = validateUrl(targetUrl);
    if (!urlValidation.isValid) {
      toast.error(urlValidation.error || "Enter a full http(s) link.");
      return;
    }

    resetJob();
    setRunning(true);
    setProgress(5);
    setStage("Starting download…");
    try {
      const threadsNum = cpuThreads === "0" ? undefined : parseInt(cpuThreads, 10);
      const proxyParam =
        proxyMode === "custom" && customProxy.trim()
          ? customProxy.trim()
          : proxyMode === "direct"
            ? "none"
            : "auto";
      const res = await submitUrlDownload({
        url: targetUrl,
        quality: quality || "source",
        format: format || "mp4",
        title: analysis?.title,
        kind: analysis?.kind,
        threads: threadsNum,
        proxy: proxyParam,
      });
      track(res.jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start the download.";
      setJobError(message);
      setRunning(false);
      toast.error(message);
    }
  };

  const duration = formatDuration(analysis?.durationSec ?? null);
  const isAudio = format === "mp3" || format === "m4a";
  const qualities = analysis?.qualities?.length ? analysis.qualities : DEFAULT_QUALITIES;

  return (
    <AuthGate>
      <div className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6 md:py-10">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
              Universal Media Downloader
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3 w-3" />
              All Websites Supported
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Paste any link from any website worldwide — YouTube, TikTok, Facebook, Instagram, Vimeo, IMDb, Reddit, X (Twitter), Google Video & Drive,
            news sites, streaming portals, public HLS (.m3u8) streams, or direct media files.
          </p>
        </div>

        {result && (
          <div className="glass-panel mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border-emerald-500/30 bg-emerald-500/5 p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-xl font-semibold">Download Complete</h2>
                  <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Ready to Save
                  </span>
                </div>
                <p className="truncate text-sm text-on-surface-variant">
                  {result.outputFilename ?? analysis?.title}
                  {result.outputSize ? ` · ${formatBytes(result.outputSize)}` : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                asChild
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
              >
                <a
                  href={downloadUrl(result.id)}
                  download={result.outputFilename || "video.mp4"}
                  target="_self"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4" />
                  Save Video to Device
                </a>
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  resetJob();
                  setAnalysis(null);
                  setUrl("");
                }}
              >
                <RefreshCcw className="h-4 w-4" />
                New link
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="flex flex-col gap-4 lg:col-span-8">
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-[0_4px_12px_rgba(0,0,0,0.03)] sm:p-6">
              <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
                Media link
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                  <Input
                    value={url}
                    onChange={(e) => {
                      const val = e.target.value;
                      const unwrapped = unwrapGoogleUrl(val);
                      setUrl(unwrapped);
                      if (result) resetJob();
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData?.getData("text") || "";
                      const unwrapped = unwrapGoogleUrl(text);
                      if (unwrapped !== text) {
                        e.preventDefault();
                        setUrl(unwrapped);
                        if (result) resetJob();
                      }
                    }}
                    preventQueryInjection={false}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (analysis) {
                          void start();
                        } else {
                          void analyze();
                        }
                      }
                    }}
                    placeholder="Paste any video link from any website worldwide (YouTube, TikTok, Vimeo, IMDb, news, or direct link)…"
                    className="pl-9"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
                {/* Single clean Analyze button in the input row — no duplicate download button */}
                <Button
                  onClick={() => void analyze()}
                  disabled={analyzing || !url.trim()}
                  className="gap-2 sm:w-36 font-semibold"
                >
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {analyzing ? "Analyzing…" : "Analyze"}
                </Button>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-on-surface-variant">
                <span className="font-semibold text-foreground">Universal:</span>
                <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 font-semibold">Any Website</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">YouTube</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">TikTok</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">Instagram</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">Facebook</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">Vimeo</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">IMDb</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">Reddit</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">X (Twitter)</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">HLS / MP4</span>
              </div>

              {analysis && (
                <div className="mt-5 flex flex-col gap-4 rounded-xl border border-outline-variant/10 bg-muted/40 p-4 sm:flex-row sm:items-center">
                  {analysis.thumbnail && !thumbError ? (
                    <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-black/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={analysis.thumbnail}
                        alt={analysis.title}
                        className="h-full w-full object-cover"
                        onError={() => setThumbError(true)}
                      />
                      {duration && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] text-white">
                          {duration}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-container/15">
                      {analysis.kind === "hls" || analysis.kind === "stream" ? (
                        <Video className="h-5 w-5 text-primary" />
                      ) : (
                        <CloudDownload className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 font-display text-[14px] font-semibold text-foreground">
                      {analysis.title}
                    </div>
                    {analysis.uploader && (
                      <div className="mt-0.5 truncate text-xs font-medium text-primary">
                        {analysis.uploader}
                      </div>
                    )}
                    <div className="mt-1 font-mono text-xs text-on-surface-variant">
                      {analysis.kind === "stream"
                        ? "Streaming video"
                        : analysis.kind === "hls"
                          ? "HLS stream"
                          : "Direct file"}
                      {analysis.width && analysis.height ? ` · ${analysis.width}×${analysis.height}` : ""}
                      {duration ? ` · ${duration}` : ""}
                      {analysis.contentLength ? ` · ${formatBytes(analysis.contentLength)}` : ""}
                    </div>
                  </div>
                </div>
              )}

              {/* Live Video Download Process Card with Two Times & Delete/Pause Control Icons */}
              {running && (
                <div
                  className={cn(
                    "mt-5 rounded-2xl border p-5 shadow-sm transition-all duration-300",
                    isPaused
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-emerald-500/30 bg-emerald-500/5",
                  )}
                >
                  {/* Top Header: Title, Status Badge, and Control Action Icons */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isPaused ? (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                          <Pause className="h-4 w-4" />
                        </span>
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-sm font-semibold text-foreground truncate max-w-[200px] sm:max-w-[340px]">
                            {analysis?.title || "Online Media"}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider",
                              isPaused
                                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
                            )}
                          >
                            {isPaused ? "Paused" : "Downloading"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-300">
                            <Zap className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                            {cpuThreads === "1" ? "Single CPU Core" : "Multi-CPU Turbo"}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant truncate">
                          {isPaused
                            ? "Download paused — click resume to continue"
                            : stage ?? "Downloading media stream…"}
                        </p>
                      </div>
                    </div>

                    {/* Control Action Icons: Pause/Resume, Restart, and Cancel/Delete */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleTogglePause}
                        title={isPaused ? "Resume download" : "Pause download"}
                        aria-label={isPaused ? "Resume download" : "Pause download"}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/30 bg-background/80 text-foreground transition-all hover:bg-surface-container-high hover:border-outline-variant/60 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isPaused ? (
                          <Play className="h-3.5 w-3.5 fill-current text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Pause className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleRestart()}
                        title="Restart download"
                        aria-label="Restart download"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/30 bg-background/80 text-foreground transition-all hover:bg-surface-container-high hover:border-outline-variant/60 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-on-surface-variant" />
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleCancel()}
                        title="Cancel and delete download"
                        aria-label="Cancel and delete download"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10 text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Line / Slider */}
                  <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-outline-variant/20">
                    <div
                      style={{ width: `${progress ?? 8}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-300 ease-out shadow-sm",
                        isPaused
                          ? "bg-amber-500/80"
                          : "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 animate-pulse",
                      )}
                    />
                  </div>

                  {/* Dual Time Metrics: Elapsed Time (Time 1) & Remaining Time (Time 2) */}
                  <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 border-t border-outline-variant/15 text-xs font-mono">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-on-surface-variant">Progress</span>
                      <span className="font-bold text-foreground">
                        {progress !== null ? `${progress}%` : "Starting…"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-on-surface-variant">Elapsed Time</span>
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3 text-on-surface-variant" />
                        {formatSeconds(elapsedSec)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-on-surface-variant">Estimated Left</span>
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <Timer className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        {estimatedRemainingSec !== null
                          ? `~${formatSeconds(estimatedRemainingSec)}`
                          : "Calculating…"}
                      </span>
                    </div>
                    <div className="flex flex-col sm:items-end">
                      <span className="text-[10px] uppercase text-on-surface-variant">CPU Multitasker</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {cpuThreads === "1" ? "Single Core" : "Multi-Core Turbo"}
                      </span>
                    </div>
                  </div>

                  {/* Multi-CPU Multitasking Engine Status Banner */}
                  <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-outline-variant/15 bg-background/70 px-3 py-2 text-xs text-on-surface-variant">
                    <Cpu className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate">
                      <strong>CPU Multitasker Active:</strong> Downloading video stream in parallel chunks across multiple CPU threads.
                    </span>
                  </div>
                </div>
              )}

              {jobError && (
                <div className="mt-5 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{jobError}</span>
                </div>
              )}
            </div>
          </section>

          <aside className="lg:col-span-4">
            <div className="flex flex-col rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-[0_4px_12px_rgba(0,0,0,0.03)] sm:p-6 lg:sticky lg:top-24">
              <div className="mb-6 border-b border-outline-variant/10 pb-4">
                <h2 className="font-display text-xl font-medium">Download settings</h2>
              </div>

              <div className="flex-1 space-y-6">
                <div>
                  <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
                    Quality
                  </label>
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger className="bg-muted">
                      <SelectValue placeholder="Choose quality" />
                    </SelectTrigger>
                    <SelectContent>
                      {qualities.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                          {option.source ? " — source" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
                    Format
                  </label>
                  <Select
                    value={format}
                    onValueChange={(v) => setFormat(v as UrlDownloadFormat)}
                  >
                    <SelectTrigger className="bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {URL_DOWNLOAD_FORMATS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isAudio && (
                    <p className="mt-2 flex items-center gap-1.5 font-mono text-xs text-on-surface-variant">
                      <Music className="h-3.5 w-3.5" />
                      Only the audio track will be kept.
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 font-display text-[13px] font-semibold text-on-surface-variant">
                      <Cpu className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Multitasker (Multi-CPU)
                    </label>
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Zap className="h-2.5 w-2.5" />
                      Turbo
                    </span>
                  </div>
                  <Select value={cpuThreads} onValueChange={setCpuThreads}>
                    <SelectTrigger className="bg-muted">
                      <SelectValue placeholder="CPU Acceleration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">⚡ Turbo Multitasker (All CPU Cores · Multi-Threaded)</SelectItem>
                      <SelectItem value="8">⚡ High Performance (8 CPU Threads)</SelectItem>
                      <SelectItem value="4">Balanced Multitasker (4 CPU Threads)</SelectItem>
                      <SelectItem value="1">Standard (Single CPU Core)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-[11px] text-on-surface-variant">
                    Splits video chunks across multiple CPU threads for maximum download speed.
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 font-display text-[13px] font-semibold text-on-surface-variant">
                      <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Anti-Block & Auto Proxy
                    </label>
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Auto IP Rotation
                    </span>
                  </div>
                  <Select value={proxyMode} onValueChange={setProxyMode}>
                    <SelectTrigger className="bg-muted">
                      <SelectValue placeholder="Proxy / Anti-Block" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">🌐 Auto IP Rotation (Bypass Country & ISP Blocks)</SelectItem>
                      <SelectItem value="custom">⚙️ Custom Proxy (HTTP / SOCKS5)</SelectItem>
                      <SelectItem value="direct">Direct Connection (No Proxy)</SelectItem>
                    </SelectContent>
                  </Select>
                  {proxyMode === "custom" && (
                    <div className="mt-2">
                      <Input
                        type="text"
                        value={customProxy}
                        onChange={(e) => setCustomProxy(e.target.value)}
                        placeholder="socks5://127.0.0.1:1080 or http://proxy:8080"
                        className="text-xs font-mono"
                      />
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] text-on-surface-variant">
                    {proxyMode === "auto"
                      ? "If video is blocked in your country or by ISP DPI, automatically changes IP to bypass the block."
                      : proxyMode === "custom"
                        ? "Routes all traffic through your custom HTTP or SOCKS5 proxy server."
                        : "Downloads directly from the remote server without proxy routing."}
                  </p>
                </div>
              </div>

              {/* The Action Button: When Completed, Save to Device. When Running, Pause/Resume. When Idle, Start Download */}
              <div className="mt-6 border-t border-outline-variant/10 pt-5">
                {result ? (
                  <Button
                    asChild
                    className="w-full gap-2 rounded-xl py-4 font-semibold text-base shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                    size="lg"
                  >
                    <a
                      href={downloadUrl(result.id)}
                      download={result.outputFilename || "video.mp4"}
                      target="_self"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-5 w-5" />
                      Save to PC / Phone ({result.outputSize ? formatBytes(result.outputSize) : "Download"})
                    </a>
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (isPaused) {
                        handleTogglePause();
                      } else if (!running) {
                        void start();
                      }
                    }}
                    disabled={!url.trim() || (running && !isPaused)}
                    className="w-full gap-2 rounded-xl py-4 font-semibold text-base shadow-sm"
                    size="lg"
                  >
                    {running ? (
                      isPaused ? (
                        <>
                          <Play className="h-5 w-5 fill-current text-amber-500" />
                          Resume Download ({progress !== null ? `${progress}%` : ""})
                        </>
                      ) : (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Downloading ({progress !== null ? `${progress}%` : "Please wait"})…
                        </>
                      )
                    ) : (
                      <>
                        <CloudDownload className="h-5 w-5" />
                        Download Video
                      </>
                    )}
                  </Button>
                )}
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-on-surface-variant">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {result ? "File ready — tap button to save to your device" : "Direct download: Saves file to your device upon completion"}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AuthGate>
  );
}
