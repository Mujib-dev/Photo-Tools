"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  Eye,
  Upload,
  Download,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Sliders,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  VisionDeficiency,
  VISION_CONDITIONS,
  applyVisionSimulation,
  getContrastRatio,
} from "@/lib/accessibility-engine";
import { ImageCompareSlider } from "@/components/image-compare-slider";

export function AccessibilityTool() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [simulatedUrl, setSimulatedUrl] = useState<string | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<VisionDeficiency>("deuteranopia");

  // Sample contrast checker
  const [fgColor, setFgColor] = useState<string>("#1e293b");
  const [bgColor, setBgColor] = useState<string>("#ffffff");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  // Load Image
  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (simulatedUrl) URL.revokeObjectURL(simulatedUrl);

    const url = URL.createObjectURL(file);
    setOriginalFile(file);
    setOriginalUrl(url);
    setSimulatedUrl(null);
    toast.success(`Loaded image: ${file.name}`);
  };

  // Run Simulation
  const runSimulation = () => {
    if (!originalUrl) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      applyVisionSimulation(ctx, canvas.width, canvas.height, selectedCondition);

      const url = canvas.toDataURL("image/jpeg", 0.94);
      setSimulatedUrl(url);
      toast.success(`Simulating ${VISION_CONDITIONS[selectedCondition].name}`);
    };
    img.src = originalUrl;
  };

  useEffect(() => {
    if (originalUrl) {
      runSimulation();
    }
  }, [originalUrl, selectedCondition]);

  // Hex to RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const clean = hex.replace("#", "");
    const bigint = parseInt(clean, 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  };

  const contrast = getContrastRatio(hexToRgb(fgColor), hexToRgb(bgColor));
  const passesAa = contrast >= 4.5;
  const passesAaa = contrast >= 7.0;
  const passesLarge = contrast >= 3.0;

  // Download Simulated Image
  const handleDownload = () => {
    if (!simulatedUrl || !originalFile) return;
    const a = document.createElement("a");
    a.href = simulatedUrl;
    a.download = `${originalFile.name.replace(/\.[^/.]+$/, "")}-${selectedCondition}.jpg`;
    a.click();
    toast.success("Downloaded accessibility simulation image!");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-400">
          <Eye className="h-3.5 w-3.5" />
          WCAG 2.2 & Global Accessibility Standards
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          AI Color Blindness & Accessibility Simulator
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Test UI mockups, marketing graphics, and photos against Deuteranopia, Protanopia, Tritanopia, and Achromatopsia. Verify WCAG contrast compliance.
        </p>
      </div>

      {!originalUrl ? (
        /* Upload Hero Dropzone */
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/80 bg-card/60 p-12 text-center transition hover:border-teal-500/60 hover:bg-muted/30 cursor-pointer shadow-lg"
        >
          <div className="rounded-2xl bg-teal-500/10 p-5 text-teal-400 mb-4 shadow-inner">
            <Eye className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Drop an image or website screenshot to test
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            UI components, infographics, posters, landing page designs, or product photography.
          </p>
          <button
            type="button"
            className="mt-6 flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-teal-500 transition"
          >
            <Upload className="h-4 w-4" />
            Select Image
          </button>
          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
          />
        </div>
      ) : (
        /* Interactive Simulator Workspace */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Split Slider Comparison */}
          <div className="space-y-4 lg:col-span-8">
            <div className="overflow-hidden rounded-3xl border border-border/80 bg-black shadow-2xl p-2">
              {simulatedUrl ? (
                <ImageCompareSlider
                  beforeImage={originalUrl}
                  afterImage={simulatedUrl}
                  beforeLabel="Normal Vision"
                  afterLabel={VISION_CONDITIONS[selectedCondition].name}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                  Running simulation...
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setOriginalUrl(null);
                  setSimulatedUrl(null);
                  setOriginalFile(null);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Change Image
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-teal-500 transition"
              >
                <Download className="h-3.5 w-3.5" />
                Download Simulation
              </button>
            </div>
          </div>

          {/* Right Column: Conditions & WCAG Scorer */}
          <div className="space-y-4 lg:col-span-4">
            {/* Condition Selector */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-3">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Select Vision Condition
              </h3>

              <div className="space-y-2">
                {(Object.keys(VISION_CONDITIONS) as VisionDeficiency[]).map((key) => {
                  const cond = VISION_CONDITIONS[key];
                  const active = selectedCondition === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedCondition(key)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        active
                          ? "border-teal-500 bg-teal-500/10 text-foreground ring-1 ring-teal-500/40"
                          : "border-border/60 bg-background/50 hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-foreground">{cond.name}</span>
                        <span className="text-[10px] text-teal-400 font-semibold">
                          {cond.affectedPopulation}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {cond.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick WCAG 2.2 Contrast Ratio Checker */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  WCAG 2.2 Contrast Scorer
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Text Color</label>
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="h-8 w-full rounded-lg cursor-pointer bg-background border border-border/60"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">
                    Background
                  </label>
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-8 w-full rounded-lg cursor-pointer bg-background border border-border/60"
                  />
                </div>
              </div>

              {/* Contrast Score Pill */}
              <div className="rounded-xl border border-border/60 bg-background/60 p-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Contrast Ratio</span>
                <span className="text-lg font-black font-mono text-foreground">
                  {contrast} : 1
                </span>
              </div>

              {/* Badges */}
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
                <div
                  className={`rounded-lg p-1.5 border ${
                    passesAa
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/40 bg-red-500/10 text-red-400"
                  }`}
                >
                  AA Normal {passesAa ? "✓" : "✗"}
                </div>
                <div
                  className={`rounded-lg p-1.5 border ${
                    passesLarge
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/40 bg-red-500/10 text-red-400"
                  }`}
                >
                  AA Large {passesLarge ? "✓" : "✗"}
                </div>
                <div
                  className={`rounded-lg p-1.5 border ${
                    passesAaa
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-neutral-500/40 bg-neutral-500/10 text-neutral-400"
                  }`}
                >
                  AAA {passesAaa ? "✓" : "✗"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
