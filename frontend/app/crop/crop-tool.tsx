"use client";

import * as React from "react";
import {
  Download,
  FileArchive,
  FlipHorizontal2,
  FlipVertical2,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { CropSelector } from "@/components/crop/crop-selector";
import { downloadBlob } from "@/lib/screenshot";
import {
  FULL_RECT,
  IDENTITY_TRANSFORM,
  OUTPUT_FORMATS,
  baseName,
  canvasToBlob,
  cropCanvas,
  fitAspectRect,
  getOutputFormat,
  loadImageElement,
  renderTransformed,
  rotateBy,
  transformedSize,
  uid,
  type NormRect,
  type Transform,
} from "@/lib/image-edit";
import { createZip } from "@/lib/zip";
import { formatBytes, formatPixels } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CropResult {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  ext: string;
}

interface CropItem {
  key: string;
  file: File;
  url: string;
  width: number;
  height: number;
  transform: Transform;
  crop: NormRect;
  result: CropResult | null;
  status: "ready" | "done" | "downloaded";
}

const ASPECT_PRESETS: { value: string; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "original", label: "Original" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

function presetAspect(value: string, tw: number, th: number): number | null {
  if (value === "free") return null;
  if (value === "original") return th > 0 ? tw / th : null;
  const [a, b] = value.split(":").map(Number);
  return a > 0 && b > 0 ? a / b : null;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes(),
  )}${pad(d.getSeconds())}`;
}

export function CropTool() {
  const [items, setItems] = React.useState<CropItem[]>([]);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [aspect, setAspect] = React.useState("free");
  const [formatValue, setFormatValue] = React.useState("png");
  const [quality, setQuality] = React.useState(0.9);
  const [applying, setApplying] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [resetNonce, setResetNonce] = React.useState(0);
  const [imageNonce, setImageNonce] = React.useState(0);

  const itemsRef = React.useRef<CropItem[]>([]);
  itemsRef.current = items;
  const imgCache = React.useRef(new Map<string, HTMLImageElement>());
  const inputRef = React.useRef<HTMLInputElement>(null);

  const format = getOutputFormat(formatValue);
  const selected = items.find((i) => i.key === selectedKey) ?? null;

  const addFiles = React.useCallback((files: File[]) => {
    const existing = new Set(itemsRef.current.map((i) => i.file));
    const added = files.filter((f) => f.type.startsWith("image/") && !existing.has(f));
    if (added.length === 0) return;

    const newItems: CropItem[] = added.map((f) => ({
      key: uid(),
      file: f,
      url: URL.createObjectURL(f),
      width: 0,
      height: 0,
      transform: { ...IDENTITY_TRANSFORM },
      crop: { ...FULL_RECT },
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

  // Render the rotated/flipped preview whenever the selection or transform changes.
  const tKey = selected
    ? `${selected.key}:${selected.transform.rotate}:${selected.transform.flipH}:${selected.transform.flipV}`
    : "";

  React.useEffect(() => {
    if (!selected) {
      setPreviewUrl(null);
      return;
    }
    const img = imgCache.current.get(selected.key);
    if (!img) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    let created: string | null = null;
    try {
      const canvas = renderTransformed(img, selected.transform, 1600);
      canvas.toBlob((blob) => {
        if (cancelled || !blob) return;
        created = URL.createObjectURL(blob);
        setPreviewUrl(created);
      }, "image/png");
    } catch {
      setPreviewUrl(null);
    }
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tKey, imageNonce]);

  const clearResult = (item: CropItem): CropItem => {
    if (item.result) URL.revokeObjectURL(item.result.url);
    return { ...item, result: null, status: "ready" };
  };

  const patchItem = (key: string, patch: Partial<CropItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const updateTransform = (key: string, fn: (t: Transform) => Transform) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...clearResult(i), transform: fn(i.transform) } : i)));

  const updateCrop = (key: string, crop: NormRect) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...clearResult(i), crop } : i)));

  const rotate = (delta: 90 | -90) => {
    if (!selected) return;
    updateTransform(selected.key, (t) => ({ ...t, rotate: rotateBy(t.rotate, delta) }));
  };

  const flip = (axis: "h" | "v") => {
    if (!selected) return;
    updateTransform(selected.key, (t) => (axis === "h" ? { ...t, flipH: !t.flipH } : { ...t, flipV: !t.flipV }));
  };

  const resetCrop = () => {
    if (!selected) return;
    updateCrop(selected.key, { ...FULL_RECT });
    setResetNonce((n) => n + 1);
  };

  const resetAll = () => {
    if (!selected) return;
    setItems((prev) =>
      prev.map((i) => (i.key === selected.key ? { ...clearResult(i), transform: { ...IDENTITY_TRANSFORM }, crop: { ...FULL_RECT } } : i)),
    );
    setAspect("free");
    setResetNonce((n) => n + 1);
  };

  const changeAspect = (value: string) => {
    setAspect(value);
    const item = selected;
    if (!item || !item.width) return;
    const { width: tw, height: th } = transformedSize(item.width, item.height, item.transform);
    const target = presetAspect(value, tw, th);
    if (target == null) return;
    updateCrop(item.key, fitAspectRect(target * (th / tw)));
    setResetNonce((n) => n + 1);
  };

  const applyOne = async (item: CropItem) => {
    const img = imgCache.current.get(item.key);
    if (!img) throw new Error(`${item.file.name} is still loading.`);
    const full = renderTransformed(img, item.transform);
    const cropped = cropCanvas(full, item.crop);
    const blob = await canvasToBlob(cropped, format, quality);
    const url = URL.createObjectURL(blob);
    setItems((prev) =>
      prev.map((i) => {
        if (i.key !== item.key) return i;
        if (i.result) URL.revokeObjectURL(i.result.url);
        return {
          ...i,
          result: { blob, url, width: cropped.width, height: cropped.height, ext: format.ext },
          status: "done",
        };
      }),
    );
  };

  const runApply = async (targets: CropItem[]) => {
    if (applying || targets.length === 0) return;
    setApplying(true);
    try {
      for (const item of targets) await applyOne(item);
      toast.success(targets.length === 1 ? "Cropped image ready." : `${targets.length} images cropped.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not crop the image.");
    } finally {
      setApplying(false);
    }
  };

  const download = (item: CropItem) => {
    if (!item.result) return;
    downloadBlob(item.result.blob, `${baseName(item.file.name)}-cropped.${item.result.ext}`);
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
          name: `${baseName(i.file.name)}-cropped.${i.result!.ext}`,
          blob: i.result!.blob,
        })),
      );
      downloadBlob(zip, `cropped-${timestamp()}.zip`);
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
    setPreviewUrl(null);
  };

  const tSize = selected ? transformedSize(selected.width, selected.height, selected.transform) : null;
  const outW = selected && tSize ? Math.max(1, Math.round(selected.crop.width * tSize.width)) : 0;
  const outH = selected && tSize ? Math.max(1, Math.round(selected.crop.height * tSize.height)) : 0;
  const doneCount = items.filter((i) => i.result).length;

  return (
    <AuthGate>
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
            Crop &amp; Rotate
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Straighten and reframe photos — rotate, flip and drag a crop box with handy aspect
            presets, then export PNG, JPG or WEBP. Everything happens in this browser.
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
          {/* Left: editor + queue */}
          <section className="flex flex-col gap-4 lg:col-span-8">
            {selected ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold">
                    <ImageIcon className="h-5 w-5 shrink-0 text-on-surface-variant" />
                    <span className="truncate">{selected.file.name}</span>
                  </h2>
                  <Button variant="outline" size="sm" className="gap-2" onClick={resetAll}>
                    <RefreshCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>

                <div className="flex justify-center rounded-xl border border-outline-variant/10 bg-[repeating-conic-gradient(#00000010_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] p-3">
                  {previewUrl ? (
                    <CropSelector
                      key={`${selected.key}:${selected.transform.rotate}:${selected.transform.flipH}:${selected.transform.flipV}:${aspect}:${resetNonce}`}
                      imageUrl={previewUrl}
                      aspect={tSize ? presetAspect(aspect, tSize.width, tSize.height) : null}
                      initial={selected.crop}
                      onChange={(rect) => updateCrop(selected.key, rect)}
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center text-sm text-on-surface-variant">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Preparing preview…
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-outline-variant/10 bg-muted/30 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-display text-[13px] font-semibold text-foreground">
                      Crop {outW} × {outH} px
                    </p>
                    <p className="font-mono text-xs text-on-surface-variant">
                      Source {selected.width > 0 ? formatPixels(selected.width, selected.height) : "…"}
                      {selected.result &&
                        ` · Output ${formatBytes(selected.result.blob.size)} ${selected.result.ext.toUpperCase()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={resetCrop}>
                      Reset crop
                    </Button>
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
              </div>
            ) : (
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
                <Dropzone kind="image" accept="image/*" onFiles={addFiles} />
                <p className="mt-3 text-center text-sm text-on-surface-variant">
                  Drop one or more images to start cropping and rotating.
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
                            : item.width > 0
                              ? formatPixels(item.width, item.height)
                              : "Loading…"}
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
              <div>
                <h2 className="font-display text-xl font-medium">Crop &amp; Rotate</h2>
              </div>

              <div className="space-y-2">
                <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Transform
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!selected}
                    onClick={() => rotate(-90)}
                    className="flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant/30 font-mono text-xs font-semibold text-foreground transition-colors hover:border-primary/50 disabled:opacity-40"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Left
                  </button>
                  <button
                    type="button"
                    disabled={!selected}
                    onClick={() => rotate(90)}
                    className="flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant/30 font-mono text-xs font-semibold text-foreground transition-colors hover:border-primary/50 disabled:opacity-40"
                  >
                    <RotateCw className="h-4 w-4" />
                    Right
                  </button>
                  <button
                    type="button"
                    disabled={!selected}
                    onClick={() => flip("h")}
                    className="flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant/30 font-mono text-xs font-semibold text-foreground transition-colors hover:border-primary/50 disabled:opacity-40"
                  >
                    <FlipHorizontal2 className="h-4 w-4" />
                    Flip H
                  </button>
                  <button
                    type="button"
                    disabled={!selected}
                    onClick={() => flip("v")}
                    className="flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant/30 font-mono text-xs font-semibold text-foreground transition-colors hover:border-primary/50 disabled:opacity-40"
                  >
                    <FlipVertical2 className="h-4 w-4" />
                    Flip V
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Aspect ratio
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      disabled={!selected}
                      onClick={() => changeAspect(preset.value)}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-lg border px-1 font-mono text-xs font-semibold transition-colors disabled:opacity-40",
                        aspect === preset.value
                          ? "border-primary bg-primary-container/15 text-primary"
                          : "border-outline-variant/30 text-foreground hover:border-primary/50",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
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
                      Cropping…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Crop this image
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
                  Crop all ({items.length})
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
