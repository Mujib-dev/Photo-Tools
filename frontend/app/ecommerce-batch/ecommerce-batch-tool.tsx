"use client";

import React, { useState, useRef, useId } from "react";
import {
  ShoppingBag,
  Upload,
  Download,
  Trash2,
  Sparkles,
  CheckCircle2,
  Layers,
  Archive,
  Image as ImageIcon,
  RotateCcw,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import {
  EcommerceConfig,
  EcommerceItem,
  ECOMMERCE_PRESETS,
  MarketplacePreset,
  processEcommerceProduct,
  bundleEcommerceZip,
} from "@/lib/ecommerce-batch-engine";
import { downloadBlob } from "@/lib/screenshot";

export function EcommerceBatchTool() {
  const [items, setItems] = useState<EcommerceItem[]>([]);
  const [preset, setPreset] = useState<MarketplacePreset>("amazon");
  const [customConfig, setCustomConfig] = useState<EcommerceConfig>(ECOMMERCE_PRESETS.amazon);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  // Handle Preset Change
  const handlePresetSelect = (p: MarketplacePreset) => {
    setPreset(p);
    setCustomConfig(ECOMMERCE_PRESETS[p]);
  };

  // Handle Multiple File Drops / Selection
  const handleFilesSelect = (fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter((f) => f.type.startsWith("image/"));

    if (validFiles.length === 0) {
      toast.error("Please drop valid image files (JPG, PNG, WebP).");
      return;
    }

    const newItems: EcommerceItem[] = validFiles.map((file) => ({
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      size: file.size,
      status: "idle",
      progress: 0,
      previewUrl: URL.createObjectURL(file),
    }));

    setItems((prev) => [...prev, ...newItems]);
    setZipBlob(null);
    toast.success(`Added ${newItems.length} product photos to batch!`);
  };

  // Process all queued items
  const handleProcessBatch = async () => {
    if (items.length === 0) {
      toast.error("Add product photos first.");
      return;
    }

    setIsProcessing(true);
    setProcessedCount(0);
    setZipBlob(null);

    const activeConfig = {
      ...customConfig,
      preset,
    };

    const updated = [...items];

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      item.status = "processing";
      setItems([...updated]);

      try {
        const resultBlob = await processEcommerceProduct(item.file, activeConfig);
        item.status = "done";
        item.progress = 100;
        item.resultBlob = resultBlob;
        item.resultUrl = URL.createObjectURL(resultBlob);
        setProcessedCount((c) => c + 1);
      } catch (err: any) {
        item.status = "error";
        item.errorMessage = err?.message || "Failed to process photo";
      }

      setItems([...updated]);
    }

    // Bundle into ZIP
    try {
      const zip = await bundleEcommerceZip(updated);
      setZipBlob(zip);
      toast.success(`Finished processing ${updated.length} photos! ZIP package ready.`);
    } catch {
      toast.error("Could not generate ZIP bundle.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Download ZIP
  const handleDownloadZip = () => {
    if (!zipBlob) return;
    downloadBlob(zipBlob, `ecommerce-${preset}-catalog-${Date.now()}.zip`);
    toast.success("Downloaded catalog ZIP archive!");
  };

  // Download single item
  const handleDownloadSingle = (item: EcommerceItem) => {
    if (!item.resultBlob) return;
    const ext = item.resultBlob.type.includes("webp")
      ? "webp"
      : item.resultBlob.type.includes("png")
      ? "png"
      : "jpg";
    downloadBlob(item.resultBlob, `${item.name.replace(/\.[^/.]+$/, "")}-${preset}.${ext}`);
  };

  // Remove single item
  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const filtered = prev.filter((i) => i.id !== id);
      return filtered;
    });
    setZipBlob(null);
  };

  // Clear all
  const handleClearAll = () => {
    items.forEach((i) => {
      URL.revokeObjectURL(i.previewUrl);
      if (i.resultUrl) URL.revokeObjectURL(i.resultUrl);
    });
    setItems([]);
    setZipBlob(null);
    setProcessedCount(0);
  };

  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500">
          <ShoppingBag className="h-3.5 w-3.5" />
          Amazon, Shopify & Marketplace Stager
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Bulk E-Commerce Catalog Processor
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Format dozens of product photos in 1 click: Amazon pure white 85% rule, uniform aspect ratio, soft contact shadows, and bulk ZIP export.
        </p>
      </div>

      {/* Preset Selector Bar */}
      <div className="mb-6 rounded-2xl border border-border/60 bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">Marketplace Standards Preset</h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {customConfig.width} × {customConfig.height}px • {customConfig.fillPercent}% fill
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              id: "amazon",
              title: "Amazon Compliance",
              sub: "2000×2000 • Pure White #FFF • 85% Fill",
              badge: "Official standard",
            },
            {
              id: "shopify",
              title: "Shopify Luxury",
              sub: "2048×2048 • Studio Light Grey • Soft Shadow",
              badge: "High conversion",
            },
            {
              id: "etsy",
              title: "Etsy & Social",
              sub: "1500×1500 • Warm Stone Beige • Subtle Glow",
              badge: "Organic aesthetic",
            },
            {
              id: "custom",
              title: "Custom Dimensions",
              sub: "Manual canvas size, background, & shadows",
              badge: "Configurable",
            },
          ].map((card) => {
            const active = preset === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handlePresetSelect(card.id as MarketplacePreset)}
                className={`rounded-xl border p-3.5 text-left transition ${
                  active
                    ? "border-amber-500 bg-amber-500/10 text-foreground ring-1 ring-amber-500/40"
                    : "border-border/60 bg-background/50 hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-foreground">{card.title}</span>
                  <span className="text-[10px] font-semibold text-amber-500">{card.badge}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">{card.sub}</p>
              </button>
            );
          })}
        </div>

        {/* Custom Controls Drawer if custom is selected */}
        {preset === "custom" && (
          <div className="grid grid-cols-1 gap-4 pt-3 border-t border-border/40 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Dimensions: {customConfig.width}px
              </label>
              <input
                type="range"
                min={1000}
                max={3000}
                step={100}
                value={customConfig.width}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setCustomConfig((prev) => ({ ...prev, width: val, height: val }));
                }}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Product Frame Fill: {customConfig.fillPercent}%
              </label>
              <input
                type="range"
                min={60}
                max={95}
                value={customConfig.fillPercent}
                onChange={(e) =>
                  setCustomConfig((prev) => ({
                    ...prev,
                    fillPercent: parseInt(e.target.value, 10),
                  }))
                }
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Floor Contact Shadow: {customConfig.shadowIntensity}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={customConfig.shadowIntensity}
                onChange={(e) =>
                  setCustomConfig((prev) => ({
                    ...prev,
                    shadowIntensity: parseInt(e.target.value, 10),
                  }))
                }
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Upload Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/80 bg-card/60 p-8 text-center transition hover:border-amber-500/60 hover:bg-muted/30 cursor-pointer shadow-sm mb-6"
      >
        <div className="rounded-2xl bg-amber-500/10 p-4 text-amber-500 mb-3 shadow-inner">
          <Upload className="h-7 w-7" />
        </div>
        <p className="text-base font-bold text-foreground">
          Drop product photos here, or click to browse
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Accepts up to 50 photos simultaneously (JPG, PNG, WebP)
        </p>
        <input
          id={fileInputId}
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
        />
      </div>

      {/* Batch Processing Action Bar */}
      {items.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">
              {items.length} Product Photos Queued
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              ({doneCount} / {items.length} completed)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              disabled={isProcessing}
              className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear
            </button>

            <button
              type="button"
              onClick={handleProcessBatch}
              disabled={isProcessing}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black shadow hover:bg-amber-400 transition disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isProcessing ? `Processing (${processedCount}/${items.length})...` : "Process All Photos"}
            </button>

            {zipBlob && (
              <button
                type="button"
                onClick={handleDownloadZip}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-500 transition animate-bounce"
              >
                <Archive className="h-3.5 w-3.5" />
                Download All (ZIP)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Products Grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-3 shadow-sm transition hover:shadow-md"
            >
              {/* Thumbnail Frame */}
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center border border-border/40">
                <img
                  src={item.resultUrl || item.previewUrl}
                  alt={item.name}
                  className="max-h-full max-w-full object-contain"
                />

                {/* Status Badge */}
                <div className="absolute top-2 left-2">
                  {item.status === "done" ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow backdrop-blur-sm">
                      <CheckCircle2 className="h-3 w-3" /> Done
                    </span>
                  ) : item.status === "processing" ? (
                    <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-black shadow backdrop-blur-sm animate-pulse">
                      Processing...
                    </span>
                  ) : null}
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="absolute top-2 right-2 hidden h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-500 group-hover:flex transition"
                  title="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {/* Title & Info */}
              <div className="mt-2.5 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {(item.size / 1024).toFixed(0)} KB
                  </p>
                </div>

                {item.status === "done" && (
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(item)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-foreground hover:bg-primary hover:text-primary-foreground transition"
                    title="Download this photo"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
