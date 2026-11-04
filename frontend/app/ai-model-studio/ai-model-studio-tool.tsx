"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  ShoppingBag,
  Upload,
  Download,
  Share2,
  RotateCcw,
  Sparkles,
  Sliders,
  CheckCircle2,
  Users,
  Palette,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_MODEL_CONFIG,
  MARKETPLACE_SIZES,
  MarketplacePreset,
  ModelEthnicity,
  ModelGender,
  ModelStudioConfig,
  StudioBackground,
  renderModelStudio,
} from "@/lib/ai-model-engine";
import { shareBlob } from "@/lib/share";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";

export function AiModelStudioTool() {
  const [config, setConfig] = useState<ModelStudioConfig>(DEFAULT_MODEL_CONFIG);
  const [garmentImg, setGarmentImg] = useState<HTMLImageElement | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft<ModelStudioConfig>(
    "ai-model-studio",
    config,
    setConfig,
  );

  // Handle Garment Upload
  const handleGarmentSelect = (file: File) => {
    setTargetFile(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setGarmentImg(img);
      URL.revokeObjectURL(url);
      toast.success("Loaded apparel photo!");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("Failed to load garment image.");
    };
    img.src = url;
  };

  // Re-render Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = MARKETPLACE_SIZES[config.marketplace];
    canvas.width = size.width;
    canvas.height = size.height;

    renderModelStudio(ctx, canvas.width, canvas.height, garmentImg, config);
  }, [config, garmentImg]);

  // Download High-Res Marketplace Image
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/jpeg", 0.95);
    const a = document.createElement("a");
    a.href = url;
    const base = targetFile?.name.replace(/\.[^/.]+$/, "") || "product";
    a.download = `${base}-${config.marketplace}-model.jpg`;
    a.click();
    toast.success(`Downloaded ${MARKETPLACE_SIZES[config.marketplace].width}x${MARKETPLACE_SIZES[config.marketplace].height} marketplace photo!`);
  };

  // Web Share
  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const ok = await shareBlob(blob, `product-${config.marketplace}.jpg`, {
        title: "E-Commerce Product Model Shot",
        text: "Created with PicTools AI Model Studio",
      });
      if (ok) toast.success("Shared product photo!");
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/20 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-400">
          <ShoppingBag className="h-3.5 w-3.5" />
          Amazon, Shopify & Fashion E-Commerce
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          AI E-Commerce Fashion Model & Product Studio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Put flat clothing, ghost mannequins, and apparel onto diverse AI fashion models with realistic contact drop shadows and pure-white Amazon FBA compliance.
        </p>
      </div>

      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Canvas Preview */}
        <div className="space-y-4 lg:col-span-7 xl:col-span-8">
          <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border/80 bg-neutral-900 shadow-2xl p-2 flex items-center justify-center">
            <canvas ref={canvasRef} className="max-h-full max-w-full object-contain rounded-2xl" />

            {!garmentImg && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-8 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-black/40 p-6 text-center backdrop-blur-xs transition hover:border-pink-500/60 hover:bg-black/60"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/20 text-pink-400 mb-3">
                  <Upload className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-white">Upload Clothing or Product Item</h3>
                <p className="mt-1 text-xs text-neutral-400 max-w-xs">
                  Transparent PNG or cutout photo of shirts, dresses, hoodies, jackets, or jewelry.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl bg-pink-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-pink-500"
                >
                  Choose Apparel File
                </button>
              </div>
            )}
          </div>

          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleGarmentSelect(e.target.files[0])}
          />

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <Upload className="h-3.5 w-3.5" />
                {garmentImg ? "Replace Apparel" : "Upload Apparel"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                disabled={!garmentImg}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition disabled:opacity-40"
              >
                <Share2 className="h-3.5 w-3.5 text-pink-400" />
                Share
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={!garmentImg}
                className="flex items-center gap-2 rounded-xl bg-pink-600 px-5 py-2 text-xs font-bold text-white shadow-lg hover:bg-pink-500 transition disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                Download Marketplace Photo
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Customizer */}
        <div className="space-y-4 lg:col-span-5 xl:col-span-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-5">
            {/* Marketplace Target */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-2 flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5 text-pink-400" />
                Marketplace Export Standard
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(["amazon", "shopify", "instagram", "etsy"] as MarketplacePreset[]).map((m) => {
                  const size = MARKETPLACE_SIZES[m];
                  const isSelected = config.marketplace === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setConfig({ ...config, marketplace: m })}
                      className={`rounded-xl border p-2.5 text-left transition ${
                        isSelected
                          ? "border-pink-500 bg-pink-500/10 text-foreground ring-1 ring-pink-500/40"
                          : "border-border/60 bg-background hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <span className="block text-xs font-bold capitalize text-foreground">{m}</span>
                      <span className="block text-[10px] text-muted-foreground">{size.ratio} • {size.width}px</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Model Demographics */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <label className="text-xs font-bold text-foreground block flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-pink-400" />
                Model Demographics
              </label>

              <div>
                <span className="text-[11px] text-muted-foreground block mb-1">Gender</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["female", "male", "unisex"] as ModelGender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setConfig({ ...config, gender: g })}
                      className={`rounded-xl border py-1.5 text-xs font-semibold capitalize text-center transition ${
                        config.gender === g
                          ? "border-pink-500 bg-pink-500/10 text-foreground font-bold"
                          : "border-border/60 bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block mb-1">Ethnicity</span>
                <select
                  value={config.ethnicity}
                  onChange={(e) => setConfig({ ...config, ethnicity: e.target.value as ModelEthnicity })}
                  className="w-full h-9 rounded-xl border border-border/60 bg-background px-3 text-xs font-semibold"
                >
                  <option value="caucasian">Caucasian / European</option>
                  <option value="african">African / Black</option>
                  <option value="east-asian">East Asian</option>
                  <option value="hispanic">Hispanic / Latino</option>
                  <option value="south-asian">South Asian</option>
                </select>
              </div>
            </div>

            {/* Studio Backdrop */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <label className="text-xs font-bold text-foreground block flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-pink-400" />
                Studio Background
              </label>
              <div className="space-y-1.5">
                {[
                  { id: "amazon-white", label: "Amazon Pure White (#FFFFFF)", desc: "100% compliant with Amazon main image search rules" },
                  { id: "minimal-studio", label: "Minimalist Studio Spotlight", desc: "Subtle soft radial vignetted gradient" },
                  { id: "warm-terracotta", label: "Warm Terracotta Sun", desc: "Warm golden bohemian fashion studio" },
                  { id: "luxury-villa", label: "Modern Luxury Villa", desc: "Cool architectural grey concrete interior" },
                  { id: "urban-street", label: "Urban Streetstyle", desc: "Modern streetwear fashion concrete backdrop" },
                ].map((bg) => {
                  const isSelected = config.background === bg.id;
                  return (
                    <div
                      key={bg.id}
                      onClick={() => setConfig({ ...config, background: bg.id as StudioBackground })}
                      className={`cursor-pointer rounded-xl border p-2.5 transition ${
                        isSelected
                          ? "border-pink-500 bg-pink-500/10 ring-1 ring-pink-500/30"
                          : "border-border/60 bg-background hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{bg.label}</span>
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-pink-500" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{bg.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Contact Drop Shadows */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Realistic Contact Shadow</span>
                <input
                  type="checkbox"
                  checked={config.contactShadow}
                  onChange={(e) => setConfig({ ...config, contactShadow: e.target.checked })}
                  className="h-4 w-4 rounded accent-pink-600"
                />
              </div>

              {config.contactShadow && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Shadow Softness</span>
                    <span>{config.shadowBlur}px</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    value={config.shadowBlur}
                    onChange={(e) => setConfig({ ...config, shadowBlur: Number(e.target.value) })}
                    className="w-full accent-pink-600 cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
