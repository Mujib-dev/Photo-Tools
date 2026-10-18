"use client";

import * as React from "react";
import {
  AlertTriangle,
  Download,
  Eraser,
  FileSearch,
  ImageIcon,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { ZoomControls } from "@/components/zoom-controls";
import { downloadBlob } from "@/lib/screenshot";
import { baseName, loadImageElement, uid } from "@/lib/image-edit";
import { readImageMeta, stripMetadata, type ImageMeta } from "@/lib/exif";
import { createZip } from "@/lib/zip";
import { formatBytes, formatPixels } from "@/lib/format";
import { useZoomPan } from "@/lib/use-zoom-pan";
import { cn } from "@/lib/utils";

interface StripResult {
  blob: Blob;
  url: string;
  size: number;
  ext: string;
}

interface ExifItem {
  key: string;
  file: File;
  url: string;
  width: number;
  height: number;
  state: "loading" | "ready" | "error";
  meta: ImageMeta | null;
  result: StripResult | null;
  status: "ready" | "done" | "downloaded";
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes(),
  )}${pad(d.getSeconds())}`;
}

export function ExifTool() {
  const [items, setItems] = React.useState<ExifItem[]>([]);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);

  const itemsRef = React.useRef<ExifItem[]>([]);
  itemsRef.current = items;
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = items.find((i) => i.key === selectedKey) ?? null;
  const zoomPan = useZoomPan(selected?.key);

  const patchItem = (key: string, patch: Partial<ExifItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const addFiles = React.useCallback((files: File[]) => {
    const existing = new Set(itemsRef.current.map((i) => i.file));
    const added = files.filter((f) => f.type.startsWith("image/") && !existing.has(f));
    if (added.length === 0) return;

    const newItems: ExifItem[] = added.map((f) => ({
      key: uid(),
      file: f,
      url: URL.createObjectURL(f),
      width: 0,
      height: 0,
      state: "loading",
      meta: null,
      result: null,
      status: "ready",
    }));

    setItems((prev) => [...prev, ...newItems]);
    setSelectedKey((k) => k ?? newItems[0].key);

    for (const item of newItems) {
      void loadImageElement(item.url)
        .then(async (img) => {
          const meta = await readImageMeta(item.file, img.naturalWidth, img.naturalHeight);
          patchItem(item.key, {
            width: img.naturalWidth,
            height: img.naturalHeight,
            meta,
            state: "ready",
          });
        })
        .catch(() => {
          patchItem(item.key, { state: "error" });
          toast.error(`Could not read ${item.file.name}.`);
        });
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

  const stripOne = async (item: ExifItem): Promise<StripResult> => {
    const { blob, ext } = await stripMetadata(item.file);
    const url = URL.createObjectURL(blob);
    const result: StripResult = { blob, url, size: blob.size, ext };
    setItems((prev) =>
      prev.map((i) => {
        if (i.key !== item.key) return i;
        if (i.result) URL.revokeObjectURL(i.result.url);
        return { ...i, result, status: "done" as const };
      }),
    );
    return result;
  };

  const stripAndDownload = async () => {
    if (!selected || working) return;
    setWorking(true);
    try {
      const result = await stripOne(selected);
      downloadBlob(result.blob, `${baseName(selected.file.name)}-clean.${result.ext}`);
      toast.success("Metadata removed and downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not strip metadata.");
    } finally {
      setWorking(false);
    }
  };

  const stripAll = async () => {
    if (working || items.length === 0) return;
    setWorking(true);
    try {
      const cleaned: { name: string; blob: Blob }[] = [];
      for (const item of itemsRef.current) {
        const result = await stripOne(item);
        cleaned.push({ name: `${baseName(item.file.name)}-clean.${result.ext}`, blob: result.blob });
      }
      if (cleaned.length === 1) {
        downloadBlob(cleaned[0].blob, cleaned[0].name);
      } else {
        const zip = await createZip(cleaned);
        downloadBlob(zip, `metadata-stripped-${timestamp()}.zip`);
      }
      toast.success(`Downloading ${cleaned.length} cleaned image${cleaned.length === 1 ? "" : "s"}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not strip metadata.");
    } finally {
      setWorking(false);
    }
  };

  const removeItem = (key: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.key === key);
      if (target) {
        URL.revokeObjectURL(target.url);
        if (target.result) URL.revokeObjectURL(target.result.url);
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
    setItems([]);
    setSelectedKey(null);
  };

  const meta = selected?.meta ?? null;
  const loadedCount = items.filter((i) => i.state === "ready").length;

  return (
    <AuthGate>
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
            Metadata &amp; EXIF
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            See exactly what your photos reveal — camera, settings, timestamps and GPS — then remove
            it in one click. JPEG and PNG are stripped losslessly, right in this browser.
          </p>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-container/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" />
          <p className="text-sm text-on-surface-variant">
            <span className="font-display font-semibold text-foreground">Nothing is uploaded.</span>{" "}
            Files are read and rewritten on this computer only — closing the tab clears everything.
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
          {/* Left: preview + metadata */}
          <section className="flex flex-col gap-4 lg:col-span-8">
            {selected ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold">
                    <ImageIcon className="h-5 w-5 shrink-0 text-on-surface-variant" />
                    <span className="truncate">{selected.file.name}</span>
                  </h2>
                  {selected.state === "ready" && meta && (
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 font-mono text-xs font-semibold",
                        meta.hasMetadata
                          ? "bg-amber-500/15 text-amber-500"
                          : "bg-emerald-500/15 text-emerald-500",
                      )}
                    >
                      {meta.hasMetadata ? `${meta.tags.length} tags` : "No metadata"}
                    </span>
                  )}
                </div>

                <div className="relative rounded-xl border border-outline-variant/10 bg-[repeating-conic-gradient(#00000010_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] p-3">
                  <div
                    ref={zoomPan.viewportRef}
                    onPointerDown={zoomPan.onPointerDown}
                    onPointerMove={zoomPan.onPointerMove}
                    onPointerUp={zoomPan.onPointerUp}
                    onPointerLeave={zoomPan.onPointerUp}
                    onDoubleClick={zoomPan.onDoubleClick}
                    className="relative flex h-[46vh] w-full items-center justify-center overflow-hidden"
                    style={zoomPan.viewportStyle}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selected.result?.url ?? selected.url}
                      alt={selected.file.name}
                      style={zoomPan.contentStyle}
                      className="max-h-full w-auto max-w-full rounded-lg object-contain"
                    />
                  </div>
                  <ZoomControls
                    className="absolute right-5 top-5 z-10"
                    zoom={zoomPan.zoom}
                    onZoomIn={() => zoomPan.zoomBy(1.25)}
                    onZoomOut={() => zoomPan.zoomBy(1 / 1.25)}
                    onReset={zoomPan.resetZoom}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
                <Dropzone kind="image" accept="image/*" onFiles={addFiles} />
                <p className="mt-3 text-center text-sm text-on-surface-variant">
                  Drop one or more photos to inspect and clean their metadata.
                </p>
              </div>
            )}

            {selected && (
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
                  <FileSearch className="h-5 w-5 text-on-surface-variant" />
                  Details
                </h3>

                {selected.state === "loading" && (
                  <p className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reading metadata…
                  </p>
                )}

                {selected.state === "error" && (
                  <p className="flex items-center gap-2 text-sm text-amber-500">
                    <AlertTriangle className="h-4 w-4" />
                    Could not read this file.
                  </p>
                )}

                {selected.state === "ready" && meta && (
                  <div className="flex flex-col gap-4">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      <Row label="Dimensions" value={formatPixels(meta.width, meta.height)} />
                      <Row label="File size" value={formatBytes(meta.size)} />
                      <Row label="Type" value={meta.type} />
                      <Row label="Modified" value={new Date(meta.lastModified).toLocaleString()} />
                      <Row
                        label="GPS location"
                        value={
                          meta.gps
                            ? `${meta.gps.lat.toFixed(6)}, ${meta.gps.lon.toFixed(6)}`
                            : "None"
                        }
                        icon={meta.gps ? <MapPin className="h-3.5 w-3.5 text-amber-500" /> : undefined}
                      />
                    </dl>

                    {meta.tags.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-outline-variant/10">
                        <div className="max-h-80 overflow-auto">
                          <table className="w-full border-collapse text-sm">
                            <tbody>
                              {meta.tags.map((t, i) => (
                                <tr
                                  key={`${t.tag}-${i}`}
                                  className={cn(i % 2 === 1 && "bg-muted/30")}
                                >
                                  <td className="w-1/2 px-3 py-1.5 align-top font-display text-[13px] font-semibold text-on-surface-variant">
                                    {t.name}
                                  </td>
                                  <td className="break-words px-3 py-1.5 align-top font-mono text-xs text-foreground">
                                    {t.value || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-on-surface-variant">
                        No EXIF metadata found in this image.
                      </p>
                    )}
                  </div>
                )}
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
                        {item.state === "loading"
                          ? "Reading…"
                          : item.state === "error"
                            ? "Unreadable"
                            : item.result
                              ? `Cleaned · ${formatBytes(item.result.size)}`
                              : item.meta?.hasMetadata
                                ? `${item.meta.tags.length} tags`
                                : item.status === "downloaded"
                                  ? "Saved"
                                  : "No metadata"}
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
                            downloadBlob(
                              item.result!.blob,
                              `${baseName(item.file.name)}-clean.${item.result!.ext}`,
                            );
                            patchItem(item.key, { status: "downloaded" });
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

          {/* Right: actions */}
          <aside className="lg:col-span-4">
            <div className="flex flex-col gap-6 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
              <h2 className="flex items-center gap-2 font-display text-xl font-medium">
                <Eraser className="h-5 w-5 text-on-surface-variant" />
                Clean metadata
              </h2>

              <p className="text-sm text-on-surface-variant">
                Stripping removes EXIF, GPS, timestamps and comments. JPEG/PNG pixels are copied
                untouched, so quality is preserved; other formats are re-encoded to PNG.
              </p>

              <div className="space-y-2">
                <Button
                  onClick={() => void stripAndDownload()}
                  disabled={!selected || selected.state !== "ready" || working}
                  className="w-full gap-2 rounded-xl py-4"
                  size="lg"
                >
                  {working ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Working…
                    </>
                  ) : (
                    <>
                      <Eraser className="h-4 w-4" />
                      Strip &amp; download
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  className="w-full gap-2 whitespace-normal text-center"
                  disabled={items.length === 0 || working}
                  onClick={() => void stripAll()}
                >
                  <Download className="h-4 w-4" />
                  Strip all ({loadedCount}){items.length > 1 ? " — ZIP" : ""}
                </Button>

                {items.length > 0 && (
                  <Button variant="ghost" className="w-full gap-2 text-primary" onClick={clearAll} disabled={working}>
                    <Trash2 className="h-4 w-4" />
                    Clear all
                  </Button>
                )}
              </div>

              <div className="rounded-xl border border-outline-variant/10 bg-muted/30 p-3">
                <p className="flex items-start gap-2 text-xs text-on-surface-variant">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  WebP, HEIC and other formats are converted to PNG when cleaned.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AuthGate>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-outline-variant/10 pb-1.5">
      <dt className="shrink-0 font-display text-[13px] font-semibold text-on-surface-variant">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 truncate font-mono text-xs text-foreground">
        {icon}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}
