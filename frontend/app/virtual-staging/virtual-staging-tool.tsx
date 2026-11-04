"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  Home,
  Sun,
  Moon,
  Sparkles,
  Sliders,
  Download,
  Share2,
  Upload,
  RotateCcw,
  TreePine,
  Armchair,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_STAGING_CONFIG,
  FURNITURE_PRESETS,
  FurnitureStyle,
  StagingConfig,
  StagingMode,
  renderStagedPhoto,
} from "@/lib/virtual-staging-engine";
import { ImageCompareSlider } from "@/components/image-compare-slider";
import { shareBlob } from "@/lib/share";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";

export function VirtualStagingTool() {
  const [config, setConfig] = useState<StagingConfig>(DEFAULT_STAGING_CONFIG);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [stagedUrl, setStagedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [targetFile, setTargetFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft<StagingConfig>(
    "virtual-staging",
    config,
    setConfig,
  );

  // Handle Photo Upload
  const handlePhotoSelect = (file: File) => {
    setTargetFile(file);
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);

    const img = new Image();
    img.onload = () => {
      sourceImageRef.current = img;
      toast.success("Loaded property photo!");
      processStaging(img, config);
    };
    img.onerror = () => {
      toast.error("Failed to load photo.");
    };
    img.src = url;
  };

  // Process transformation
  const processStaging = async (img: HTMLImageElement, currentConfig: StagingConfig) => {
    const canvas = hiddenCanvasRef.current;
    if (!canvas) return;

    try {
      setIsProcessing(true);
      await renderStagedPhoto(img, canvas, currentConfig);
      const url = canvas.toDataURL("image/jpeg", 0.95);
      setStagedUrl(url);
    } catch (err: any) {
      toast.error(err?.message || "Failed to process virtual staging.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Re-process when config changes
  useEffect(() => {
    if (sourceImageRef.current) {
      const timer = setTimeout(() => {
        processStaging(sourceImageRef.current!, config);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [config]);

  // Download High-Res MLS Photo
  const handleDownload = () => {
    const canvas = hiddenCanvasRef.current;
    if (!canvas || !targetFile) return;
    const url = canvas.toDataURL("image/jpeg", 0.95);
    const a = document.createElement("a");
    a.href = url;
    const baseName = targetFile.name.replace(/\.[^/.]+$/, "");
    a.download = `${baseName}-${config.mode}-staged.jpg`;
    a.click();
    toast.success("Downloaded high-res staged photo!");
  };

  // Web Share
  const handleShare = async () => {
    const canvas = hiddenCanvasRef.current;
    if (!canvas || !targetFile) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const baseName = targetFile.name.replace(/\.[^/.]+$/, "");
      const ok = await shareBlob(blob, `${baseName}-staged.jpg`, {
        title: "Virtual Staged Property Photo",
        text: "Enhanced with PicTools Real Estate Studio",
      });
      if (ok) toast.success("Shared photo!");
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Hidden processing canvas */}
      <canvas ref={hiddenCanvasRef} className="hidden" />

      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500 dark:text-amber-400">
          <Home className="h-3.5 w-3.5" />
          High-Ticket Real Estate & Property Marketing
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          AI Real Estate Virtual Staging & Twilight Studio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Transform daytime real estate photos into dramatic golden hour twilights with warm window illumination, green patchy lawns, and stage empty interiors. MLS-compliant 4K export.
        </p>
      </div>

      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      {/* Main Studio View */}
      {!originalUrl ? (
        /* Upload Hero Dropzone */
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-[420px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/80 bg-card/60 p-10 text-center transition hover:border-amber-500/60 hover:bg-card shadow-xl"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4">
            <Upload className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Drop Real Estate Exterior or Interior Photo
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-md">
            Supports High-Res JPG, PNG, WEBP, or HEIC. Perfect for living rooms, kitchens, front facade exteriors, and backyard patios.
          </p>
          <button
            type="button"
            className="mt-6 rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-black shadow-lg hover:bg-amber-400 transition"
          >
            Select Property Image
          </button>
          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handlePhotoSelect(e.target.files[0])}
          />
        </div>
      ) : (
        /* Interactive Split Studio */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Split Compare Slider */}
          <div className="space-y-4 lg:col-span-8">
            <div className="overflow-hidden rounded-3xl border border-border/80 bg-black shadow-2xl p-2">
              {stagedUrl ? (
                <ImageCompareSlider
                  beforeImage={originalUrl}
                  afterImage={stagedUrl}
                  beforeLabel="Original Listing"
                  afterLabel={
                    config.mode === "twilight"
                      ? "Day-to-Dusk Twilight"
                      : config.mode === "lawn-enhancer"
                      ? "Lush Green Lawn"
                      : config.mode === "hdr-clarity"
                      ? "Architectural HDR"
                      : "Staged Interior"
                  }
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                  Simulating architectural staging...
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setOriginalUrl(null);
                  setStagedUrl(null);
                  setTargetFile(null);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Change Property Photo
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
                  title="Share via mobile or desktop"
                >
                  <Share2 className="h-3.5 w-3.5 text-amber-500" />
                  Share
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-black shadow-lg hover:bg-amber-400 transition"
                >
                  <Download className="h-4 w-4" />
                  Download MLS Photo (4K)
                </button>
              </div>
            </div>
          </div>

          {/* Right: Mode & Control Panel */}
          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-5">
              {/* Mode Selector */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-2">
                  Staging Mode
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "twilight", label: "Dusk Twilight", icon: Moon },
                    { id: "lawn-enhancer", label: "Lawn Greener", icon: TreePine },
                    { id: "hdr-clarity", label: "HDR Clarity", icon: Sun },
                    { id: "virtual-furniture", label: "Staging Style", icon: Armchair },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = config.mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setConfig({ ...config, mode: m.id as StagingMode })}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                          isSelected
                            ? "border-amber-500 bg-amber-500/10 text-foreground ring-1 ring-amber-500/40"
                            : "border-border/60 bg-background hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span className="truncate">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode Specific Controls */}
              {config.mode === "twilight" && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-foreground">Dusk Sky Intensity</span>
                      <span className="font-mono text-muted-foreground">{config.twilightIntensity}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={config.twilightIntensity}
                      onChange={(e) => setConfig({ ...config, twilightIntensity: Number(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-foreground">Window Warm Glow</span>
                      <span className="font-mono text-muted-foreground">{config.windowWarmth}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={config.windowWarmth}
                      onChange={(e) => setConfig({ ...config, windowWarmth: Number(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Simulates golden hour warm lamps and indoor chandelier reflections.
                    </p>
                  </div>
                </div>
              )}

              {config.mode === "lawn-enhancer" && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-foreground">Lush Emerald Grass Boost</span>
                      <span className="font-mono text-muted-foreground">{config.lawnGreenBoost}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={config.lawnGreenBoost}
                      onChange={(e) => setConfig({ ...config, lawnGreenBoost: Number(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Revitalizes patchy, faded, or dry brown front yard lawns into vibrant curb-appeal turf.
                    </p>
                  </div>
                </div>
              )}

              {config.mode === "hdr-clarity" && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-foreground">HDR Dynamic Range & Contrast</span>
                      <span className="font-mono text-muted-foreground">{config.hdrClarity}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={config.hdrClarity}
                      onChange={(e) => setConfig({ ...config, hdrClarity: Number(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Lifts deep shadow corners and recovers blown-out window view-throughs.
                    </p>
                  </div>
                </div>
              )}

              {config.mode === "virtual-furniture" && (
                <div className="space-y-3 animate-in fade-in">
                  <label className="text-xs font-bold text-foreground block">
                    Staging Architecture Preset
                  </label>
                  <div className="space-y-2">
                    {FURNITURE_PRESETS.map((p) => {
                      const isSelected = config.furnitureStyle === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setConfig({ ...config, furnitureStyle: p.id })}
                          className={`cursor-pointer rounded-2xl border p-3 transition ${
                            isSelected
                              ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30"
                              : "border-border/60 bg-background hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">{p.label}</span>
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                            {p.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
