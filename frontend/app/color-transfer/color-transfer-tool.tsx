"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Palette,
  Film,
  Download,
  Share2,
  Sparkles,
  Upload,
  Check,
  RotateCcw,
  Sliders,
  ShieldCheck,
  Split,
} from "lucide-react";
import { toast } from "sonner";
import {
  CinemaPreset,
  CINEMA_PRESETS,
  ColorTransferOptions,
  DEFAULT_TRANSFER_OPTIONS,
  LabStats,
  computeImageLabStats,
  applyReinhardTransfer,
  generateCubeLut,
} from "@/lib/color-transfer-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function ColorTransferTool() {
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [sourceName, setSourceName] = useState<string>("photo.jpg");
  const [sourceStats, setSourceStats] = useState<LabStats | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("oppenheimer");
  const [customRefStats, setCustomRefStats] = useState<LabStats | null>(null);
  const [customRefName, setCustomRefName] = useState<string | null>(null);

  const [options, setOptions] = useState<ColorTransferOptions>(DEFAULT_TRANSFER_OPTIONS);
  const [splitPos, setSplitPos] = useState<number>(50); // 0 to 100 %
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceInputRef = useRef<HTMLInputElement | null>(null);
  const refInputRef = useRef<HTMLInputElement | null>(null);

  // Draft persistence for settings
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "color-transfer",
    { selectedPresetId, options },
    (saved) => {
      if (saved.selectedPresetId) setSelectedPresetId(saved.selectedPresetId as string);
      if (saved.options) setOptions(saved.options as ColorTransferOptions);
      toast.success("Draft color grading settings restored!");
    }
  );

  // Active Reference Stats
  const activeRefStats: LabStats = customRefStats || {
    meanL: CINEMA_PRESETS.find((p) => p.id === selectedPresetId)?.meanL || 50,
    meanA: CINEMA_PRESETS.find((p) => p.id === selectedPresetId)?.meanA || 0,
    meanB: CINEMA_PRESETS.find((p) => p.id === selectedPresetId)?.meanB || 0,
    stdL: CINEMA_PRESETS.find((p) => p.id === selectedPresetId)?.stdL || 20,
    stdA: CINEMA_PRESETS.find((p) => p.id === selectedPresetId)?.stdA || 10,
    stdB: CINEMA_PRESETS.find((p) => p.id === selectedPresetId)?.stdB || 10,
  };

  // Re-render Canvas with Split Wiper
  const renderGradedCanvas = useCallback(() => {
    if (!sourceImg || !sourceStats) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = sourceImg.naturalWidth;
    canvas.height = sourceImg.naturalHeight;

    // Draw original
    ctx.drawImage(sourceImg, 0, 0);
    const origData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Apply color transfer
    const gradedData = applyReinhardTransfer(origData, activeRefStats, sourceStats, options);

    // Draw graded version
    ctx.putImageData(gradedData, 0, 0);

    // Apply Split Wiper (Draw original on left side of split line)
    const splitX = Math.round((splitPos / 100) * canvas.width);
    if (splitX > 0 && splitX < canvas.width) {
      // Create a temporary canvas for original slice
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tCtx = tempCanvas.getContext("2d");
      if (tCtx) {
        tCtx.putImageData(origData, 0, 0);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, splitX, canvas.height);
        ctx.clip();
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();

        // Draw split boundary line
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(2, Math.round(canvas.width / 400));
        ctx.beginPath();
        ctx.moveTo(splitX, 0);
        ctx.lineTo(splitX, canvas.height);
        ctx.stroke();
      }
    }
  }, [sourceImg, sourceStats, activeRefStats, options, splitPos]);

  useEffect(() => {
    renderGradedCanvas();
  }, [renderGradedCanvas]);

  // Load Source Image
  const handleSourceUpload = (file: File) => {
    setSourceName(file.name);
    setIsProcessing(true);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSourceImg(img);
      // Compute stats
      const offscreen = document.createElement("canvas");
      offscreen.width = Math.min(img.naturalWidth, 800);
      offscreen.height = Math.min(img.naturalHeight, 800);
      const oCtx = offscreen.getContext("2d");
      if (oCtx) {
        oCtx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
        const data = oCtx.getImageData(0, 0, offscreen.width, offscreen.height);
        const stats = computeImageLabStats(data);
        setSourceStats(stats);
      }
      setIsProcessing(false);
      toast.success("Source photo loaded!");
    };
    img.src = url;
  };

  // Load Custom Reference Mood Photo
  const handleRefUpload = (file: File) => {
    setCustomRefName(file.name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const offscreen = document.createElement("canvas");
      offscreen.width = Math.min(img.naturalWidth, 600);
      offscreen.height = Math.min(img.naturalHeight, 600);
      const oCtx = offscreen.getContext("2d");
      if (oCtx) {
        oCtx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
        const data = oCtx.getImageData(0, 0, offscreen.width, offscreen.height);
        const stats = computeImageLabStats(data);
        setCustomRefStats(stats);
        toast.success("Reference mood extracted from photo!");
      }
    };
    img.src = url;
  };

  // Download Graded Image (Full 100% resolution without split wiper)
  const handleDownloadImage = () => {
    if (!sourceImg || !sourceStats) return;
    const offscreen = document.createElement("canvas");
    offscreen.width = sourceImg.naturalWidth;
    offscreen.height = sourceImg.naturalHeight;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(sourceImg, 0, 0);
    const origData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
    const graded = applyReinhardTransfer(origData, activeRefStats, sourceStats, options);
    ctx.putImageData(graded, 0, 0);

    offscreen.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const baseName = sourceName.replace(/\.[^/.]+$/, "");
        link.download = `${baseName}_cinema_grade.png`;
        link.click();
        toast.success("Downloaded high-resolution graded photo!");
      }
    }, "image/png");
  };

  // Export .CUBE 3D LUT
  const handleExportLut = () => {
    if (!sourceStats) {
      toast.error("Please upload a source image first.");
      return;
    }
    const cubeString = generateCubeLut(activeRefStats, sourceStats, options, 33);
    const blob = new Blob([cubeString], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "cinematic_grade_33x33.cube";
    link.click();
    toast.success("Exported 33x33 .CUBE 3D LUT for DaVinci Resolve & Premiere!");
  };

  // Share
  const handleShare = () => {
    if (!sourceImg || !sourceStats) return;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.toBlob(async (blob) => {
        if (blob) {
          await shareBlob(blob, "cinematic_mood_photo.png", {
            title: "Cinematic Mood Grade",
            text: "Graded with PicTools Cinematic Color Match",
          });
        }
      });
    }
  };

  const activePreset = CINEMA_PRESETS.find((p) => p.id === selectedPresetId);

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
            <Film className="h-6 w-6 text-indigo-500" />
            Cinematic Color Match &amp; Mood Transfer
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Transfer the lighting, palette and atmosphere of iconic movie stills with LAB color matching, skin protection &amp; .CUBE 3D LUT export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportLut}
            disabled={!sourceImg}
            className="flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 disabled:opacity-40 transition shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export .CUBE LUT
          </button>
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={!sourceImg}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition shadow-md hover:shadow-indigo-500/20"
          >
            <Download className="h-4 w-4" />
            Download Graded Photo
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

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Canvas Preview with Split Wiper (7 Cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-6 shadow-inner flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800 mb-4 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">
              Interactive Split Wiper ({splitPos}% Original | {100 - splitPos}% Graded)
            </span>
            <span className="font-mono text-indigo-400">
              {customRefName ? `Mood: ${customRefName}` : activePreset?.name}
            </span>
          </div>

          {!sourceImg ? (
            <div
              onClick={() => sourceInputRef.current?.click()}
              className="w-full border-2 border-dashed border-zinc-800 hover:border-indigo-500/60 rounded-2xl p-16 text-center cursor-pointer transition bg-zinc-900/40 hover:bg-zinc-900/80 group my-8"
            >
              <input
                ref={sourceInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSourceUpload(f);
                }}
              />
              <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition mb-4">
                <Upload className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">Upload Target Photo</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                Select your portrait, landscape, or street photo to apply cinematic color matching.
              </p>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl flex items-center justify-center">
                <canvas ref={canvasRef} className="max-h-[500px] w-auto block object-contain" />
              </div>

              {/* Split Wiper Slider */}
              <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Split className="h-3.5 w-3.5 text-zinc-400" />
                    Original (Left)
                  </span>
                  <span>Cinematic Grade (Right)</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={splitPos}
                  onChange={(e) => setSplitPos(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Presets & Color Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Reference Mood Source (Preset vs Upload) */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                1. Reference Mood Source
              </h2>
              {customRefStats && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomRefStats(null);
                    setCustomRefName(null);
                  }}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Reset to Presets
                </button>
              )}
            </div>

            {/* Custom Movie Still Uploader */}
            <input
              ref={refInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleRefUpload(f);
              }}
            />
            <button
              type="button"
              onClick={() => refInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 p-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              <Upload className="h-3.5 w-3.5 text-indigo-500" />
              {customRefName ? `Using Reference: ${customRefName}` : "Upload Custom Reference Photo / Movie Still"}
            </button>

            {/* Iconic Movie Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                Or Select Iconic Cinema Presets:
              </label>
              <div className="grid grid-cols-1 gap-2">
                {CINEMA_PRESETS.map((p) => {
                  const isSelected = !customRefStats && selectedPresetId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setCustomRefStats(null);
                        setCustomRefName(null);
                        setSelectedPresetId(p.id);
                      }}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 dark:border-indigo-500"
                          : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">{p.name}</span>
                          <span className="text-[10px] text-zinc-400">({p.director})</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                          {p.description}
                        </p>
                      </div>

                      {/* 4-Swatch Palette Preview */}
                      <div className="flex items-center -space-x-1 pl-2">
                        {p.paletteColors.map((color, cIdx) => (
                          <div
                            key={cIdx}
                            className="w-4 h-4 rounded-full border border-white dark:border-zinc-900 shadow-sm"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Color Transfer Controls */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              2. Grading Precision &amp; Texture
            </h2>

            {/* Strength */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                <span>Transfer Strength</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                  {Math.round(options.strength * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(options.strength * 100)}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, strength: parseInt(e.target.value, 10) / 100 }))
                }
                className="w-full accent-indigo-600"
              />
            </div>

            {/* Skin Protection */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Skin Tone Preservation Mask
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    Keeps portrait faces natural while grading surroundings
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={options.protectSkin}
                onChange={(e) => setOptions((o) => ({ ...o, protectSkin: e.target.checked }))}
                className="rounded accent-indigo-600 h-4 w-4"
              />
            </div>

            {/* 35mm Film Grain */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                <span>35mm Film Grain Intensity</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                  {Math.round(options.filmGrain * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(options.filmGrain * 100)}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, filmGrain: parseInt(e.target.value, 10) / 100 }))
                }
                className="w-full accent-indigo-600"
              />
            </div>

            {/* Contrast Lift */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                <span>Contrast Shift</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                  {options.contrast > 0 ? `+${Math.round(options.contrast * 100)}` : Math.round(options.contrast * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={-30}
                max={30}
                value={Math.round(options.contrast * 100)}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, contrast: parseInt(e.target.value, 10) / 100 }))
                }
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
