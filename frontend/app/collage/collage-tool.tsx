"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  ImageIcon,
  Images,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { ZoomControls } from "@/components/zoom-controls";
import { downloadBlob } from "@/lib/screenshot";
import {
  OUTPUT_FORMATS,
  baseName,
  canvasToBlob,
  getOutputFormat,
  loadImageElement,
  uid,
} from "@/lib/image-edit";
import {
  COLLAGE_FITS,
  COLLAGE_LAYOUTS,
  COLLAGE_SWATCHES,
  DEFAULT_COLLAGE,
  collageDimensions,
  renderCollage,
  type CollageOptions,
} from "@/lib/collage";
import { formatPixels } from "@/lib/format";
import { useZoomPan } from "@/lib/use-zoom-pan";
import { cn } from "@/lib/utils";

interface CollageItem {
  key: string;
  file: File;
  url: string;
  width: number;
  height: number;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes(),
  )}${pad(d.getSeconds())}`;
}

export function CollageTool() {
  const [items, setItems] = React.useState<CollageItem[]>([]);
  const [opts, setOpts] = React.useState<CollageOptions>({ ...DEFAULT_COLLAGE });
  const [formatValue, setFormatValue] = React.useState("png");
  const [quality, setQuality] = React.useState(0.92);
  const [imageNonce, setImageNonce] = React.useState(0);
  const [previewSize, setPreviewSize] = React.useState<{ w: number; h: number } | null>(null);

  const itemsRef = React.useRef<CollageItem[]>([]);
  itemsRef.current = items;
  const imgCache = React.useRef(new Map<string, HTMLImageElement>());
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previewRef = React.useRef<HTMLCanvasElement>(null);
  const zoomPan = useZoomPan(imageNonce);

  const format = getOutputFormat(formatValue);

  const addFiles = React.useCallback((files: File[]) => {
    const existing = new Set(itemsRef.current.map((i) => i.file));
    const added = files.filter((f) => f.type.startsWith("image/") && !existing.has(f));
    if (added.length === 0) return;

    const newItems: CollageItem[] = added.map((f) => ({
      key: uid(),
      file: f,
      url: URL.createObjectURL(f),
      width: 0,
      height: 0,
    }));

    setItems((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      void loadImageElement(item.url)
        .then((img) => {
          imgCache.current.set(item.key, img);
          setItems((prev) =>
            prev.map((i) =>
              i.key === item.key ? { ...i, width: img.naturalWidth, height: img.naturalHeight } : i,
            ),
          );
          setImageNonce((n) => n + 1);
        })
        .catch(() => toast.error(`Could not read ${item.file.name}.`));
    }
  }, []);

  React.useEffect(() => {
    return () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    };
  }, []);

  const optsKey = JSON.stringify(opts);
  const allLoaded = items.length > 0 && items.every((i) => i.width > 0);

  // Repaint the live preview whenever the images or any option change.
  React.useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !allLoaded) return;
    const images = itemsRef.current
      .map((i) => imgCache.current.get(i.key))
      .filter((img): img is HTMLImageElement => Boolean(img));
    if (images.length !== itemsRef.current.length) return;
    try {
      const rendered = renderCollage(images, opts, 1400);
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(rendered, 0, 0);
      setPreviewSize({ w: rendered.width, h: rendered.height });
    } catch {
      /* canvas unavailable — preview stays blank */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLoaded, optsKey, imageNonce]);

  const set = <K extends keyof CollageOptions>(key: K, value: CollageOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setImageNonce((n) => n + 1);
  };

  const removeItem = (key: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.key === key);
      if (target) {
        URL.revokeObjectURL(target.url);
        imgCache.current.delete(key);
      }
      return prev.filter((i) => i.key !== key);
    });
    setImageNonce((n) => n + 1);
  };

  const clearAll = () => {
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    imgCache.current.clear();
    setItems([]);
    setPreviewSize(null);
  };

  const download = async () => {
    const images = itemsRef.current
      .map((i) => imgCache.current.get(i.key))
      .filter((img): img is HTMLImageElement => Boolean(img));
    if (images.length === 0) return;
    try {
      const canvas = renderCollage(images, opts);
      const blob = await canvasToBlob(canvas, format, quality);
      downloadBlob(blob, `collage-${timestamp()}.${format.ext}`);
      toast.success("Collage exported.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export the collage.");
    }
  };

  const dims = collageDimensions(opts, Math.max(1, items.length));
  const transparentLossy = opts.transparent && format.lossy;

  return (
    <AuthGate>
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
            Collage &amp; Combine
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Merge several photos into a grid, a row or a stacked strip — tweak spacing, corners and
            background, then export. Everything happens in this browser.
          </p>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-container/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" />
          <p className="text-sm text-on-surface-variant">
            <span className="font-display font-semibold text-foreground">Your photos stay private.</span>{" "}
            Images are composed on this computer only — nothing is uploaded and closing the tab clears
            everything.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: preview + image list */}
          <section className="flex flex-col gap-4 lg:col-span-8">
            {items.length > 0 ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                    <Images className="h-5 w-5 shrink-0 text-on-surface-variant" />
                    Preview
                  </h2>
                  <span className="font-mono text-xs text-on-surface-variant">
                    {dims.width} × {dims.height} px · {dims.cols}×{dims.rows}
                  </span>
                </div>

                <div className="relative rounded-xl border border-outline-variant/10 bg-[repeating-conic-gradient(#00000010_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] p-3">
                  <div
                    ref={zoomPan.viewportRef}
                    onPointerDown={zoomPan.onPointerDown}
                    onPointerMove={zoomPan.onPointerMove}
                    onPointerUp={zoomPan.onPointerUp}
                    onPointerLeave={zoomPan.onPointerUp}
                    onDoubleClick={zoomPan.onDoubleClick}
                    className="relative flex h-[52vh] w-full items-center justify-center overflow-hidden"
                    style={zoomPan.viewportStyle}
                  >
                    <canvas
                      ref={previewRef}
                      className="max-h-full w-auto max-w-full rounded-lg object-contain"
                      style={zoomPan.contentStyle}
                    />
                    {!allLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-on-surface-variant">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Preparing preview…
                      </div>
                    )}
                  </div>
                  {allLoaded && (
                    <ZoomControls
                      className="absolute right-5 top-5 z-10"
                      zoom={zoomPan.zoom}
                      onZoomIn={() => zoomPan.zoomBy(1.25)}
                      onZoomOut={() => zoomPan.zoomBy(1 / 1.25)}
                      onReset={zoomPan.resetZoom}
                    />
                  )}
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-outline-variant/10 bg-muted/30 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-mono text-xs text-on-surface-variant">
                    {items.length} image{items.length === 1 ? "" : "s"} · {format.ext.toUpperCase()}
                    {previewSize && ` · preview ${previewSize.w} × ${previewSize.h}`}
                  </p>
                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={!allLoaded}
                    onClick={() => void download()}
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
                <Dropzone kind="image" accept="image/*" onFiles={addFiles} />
                <p className="mt-3 text-center text-sm text-on-surface-variant">
                  Drop two or more images to build a collage.
                </p>
              </div>
            )}

            {items.length > 0 && (
              <Button variant="outline" className="w-full gap-2" onClick={() => inputRef.current?.click()}>
                <Plus className="h-4 w-4" />
                Add images
              </Button>
            )}

            {items.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="mb-1 flex items-center gap-2 font-display text-xl font-medium">
                  <ImageIcon className="h-5 w-5 text-on-surface-variant" />
                  Order ({items.length})
                </h3>
                {items.map((item, index) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 rounded-lg border border-outline-variant/10 p-2.5"
                  >
                    <span className="w-5 shrink-0 text-center font-mono text-xs text-on-surface-variant">
                      {index + 1}
                    </span>
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-outline-variant/20 bg-surface-container-high">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.file.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[13px] font-semibold text-foreground">
                        {item.file.name}
                      </p>
                      <p className="font-mono text-xs text-on-surface-variant">
                        {item.width > 0 ? formatPixels(item.width, item.height) : "Loading…"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Move up"
                        className="h-8 w-8"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ChevronUp className="h-4 w-4 text-on-surface-variant" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Move down"
                        className="h-8 w-8"
                        disabled={index === items.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ChevronDown className="h-4 w-4 text-on-surface-variant" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${item.file.name}`}
                        className="h-8 w-8"
                        onClick={() => removeItem(item.key)}
                      >
                        <Trash2 className="h-4 w-4 text-on-surface-variant" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Right: layout settings */}
          <aside className="lg:col-span-4">
            <div className="flex flex-col gap-6 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
              <h2 className="font-display text-xl font-medium">Layout</h2>

              <div className="space-y-2">
                <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Arrangement
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {COLLAGE_LAYOUTS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => set("layout", option.value)}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-lg border px-1 font-mono text-xs font-semibold transition-colors",
                        opts.layout === option.value
                          ? "border-primary bg-primary-container/15 text-primary"
                          : "border-outline-variant/30 text-foreground hover:border-primary/50",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {opts.layout === "grid" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-display text-[13px] font-semibold text-on-surface-variant">
                      Columns
                    </label>
                    <span className="font-mono text-xs text-on-surface-variant">{opts.columns}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    step={1}
                    value={opts.columns}
                    onChange={(e) => set("columns", Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-container-high accent-primary"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Fill mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {COLLAGE_FITS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => set("fit", option.value)}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-lg border px-1 font-mono text-xs font-semibold transition-colors",
                        opts.fit === option.value
                          ? "border-primary bg-primary-container/15 text-primary"
                          : "border-outline-variant/30 text-foreground hover:border-primary/50",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 border-t border-outline-variant/10 pt-5">
                {(
                  [
                    { key: "cellSize" as const, label: "Cell size", min: 120, max: 1200, value: opts.cellSize },
                    { key: "gap" as const, label: "Gap", min: 0, max: 80, value: opts.gap },
                    { key: "padding" as const, label: "Padding", min: 0, max: 120, value: opts.padding },
                    { key: "radius" as const, label: "Corners", min: 0, max: 200, value: opts.radius },
                  ]
                ).map((slider) => (
                  <div key={slider.key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-display text-[13px] font-semibold text-on-surface-variant">
                        {slider.label}
                      </label>
                      <span className="font-mono text-xs text-on-surface-variant">{slider.value}px</span>
                    </div>
                    <input
                      type="range"
                      min={slider.min}
                      max={slider.max}
                      step={1}
                      value={slider.value}
                      onChange={(e) => set(slider.key, Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-container-high accent-primary"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2 border-t border-outline-variant/10 pt-5">
                <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Background
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={opts.background}
                    disabled={opts.transparent}
                    onChange={(e) => set("background", e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-lg border border-outline-variant/30 bg-transparent disabled:opacity-40"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {COLLAGE_SWATCHES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Background ${color}`}
                        disabled={opts.transparent}
                        onClick={() => set("background", color)}
                        className={cn(
                          "h-7 w-7 rounded-md border transition-transform disabled:opacity-40",
                          opts.background === color && !opts.transparent
                            ? "border-primary ring-2 ring-primary/40"
                            : "border-outline-variant/30",
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => set("transparent", !opts.transparent)}
                  className={cn(
                    "flex h-9 w-full items-center justify-center rounded-lg border font-mono text-xs font-semibold transition-colors",
                    opts.transparent
                      ? "border-primary bg-primary-container/15 text-primary"
                      : "border-outline-variant/30 text-foreground hover:border-primary/50",
                  )}
                >
                  Transparent background
                </button>
              </div>

              <div className="space-y-2 border-t border-outline-variant/10 pt-5">
                <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Output format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {OUTPUT_FORMATS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormatValue(option.value)}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-lg border px-1 font-mono text-xs font-semibold transition-colors",
                        formatValue === option.value
                          ? "border-primary bg-primary-container/15 text-primary"
                          : "border-outline-variant/30 text-foreground hover:border-primary/50",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {transparentLossy && (
                  <p className="font-mono text-xs text-amber-500">
                    JPG/WEBP here won&apos;t keep transparency — use PNG.
                  </p>
                )}
              </div>

              {format.lossy && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      Quality
                    </label>
                    <span className="font-mono text-xs text-on-surface-variant">
                      {Math.round(quality * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={1}
                    step={0.05}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-container-high accent-primary"
                  />
                </div>
              )}

              <div className="space-y-2 border-t border-outline-variant/10 pt-5">
                <Button
                  onClick={() => void download()}
                  disabled={items.length === 0 || !allLoaded}
                  className="w-full gap-2 rounded-xl py-4"
                  size="lg"
                >
                  <Wand2 className="h-4 w-4" />
                  Export collage
                </Button>

                {items.length > 0 && (
                  <Button variant="ghost" className="w-full gap-2 text-primary" onClick={clearAll}>
                    <Trash2 className="h-4 w-4" />
                    Clear all
                  </Button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AuthGate>
  );
}
