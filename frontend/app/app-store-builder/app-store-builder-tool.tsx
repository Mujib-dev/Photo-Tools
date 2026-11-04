"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Smartphone,
  Tablet,
  Download,
  Share2,
  Plus,
  Trash2,
  Sparkles,
  Upload,
  Check,
  RotateCcw,
  Palette,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  AppStoreConfig,
  INITIAL_APP_STORE_CONFIG,
  APP_STORE_TEMPLATES,
  STORE_FORMATS,
  StoreDeviceFormat,
  DeviceStyle,
  DevicePosition,
  renderStoreSlideCanvas,
  packageStoreScreenshots,
  exportStoreZip,
  GeneratedStoreSlide,
} from "@/lib/app-store-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function AppStoreBuilderTool() {
  const [config, setConfig] = useState<AppStoreConfig>(INITIAL_APP_STORE_CONFIG);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [renderedSlides, setRenderedSlides] = useState<GeneratedStoreSlide[]>([]);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenInputRef = useRef<HTMLInputElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "app-store-builder",
    config,
    (saved) => {
      setConfig(saved);
      toast.success("Draft app store screenshots restored!");
    }
  );

  // Live preview update
  const updatePreview = useCallback(async () => {
    try {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const full = await renderStoreSlideCanvas(config, activeSlideIdx, 0.28);
      canvas.width = full.width;
      canvas.height = full.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(full, 0, 0);
      }
    } catch (err) {
      console.error("Preview render failed:", err);
    }
  }, [config, activeSlideIdx]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  // Upload screenshot for active slide
  const handleScreenUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        setConfig((prev) => {
          const nextSlides = [...prev.slides];
          nextSlides[activeSlideIdx] = {
            ...nextSlides[activeSlideIdx],
            screenDataUrl: e.target?.result as string,
          };
          return { ...prev, slides: nextSlides };
        });
        toast.success(`Screen loaded into Slide #${activeSlideIdx + 1}!`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Add new slide
  const handleAddSlide = () => {
    if (config.slides.length >= 8) {
      toast.error("App Store allows up to 8-10 screenshots per localization.");
      return;
    }
    const nextNum = config.slides.length + 1;
    setConfig((prev) => ({
      ...prev,
      slides: [
        ...prev.slides,
        {
          id: `slide-${Date.now()}`,
          headline: `Highlight Feature #${nextNum}`,
          subheadline: "Explain how your app saves time and delight users.",
          badgeText: "INSTANT SETUP",
          screenDataUrl: null,
        },
      ],
    }));
    setActiveSlideIdx(config.slides.length);
    toast.success("Added new screenshot slide!");
  };

  // Remove slide
  const handleRemoveSlide = (idx: number) => {
    if (config.slides.length <= 1) {
      toast.error("You need at least 1 screenshot slide.");
      return;
    }
    setConfig((prev) => ({
      ...prev,
      slides: prev.slides.filter((_, i) => i !== idx),
    }));
    if (activeSlideIdx >= idx && activeSlideIdx > 0) {
      setActiveSlideIdx(activeSlideIdx - 1);
    }
  };

  // Batch Export ZIP
  const handleExportZip = async () => {
    setIsExporting(true);
    try {
      toast.info("Generating high-resolution official store screenshots...");
      const slides = await packageStoreScreenshots(config);
      setRenderedSlides(slides);
      const zipBlob = await exportStoreZip(slides);

      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      const meta = STORE_FORMATS[config.format];
      link.download = `${meta.store}_store_screenshots_${meta.id}.zip`;
      link.click();
      toast.success(`Exported ${slides.length} official screenshots in ZIP!`);
    } catch (err) {
      toast.error("Failed to generate ZIP: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // Share current slide
  const handleShare = async () => {
    try {
      const canvas = await renderStoreSlideCanvas(config, activeSlideIdx, 1.0);
      canvas.toBlob(async (blob) => {
        if (blob) {
          await shareBlob(blob, `screenshot_slide_${activeSlideIdx + 1}.png`, {
            title: config.slides[activeSlideIdx]?.headline || "App Store Screenshot",
            text: config.slides[activeSlideIdx]?.subheadline || "Built with PicTools App Store Builder",
          });
        }
      });
    } catch {
      toast.error("Sharing canceled or unavailable");
    }
  };

  const currentSlide = config.slides[activeSlideIdx] || {
    headline: "",
    subheadline: "",
    badgeText: "",
    screenDataUrl: null,
  };

  return (
    <div className="space-y-6">
      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      {/* Header controls & stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2.5">
            <Smartphone className="h-6 w-6 text-indigo-500" />
            App Store &amp; Google Play Screenshot Packager
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Generate pixel-perfect Apple App Store &amp; Google Play promotional screenshots with 3D device bezels and panoramic gradients.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportZip}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md hover:shadow-indigo-500/20"
          >
            <Download className="h-4 w-4" />
            Export Store ZIP
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
            title="Share preview"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 1-Click App Store Presets */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-1">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            1-Click App Store Templates (Fintech, Health, AI &amp; Wellness)
          </span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Pre-written marketing headlines, subheadings &amp; continuous gradients</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {APP_STORE_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => {
                setConfig((prev) => ({ ...prev, ...tmpl.config }));
                setActiveSlideIdx(0);
                toast.success(`Loaded "${tmpl.name}" app store template!`);
              }}
              className="group flex flex-col items-start rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-2.5 text-left transition hover:border-indigo-500/80 hover:bg-indigo-500/5 hover:shadow-sm"
            >
              <span className="mb-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition">
                {tmpl.badge}
              </span>
              <span className="line-clamp-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {tmpl.name}
              </span>
              <span className="mt-1 line-clamp-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                {tmpl.config.slides?.[0]?.headline}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Canvas Preview & Slide Selector (5 Cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-6 shadow-inner flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800 mb-4 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">
              Slide {activeSlideIdx + 1} of {config.slides.length}
            </span>
            <span className="font-mono text-zinc-400">
              {STORE_FORMATS[config.format].aspectDesc}
            </span>
          </div>

          {/* Device canvas render */}
          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-900/50">
            <canvas ref={previewCanvasRef} className="block max-h-[520px] w-auto mx-auto" />
          </div>

          {/* Slide Deck Tabs */}
          <div className="w-full flex items-center gap-2 mt-5 pt-3 border-t border-zinc-800 overflow-x-auto">
            {config.slides.map((_, idx) => (
              <div key={idx} className="relative group">
                <button
                  type="button"
                  onClick={() => setActiveSlideIdx(idx)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                    activeSlideIdx === idx
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  <span>#{idx + 1}</span>
                  {activeSlideIdx === idx && <Check className="h-3 w-3" />}
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddSlide}
              className="p-2 rounded-xl border border-dashed border-zinc-700 hover:border-indigo-500 text-zinc-400 hover:text-indigo-400 transition"
              title="Add slide"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right Column: Slide Editor & Device Customization (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Target Store Format Picker */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Target Device &amp; Store Resolution
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(Object.keys(STORE_FORMATS) as StoreDeviceFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      format: fmt,
                      deviceStyle: fmt === "ipad-129" ? "ipad-pro" : fmt === "android-phone" ? "android-flagship" : "iphone-titanium",
                    }))
                  }
                  className={`p-3 rounded-xl border text-left transition ${
                    config.format === fmt
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 dark:border-indigo-500"
                      : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <p className="font-bold text-xs">{STORE_FORMATS[fmt].name}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{STORE_FORMATS[fmt].aspectDesc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Active Slide Copy & Screen Uploader */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Slide #{activeSlideIdx + 1} Content &amp; Screenshot
              </h2>
              <button
                type="button"
                onClick={() => handleRemoveSlide(activeSlideIdx)}
                className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove Slide
              </button>
            </div>

            {/* Screen Upload Zone */}
            <div className="p-4 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 text-center space-y-2">
              <input
                ref={screenInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleScreenUpload(f);
                }}
              />
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {currentSlide.screenDataUrl
                  ? "✓ Screenshot loaded inside phone frame"
                  : "Upload app screenshot for this slide"}
              </p>
              <button
                type="button"
                onClick={() => screenInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition"
              >
                <Upload className="h-3.5 w-3.5" />
                {currentSlide.screenDataUrl ? "Replace Screenshot" : "Choose Screenshot"}
              </button>
            </div>

            {/* Headline */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Main Headline
              </label>
              <input
                type="text"
                value={currentSlide.headline}
                onChange={(e) => {
                  const val = e.target.value;
                  setConfig((prev) => {
                    const next = [...prev.slides];
                    next[activeSlideIdx] = { ...next[activeSlideIdx], headline: val };
                    return { ...prev, slides: next };
                  });
                }}
                placeholder="e.g. Track Everything In Real Time"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
              />
            </div>

            {/* Subheadline */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Subheadline
              </label>
              <input
                type="text"
                value={currentSlide.subheadline}
                onChange={(e) => {
                  const val = e.target.value;
                  setConfig((prev) => {
                    const next = [...prev.slides];
                    next[activeSlideIdx] = { ...next[activeSlideIdx], subheadline: val };
                    return { ...prev, slides: next };
                  });
                }}
                placeholder="e.g. Smart insights, zero clutter, and blazing speed."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
              />
            </div>

            {/* Badge / Rating */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Top Pill Badge / Social Proof
              </label>
              <input
                type="text"
                value={currentSlide.badgeText || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setConfig((prev) => {
                    const next = [...prev.slides];
                    next[activeSlideIdx] = { ...next[activeSlideIdx], badgeText: val };
                    return { ...prev, slides: next };
                  });
                }}
                placeholder="e.g. ★ 4.9 APP STORE RATING"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Device Styling & Layout Controls */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Device Styling &amp; Positioning
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "bottom-bleed", label: "Bottom Bleed" },
                  { id: "centered", label: "Centered" },
                  { id: "tilted-angle", label: "3D Dynamic Tilt" },
                ] as const
              ).map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, position: pos.id }))}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                    config.position === pos.id
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                      : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>

            {/* Background Style */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                Panoramic Connected Gradient
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { start: "#4f46e5", end: "#06b6d4", label: "Indigo Cyan" },
                  { start: "#7c3aed", end: "#ec4899", label: "Purple Pink" },
                  { start: "#0f172a", end: "#1e293b", label: "Deep Slate" },
                  { start: "#047857", end: "#10b981", label: "Emerald Glow" },
                ].map((g) => (
                  <button
                    key={g.label}
                    type="button"
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        bgStartColor: g.start,
                        bgEndColor: g.end,
                      }))
                    }
                    className="h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 transition overflow-hidden hover:scale-105"
                    style={{ background: `linear-gradient(135deg, ${g.start}, ${g.end})` }}
                    title={g.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
