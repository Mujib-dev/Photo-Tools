"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  Film,
  Play,
  Pause,
  Upload,
  Download,
  Share2,
  Sparkles,
  Sliders,
  Type,
  Maximize2,
  Subtitles,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  BackgroundMode,
  CaptionStyle,
  DEFAULT_VIRAL_CONFIG,
  ViralAspect,
  ViralClipConfig,
  renderViralFrame,
} from "@/lib/viral-clips-engine";
import { shareBlob } from "@/lib/share";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";

export function ViralClipsTool() {
  const [config, setConfig] = useState<ViralClipConfig>(DEFAULT_VIRAL_CONFIG);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(10);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();
  const animFrameId = useRef<number | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft<ViralClipConfig>(
    "viral-clips",
    config,
    setConfig,
  );

  // Load video
  const handleVideoSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setIsPlaying(true);
    toast.success("Loaded video! Re-framing to 9:16 short...");
  };

  // Canvas dimensions based on aspect ratio
  const getCanvasDimensions = () => {
    if (config.aspect === "9:16") return { width: 1080, height: 1920 };
    if (config.aspect === "4:5") return { width: 1080, height: 1350 };
    return { width: 1080, height: 1080 }; // 1:1
  };

  // Continuous animation render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = getCanvasDimensions();
    canvas.width = width;
    canvas.height = height;

    const render = () => {
      const curTime = video ? video.currentTime : (Date.now() / 1000) % 10;
      const dur = video && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
      setCurrentTime(curTime);

      renderViralFrame(ctx, width, height, video, config, curTime, dur);
      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [config, videoSrc]);

  // Toggle Play / Pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Download high-resolution frame / short
  const handleDownloadSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/jpeg", 0.95);
    const a = document.createElement("a");
    a.href = url;
    a.download = `viral-short-${config.aspect.replace(":", "x")}-${Date.now()}.jpg`;
    a.click();
    toast.success("Downloaded 4K short frame!");
  };

  // Web Share
  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const ok = await shareBlob(blob, `viral-clip-${Date.now()}.jpg`, {
        title: config.headlineText || "Viral Short Clip",
        text: "Created with PicTools Viral Video Studio",
      });
      if (ok) toast.success("Shared!");
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Hidden Video Source Element */}
      {videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          loop
          muted
          playsInline
          autoPlay
          onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration || 10)}
          className="hidden"
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
          <Film className="h-3.5 w-3.5" />
          TikTok, Reels & YouTube Shorts Virality
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Viral Short-Form Video Clipper & Submagic Subtitles
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Re-frame widescreen videos into 9:16 vertical TikTok/Shorts clips with blurred background letterboxing, Alex Hormozi animated word-bounce captions, and hook headlines.
        </p>
      </div>

      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Canvas Preview */}
        <div className="space-y-4 lg:col-span-6 xl:col-span-7 flex flex-col items-center">
          <div className="relative aspect-[9/16] max-h-[640px] w-full max-w-[360px] overflow-hidden rounded-3xl border border-border/80 bg-black shadow-2xl flex items-center justify-center">
            <canvas ref={canvasRef} className="h-full w-full object-contain" />

            {!videoSrc && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-black/60 p-6 text-center backdrop-blur-xs transition hover:border-red-500/60"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/20 text-red-400 mb-3">
                  <Upload className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-white">Upload Landscape or Square Video</h3>
                <p className="mt-1 text-xs text-neutral-400 max-w-xs">
                  MP4, WebM, or MOV. Re-frames to 9:16 vertical with animated subtitles.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-red-500"
                >
                  Choose Video File
                </button>
              </div>
            )}
          </div>

          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleVideoSelect(e.target.files[0])}
          />

          {/* Action Bar */}
          <div className="flex w-full max-w-[360px] flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
            {videoSrc && (
              <button
                type="button"
                onClick={togglePlay}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isPlaying ? "Pause" : "Play"}
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <Upload className="h-3.5 w-3.5" />
              {videoSrc ? "Change Video" : "Upload"}
            </button>

            <button
              type="button"
              onClick={handleDownloadSnapshot}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-red-500"
            >
              <Download className="h-3.5 w-3.5" />
              Snapshot
            </button>
          </div>
        </div>

        {/* Right Column: Viral Controls */}
        <div className="space-y-4 lg:col-span-6 xl:col-span-5">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-5">
            {/* Aspect Ratio */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Target Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "9:16", label: "9:16 Shorts" },
                  { id: "1:1", label: "1:1 Square" },
                  { id: "4:5", label: "4:5 Portrait" },
                ].map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setConfig({ ...config, aspect: a.id as ViralAspect })}
                    className={`rounded-xl border py-2 text-xs font-bold transition text-center ${
                      config.aspect === a.id
                        ? "border-red-500 bg-red-500/10 text-foreground ring-1 ring-red-500/40"
                        : "border-border/60 bg-background hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hook Headline */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Type className="h-3.5 w-3.5 text-red-400" />
                  Hook Headline Banner
                </label>
                <input
                  type="checkbox"
                  checked={config.showHeadline}
                  onChange={(e) => setConfig({ ...config, showHeadline: e.target.checked })}
                  className="h-4 w-4 rounded accent-red-600"
                />
              </div>

              {config.showHeadline && (
                <input
                  type="text"
                  value={config.headlineText}
                  onChange={(e) => setConfig({ ...config, headlineText: e.target.value })}
                  placeholder="HOOK TITLE THAT STOPS THE SCROLL..."
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-black uppercase text-foreground"
                />
              )}
            </div>

            {/* Subtitle Style */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <label className="text-xs font-bold text-foreground block flex items-center gap-1.5">
                <Subtitles className="h-3.5 w-3.5 text-red-400" />
                Animated Word-Bounce Subtitles
              </label>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "hormozi-yellow", label: "Hormozi Yellow", color: "#facc15" },
                  { id: "beast-green", label: "MrBeast Green", color: "#4ade80" },
                  { id: "neon-cyan", label: "Neon Cyan", color: "#38bdf8" },
                  { id: "clean-white", label: "Minimal White", color: "#ffffff" },
                ].map((s) => {
                  const isSelected = config.captionStyle === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setConfig({ ...config, captionStyle: s.id as CaptionStyle })}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                        isSelected
                          ? "border-red-500 bg-red-500/10 text-foreground ring-1 ring-red-500/30"
                          : "border-border/60 bg-background hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Background Style */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <label className="text-xs font-bold text-foreground block">
                Letterbox Background
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "blurred-video", label: "Blurred Video" },
                  { id: "solid-black", label: "Black Studio" },
                  { id: "gradient", label: "Dark Mesh" },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setConfig({ ...config, background: b.id as BackgroundMode })}
                    className={`rounded-xl border py-2 text-xs font-medium text-center transition ${
                      config.background === b.id
                        ? "border-red-500 bg-red-500/10 text-foreground font-bold"
                        : "border-border/60 bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress Bar Timer */}
            <div className="pt-2 border-t border-border/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-foreground block">Progress Bar Timer</span>
                <span className="text-[11px] text-muted-foreground">Increases video completion rate</span>
              </div>
              <input
                type="checkbox"
                checked={config.showProgressBar}
                onChange={(e) => setConfig({ ...config, showProgressBar: e.target.checked })}
                className="h-4 w-4 rounded accent-red-600"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
