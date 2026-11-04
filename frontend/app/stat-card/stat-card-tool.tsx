"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  MessageSquare,
  Upload,
  Download,
  RotateCcw,
  Sparkles,
  Sliders,
  CheckCircle2,
  Share2,
  Undo2,
  Redo2,
} from "lucide-react";
import { toast } from "sonner";
import { useHistory } from "@/lib/use-history";
import {
  DEFAULT_STAT_CARD,
  STAT_CARD_TEMPLATES,
  STAT_CARD_THEMES,
  StatCardAspect,
  StatCardConfig,
  StatCardTemplate,
  StatCardTheme,
  drawStatCard,
} from "@/lib/stat-card-engine";
import { shareBlob, isShareSupported } from "@/lib/share";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";

export function StatCardTool() {
  const {
    state: config,
    set: setConfig,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<StatCardConfig>(DEFAULT_STAT_CARD);

  const [avatarImg, setAvatarImg] = useState<HTMLImageElement | null>(null);
  const [exportScale, setExportScale] = useState<1 | 2 | 3>(1);

  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft<StatCardConfig>(
    "stat-card",
    config,
    setConfig,
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputId = useId();

  // Load avatar photo
  const handleAvatarSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setAvatarImg(img);
      toast.success("Loaded author avatar!");
    };
    img.src = url;
  };

  // Re-render Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (config.aspect === "16:9") {
      canvas.width = 1600;
      canvas.height = 900;
    } else if (config.aspect === "4:5") {
      canvas.width = 1080;
      canvas.height = 1350;
    } else {
      // 1:1
      canvas.width = 1080;
      canvas.height = 1080;
    }

    drawStatCard(ctx, canvas.width, canvas.height, config, avatarImg);
  }, [config, avatarImg]);

  // Download High-Res Card
  const handleDownload = () => {
    let baseW = 1080;
    let baseH = 1080;
    if (config.aspect === "16:9") {
      baseW = 1600;
      baseH = 900;
    } else if (config.aspect === "4:5") {
      baseW = 1080;
      baseH = 1350;
    }

    const targetW = baseW * exportScale;
    const targetH = baseH * exportScale;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = targetW;
    outCanvas.height = targetH;
    const ctx = outCanvas.getContext("2d");
    if (!ctx) return;

    if (exportScale > 1) {
      ctx.scale(exportScale, exportScale);
    }
    drawStatCard(ctx, baseW, baseH, config, avatarImg);

    const url = outCanvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `social-quote-card-${targetW}x${targetH}-${Date.now()}.png`;
    a.click();
    toast.success(
      `Downloaded ${targetW}x${targetH} (${exportScale}x ${exportScale === 3 ? "Ultra-HD 300 DPI" : exportScale === 2 ? "2K Retina" : "Standard"})!`
    );
  };

  // Web Share
  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const ok = await shareBlob(blob, `quote-card-${Date.now()}.png`, {
        title: config.authorName ? `Quote by ${config.authorName}` : "Social Quote Card",
        text: config.quoteText.slice(0, 100),
      });
      if (ok) toast.success("Shared successfully!");
      else toast.info("Sharing not completed.");
    }, "image/png");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400">
          <MessageSquare className="h-3.5 w-3.5" />
          LinkedIn & Twitter Viral Social Cards
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Social Quote & Stat Card Maker
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Turn quotes, testimonials, metrics, and insights into high-engagement social media cards formatted for LinkedIn, Twitter, and Instagram.
        </p>
      </div>

      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      {/* 1-Click Viral Stat Card Templates */}
      <div className="mb-6 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-1">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
            1-Click Proven Templates (SaaS, Open Source, Founders)
          </span>
          <span className="text-[11px] text-muted-foreground">Pre-formatted quotes, metrics & color schemes</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STAT_CARD_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => {
                setConfig((prev) => ({ ...prev, ...tmpl.config }));
                toast.success(`Loaded "${tmpl.name}" template!`);
              }}
              className="group flex flex-col items-start rounded-xl border border-border/70 bg-background/80 p-2.5 text-left transition hover:border-sky-500/80 hover:bg-sky-500/5 hover:shadow-sm"
            >
              <span className="mb-1 rounded bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-400 group-hover:bg-sky-500 group-hover:text-white transition">
                {tmpl.tag}
              </span>
              <span className="line-clamp-1 text-xs font-semibold text-foreground">
                {tmpl.name}
              </span>
              <span className="mt-1 line-clamp-1 font-mono text-[10px] text-sky-400 font-bold">
                {tmpl.config.statMetric}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Canvas Preview */}
        <div className="space-y-4 lg:col-span-7">
          <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border/80 bg-black/80 shadow-2xl p-2 flex items-center justify-center">
            <canvas ref={canvasRef} className="max-h-full max-w-full object-contain rounded-2xl" />
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Format:</span>
              {(["1:1", "16:9", "4:5"] as StatCardAspect[]).map((aspect) => (
                <button
                  key={aspect}
                  type="button"
                  onClick={() => setConfig({ ...config, aspect })}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    config.aspect === aspect
                      ? "bg-primary text-primary-foreground shadow"
                      : "border border-border/60 bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {aspect === "1:1" ? "1:1 Square" : aspect === "16:9" ? "16:9 Landscape" : "4:5 Portrait"}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Undo / Redo */}
              <div className="flex items-center overflow-hidden rounded-xl border border-border/60 bg-background text-xs font-bold">
                <button
                  type="button"
                  onClick={undo}
                  disabled={!canUndo}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-35"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Undo
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={!canRedo}
                  className="flex items-center gap-1 border-l border-border/60 px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-35"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                  Redo
                </button>
              </div>

              {/* Resolution Scale Multiplier */}
              <div className="flex items-center overflow-hidden rounded-xl border border-border/60 bg-background text-xs font-bold">
                {([1, 2, 3] as const).map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => setExportScale(scale)}
                    className={`px-2.5 py-2 transition ${
                      exportScale === scale
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={scale === 3 ? "3x Ultra-HD 300 DPI" : scale === 2 ? "2x Retina HD" : "1x Standard"}
                  >
                    {scale === 3 ? "3x (4K Ultra)" : scale === 2 ? "2x (Retina)" : "1x (Web)"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition"
                title="Share directly via mobile or desktop"
              >
                <Share2 className="h-4 w-4 text-sky-400" />
                Share
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-sky-500 transition"
              >
                <Download className="h-4 w-4" />
                Download {exportScale === 3 ? "Ultra-HD 4K" : exportScale === 2 ? "Retina 2K" : "PNG"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Customizer */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
            {/* Author Profile */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-foreground block">
                Author & Attribution
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.authorName}
                  onChange={(e) => setConfig({ ...config, authorName: e.target.value })}
                  placeholder="Author Name"
                  className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-bold text-foreground"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <Upload className="h-3.5 w-3.5" /> Avatar
                </button>
                <input
                  id={avatarInputId}
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleAvatarSelect(e.target.files[0])}
                />
              </div>

              <input
                type="text"
                value={config.authorHandle}
                onChange={(e) => setConfig({ ...config, authorHandle: e.target.value })}
                placeholder="@handle • Title"
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground"
              />

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>Verified Badge</span>
                <input
                  type="checkbox"
                  checked={config.hasVerifiedBadge}
                  onChange={(e) => setConfig({ ...config, hasVerifiedBadge: e.target.checked })}
                  className="rounded accent-sky-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Quote Body */}
            <div className="pt-2 border-t border-border/40 space-y-1.5">
              <label className="text-xs font-bold text-foreground block">
                Quote / Key Takeaway
              </label>
              <textarea
                rows={3}
                value={config.quoteText}
                onChange={(e) => setConfig({ ...config, quoteText: e.target.value })}
                className="w-full rounded-xl border border-border/60 bg-background p-2.5 text-xs text-foreground leading-relaxed"
              />
            </div>

            {/* Metric Callout */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Metric Callout
                </label>
                <input
                  type="text"
                  value={config.statMetric || ""}
                  onChange={(e) => setConfig({ ...config, statMetric: e.target.value })}
                  placeholder="e.g. 10x or $1M"
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs font-mono font-bold text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Metric Label
                </label>
                <input
                  type="text"
                  value={config.statLabel || ""}
                  onChange={(e) => setConfig({ ...config, statLabel: e.target.value })}
                  placeholder="e.g. Faster Growth"
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs text-foreground"
                />
              </div>
            </div>

            {/* Theme */}
            <div className="pt-2 border-t border-border/40">
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Visual Theme ({STAT_CARD_THEMES.length} Themes)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STAT_CARD_THEMES.map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setConfig({ ...config, theme: th.id })}
                    className={`flex items-center gap-2 rounded-xl border p-2 text-xs font-semibold text-left transition ${
                      config.theme === th.id
                        ? "border-sky-500 bg-sky-500/10 text-foreground ring-1 ring-sky-500/40"
                        : "border-border/60 bg-background hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-white/20 shadow-sm"
                      style={{ background: th.preview }}
                    />
                    <span className="truncate">{th.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
