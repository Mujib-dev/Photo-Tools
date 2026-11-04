"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Images,
  Download,
  Share2,
  Plus,
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  Palette,
  Layers,
  Check,
  RotateCcw,
  Undo2,
  Redo2,
} from "lucide-react";
import { toast } from "sonner";
import { useHistory } from "@/lib/use-history";
import {
  CarouselState,
  INITIAL_CAROUSEL_STATE,
  CAROUSEL_TEMPLATES,
  CAROUSEL_FORMATS,
  CAROUSEL_GRADIENTS,
  CarouselFormat,
  renderFullPanoramaCanvas,
  slicePanorama,
  downloadCarouselZip,
  generateCarouselPdf,
  SlicedSlide,
  FloatingImage,
} from "@/lib/carousel-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function CarouselMakerTool() {
  const {
    state,
    set: setState,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<CarouselState>(INITIAL_CAROUSEL_STATE);

  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.25);
  const [renderedSlides, setRenderedSlides] = useState<SlicedSlide[]>([]);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const floatingFileInputRef = useRef<HTMLInputElement | null>(null);
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "carousel-maker",
    state,
    (saved) => {
      setState(saved);
      toast.success("Draft carousel restored!");
    }
  );

  // Re-render canvas preview
  const updatePreview = useCallback(async () => {
    try {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const full = await renderFullPanoramaCanvas(state, 0.35);
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
  }, [state]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  // Handle slide count change
  const handleSlideCountChange = (count: number) => {
    const clamped = Math.max(2, Math.min(10, count));
    setState((prev) => {
      const newSlides = [...prev.slides];
      while (newSlides.length < clamped) {
        const nextNum = newSlides.length + 1;
        newSlides.push({
          eyebrow: `0${nextNum} / TIP`,
          title: `Key Insight #${nextNum}`,
          body: "Break down your core principle or tactical recommendation here.",
        });
      }
      return {
        ...prev,
        slideCount: clamped,
        slides: newSlides.slice(0, clamped),
      };
    });
    if (activeSlideIdx >= clamped) {
      setActiveSlideIdx(clamped - 1);
    }
  };

  // Add floating graphic/photo across seams
  const handleFloatingImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        const newImg: FloatingImage = {
          id: Math.random().toString(36).slice(2, 9),
          src: e.target.result,
          xPercent: 30, // Crosses slide 1 & 2 seam
          yPercent: 55,
          scalePercent: 35,
          rotation: 0,
          opacity: 1,
          borderRadius: 24,
          shadow: true,
        };
        setState((prev) => ({
          ...prev,
          floatingImages: [...prev.floatingImages, newImg],
        }));
        toast.success("Image placed! Position it across slide seams for the panoramic effect.");
      }
    };
    reader.readAsDataURL(file);
  };

  // Add background image
  const handleBgImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        setState((prev) => ({
          ...prev,
          bgImageUrl: e.target?.result as string,
        }));
        toast.success("Continuous background image loaded!");
      }
    };
    reader.readAsDataURL(file);
  };

  // Export all individual slides in ZIP
  const handleExportZip = async () => {
    setIsExporting(true);
    try {
      toast.info("Generating high-resolution slides...");
      const slides = await slicePanorama(state);
      setRenderedSlides(slides);
      const zipBlob = await downloadCarouselZip(slides, "panoramic_carousel");

      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = "panoramic_carousel_slides.zip";
      link.click();
      toast.success(`Exported ${slides.length} slides in high-res ZIP!`);
    } catch (err) {
      toast.error("Failed to generate ZIP export: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // Export LinkedIn Multi-page PDF
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      toast.info("Building vector document PDF for LinkedIn...");
      const slides = await slicePanorama(state);
      const pdfBlob = await generateCarouselPdf(slides, state);

      const link = document.createElement("a");
      link.href = URL.createObjectURL(pdfBlob);
      link.download = "linkedin_carousel_document.pdf";
      link.click();
      toast.success("LinkedIn carousel document PDF exported!");
    } catch (err) {
      toast.error("Failed to generate PDF: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // Share Slide 1 or ZIP
  const handleShare = async () => {
    try {
      const slides = await slicePanorama(state);
      if (slides.length > 0) {
        await shareBlob(slides[0].blob, "carousel_slide_01.png", {
          title: "Panoramic Carousel Preview",
          text: state.slides[0]?.title || "Seamless panoramic carousel",
        });
      }
    } catch (err) {
      toast.error("Sharing canceled or unavailable");
    }
  };

  const currentSlide = state.slides[activeSlideIdx] || {
    eyebrow: "",
    title: "",
    body: "",
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
            <Images className="h-6 w-6 text-indigo-500" />
            Seamless Panoramic Carousel Maker
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Create seamless continuous multi-slide carousels for Instagram, LinkedIn &amp; Twitter where images and gradients cross seams.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-xs font-bold">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 transition hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-35"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 transition hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-35"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
              Redo
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition shadow-sm"
          >
            <FileText className="h-4 w-4" />
            LinkedIn PDF
          </button>
          <button
            type="button"
            onClick={handleExportZip}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md hover:shadow-indigo-500/20"
          >
            <Download className="h-4 w-4" />
            Download All (ZIP)
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
            title="Share slide preview"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 1-Click Carousel Topic Templates */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-1">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            1-Click Viral Carousel Templates (LinkedIn & Instagram)
          </span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Pre-written multi-slide hooks, frameworks & color schemes</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {CAROUSEL_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => {
                setState((prev) => ({ ...prev, ...tmpl.state }));
                setActiveSlideIdx(0);
                toast.success(`Loaded "${tmpl.name}" carousel template!`);
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
                {tmpl.state.slides?.[0]?.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Panorama Viewport with Horizontal Scroll & Seam Indicators */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-6 shadow-inner">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4 text-xs text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-zinc-200">Continuous Viewport</span>
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {state.slideCount} Connected Slides • {CAROUSEL_FORMATS[state.format].ratio}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>Scroll horizontally to view seam flow</span>
            <ChevronRight className="h-4 w-4 text-zinc-500 animate-pulse" />
          </div>
        </div>

        {/* Scrollable panoramic wrapper */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto pb-4 pt-1 rounded-xl scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900/50"
        >
          <div className="relative inline-block border border-zinc-800 rounded-lg overflow-hidden shadow-2xl">
            <canvas ref={previewCanvasRef} className="block max-h-[460px] w-auto" />

            {/* Overlay grid indicating slide boundaries */}
            <div className="absolute inset-0 pointer-events-none flex">
              {Array.from({ length: state.slideCount }).map((_, idx) => (
                <div
                  key={idx}
                  className={`flex-1 border-r border-dashed border-white/30 relative ${
                    activeSlideIdx === idx ? "bg-indigo-500/10" : ""
                  }`}
                >
                  <span className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 backdrop-blur-md text-[11px] font-mono text-white/90">
                    Slide {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Slide quick picker tabs */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-800/80 overflow-x-auto">
          {Array.from({ length: state.slideCount }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveSlideIdx(idx)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                activeSlideIdx === idx
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <span>Slide {idx + 1}</span>
              {activeSlideIdx === idx && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Editor & Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Current Slide Content (7 Cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Slide {activeSlideIdx + 1} Content
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Configure headline, eyebrow, and value points for this slide.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={activeSlideIdx === 0}
                onClick={() => setActiveSlideIdx((i) => Math.max(0, i - 1))}
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={activeSlideIdx === state.slideCount - 1}
                onClick={() => setActiveSlideIdx((i) => Math.min(state.slideCount - 1, i + 1))}
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Eyebrow / Category Tag
              </label>
              <input
                type="text"
                value={currentSlide.eyebrow}
                onChange={(e) => {
                  const val = e.target.value;
                  setState((prev) => {
                    const newSlides = [...prev.slides];
                    newSlides[activeSlideIdx] = { ...newSlides[activeSlideIdx], eyebrow: val };
                    return { ...prev, slides: newSlides };
                  });
                }}
                placeholder="e.g. 01 / FRAMEWORK"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Main Headline
              </label>
              <textarea
                rows={2}
                value={currentSlide.title}
                onChange={(e) => {
                  const val = e.target.value;
                  setState((prev) => {
                    const newSlides = [...prev.slides];
                    newSlides[activeSlideIdx] = { ...newSlides[activeSlideIdx], title: val };
                    return { ...prev, slides: newSlides };
                  });
                }}
                placeholder="Hook headline that pulls the reader into the content..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Body Content / Key Takeaways
              </label>
              <textarea
                rows={4}
                value={currentSlide.body}
                onChange={(e) => {
                  const val = e.target.value;
                  setState((prev) => {
                    const newSlides = [...prev.slides];
                    newSlides[activeSlideIdx] = { ...newSlides[activeSlideIdx], body: val };
                    return { ...prev, slides: newSlides };
                  });
                }}
                placeholder="Provide actionable, value-packed insights or bullet points..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Optional Pill Badge
              </label>
              <input
                type="text"
                value={currentSlide.badge || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setState((prev) => {
                    const newSlides = [...prev.slides];
                    newSlides[activeSlideIdx] = { ...newSlides[activeSlideIdx], badge: val };
                    return { ...prev, slides: newSlides };
                  });
                }}
                placeholder="e.g. 3.1X ENGAGEMENT or PRO TIP"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Global Settings, Seamless Items & Theme (5 Cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            Global Layout &amp; Theme
          </h2>

          {/* Aspect Ratio & Format */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Carousel Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CAROUSEL_FORMATS) as CarouselFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, format: fmt }))}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-semibold text-left transition ${
                    state.format === fmt
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-500"
                      : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <p className="font-bold">{CAROUSEL_FORMATS[fmt].label}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {CAROUSEL_FORMATS[fmt].width} × {CAROUSEL_FORMATS[fmt].height} px
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Slide Count Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              <span>Total Slides</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {state.slideCount} Slides
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={10}
              step={1}
              value={state.slideCount}
              onChange={(e) => handleSlideCountChange(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Seamless Panorama Gradients */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Connected Background Gradient
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CAROUSEL_GRADIENTS.map((g, idx) => (
                <button
                  key={g.name}
                  type="button"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      bgType: "gradient",
                      selectedGradientIndex: idx,
                    }))
                  }
                  className={`h-10 rounded-xl border relative transition overflow-hidden ${
                    state.bgType === "gradient" && state.selectedGradientIndex === idx
                      ? "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-zinc-900 border-white"
                      : "border-zinc-300 dark:border-zinc-700 hover:opacity-90"
                  }`}
                  style={{
                    background: `linear-gradient(90deg, ${g.from}, ${g.via || g.to}, ${g.to})`,
                  }}
                  title={g.name}
                />
              ))}
            </div>
          </div>

          {/* Floating Seam Graphic Item Adder */}
          <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Seam-Crossing Graphic Element
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Place a photo or graphic that straddles the boundary between slides to create an irresistible visual swipe urge.
            </p>
            <input
              ref={floatingFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFloatingImageUpload(f);
              }}
            />
            <button
              type="button"
              onClick={() => floatingFileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 text-xs font-semibold shadow-sm transition"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Seam Graphic
            </button>

            {/* List existing floating images if any */}
            {state.floatingImages.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-indigo-200 dark:border-indigo-900/50">
                {state.floatingImages.map((imgItem, idx) => (
                  <div
                    key={imgItem.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300"
                  >
                    <span>Item #{idx + 1} ({Math.round(imgItem.xPercent)}% across)</span>
                    <button
                      type="button"
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          floatingImages: s.floatingImages.filter((x) => x.id !== imgItem.id),
                        }))
                      }
                      className="text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Branding & Footer Options */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Author / Handle Watermark
              </label>
              <input
                type="text"
                value={state.authorHandle}
                onChange={(e) => setState((s) => ({ ...s, authorHandle: e.target.value }))}
                placeholder="@yourhandle"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-700 dark:text-zinc-300">Show Slide Numbers (1/5)</span>
              <input
                type="checkbox"
                checked={state.showSlideNumbers}
                onChange={(e) => setState((s) => ({ ...s, showSlideNumbers: e.target.checked }))}
                className="rounded accent-indigo-600"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-700 dark:text-zinc-300">Show Swipe Indicator</span>
              <input
                type="checkbox"
                checked={state.showSwipeHint}
                onChange={(e) => setState((s) => ({ ...s, showSwipeHint: e.target.checked }))}
                className="rounded accent-indigo-600"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
