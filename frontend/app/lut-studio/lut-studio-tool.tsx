"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  Palette,
  Upload,
  Download,
  Film,
  Sparkles,
  RotateCcw,
  Sliders,
  Check,
  Eye,
  FileCode,
} from "lucide-react";
import { toast } from "sonner";
import {
  FilmLutPreset,
  FILM_PRESETS,
  applyFilmLut,
  transferColorFromReference,
  generateCubeLut,
} from "@/lib/lut-engine";
import { ImageCompareSlider } from "@/components/image-compare-slider";
import { downloadBlob } from "@/lib/screenshot";

export function LutStudioTool() {
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [gradedUrl, setGradedUrl] = useState<string | null>(null);

  // Mode: "preset" or "reference"
  const [mode, setMode] = useState<"preset" | "reference">("preset");
  const [selectedPreset, setSelectedPreset] = useState<FilmLutPreset>("teal-orange");
  const [intensity, setIntensity] = useState<number>(85);

  // Reference photo state
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refUrl, setRefUrl] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const refInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();
  const refInputId = useId();

  // Load target photo
  const handleTargetSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (gradedUrl) URL.revokeObjectURL(gradedUrl);

    const url = URL.createObjectURL(file);
    setTargetFile(file);
    setOriginalUrl(url);
    setGradedUrl(null);
    toast.success(`Loaded photo: ${file.name}`);
  };

  // Load reference photo
  const handleRefSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file for the reference color palette.");
      return;
    }
    if (refUrl) URL.revokeObjectURL(refUrl);
    const url = URL.createObjectURL(file);
    setRefFile(file);
    setRefUrl(url);
    toast.success(`Loaded reference palette: ${file.name}`);
  };

  // Apply Grading Process
  const processGrading = () => {
    if (!originalUrl) return;

    setIsProcessing(true);
    const targetImg = new Image();
    targetImg.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetImg.naturalWidth;
      canvas.height = targetImg.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(targetImg, 0, 0);

      if (mode === "preset") {
        applyFilmLut(ctx, canvas.width, canvas.height, selectedPreset, intensity);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
        setGradedUrl(dataUrl);
        setIsProcessing(false);
        toast.success(`Applied ${FILM_PRESETS[selectedPreset].name}!`);
      } else if (mode === "reference" && refUrl) {
        const refImg = new Image();
        refImg.onload = () => {
          const refCanvas = document.createElement("canvas");
          refCanvas.width = refImg.naturalWidth;
          refCanvas.height = refImg.naturalHeight;
          const refCtx = refCanvas.getContext("2d");
          if (!refCtx) return;

          refCtx.drawImage(refImg, 0, 0);
          transferColorFromReference(
            ctx,
            refCtx,
            canvas.width,
            canvas.height,
            refCanvas.width,
            refCanvas.height,
            intensity
          );

          const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
          setGradedUrl(dataUrl);
          setIsProcessing(false);
          toast.success("Transferred cinematic color palette from reference!");
        };
        refImg.src = refUrl;
      }
    };
    targetImg.src = originalUrl;
  };

  // Auto-run when settings change if target is loaded
  useEffect(() => {
    if (originalUrl) {
      processGrading();
    }
  }, [originalUrl, selectedPreset, intensity, mode, refUrl]);

  // Download Graded Photo
  const handleDownloadPhoto = () => {
    if (!gradedUrl || !targetFile) return;
    const a = document.createElement("a");
    a.href = gradedUrl;
    a.download = `${targetFile.name.replace(/\.[^/.]+$/, "")}-${
      mode === "preset" ? selectedPreset : "color-matched"
    }.jpg`;
    a.click();
    toast.success("Downloaded color graded image!");
  };

  // Export .cube 3D LUT
  const handleDownloadLut = () => {
    if (mode !== "preset") {
      toast.info("Switch to Preset mode to export a 3D .cube LUT file.");
      return;
    }
    const cubeText = generateCubeLut(selectedPreset, 17);
    const blob = new Blob([cubeText], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${selectedPreset}-3dlut.cube`);
    toast.success("Downloaded standard .cube 3D LUT file!");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400">
          <Film className="h-3.5 w-3.5" />
          Cinematography & Film Emulation
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          AI Film LUT & Color Grade Transfer Studio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Apply Kodak Portra, Hollywood Teal & Orange, or transfer the color palette from any reference movie still. Export photos and standard .cube 3D LUTs.
        </p>
      </div>

      {!originalUrl ? (
        /* Upload Hero */
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/80 bg-card/60 p-12 text-center transition hover:border-rose-500/60 hover:bg-muted/30 cursor-pointer shadow-lg"
        >
          <div className="rounded-2xl bg-rose-500/10 p-5 text-rose-400 mb-4 shadow-inner">
            <Palette className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Drop a photo to color grade
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Portraits, landscape shots, travel photos, or cinematography stills (JPG, PNG, WebP).
          </p>
          <button
            type="button"
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 transition"
          >
            <Upload className="h-4 w-4" />
            Select Photo
          </button>
          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleTargetSelect(e.target.files[0])}
          />
        </div>
      ) : (
        /* Interactive Grading Studio */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Interactive Before/After Split Viewer */}
          <div className="space-y-4 lg:col-span-8">
            <div className="overflow-hidden rounded-3xl border border-border/80 bg-black shadow-2xl p-2">
              {gradedUrl ? (
                <ImageCompareSlider
                  beforeImage={originalUrl}
                  afterImage={gradedUrl}
                  beforeLabel="Original Photo"
                  afterLabel={
                    mode === "preset"
                      ? FILM_PRESETS[selectedPreset].name
                      : "Color-Matched Reference"
                  }
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                  Processing color grade...
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setOriginalUrl(null);
                  setGradedUrl(null);
                  setTargetFile(null);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Change Photo
              </button>

              <div className="flex items-center gap-2">
                {mode === "preset" && (
                  <button
                    type="button"
                    onClick={handleDownloadLut}
                    className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
                    title="Export standard .cube 3D LUT for Premiere, DaVinci, Final Cut"
                  >
                    <FileCode className="h-3.5 w-3.5 text-rose-400" />
                    Download .CUBE LUT
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadPhoto}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-rose-500 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Graded Photo
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: LUT Selector & Palette Matcher */}
          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
              {/* Mode Tabs */}
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1 border border-border/60">
                <button
                  type="button"
                  onClick={() => setMode("preset")}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                    mode === "preset"
                      ? "bg-background text-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Film LUT Presets
                </button>
                <button
                  type="button"
                  onClick={() => setMode("reference")}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                    mode === "reference"
                      ? "bg-background text-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Match Reference
                </button>
              </div>

              {/* Mode 1: Film Presets */}
              {mode === "preset" ? (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {(Object.keys(FILM_PRESETS) as FilmLutPreset[]).map((key) => {
                    const preset = FILM_PRESETS[key];
                    const active = selectedPreset === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedPreset(key)}
                        className={`w-full rounded-2xl border p-3.5 text-left transition ${
                          active
                            ? "border-rose-500 bg-rose-500/10 text-foreground ring-1 ring-rose-500/40"
                            : "border-border/60 bg-background/50 hover:bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-foreground">
                            {preset.name}
                          </span>
                          {active && <Check className="h-3.5 w-3.5 text-rose-400" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {preset.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Mode 2: Match Reference Photo */
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Upload any movie screenshot or inspiring artwork. The engine will extract the color distribution and apply it onto your photo.
                  </p>

                  <div
                    onClick={() => refInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-background/60 p-4 text-center cursor-pointer hover:border-rose-500/60 transition"
                  >
                    {refUrl ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded-xl">
                        <img
                          src={refUrl}
                          alt="Reference"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="py-4">
                        <Palette className="h-6 w-6 text-rose-400 mx-auto mb-2" />
                        <span className="text-xs font-semibold text-foreground">
                          Select Reference Image
                        </span>
                      </div>
                    )}
                    <input
                      id={refInputId}
                      ref={refInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleRefSelect(e.target.files[0])}
                    />
                  </div>
                </div>
              )}

              {/* Intensity Slider */}
              <div className="pt-3 border-t border-border/40 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">Grade Intensity</span>
                  <span className="font-mono text-foreground font-bold">{intensity}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={intensity}
                  onChange={(e) => setIntensity(parseInt(e.target.value, 10))}
                  className="w-full accent-rose-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
