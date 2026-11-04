"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Eraser,
  Download,
  Share2,
  Upload,
  RotateCcw,
  Sliders,
  Check,
  Split,
  Eye,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import {
  detectWatermarkRegions,
  removeWatermark,
  WatermarkDetectRegion,
} from "@/lib/watermark-remover-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function WatermarkRemoverTool() {
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState<string>("photo.jpg");
  const [brushSize, setBrushSize] = useState<number>(30);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [detectedRegions, setDetectedRegions] = useState<WatermarkDetectRegion[]>([]);
  const [splitPos, setSplitPos] = useState<number>(50);
  const [hasInpainted, setHasInpainted] = useState<boolean>(false);

  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "watermark-remover",
    { brushSize, splitPos },
    (saved) => {
      if (saved.brushSize) setBrushSize(saved.brushSize as number);
      toast.success("Draft watermark settings restored!");
    }
  );

  // Load Source Image
  const handleImageUpload = (file: File) => {
    setFileName(file.name);
    setHasInpainted(false);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSourceImg(img);
      initCanvases(img);
      toast.success("Photo loaded! Paint over watermark or use AI Auto-Detect.");
    };
    img.src = url;
  };

  const initCanvases = (img: HTMLImageElement) => {
    const main = mainCanvasRef.current;
    const mask = maskCanvasRef.current;
    const orig = originalCanvasRef.current;
    if (!main || !mask || !orig) return;

    main.width = img.naturalWidth;
    main.height = img.naturalHeight;
    mask.width = img.naturalWidth;
    mask.height = img.naturalHeight;
    orig.width = img.naturalWidth;
    orig.height = img.naturalHeight;

    const mCtx = main.getContext("2d");
    const oCtx = orig.getContext("2d");
    const maskCtx = mask.getContext("2d");

    if (mCtx && oCtx && maskCtx) {
      mCtx.drawImage(img, 0, 0);
      oCtx.drawImage(img, 0, 0);
      maskCtx.clearRect(0, 0, mask.width, mask.height);
    }
  };

  // AI Auto-Detect Watermark
  const handleAiAutoDetect = () => {
    const orig = originalCanvasRef.current;
    const mask = maskCanvasRef.current;
    if (!orig || !mask) return;

    const oCtx = orig.getContext("2d");
    const maskCtx = mask.getContext("2d");
    if (!oCtx || !maskCtx) return;

    const imgData = oCtx.getImageData(0, 0, orig.width, orig.height);
    const regions = detectWatermarkRegions(imgData);
    setDetectedRegions(regions);

    // Auto-paint detected primary region onto mask
    if (regions.length > 0) {
      const r = regions[0];
      maskCtx.fillStyle = "rgba(239, 68, 68, 0.85)";
      maskCtx.beginPath();
      maskCtx.roundRect(r.x, r.y, r.width, r.height, 12);
      maskCtx.fill();
      toast.success(`AI identified ${regions.length} likely watermark zone${regions.length > 1 ? "s" : ""}!`);
    } else {
      toast.info("No prominent high-contrast stamp detected. Paint directly over the watermark with the brush.");
    }
  };

  // Manual Brush Mask Painting
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    drawMaskAt(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    drawMaskAt(e);
  };

  const handlePointerUp = () => setIsDrawing(false);

  const drawMaskAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const rect = mask.getBoundingClientRect();
    const scaleX = mask.width / rect.width;
    const scaleY = mask.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const ctx = mask.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
    ctx.beginPath();
    ctx.arc(x, y, brushSize * scaleX, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleClearMask = () => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, mask.width, mask.height);
    toast.info("Mask cleared.");
  };

  // Execute Watermark Removal Inpainting
  const handleRemoveWatermark = async () => {
    const main = mainCanvasRef.current;
    const mask = maskCanvasRef.current;
    if (!main || !mask) return;

    setIsProcessing(true);
    toast.info("Synthesizing background textures and removing watermark...");

    try {
      const inpaintedData = await removeWatermark(main, mask);
      const ctx = main.getContext("2d");
      if (ctx) {
        ctx.putImageData(inpaintedData, 0, 0);
        // Clear mask
        handleClearMask();
        setHasInpainted(true);
        toast.success("Watermark removed cleanly!");
      }
    } catch (err) {
      toast.error("Inpainting failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Clean Photo
  const handleDownload = () => {
    const main = mainCanvasRef.current;
    if (!main) return;
    main.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const base = fileName.replace(/\.[^/.]+$/, "");
        link.download = `${base}_clean.png`;
        link.click();
        toast.success("Downloaded clean watermark-free photo!");
      }
    }, "image/png");
  };

  // Share
  const handleShare = () => {
    const main = mainCanvasRef.current;
    if (!main) return;
    main.toBlob(async (blob) => {
      if (blob) {
        await shareBlob(blob, "clean_photo.png", {
          title: "Clean Photo",
          text: "Watermark removed with PicTools",
        });
      }
    });
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
            <Wand2 className="h-6 w-6 text-indigo-500" />
            Smart AI Watermark Remover &amp; Clean Inpainter
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Remove logos, date stamps, and watermarks with AI auto-detection and high-speed texture inpainting directly in your browser.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!sourceImg}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition shadow-md hover:shadow-indigo-500/20"
          >
            <Download className="h-4 w-4" />
            Download Clean Photo
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={!sourceImg}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Canvas & Painting (7 Cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-6 shadow-inner flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800 mb-4 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">
              {hasInpainted ? "Clean Inpainted Result" : "Paint Red Mask Over Watermark"}
            </span>
            <span className="font-mono text-indigo-400">Brush: {brushSize}px</span>
          </div>

          {!sourceImg ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-zinc-800 hover:border-indigo-500/60 rounded-2xl p-16 text-center cursor-pointer transition bg-zinc-900/40 hover:bg-zinc-900/80 group my-8"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                }}
              />
              <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition mb-4">
                <Upload className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">Upload Photo with Watermark</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                Erase stock stamps, date numbers, camera logos, or unwanted text.
              </p>
            </div>
          ) : (
            <div className="w-full space-y-4">
              {/* Overlaid Canvases */}
              <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl flex items-center justify-center select-none">
                <canvas ref={mainCanvasRef} className="max-h-[500px] w-auto block object-contain" />
                <canvas
                  ref={maskCanvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                />
                <canvas ref={originalCanvasRef} className="hidden" />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAiAutoDetect}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold text-xs shadow-sm hover:bg-indigo-100 transition"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Auto-Detect Watermark
                  </button>
                  <button
                    type="button"
                    onClick={handleClearMask}
                    className="px-3 py-2 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-semibold hover:bg-zinc-800 transition"
                  >
                    Clear Mask
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveWatermark}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs shadow-md transition"
                >
                  <Eraser className="h-4 w-4" />
                  {isProcessing ? "Inpainting..." : "Remove Watermark"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Brush & AI Tools (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Brush Controls */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Precision Masking Brush
            </h2>

            <div>
              <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                <span>Brush Radius</span>
                <span className="font-mono text-indigo-600 font-bold">{brushSize}px</span>
              </div>
              <input
                type="range"
                min={8}
                max={80}
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600"
              />
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Drag your cursor directly over logos, dates, or stamps. A translucent red mask marks the pixels that will be seamlessly reconstructed from surrounding background textures.
            </p>
          </div>

          {/* AI Detection Info */}
          {detectedRegions.length > 0 && (
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 shadow-sm space-y-3">
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                AI Detected Watermark Zones
              </span>
              <div className="space-y-2">
                {detectedRegions.map((reg, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{reg.label}</span>
                    <span className="font-mono text-emerald-600 text-[11px]">
                      {Math.round(reg.confidence * 100)}% match
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
