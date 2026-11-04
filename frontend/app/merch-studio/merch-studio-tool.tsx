"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ShoppingBag,
  Download,
  Share2,
  Sparkles,
  Upload,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  Tag,
  Palette,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  MerchStudioState,
  INITIAL_MERCH_STATE,
  MERCH_ITEMS,
  MerchItemType,
  renderMerchCanvas,
  generateAiEcomListing,
} from "@/lib/merch-studio-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function MerchStudioTool() {
  const [state, setState] = useState<MerchStudioState>(INITIAL_MERCH_STATE);
  const [designTheme, setDesignTheme] = useState<string>("Retro Vintage Aesthetic");
  const [aiListing, setAiListing] = useState<ReturnType<typeof generateAiEcomListing> | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "merch-studio",
    state,
    (saved) => {
      setState(saved);
      toast.success("Merch studio draft restored!");
    }
  );

  // Render canvas
  const updateCanvas = useCallback(async () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const full = await renderMerchCanvas(state, 0.45);
      canvas.width = full.width;
      canvas.height = full.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(full, 0, 0);
      }
    } catch (err) {
      console.error("Merch render failed:", err);
    }
  }, [state]);

  useEffect(() => {
    updateCanvas();
  }, [updateCanvas]);

  // Upload custom design/artwork
  const handleGraphicUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        setState((prev) => ({
          ...prev,
          graphic: {
            ...prev.graphic,
            src: e.target?.result as string,
          },
        }));
        toast.success("Artwork loaded onto apparel mockup!");
      }
    };
    reader.readAsDataURL(file);
  };

  // Generate AI E-Commerce Listing
  const handleGenerateListing = () => {
    const listing = generateAiEcomListing(state, designTheme);
    setAiListing(listing);
    toast.success("AI generated SEO Title, Description, and 13 Etsy Tags!");
  };

  // Copy helper
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Copied ${field} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Download high-resolution 2400x2400 commercial image
  const handleDownload = async () => {
    setIsExporting(true);
    try {
      toast.info("Rendering 2400×2400 e-commerce ready mockup...");
      const full = await renderMerchCanvas(state, 2.0);
      full.toBlob((blob) => {
        if (blob) {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${state.itemType}_commercial_mockup.png`;
          link.click();
          toast.success("Downloaded commercial 300 DPI mockup!");
        }
      }, "image/png");
    } finally {
      setIsExporting(false);
    }
  };

  // Share
  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (blob) {
        await shareBlob(blob, "merch_mockup.png", {
          title: "Apparel Merch Mockup",
          text: `Rendered with PicTools Merch Studio (${MERCH_ITEMS[state.itemType].name})`,
        });
      }
    });
  };

  const currentItem = MERCH_ITEMS[state.itemType];

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
            <ShoppingBag className="h-6 w-6 text-indigo-500" />
            Print-on-Demand &amp; Merch Mockup Studio
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Realistic apparel &amp; merch mockups with fabric fold displacement, textile color pickers, and AI E-Commerce listing generator for Etsy &amp; Shopify.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md hover:shadow-indigo-500/20"
          >
            <Download className="h-4 w-4" />
            Download 300 DPI Mockup
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
            title="Share mockup"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Canvas Preview (6 Cols) */}
        <div className="lg:col-span-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-6 shadow-inner flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800 mb-4 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">{currentItem.name}</span>
            <span className="font-mono text-indigo-400">{currentItem.category}</span>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-900/50">
            <canvas ref={canvasRef} className="block max-h-[500px] w-auto mx-auto" />
          </div>

          {/* Upload Design Button */}
          <div className="w-full mt-5 pt-3 border-t border-zinc-800 flex items-center justify-between gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleGraphicUpload(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 text-xs font-semibold shadow-md transition"
            >
              <Upload className="h-4 w-4" />
              {state.graphic.src ? "Replace Artwork" : "Upload Design / Logo"}
            </button>
          </div>
        </div>

        {/* Right Column: Apparel & AI Listing Controls (6 Cols) */}
        <div className="lg:col-span-6 space-y-5">
          {/* Item Selector */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Select Merch Product
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(Object.keys(MERCH_ITEMS) as MerchItemType[]).map((mId) => {
                const item = MERCH_ITEMS[mId];
                const isSelected = state.itemType === mId;
                return (
                  <button
                    key={mId}
                    type="button"
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        itemType: mId,
                        fabricColor: item.defaultColor,
                      }))
                    }
                    className={`p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 dark:border-indigo-500"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <p className="font-bold text-xs truncate">{item.name}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{item.category}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fabric Color Swatches */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Garment / Fabric Color
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {currentItem.popularColors.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, fabricColor: col }))}
                  className={`w-8 h-8 rounded-full border-2 transition ${
                    state.fabricColor === col ? "border-indigo-600 scale-110 shadow-md" : "border-zinc-300 dark:border-zinc-700"
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
              <input
                type="color"
                value={state.fabricColor}
                onChange={(e) => setState((s) => ({ ...s, fabricColor: e.target.value }))}
                className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 cursor-pointer p-0"
                title="Custom Hex Color"
              />
            </div>
          </div>

          {/* Artwork Transform Controls */}
          {state.graphic.src && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Artwork Placement &amp; Blend
              </h2>

              <div className="grid grid-cols-2 gap-3">
                {/* Scale */}
                <div>
                  <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                    <span>Print Scale</span>
                    <span className="font-mono text-indigo-600">{state.graphic.scalePercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={120}
                    value={state.graphic.scalePercent}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setState((s) => ({ ...s, graphic: { ...s.graphic, scalePercent: val } }));
                    }}
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* Y-Position */}
                <div>
                  <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                    <span>Vertical Position</span>
                    <span className="font-mono text-indigo-600">{state.graphic.yOffset}%</span>
                  </div>
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    value={state.graphic.yOffset}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setState((s) => ({ ...s, graphic: { ...s.graphic, yOffset: val } }));
                    }}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>

              {/* Blend Mode */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-zinc-700 dark:text-zinc-300">Fabric Shading Blend</span>
                <select
                  value={state.graphic.blendMode}
                  onChange={(e) => {
                    const mode = e.target.value as "multiply" | "source-over" | "soft-light";
                    setState((s) => ({ ...s, graphic: { ...s.graphic, blendMode: mode } }));
                  }}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-xs"
                >
                  <option value="multiply">Multiply (Ink Absorption)</option>
                  <option value="source-over">Standard Direct Print</option>
                  <option value="soft-light">Vintage Washed Print</option>
                </select>
              </div>
            </div>
          )}

          {/* AI E-Commerce Listing Generator */}
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                AI E-Commerce Listing Assistant
              </span>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Generate ready-to-paste Etsy &amp; Shopify SEO titles, product descriptions, bullet points, and 13 search tags.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={designTheme}
                onChange={(e) => setDesignTheme(e.target.value)}
                placeholder="e.g. Japanese Cyberpunk Koi Graphic"
                className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={handleGenerateListing}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
              >
                Generate
              </button>
            </div>

            {aiListing && (
              <div className="space-y-3 pt-3 border-t border-indigo-200 dark:border-indigo-900/50">
                {/* Title */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-800 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">SEO Product Title</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(aiListing.title, "Title")}
                      className="text-indigo-600 hover:text-indigo-500 text-[11px] font-semibold flex items-center gap-1"
                    >
                      {copiedField === "Title" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy
                    </button>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">{aiListing.title}</p>
                </div>

                {/* 13 Tags */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">13 Etsy Tags</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(aiListing.etsyTags.join(", "), "Tags")}
                      className="text-indigo-600 hover:text-indigo-500 text-[11px] font-semibold flex items-center gap-1"
                    >
                      {copiedField === "Tags" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {aiListing.etsyTags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-[10px] text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
