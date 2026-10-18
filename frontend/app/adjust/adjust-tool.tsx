"use client";

import * as React from "react";
import {
  Download,
  FileArchive,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
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
  ADJUST_PRESETS,
  IDENTITY_ADJUSTMENTS,
  autoAdjust,
  isIdentity,
  matchPreset,
  renderAdjusted,
  type Adjustments,
} from "@/lib/image-adjust";
import { createZip } from "@/lib/zip";
import { formatBytes, formatPixels } from "@/lib/format";
import { useZoomPan } from "@/lib/use-zoom-pan";
import { cn } from "@/lib/utils";

interface AdjustResult {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  ext: string;
}

interface AdjustItem {
  key: string;
  file: File;
  url: string;
  width: number;
  height: number;
  adjustments: Adjustments;
  result: AdjustResult | null;
  status: "ready" | "done" | "downloaded";
}

const SLIDERS: { key: keyof Adjustments; label: string; min: number; max: number }[] = [
  { key: "brightness", label: "Brightness", min: -100, max: 100 },
  { key: "contrast", label: "Contrast", min: -100, max: 100 },
  { key: "saturation", label: "Saturation", min: -100, max: 100 },
  { key: "warmth", label: "Warmth", min: -100, max: 100 },
  { key: "hue", label: "Hue", min: -180, max: 180 },
  { key: "vignette", label: "Vignette", min: 0, max: 100 },
];

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes(),
  )}${pad(d.getSeconds())}`;
}

export function AdjustTool() {
  const [items, setItems] = React.useState<AdjustItem[]>([]);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [formatValue, setFormatValue] = React.useState("jpeg");
  const [quality, setQuality] = React.useState(0.9);
  const [applying, setApplying] = React.useState(false);
  const [imageNonce, setImageNonce] = React.useState(0);

  const itemsRef = React.useRef<AdjustItem[]>([]);
  itemsRef.current = items;
  const imgCache = React.useRef(new Map<string, HTMLImageElement>());
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previewRef = React.useRef<HTMLCanvasElement>(null);
  const zoomPan = useZoomPan(selectedKey);

  const format = getOutputFormat(formatValue);
  const selected = items.find((i) => i.key === selectedKey) ?? null;
  const activePreset = selected ? matchPreset(selected.adjustments) : "original";

  const addFiles = React.useCallback((files: File[]) => {
    const existing = new Set(itemsRef.current.map((i) => i.file));
    const added = files.filter((f) => f.type.startsWith("image/") && !existing.has(f));
    if (added.length === 0) return;

    const newItems: AdjustItem[] = added.map((f) => ({
      key: uid(),
      file: f,
      url: URL.createObjectURL(f),
      width: 0,
      height: 0,
      adjustments: { ...IDENTITY_ADJUSTMENTS },
      result: null,
      status: "ready",
    }));

    setItems((prev) => [...prev, ...newItems]);
    setSelectedKey((k) => k ?? newItems[0].key);

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
      itemsRef.current.forEach((i) => {
        URL.revokeObjectURL(i.url);
        if (i.result) URL.revokeObjectURL(i.result.url);
      });
    };
  }, []);

  const adjKey = selected ? JSON.stringify(selected.adjustments) : "";

  // Repaint the live preview whenever the selection or its sliders change.
  React.useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !selected) return;
    const img = imgCache.current.get(selected.key);
    if (!img) return;
    try {
      const rendered = renderAdjusted(img, selected.adjustments, 1600);
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(rendered, 0, 0);
    } catch {
      /* canvas unavailable — preview stays blank */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, adjKey, imageNonce]);

  const clearResult = (item: AdjustItem): AdjustItem => {
    if (item.result) URL.revokeObjectURL(item.result.url);
    return { ...item, result: null, status: "ready" };
  };

  const patchItem = (key: string, patch: Partial<AdjustItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const updateAdjustments = (key: string, patch: Partial<Adjustments>) =>
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...clearResult(i), adjustments: { ...i.adjustments, ...patch } } : i)),
    );

  const applyPreset = (presetId: string) => {
    if (!selected) return;
    const preset = ADJUST_PRESETS.find((p) => p.id === presetId);
    if (preset) updateAdjustments(selected.key, { ...preset.values });
  };

  const resetAdjustments = () => {
    if (!selected) return;
    updateAdjustments(selected.key, { ...IDENTITY_ADJUSTMENTS });
  };

  const runAuto = () => {
    if (!selected) return;
    const img = imgCache.current.get(selected.key);
    if (!img) {
      toast.error("Image is still loading.");
      return;
    }
    try {
      updateAdjustments(selected.key, autoAdjust(img));
      toast.success("Auto-enhanced — fine-tune any slider.");
    } catch {
      toast.error("Could not analyze the image.");
    }
  };

  const applyOne = async (item: AdjustItem) => {
    const img = imgCache.current.get(item.key);
    if (!img) throw new Error(`${item.file.name} is still loading.`);
    const rendered = renderAdjusted(img, item.adjustments);
    const blob = await canvasToBlob(rendered, format, quality);
    const url = URL.createObjectURL(blob);
    setItems((prev) =>
      prev.map((i) => {
        if (i.key !== item.key) return i;
        if (i.result) URL.revokeObjectURL(i.result.url);
        return {
          ...i,
          result: { blob, url, width: rendered.width, height: rendered.height, ext: format.ext },
          status: "done",
        };
      }),
    );
  };

  const runApply = async (targets: AdjustItem[]) => {
    if (applying || targets.length === 0) return;
    setApplying(true);
    try {
      for (const item of targets) await applyOne(item);
      toast.success(targets.length === 1 ? "Adjusted image ready." : `${targets.length} images adjusted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not adjust the image.");
    } finally {
      setApplying(false);
    }
  };

  const download = (item: AdjustItem) => {
    if (!item.result) return;
    downloadBlob(item.result.blob, `${baseName(item.file.name)}-adjusted.${item.result.ext}`);
    patchItem(item.key, { status: "downloaded" });
  };

  const downloadAll = async () => {
    const done = itemsRef.current.filter((i) => i.result);
    if (done.length === 0) return;
    if (done.length === 1) {
      download(done[0]);
      return;
    }
    try {
      const zip = await createZip(
        done.map((i) => ({
          name: `${baseName(i.file.name)}-adjusted.${i.result!.ext}`,
          blob: i.result!.blob,
        })),
      );
      downloadBlob(zip, `adjusted-${timestamp()}.zip`);
      done.forEach((i) => patchItem(i.key, { status: "downloaded" }));
      toast.success(`Downloading ${done.length} images as a ZIP…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build the ZIP.");
    }
  };

  const removeItem = (key: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.key === key);
      if (target) {
        URL.revokeObjectURL(target.url);
        if (target.result) URL.revokeObjectURL(target.result.url);
        imgCache.current.delete(key);
      }
      const next = prev.filter((i) => i.key !== key);
      setSelectedKey((cur) => (cur === key ? (next[0]?.key ?? null) : cur));
      return next;
    });
  };

  const clearAll = () => {
    itemsRef.current.forEach((i) => {
      URL.revokeObjectURL(i.url);
      if (i.result) URL.revokeObjectURL(i.result.url);
    });
    imgCache.current.clear();
    setItems([]);
    setSelectedKey(null);
  };

  const doneCount = items.filter((i) => i.result).length;
  const loading = selected !== null && selected.width === 0;

  return (
    <AuthGate>
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
            Adjust &amp; Filters
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Polish photos with brightness, contrast, saturation, warmth, hue and vignette controls —
            or hit <span className="font-semibold text-foreground">Auto</span> to analyse the image and
            set all six for you. Export PNG, JPG or WEBP. Everything happens in this browser.
          </p>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-container/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" />
          <p className="text-sm text-on-surface-variant">
            <span className="font-display font-semibold text-foreground">Your photos stay private.</span>{" "}
            Images are edited on this computer only — nothing is uploaded and closing the tab clears
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
          {/* Left: preview + queue */}
          <section className="flex flex-col gap-4 lg:col-span-8">
            {selected ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold">
                    <ImageIcon className="h-5 w-5 shrink-0 text-on-surface-variant" />
                    <span className="truncate">{selected.file.name}</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={runAuto}>
                      <Sparkles className="h-4 w-4" />
                      Auto
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={resetAdjustments}>
                      <RefreshCcw className="h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </div>

                <div className="relative rounded-xl border border-outline-variant/10 bg-[repeating-conic-gradient(#00000010_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] p-3">
                  <div
                    ref={zoomPan.viewportRef}
                    onPointerDown={zoomPan.onPointerDown}
                    onPointerMove={zoomPan.onPointerMove}
                    onPointerUp={zoomPan.onPointerUp}
                    onPointerLeave={zoomPan.onPointerUp}
                    onDoubleClick={zoomPan.onDoubleClick}
                    className="relative flex h-[60vh] w-full items-center justify-center overflow-hidden"
                    style={zoomPan.viewportStyle}
                  >
                    <canvas
                      ref={previewRef}
                      className="max-h-full w-auto max-w-full rounded-lg object-contain"
                      style={zoomPan.contentStyle}
                    />
                    {loading && (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-on-surface-variant">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Preparing preview…
                      </div>
                    )}
                  </div>

                  {!loading && (
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
                  <div className="min-w-0">
                    <p className="font-display text-[13px] font-semibold text-foreground">
                      {selected.width > 0 ? formatPixels(selected.width, selected.height) : "…"}
                      {isIdentity(selected.adjustments) ? "" : " · adjusted"}
                    </p>
                    <p className="font-mono text-xs text-on-surface-variant">
                      {selected.result
                        ? `Output ${formatBytes(selected.result.blob.size)} ${selected.result.ext.toUpperCase()}`
                        : "Adjust, then apply to export."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={applying}
                    onClick={() => void runApply([selected])}
                  >
                    {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Apply
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
                <Dropzone kind="image" accept="image/*" onFiles={addFiles} />
                <p className="mt-3 text-center text-sm text-on-surface-variant">
                  Drop one or more images to start adjusting.
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
                  Images ({items.length})
                </h3>
                {items.map((item) => (
                  <div
                    key={item.key}
                    onClick={() => setSelectedKey(item.key)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border-l-2 p-2.5 transition-colors",
                      item.key === selected?.key
                        ? "border-primary-container bg-primary-container/10"
                        : "border-transparent hover:bg-surface-container-high/60",
                      item.result && item.key === selected?.key && "border-l-2 border-emerald-500",
                    )}
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-outline-variant/20 bg-surface-container-high">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.result?.url ?? item.url}
                        alt={item.file.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[13px] font-semibold text-foreground">
                        {item.file.name}
                      </p>
                      <p className="font-mono text-xs text-on-surface-variant">
                        {item.result
                          ? `Done · ${formatPixels(item.result.width, item.result.height)} · ${formatBytes(
                              item.result.blob.size,
                            )}`
                          : item.status === "downloaded"
                            ? "Saved"
                            : isIdentity(item.adjustments)
                              ? item.width > 0
                                ? formatPixels(item.width, item.height)
                                : "Loading…"
                              : `Preset: ${matchPreset(item.adjustments)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.result && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 px-2.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            download(item);
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Download</span>
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${item.file.name}`}
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(item.key);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-on-surface-variant" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Right: settings */}
          <aside className="lg:col-span-4">
            <div className="flex flex-col gap-6 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-xl font-medium">
                  <SlidersHorizontal className="h-5 w-5 text-on-surface-variant" />
                  Adjustments
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!selected}
                  onClick={runAuto}
                >
                  <Sparkles className="h-4 w-4" />
                  Auto
                </Button>
              </div>

              <div className="space-y-2">
                <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Filters
                </label>
                <div className="flex flex-wrap gap-2">
                  {ADJUST_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={!selected}
                      onClick={() => applyPreset(preset.id)}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-lg border px-3 font-mono text-xs font-semibold transition-colors disabled:opacity-40",
                        activePreset === preset.id
                          ? "border-primary bg-primary-container/15 text-primary"
                          : "border-outline-variant/30 text-foreground hover:border-primary/50",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {SLIDERS.map((slider) => {
                  const value = selected ? selected.adjustments[slider.key] : 0;
                  return (
                    <div key={slider.key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-display text-[13px] font-semibold text-on-surface-variant">
                          {slider.label}
                        </label>
                        <span className="font-mono text-xs text-on-surface-variant">
                          {value > 0 ? `+${value}` : value}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={slider.min}
                        max={slider.max}
                        step={1}
                        value={value}
                        disabled={!selected}
                        onChange={(e) =>
                          selected &&
                          updateAdjustments(selected.key, { [slider.key]: Number(e.target.value) })
                        }
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-container-high accent-primary disabled:opacity-40"
                      />
                    </div>
                  );
                })}
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
                  onClick={() => selected && void runApply([selected])}
                  disabled={!selected || applying}
                  className="w-full gap-2 rounded-xl py-4"
                  size="lg"
                >
                  {applying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Applying…
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Apply this image
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  disabled={items.length === 0 || applying}
                  onClick={() => void runApply(itemsRef.current)}
                >
                  <FileArchive className="h-4 w-4" />
                  Apply all ({items.length})
                </Button>

                {doneCount > 0 && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 whitespace-normal text-center"
                    onClick={() => void downloadAll()}
                    disabled={applying}
                  >
                    <Download className="h-4 w-4" />
                    Download All ({doneCount}){doneCount > 1 ? " — ZIP" : ""}
                  </Button>
                )}

                {items.length > 0 && (
                  <Button variant="ghost" className="w-full gap-2 text-primary" onClick={clearAll} disabled={applying}>
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
