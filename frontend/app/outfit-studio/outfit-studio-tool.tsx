"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Download,
  Share2,
  Upload,
  Check,
  RotateCcw,
  Sliders,
  Palette,
  Shirt,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  OutfitState,
  INITIAL_OUTFIT_STATE,
  MODEL_PRESETS,
  GARMENT_PRESETS,
  renderOutfitCanvas,
  generateAiStylingAdvice,
} from "@/lib/outfit-studio-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function OutfitStudioTool() {
  const [state, setState] = useState<OutfitState>(INITIAL_OUTFIT_STATE);
  const [aiAdvice, setAiAdvice] = useState<ReturnType<typeof generateAiStylingAdvice> | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "outfit-studio",
    state,
    (saved) => {
      setState(saved);
      toast.success("Draft outfit settings restored!");
    }
  );

  // Render canvas
  const updateCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderOutfitCanvas(canvas, state, 0.45);
  }, [state]);

  useEffect(() => {
    updateCanvas();
  }, [updateCanvas]);

  // AI Styling Advice
  const handleGenerateAiAdvice = () => {
    const g = GARMENT_PRESETS.find((x) => x.id === state.garmentId);
    const advice = generateAiStylingAdvice(g?.name || "Garment", state.garmentColor);
    setAiAdvice(advice);
    toast.success("AI generated complete outfit pairings and styling palette!");
  };

  // Download High-Res Portrait
  const handleDownload = () => {
    const offscreen = document.createElement("canvas");
    renderOutfitCanvas(offscreen, state, 2.0);
    offscreen.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "virtual_outfit_portrait.png";
        link.click();
        toast.success("Downloaded high-resolution fashion portrait!");
      }
    }, "image/png");
  };

  // Share
  const handleShare = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (blob) {
        await shareBlob(blob, "outfit_preview.png", {
          title: "Virtual Outfit Preview",
          text: "Created with PicTools Virtual Fitting Studio",
        });
      }
    });
  };

  const currentGarment = GARMENT_PRESETS.find((g) => g.id === state.garmentId) || GARMENT_PRESETS[0];

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
            <Shirt className="h-6 w-6 text-indigo-500" />
            AI Virtual Outfit Swapper &amp; Fashion Fitting Studio
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Fit apparel onto diverse fashion models in real time, customize fabrics, and receive AI styling recommendations for footwear and accessories.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md hover:shadow-indigo-500/20"
          >
            <Download className="h-4 w-4" />
            Download Portrait
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Fitting Room Canvas (6 Cols) */}
        <div className="lg:col-span-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-6 shadow-inner flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800 mb-4 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">{currentGarment.name}</span>
            <span className="font-mono text-indigo-400">Fitting Room</span>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-900 select-none">
            <canvas ref={canvasRef} className="block max-h-[520px] w-auto mx-auto" />
          </div>
        </div>

        {/* Right Column: Garment, Color & AI Styling (6 Cols) */}
        <div className="lg:col-span-6 space-y-5">
          {/* Garment Selector */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Select Garment
            </label>

            <div className="grid grid-cols-2 gap-2">
              {GARMENT_PRESETS.map((g) => {
                const isSelected = state.garmentId === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        garmentId: g.id,
                        garmentColor: g.defaultColor,
                      }))
                    }
                    className={`p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 dark:border-indigo-500"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <p className="font-bold text-xs truncate">{g.name}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{g.category}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Switcher */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Garment Colorway
            </label>

            <div className="flex items-center gap-2">
              {["#f5f5f4", "#18181b", "#1e3a8a", "#b45309", "#831843", "#14532d"].map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, garmentColor: col }))}
                  className={`w-7 h-7 rounded-full border-2 transition ${
                    state.garmentColor === col ? "border-indigo-600 scale-110 shadow-md" : "border-zinc-300 dark:border-zinc-700"
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
              <input
                type="color"
                value={state.garmentColor}
                onChange={(e) => setState((s) => ({ ...s, garmentColor: e.target.value }))}
                className="w-7 h-7 rounded-full cursor-pointer p-0 border border-zinc-300 dark:border-zinc-700"
                title="Custom Color"
              />
            </div>
          </div>

          {/* AI Styling Assistant */}
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              AI Outfit Styling &amp; Colorway Assistant
            </span>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Receive smart recommendations for matching trousers, footwear, and coordinated palette swatches.
            </p>

            <button
              type="button"
              onClick={handleGenerateAiAdvice}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
            >
              Get AI Outfit Pairing
            </button>

            {aiAdvice && (
              <div className="space-y-2 pt-2 border-t border-indigo-200 dark:border-indigo-900/50 text-xs">
                <p className="font-semibold text-indigo-950 dark:text-indigo-200">
                  Vibe: {aiAdvice.styleVibe}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">Pants:</span> {aiAdvice.pantsPairing}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">Footwear:</span> {aiAdvice.footwear}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
