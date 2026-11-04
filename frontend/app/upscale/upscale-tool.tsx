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
  FileImage,
  ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  RefreshCw,
  Sliders,
  Sparkles,
  Upload,
  User,
  Wand2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AuthGate } from "@/components/auth-gate";
import { ImageCompareSlider } from "@/components/image-compare-slider";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  createSamplePortraitDataUrl,
  upscaleImage,
  type UpscaleFactor,
  type UpscaleModel,
} from "@/lib/image-upscaler";
import { cn } from "@/lib/utils";

export function UpscaleTool() {
  const [sourceFile, setSourceFile] = React.useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = React.useState<string>("");
  const [factor, setFactor] = React.useState<UpscaleFactor>(4);
  const [model, setModel] = React.useState<UpscaleModel>("remini-face");
  const [sharpness, setSharpness] = React.useState<number>(75);
  const [faceClarity, setFaceClarity] = React.useState<number>(85);
  const [skinTexture, setSkinTexture] = React.useState<number>(70);
  const [outputFormat, setOutputFormat] = React.useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [zoomLevel, setZoomLevel] = React.useState<"fit" | "face" | "loupe">("fit");

  // Multi-image queue support
  const [imageQueue, setImageQueue] = React.useState<
    Array<{ id: string; file: File; url: string; name: string }>
  >([]);
  const [activeQueueId, setActiveQueueId] = React.useState<string | null>(null);

  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [progressStage, setProgressStage] = React.useState<string>("");
  const [progressPercent, setProgressPercent] = React.useState<number>(0);

  const [result, setResult] = React.useState<{
    dataUrl: string;
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
  } | null>(null);

  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Helper to load sample portrait demo
  const loadDemoPortrait = React.useCallback(() => {
    setSourceFile(null);
    setActiveQueueId(null);
    const demo = createSamplePortraitDataUrl();
    if (demo) {
      setSourceUrl(demo);
      runUpscale(demo);
    }
  }, []);

  // Auto-run on mount with the local sample image
  React.useEffect(() => {
    loadDemoPortrait();
  }, [loadDemoPortrait]);

  const runUpscale = async (
    src: File | string,
    overrideOpts?: {
      overrideFactor?: UpscaleFactor;
      overrideModel?: UpscaleModel;
      overrideClarity?: number;
      overrideSkin?: number;
      overrideSharpness?: number;
    }
  ) => {
    setIsProcessing(true);
    setProgressPercent(10);
    setProgressStage("Initializing Remini AI Super-Resolution Engine...");

    const curFactor = overrideOpts?.overrideFactor ?? factor;
    const curModel = overrideOpts?.overrideModel ?? model;
    const curClarity = overrideOpts?.overrideClarity ?? faceClarity;
    const curSkin = overrideOpts?.overrideSkin ?? skinTexture;
    const curSharpness = overrideOpts?.overrideSharpness ?? sharpness;

    try {
      const res = await upscaleImage(
        src,
        {
          factor: curFactor,
          model: curModel,
          sharpnessStrength: curSharpness,
          faceClarity: curClarity,
          skinTexture: curSkin,
          outputFormat,
        },
        (stage, pct) => {
          setProgressStage(stage);
          setProgressPercent(pct);
        }
      );

      setResult(res);
      const modelTitle =
        curModel === "remini-face"
          ? "Remini Face Restore Pro"
          : curModel === "remini-hd"
          ? "Remini 4K Studio Ultra"
          : curModel === "remini-old-photo"
          ? "Remini Old Photo Revive"
          : curModel;
      toast.success(`Enhanced to ${res.width}x${res.height} with ${modelTitle} (${curFactor}x)!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upscale image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFilesSelect = (files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (valid.length === 0) {
      toast.error("Please choose valid image files (PNG, JPG, WebP).");
      return;
    }

    const newEntries = valid.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
    }));

    setImageQueue((prev) => [...prev, ...newEntries]);

    // Activate the first new image
    const first = newEntries[0];
    setActiveQueueId(first.id);
    setSourceFile(first.file);
    setSourceUrl(first.url);
    runUpscale(first.file);

    if (valid.length > 1) {
      toast.success(`Loaded ${valid.length} photos into queue! Click thumbnails to switch.`);
    }
  };

  const handleQueueSelect = (item: { id: string; file: File; url: string; name: string }) => {
    setActiveQueueId(item.id);
    setSourceFile(item.file);
    setSourceUrl(item.url);
    runUpscale(item.file);
    toast.info(`Switched to "${item.name}"`);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) handleFilesSelect(files);
  };

  const downloadResult = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.dataUrl;
    const ext = outputFormat === "image/png" ? "png" : outputFormat === "image/webp" ? "webp" : "jpg";
    const base = sourceFile?.name.replace(/\.[^.]+$/, "") || "remini_enhanced_photo";
    a.download = `${base}_${factor}x_remini_ai.${ext}`;
    a.click();
    toast.success("Download started!");
  };

  // 1-Click Remini Preset Applicator
  const applyPreset = (
    targetModel: UpscaleModel,
    targetFactor: UpscaleFactor,
    targetClarity: number,
    targetSkin: number,
    targetSharpness: number
  ) => {
    setModel(targetModel);
    setFactor(targetFactor);
    setFaceClarity(targetClarity);
    setSkinTexture(targetSkin);
    setSharpness(targetSharpness);
    runUpscale(sourceFile || sourceUrl, {
      overrideModel: targetModel,
      overrideFactor: targetFactor,
      overrideClarity: targetClarity,
      overrideSkin: targetSkin,
      overrideSharpness: targetSharpness,
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-sky-400">
          <Sparkles className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
          Remini AI Reverse-Engineered Super-Resolution
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          AI Image Upscaler &{" "}
          <span className="bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
            Remini Face Restorer
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-muted-foreground">
          Reverse-engineered Remini facial clarity: reconstructs eye catchlights, limbal rings, eyelashes, and organic skin pores with 4x zero-halo super-resolution.
        </p>

        {/* Remini 1-Click Preset Chips & Primary Upload Button */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-sky-400 bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 px-4 py-1.5 text-xs font-bold text-white transition cursor-pointer shadow-sm"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Photo(s)</span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset("remini-face", 4, 90, 70, 80)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-bold transition cursor-pointer shadow-xs",
              model === "remini-face"
                ? "border-sky-500 bg-sky-500/20 text-sky-300 ring-2 ring-sky-500/30"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="h-3 w-3 text-sky-400" />
            🌟 Remini Portrait Pro (4x)
          </button>

          <button
            type="button"
            onClick={() => applyPreset("remini-old-photo", 4, 85, 75, 80)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-bold transition cursor-pointer shadow-xs",
              model === "remini-old-photo"
                ? "border-amber-500 bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/30"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <Wand2 className="h-3 w-3 text-amber-400" />
            🕰️ Old Photo Revive
          </button>

          <button
            type="button"
            onClick={() => applyPreset("remini-hd", 4, 75, 60, 85)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-bold transition cursor-pointer shadow-xs",
              model === "remini-hd"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/30"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <Maximize2 className="h-3 w-3 text-emerald-400" />
            ✨ Remini 4K Studio Ultra
          </button>

          <button
            type="button"
            onClick={() => applyPreset("anime-graphics", 4, 60, 50, 90)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-bold transition cursor-pointer shadow-xs",
              model === "anime-graphics"
                ? "border-purple-500 bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/30"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="h-3 w-3 text-purple-400" />
            🎨 Anime / Art 4K
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Viewport & Before/After Comparison (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={cn(
              "relative overflow-hidden rounded-2xl border bg-card p-4 transition-all min-h-[380px] flex items-center justify-center shadow-sm",
              isDragging ? "border-sky-500 bg-sky-500/5 ring-2 ring-sky-500/30" : "border-border"
            )}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in-50">
                <Loader2 className="h-10 w-10 text-sky-400 animate-spin" />
                <p className="mt-4 font-bold text-sm text-foreground">{progressStage}</p>
                <div className="mt-3 w-48 rounded-full bg-muted overflow-hidden h-2">
                  <div
                    className="h-full bg-sky-400 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="mt-1 text-[11px] text-muted-foreground font-mono">{progressPercent}%</span>
              </div>
            ) : result ? (
              <div className="w-full space-y-3">
                {/* Viewport Zoom & Loupe Controls + Prominent Upload Button */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload / Change Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={loadDemoPortrait}
                      className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-2 cursor-pointer"
                    >
                      Demo
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">Inspect:</span>
                    <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setZoomLevel("fit")}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer",
                        zoomLevel === "fit"
                          ? "bg-card text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Fit Screen
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel("face")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer",
                        zoomLevel === "face"
                          ? "bg-sky-500 text-white shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Eye className="h-3 w-3" />
                      🔍 100% Face Zoom
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel("loupe")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer",
                        zoomLevel === "loupe"
                          ? "bg-sky-500 text-white shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      🔬 200% Pixel Loupe
                    </button>
                    </div>
                  </div>
                </div>

                {zoomLevel !== "fit" && (
                  <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 text-xs text-sky-400 flex items-center justify-between">
                    <span>
                      🎯 <strong>1:1 Actual Pixel Magnifier</strong>: Facial pores, beard strands, and eye catchlights displayed at true resolution. Wipe the slider to inspect before & after.
                    </span>
                  </div>
                )}

                <ImageCompareSlider
                  beforeImage={sourceUrl}
                  afterImage={result.dataUrl}
                  beforeLabel={`Original (${result.originalWidth}×${result.originalHeight})`}
                  afterLabel={`Remini AI ${factor}x (${result.width}×${result.height})`}
                  aspectRatio={
                    result.height > result.width
                      ? "aspect-[3/4] sm:aspect-[4/5] min-h-[480px]"
                      : "aspect-[4/3] min-h-[380px]"
                  }
                  zoomScale={zoomLevel === "loupe" ? 3.5 : zoomLevel === "face" ? 2.2 : 1}
                  zoomOrigin="50% 28%"
                />
                <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground px-1 gap-2">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Multi-Band Frequency Separation & Pore Realism Active
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">
                    +{result.width - result.originalWidth}px Wider (Ultra-HD)
                  </span>
                </div>

                {/* Multi-Photo Queue Strip */}
                {imageQueue.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/30 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-1">
                      <span>Loaded Photos ({imageQueue.length})</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-sky-400 hover:underline cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                      >
                        <Upload className="h-3 w-3" /> Add more
                      </button>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                      {imageQueue.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleQueueSelect(item)}
                          className={cn(
                            "relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition cursor-pointer group",
                            activeQueueId === item.id
                              ? "border-sky-500 ring-2 ring-sky-500/40"
                              : "border-border hover:border-sky-400 opacity-70 hover:opacity-100"
                          )}
                          title={item.name}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-shrink-0 w-14 h-14 rounded-lg border-2 border-dashed border-border hover:border-sky-400 flex flex-col items-center justify-center text-muted-foreground hover:text-sky-400 text-[10px] transition cursor-pointer bg-card/50"
                        title="Upload more photos"
                      >
                        <Upload className="h-4 w-4" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center">
                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">Select an image to preview upscaling</p>
              </div>
            )}
          </div>

          {/* Quick upload dropzone bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs">
            <button
              type="button"
              onClick={loadDemoPortrait}
              className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-2 cursor-pointer"
            >
              Reset Demo Portrait
            </button>

            <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-sm">
              <Upload className="h-3.5 w-3.5" />
              <span>Choose Image(s) (PNG, JPG, WebP)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) handleFilesSelect(files);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Right: Controls & Parameters (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-6 shadow-sm">
            {/* Active Photo Source & Upload Card */}
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <FileImage className="h-4 w-4" /> Active Photo
                </span>
                {sourceFile ? (
                  <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Custom Photo
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Demo Portrait
                  </span>
                )}
              </div>

              <p className="text-xs text-foreground font-semibold truncate">
                {sourceFile ? sourceFile.name : "Remini Sample Portrait Demo"}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 px-4 py-2.5 text-xs font-bold text-white transition shadow-sm cursor-pointer"
                >
                  <Upload className="h-4 w-4" />
                  <span>Choose Photo(s)</span>
                </button>
                <button
                  type="button"
                  onClick={loadDemoPortrait}
                  className="rounded-xl border border-border bg-card hover:bg-muted px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title="Switch to Demo Portrait"
                >
                  Try Demo
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Supports single or multiple PNG, JPG, or WebP files
              </p>
            </div>

            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Sliders className="h-4 w-4 text-sky-400" /> Remini AI Enhancement Engine
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fine-tune facial restoration, pore retention, and 4x super-resolution
              </p>
            </div>

            {/* Factor Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Scale Factor
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 2, label: "2x Upscale", desc: "400% Area (Fast)" },
                  { id: 4, label: "4x Super-Res", desc: "1600% Area (Remini Ultra-HD)" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setFactor(item.id as UpscaleFactor);
                      runUpscale(sourceFile || sourceUrl, { overrideFactor: item.id as UpscaleFactor });
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border p-3 text-center transition cursor-pointer",
                      factor === item.id
                        ? "border-sky-500 bg-sky-500/10 text-sky-400 shadow-xs"
                        : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                    )}
                  >
                    <span className="font-bold text-sm">{item.label}</span>
                    <span className="text-[10px] opacity-80">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Model Architecture */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Neural Model Architecture
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: "remini-face",
                    label: "🌟 Remini Face Restore Pro",
                    desc: "Reconstructs eyes, pupils, lashes, lips & natural pores",
                  },
                  {
                    id: "remini-old-photo",
                    label: "🕰️ Remini Old Photo Revive",
                    desc: "De-scratches, clears vintage noise & enhances faded contrast",
                  },
                  {
                    id: "remini-hd",
                    label: "✨ Remini 4K Studio Ultra",
                    desc: "8-way directional reconstruction for scenery, objects & clothes",
                  },
                  {
                    id: "anime-graphics",
                    label: "🎨 Anime & Digital Graphics",
                    desc: "Waifu2x flat-field de-banding and clean ink line art",
                  },
                  {
                    id: "balanced",
                    label: "⚖️ Balanced Classic",
                    desc: "Standard natural contrast-adaptive sharpening",
                  },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setModel(m.id as UpscaleModel);
                      runUpscale(sourceFile || sourceUrl, { overrideModel: m.id as UpscaleModel });
                    }}
                    className={cn(
                      "flex flex-col items-start rounded-xl border px-3 py-2 text-left transition cursor-pointer",
                      model === m.id
                        ? "border-sky-500 bg-sky-500/10 text-sky-400 shadow-xs"
                        : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                    )}
                  >
                    <span className="font-bold text-xs">{m.label}</span>
                    <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Remini Face Controls (shown for remini-face and remini-old-photo) */}
            {(model === "remini-face" || model === "remini-old-photo") && (
              <div className="space-y-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> Remini Face & Eye Clarity
                    </label>
                    <span className="font-mono text-sky-400 font-bold">{faceClarity}%</span>
                  </div>
                  <Slider
                    value={[faceClarity]}
                    min={20}
                    max={100}
                    step={5}
                    onValueChange={([val]) => setFaceClarity(val)}
                    onValueCommit={([val]) =>
                      runUpscale(sourceFile || sourceUrl, { overrideClarity: val })
                    }
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Boosts iris limbal rings, pupil catchlights, lashes, and lip vermilion border.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Skin Pore & Dermal Texture
                    </label>
                    <span className="font-mono text-sky-400 font-bold">{skinTexture}%</span>
                  </div>
                  <Slider
                    value={[skinTexture]}
                    min={10}
                    max={100}
                    step={5}
                    onValueChange={([val]) => setSkinTexture(val)}
                    onValueCommit={([val]) =>
                      runUpscale(sourceFile || sourceUrl, { overrideSkin: val })
                    }
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Balances skin smoothing with organic pore preservation to prevent plastic look.
                  </p>
                </div>
              </div>
            )}

            {/* General Sharpness Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold uppercase tracking-wider text-muted-foreground">
                  Edge & Texture Sharpness
                </label>
                <span className="font-mono text-sky-400 font-bold">{sharpness}%</span>
              </div>
              <Slider
                value={[sharpness]}
                min={10}
                max={100}
                step={5}
                onValueChange={([val]) => setSharpness(val)}
                onValueCommit={([val]) =>
                  runUpscale(sourceFile || sourceUrl, { overrideSharpness: val })
                }
              />
            </div>

            {/* Output Format */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Output Format
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(["image/png", "image/jpeg", "image/webp"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setOutputFormat(fmt)}
                    className={cn(
                      "rounded-lg border py-1.5 font-mono text-[11px] font-semibold uppercase transition cursor-pointer",
                      outputFormat === fmt
                        ? "border-sky-500 bg-sky-500/10 text-sky-400 shadow-xs"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {fmt.replace("image/", "")}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Download Button */}
            <Button
              type="button"
              onClick={downloadResult}
              disabled={!result || isProcessing}
              className="w-full gap-2 rounded-xl py-3.5 bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 font-extrabold text-white shadow-lg shadow-sky-500/20 hover:opacity-95 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Download Remini Enhanced {factor}x Image
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
