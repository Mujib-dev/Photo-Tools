"use client";

import React, { useState, useRef, useEffect, useId, useCallback, useMemo } from "react";
import {
  Check,
  Copy,
  Download,
  Eye,
  Gauge,
  Image as ImageIcon,
  LayoutTemplate,
  Lightbulb,
  Monitor,
  Palette,
  Redo2,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Type,
  Undo2,
  Upload,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useHistory } from "@/lib/use-history";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { isShareSupported, shareBlob } from "@/lib/share";
import {
  ASPECT_PRESETS,
  BACKGROUND_PRESETS,
  DEFAULT_THUMBNAIL_CONFIG,
  FONT_PRESETS,
  ThumbnailConfig,
  THUMBNAIL_TEMPLATES,
  ThumbnailTemplate,
  analyzeThumbnail,
  drawSubjectSticker,
  drawThumbnailBackground,
  drawThumbnailTypography,
  getThumbnailSize,
} from "@/lib/thumbnail-engine";

type ExportFormat = "png" | "jpg";

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-foreground">{label}</span>
        <span className="font-mono text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-amber-500"
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background px-2.5 py-2">
      <span className="text-[11px] font-bold text-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase text-muted-foreground">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-border/60 bg-transparent p-0.5"
          aria-label={label}
        />
      </span>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between rounded-xl border px-2.5 py-2 text-[11px] font-bold transition ${
        checked
          ? "border-amber-500/60 bg-amber-500/10 text-foreground"
          : "border-border/60 bg-background text-muted-foreground"
      }`}
    >
      {label}
      <span
        className={`relative h-4 w-7 rounded-full transition ${
          checked ? "bg-amber-500" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
            checked ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function ThumbnailStudioTool() {
  const {
    state: config,
    set: setConfig,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<ThumbnailConfig>(DEFAULT_THUMBNAIL_CONFIG);

  const [subjectImg, setSubjectImg] = useState<HTMLImageElement | null>(null);
  const [customBgImg, setCustomBgImg] = useState<HTMLImageElement | null>(null);
  const [viewTab, setViewTab] = useState<"editor" | "ctr-simulator">("editor");
  const [simDevice, setSimDevice] = useState<"mobile" | "desktop">("mobile");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportScale, setExportScale] = useState<1 | 2 | 3>(1);

  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft<ThumbnailConfig>(
    "thumbnail-studio",
    config,
    (saved) => setConfig({ ...DEFAULT_THUMBNAIL_CONFIG, ...saved }),
  );

  const [shareSupported, setShareSupported] = useState(false);
  useEffect(() => {
    setShareSupported(isShareSupported());
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);
  const bgInputRef = useRef<HTMLInputElement | null>(null);
  const subjectInputId = useId();
  const bgInputId = useId();

  const update = useCallback((patch: Partial<ThumbnailConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, [setConfig]);

  const handleSubjectSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSubjectImg(img);
      URL.revokeObjectURL(url);
      toast.success("Loaded subject cutout with sticker outline!");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("Could not load that image.");
    };
    img.src = url;
  };

  const handleBgSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setCustomBgImg(img);
      update({ backgroundPreset: "custom" });
      URL.revokeObjectURL(url);
      toast.success("Custom background loaded!");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("Could not load that image.");
    };
    img.src = url;
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = getThumbnailSize(config.aspectRatio);
    canvas.width = width;
    canvas.height = height;

    drawThumbnailBackground(ctx, width, height, config, customBgImg);

    if (subjectImg) {
      drawSubjectSticker(ctx, subjectImg, width, height, config);
    }

    drawThumbnailTypography(ctx, width, height, config);

    for (const target of [previewCanvasRef.current, simCanvasRef.current]) {
      if (!target) continue;
      target.width = width;
      target.height = height;
      target.getContext("2d")?.drawImage(canvas, 0, 0);
    }
  }, [config, subjectImg, customBgImg]);

  useEffect(() => {
    renderCanvas();
  }, [viewTab, renderCanvas]);

  const analysis = useMemo(
    () => analyzeThumbnail(config, Boolean(subjectImg)),
    [config, subjectImg],
  );

  const exportMime = exportFormat === "jpg" ? "image/jpeg" : "image/png";

  const handleDownload = () => {
    const { width: baseW, height: baseH } = getThumbnailSize(config.aspectRatio);
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
    drawThumbnailBackground(ctx, baseW, baseH, config, customBgImg);
    if (subjectImg) {
      drawSubjectSticker(ctx, subjectImg, baseW, baseH, config);
    }
    drawThumbnailTypography(ctx, baseW, baseH, config);

    const url = outCanvas.toDataURL(exportMime, 0.95);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thumbnail-${targetW}x${targetH}-${Date.now()}.${exportFormat}`;
    a.click();
    toast.success(
      `Downloaded ${targetW}x${targetH} (${exportScale}x ${exportScale === 3 ? "Ultra-HD 300 DPI" : exportScale === 2 ? "2K Retina" : "Standard"})!`
    );
  };

  const handleCopy = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      toast.error("Clipboard images are not supported in this browser.");
      return;
    }

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        toast.success("Thumbnail copied to clipboard!");
      } catch {
        toast.error("Could not copy the image. Try downloading it instead.");
      }
    }, exportMime, 0.92);
  };

  const handleShare = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = getThumbnailSize(config.aspectRatio);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const filename = `thumbnail-${width}x${height}.${exportFormat}`;
      const shared = await shareBlob(blob, filename, {
        title: filename,
        text: "Thumbnail created with PicTools",
      });
      if (shared) toast.success("Shared successfully!");
    }, exportMime, 0.92);
  };

  const resetAll = () => {
    setConfig(DEFAULT_THUMBNAIL_CONFIG);
    setSubjectImg(null);
    setCustomBgImg(null);
    toast.success("Studio reset to defaults.");
  };

  const resetSubjectPlacement = () => {
    update({
      subjectScale: 1,
      subjectOffsetX: 0,
      subjectOffsetY: 0,
      subjectFlip: false,
      subjectShadow: true,
    });
  };

  const aspectHint = ASPECT_PRESETS.find((preset) => preset.id === config.aspectRatio);
  const canvasMaxWidth =
    config.aspectRatio === "9:16" ? "420px" : config.aspectRatio === "4:5" ? "560px" : "100%";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500">
          <Sparkles className="h-3.5 w-3.5" />
          YouTube & Social Growth Studio
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          YouTube Thumbnail Studio + Feed CTR Simulator
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Craft high-clickability thumbnails for YouTube, Shorts, Reels and square posts with
          sticker cutout borders, bold typography, background effects and a live CTR analyzer.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-1">
          <button
            type="button"
            onClick={() => setViewTab("editor")}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
              viewTab === "editor"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Thumbnail Canvas Editor
          </button>
          <button
            type="button"
            onClick={() => setViewTab("ctr-simulator")}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition ${
              viewTab === "ctr-simulator"
                ? "bg-amber-500 text-black shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Feed CTR Simulator
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Undo / Redo history controls */}
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

          <button
            type="button"
            onClick={resetAll}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
            title="Reset everything"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>

          {/* Export Scale (1x Web, 2x Retina, 3x Ultra-HD 300 DPI) */}
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
                title={scale === 3 ? "3x Ultra-HD / 300 DPI Print" : scale === 2 ? "2x Retina HD" : "1x Standard Web"}
              >
                {scale === 3 ? "3x (4K Ultra)" : scale === 2 ? "2x (Retina)" : "1x (Web)"}
              </button>
            ))}
          </div>

          <div className="flex items-center overflow-hidden rounded-xl border border-border/60 bg-background text-xs font-bold">
            {(["png", "jpg"] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => setExportFormat(format)}
                className={`px-3 py-2 uppercase transition ${
                  exportFormat === format
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {format}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
            title="Copy image to clipboard"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow transition hover:bg-emerald-500"
          >
            <Download className="h-3.5 w-3.5" />
            Download {aspectHint?.hint ?? "1280 x 720"}
          </button>

          {shareSupported && (
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
              title="Share"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
          )}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card p-3">
        <span className="flex items-center gap-1.5 px-1 text-xs font-bold text-foreground">
          <LayoutTemplate className="h-4 w-4 text-amber-500" />
          Canvas format
        </span>
        {ASPECT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => update({ aspectRatio: preset.id })}
            className={`rounded-xl border px-3 py-1.5 text-left text-xs font-bold transition ${
              config.aspectRatio === preset.id
                ? "border-amber-500 bg-amber-500/10 text-foreground"
                : "border-border/60 bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {preset.label}
            <span className="ml-1.5 font-mono text-[10px] font-normal text-muted-foreground">
              {preset.hint}
            </span>
          </button>
        ))}
      </div>

      {/* 1-Click Viral Preset Templates */}
      <div className="mb-6 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-1">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            1-Click Viral Templates (High-CTR Styles)
          </span>
          <span className="text-[11px] text-muted-foreground">Instant headline, glow, backdrop & typography</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {THUMBNAIL_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => {
                update(tmpl.config);
                toast.success(`Loaded "${tmpl.name}" template!`);
              }}
              className="group flex flex-col items-start rounded-xl border border-border/70 bg-background/80 p-2.5 text-left transition hover:border-amber-500/80 hover:bg-amber-500/5 hover:shadow-sm"
            >
              <span className="mb-1 rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-foreground group-hover:bg-amber-500 group-hover:text-black transition">
                {tmpl.badge}
              </span>
              <span className="line-clamp-1 text-xs font-semibold text-foreground">
                {tmpl.name}
              </span>
              <span className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
                {tmpl.config.titleText}
              </span>
            </button>
          ))}
        </div>
      </div>

      {viewTab === "editor" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <div className="flex justify-center rounded-3xl border border-border/80 bg-black p-2 shadow-2xl">
              <div
                className="relative w-full overflow-hidden rounded-2xl"
                style={{ aspectRatio: config.aspectRatio.replace(":", " / "), maxWidth: canvasMaxWidth }}
              >
                <canvas ref={previewCanvasRef} className="h-full w-full object-contain" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div
                onClick={() => subjectInputRef.current?.click()}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 transition hover:bg-muted/40"
              >
                <div className="rounded-xl bg-sky-500/10 p-2.5 text-sky-400">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-foreground">
                    {subjectImg ? "Replace Subject Cutout" : "Add Subject Cutout"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Transparent PNG of a person or reaction
                  </span>
                </div>
                <input
                  id={subjectInputId}
                  ref={subjectInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleSubjectSelect(e.target.files[0])}
                />
              </div>

              <div
                onClick={() => bgInputRef.current?.click()}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 transition hover:bg-muted/40"
              >
                <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-500">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-foreground">
                    {customBgImg ? "Replace Custom Background" : "Upload Custom Background"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    16:9 photo, gameplay or product shot
                  </span>
                </div>
                <input
                  id={bgInputId}
                  ref={bgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleBgSelect(e.target.files[0])}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-4">
            <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground">
                <Type className="h-4 w-4 text-amber-500" />
                Headline & Typography
              </div>

              <div className="space-y-2.5">
                <input
                  type="text"
                  value={config.titleText}
                  onChange={(e) => update({ titleText: e.target.value })}
                  placeholder="Main viral headline..."
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                />

                <input
                  type="text"
                  value={config.subText}
                  onChange={(e) => update({ subText: e.target.value })}
                  placeholder="Subtext / warning..."
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                />

                <input
                  type="text"
                  value={config.badgeText || ""}
                  onChange={(e) => update({ badgeText: e.target.value })}
                  placeholder="Badge text (e.g. 100% REAL)..."
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>

              <div>
                <span className="mb-1.5 block text-[11px] font-bold text-foreground">Font style</span>
                <div className="grid grid-cols-2 gap-2">
                  {FONT_PRESETS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => update({ fontPreset: font.id })}
                      style={{ fontFamily: font.stack }}
                      className={`rounded-xl border px-2 py-2 text-xs font-bold transition ${
                        config.fontPreset === font.id
                          ? "border-amber-500 bg-amber-500/10 text-foreground"
                          : "border-border/60 bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>

              <SliderField
                label="Headline size"
                value={config.titleScale}
                min={0.6}
                max={1.4}
                step={0.05}
                suffix="x"
                onChange={(value) => update({ titleScale: value })}
              />

              <SliderField
                label="Dramatic tilt angle"
                value={config.textRotation}
                min={-10}
                max={10}
                suffix="°"
                onChange={(value) => update({ textRotation: value })}
              />

              <div className="grid grid-cols-1 gap-2">
                <ColorField
                  label="Headline color"
                  value={config.textColor}
                  onChange={(value) => update({ textColor: value })}
                />
                <ColorField
                  label="Subtext color"
                  value={config.subTextColor}
                  onChange={(value) => update({ subTextColor: value })}
                />
                <ColorField
                  label="Badge background"
                  value={config.badgeBgColor}
                  onChange={(value) => update({ badgeBgColor: value })}
                />
                <ColorField
                  label="Badge text"
                  value={config.badgeTextColor}
                  onChange={(value) => update({ badgeTextColor: value })}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground">
                <Palette className="h-4 w-4 text-amber-500" />
                Background
              </div>

              <div className="grid grid-cols-2 gap-2">
                {BACKGROUND_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => update({ backgroundPreset: preset.id })}
                    className={`flex items-center gap-2 rounded-xl border px-2 py-2 text-left text-xs font-semibold transition ${
                      config.backgroundPreset === preset.id
                        ? "border-amber-500 bg-amber-500/10 text-foreground"
                        : "border-border/60 bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-white/30"
                      style={{ background: preset.swatch }}
                    />
                    {preset.label}
                  </button>
                ))}
              </div>

              {config.backgroundPreset === "custom" && (
                <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-sky-500">
                  Custom background active. Use the upload card to replace it.
                </p>
              )}

              <SliderField
                label="Darken overlay"
                value={config.backgroundDim}
                min={0}
                max={80}
                suffix="%"
                onChange={(value) => update({ backgroundDim: value })}
              />

              <SliderField
                label="Background blur"
                value={config.backgroundBlur}
                min={0}
                max={24}
                suffix="px"
                onChange={(value) => update({ backgroundBlur: value })}
              />
            </div>

            {subjectImg && (
              <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground">
                    <SlidersHorizontal className="h-4 w-4 text-amber-500" />
                    Subject Sticker
                  </div>
                  <button
                    type="button"
                    onClick={resetSubjectPlacement}
                    className="text-[10px] font-bold text-muted-foreground hover:text-foreground"
                  >
                    Reset
                  </button>
                </div>

                <SliderField
                  label="Subject scale"
                  value={Number(config.subjectScale.toFixed(2))}
                  min={0.5}
                  max={1.6}
                  step={0.05}
                  suffix="x"
                  onChange={(value) => update({ subjectScale: value })}
                />

                <SliderField
                  label="Horizontal position"
                  value={config.subjectOffsetX}
                  min={-1}
                  max={1}
                  step={0.05}
                  onChange={(value) => update({ subjectOffsetX: value })}
                />

                <SliderField
                  label="Vertical position"
                  value={config.subjectOffsetY}
                  min={-1}
                  max={1}
                  step={0.05}
                  onChange={(value) => update({ subjectOffsetY: value })}
                />

                <SliderField
                  label="Sticker outline width"
                  value={config.stickerGlowWidth}
                  min={0}
                  max={24}
                  suffix="px"
                  onChange={(value) => update({ stickerGlowWidth: value })}
                />

                <div className="flex flex-wrap items-center gap-1.5">
                  {["#FFFFFF", "#FFEB3B", "#00FFFF", "#00E676", "#FF1744", "#A855F7"].map(
                    (color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => update({ stickerGlowColor: color })}
                        className={`h-6 w-6 rounded-full border border-white/40 transition ${
                          config.stickerGlowColor === color ? "scale-110 ring-2 ring-primary" : ""
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Outline color ${color}`}
                      />
                    ),
                  )}
                  <input
                    type="color"
                    value={config.stickerGlowColor}
                    onChange={(e) => update({ stickerGlowColor: e.target.value })}
                    className="h-6 w-8 cursor-pointer rounded border border-border/60 bg-transparent p-0.5"
                    aria-label="Custom outline color"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ToggleField
                    label="Flip subject"
                    checked={config.subjectFlip}
                    onChange={(checked) => update({ subjectFlip: checked })}
                  />
                  <ToggleField
                    label="Drop shadow"
                    checked={config.subjectShadow}
                    onChange={(checked) => update({ subjectShadow: checked })}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setSubjectImg(null)}
                  className="w-full rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] font-bold text-destructive transition hover:bg-destructive/20"
                >
                  Remove subject cutout
                </button>
              </div>
            )}

            <div className="space-y-3 rounded-3xl border border-border/80 bg-card p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground">
                  <Gauge className="h-4 w-4 text-amber-500" />
                  CTR Readiness
                </div>
                <span className="text-lg font-black text-amber-500">{analysis.score}/100</span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    analysis.score >= 70
                      ? "bg-emerald-500"
                      : analysis.score >= 50
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${analysis.score}%` }}
                />
              </div>

              <div className="flex items-center gap-2 text-[11px] font-bold text-foreground">
                {analysis.score >= 70 ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                )}
                {analysis.label}
                <span className="ml-auto font-mono text-[10px] font-normal text-muted-foreground">
                  {analysis.contrastRatio.toFixed(1)}:1 contrast
                </span>
              </div>

              {analysis.tips.length > 0 && (
                <ul className="space-y-1.5">
                  {analysis.tips.map((tip) => (
                    <li key={tip} className="flex gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
                      <Zap className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                      {tip}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-1">
              <button
                type="button"
                onClick={() => setSimDevice("mobile")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  simDevice === "mobile"
                    ? "bg-amber-500 text-black shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile
              </button>
              <button
                type="button"
                onClick={() => setSimDevice("desktop")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  simDevice === "desktop"
                    ? "bg-amber-500 text-black shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                Desktop
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              Score{" "}
              <span className="text-amber-500">{analysis.score}/100</span>
            </div>
          </div>

          <div
            className={`mx-auto w-full ${
              simDevice === "mobile" ? "max-w-sm" : "max-w-3xl"
            } space-y-4 rounded-3xl border-4 border-neutral-800 bg-neutral-950 p-4 font-sans shadow-2xl`}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-xs font-bold text-white">
              <span className="text-red-500">YouTube</span>
              <span className="text-[10px] text-neutral-400">
                {simDevice === "mobile" ? "Mobile" : "Desktop"} Feed CTR Simulator
              </span>
            </div>

            <div className={simDevice === "desktop" ? "grid grid-cols-2 gap-4" : "space-y-4"}>
              <div className="space-y-2 opacity-60 transition hover:opacity-100">
                <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-neutral-800 text-xs text-neutral-500">
                  [Competitor Thumbnail]
                </div>
                <div className="flex gap-2.5">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-neutral-700" />
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-xs font-bold text-white">
                      How to 10x Your Productivity in 2026
                    </p>
                    <p className="text-[10px] text-neutral-400">Ali Abdaal · 1.2M views · 3 days ago</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border-2 border-amber-500/80 bg-neutral-900/60 p-2 shadow-xl ring-2 ring-amber-500/20">
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
                  <canvas ref={simCanvasRef} className="h-full w-full object-cover" />
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1 py-0.5 text-[9px] font-bold text-white">
                    12:45
                  </span>
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-black">
                    {analysis.score}/100 CTR
                  </span>
                </div>
                <div className="flex gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-black">
                    YOU
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-bold leading-tight text-white">
                      {config.titleText}
                      {config.subText ? ` — ${config.subText}` : ""}
                    </p>
                    <p className="text-[10px] font-semibold text-amber-400">
                      Your Channel · 248K views · 2 hours ago
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 opacity-60 transition hover:opacity-100">
                <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-neutral-800 text-xs text-neutral-500">
                  [Competitor Thumbnail]
                </div>
                <div className="flex gap-2.5">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-neutral-700" />
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-xs font-bold text-white">
                      I Spent 100 Hours Testing AI Tools
                    </p>
                    <p className="text-[10px] text-neutral-400">MrBeast · 8.4M views · 1 week ago</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-white">
                <Gauge className="h-3.5 w-3.5 text-amber-500" />
                {analysis.label}
                {analysis.tips.length > 0 && (
                  <span className="ml-auto text-[10px] font-normal text-neutral-400">
                    {analysis.tips.length} tip{analysis.tips.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {analysis.tips.length > 0 ? (
                <ul className="space-y-1">
                  {analysis.tips.map((tip) => (
                    <li key={tip} className="text-[10px] leading-relaxed text-neutral-400">
                      · {tip}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10px] text-emerald-400">
                  Looks strong — download it and start testing!
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
