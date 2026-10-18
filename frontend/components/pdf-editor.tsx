"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  FileCheck2,
  Highlighter,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Minus,
  PencilLine,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Search,
  Trash2,
  Type as TypeIcon,
  Undo2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pdfPreviewUrl, previewPdf } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  PdfEditAnnotation,
  PdfEditFont,
  PdfEditPlan,
  PdfPreview,
  PdfTextLine,
} from "@/lib/types";

/**
 * Preview rasters come back from the engine at 96 dpi, so this is the display
 * size of a PDF point at 100% zoom. Anything above that magnifies the raster,
 * which is why the overlay text is drawn as vector on top of it.
 */
const PREVIEW_DPI = 96;
const NATIVE_SCALE = PREVIEW_DPI / 72;
const ZOOM_MIN = 25;
const ZOOM_MAX = 400;
const ZOOM_STEPS = [50, 75, 100, 150, 200, 300, 400];

/** Engine colours are packed sRGB integers; CSS wants #rrggbb. */
function packedToCss(value: number): string {
  return `#${((value >>> 0) & 0xffffff).toString(16).padStart(6, "0")}`;
}

/** Rough CSS family for previewing a replaced line. */
function fontFamilyOf(font: string): string {
  const lower = font.toLowerCase();
  if (lower.includes("mono") || lower.includes("courier")) return "monospace";
  if (lower.includes("times") || lower.includes("serif") || lower.includes("georgia")) {
    return "serif";
  }
  return "sans-serif";
}

function fontWeightOf(font: string): number {
  return /bold|black|heavy|semibold|demi|[-_]?b\b/i.test(font) ? 700 : 400;
}

const COLORS = ["#000000", "#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed"];
const FONTS: { value: PdfEditFont; label: string }[] = [
  { value: "helv", label: "Sans" },
  { value: "hebo", label: "Sans bold" },
  { value: "cour", label: "Mono" },
  { value: "cobo", label: "Mono bold" },
];

type Tool = "select" | "text" | "image" | "draw" | "highlight" | "edit-text";

/** A line of existing text queued up for rewriting. */
interface LineEditTarget {
  pageId: string;
  line: PdfTextLine;
  /** Index within the page's line list, used to count duplicate matches. */
  index: number;
}

/**
 * A page while it is being edited. `id` is stable for the whole session so
 * overlays stay attached to their page when pages are reordered or deleted —
 * only the final index is resolved when the plan is submitted.
 */
interface WorkingPage {
  id: string;
  src: number;
  rotate: 0 | 90 | 180 | 270;
}

/** An overlay bound to a page id rather than a position. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type WorkingAnnotation = DistributiveOmit<PdfEditAnnotation, "page"> & {
  pageId: string;
  /**
   * Canvas-only geometry of the line a rewrite came from. It lets the editor
   * draw the new text on the original baseline, and is dropped on submit.
   */
  preview?: PdfTextLine;
};

interface Snapshot {
  pages: WorkingPage[];
  annotations: WorkingAnnotation[];
}

export interface PdfEditorProps {
  file: File;
  onApply: (plan: PdfEditPlan, assets: File[]) => void;
  running?: boolean;
}

export function PdfEditor({ file, onApply, running = false }: PdfEditorProps) {
  const [preview, setPreview] = React.useState<PdfPreview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [pages, setPages] = React.useState<WorkingPage[]>([]);
  const [annotations, setAnnotations] = React.useState<WorkingAnnotation[]>([]);
  const [metadata, setMetadata] = React.useState<PdfEditPlan["metadata"]>({});
  const [assets, setAssets] = React.useState<File[]>([]);

  const [tool, setTool] = React.useState<Tool>("select");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [color, setColor] = React.useState(COLORS[0]);
  const [font, setFont] = React.useState<PdfEditFont>("helv");
  const [fontSize, setFontSize] = React.useState(18);
  const [draft, setDraft] = React.useState<[number, number][] | null>(null);

  // --- view -------------------------------------------------------------
  const [zoom, setZoom] = React.useState(100);

  // --- inline text editing ----------------------------------------------
  const [lineEdit, setLineEdit] = React.useState<LineEditTarget | null>(null);
  const [lineDraft, setLineDraft] = React.useState("");
  const [showFind, setShowFind] = React.useState(false);
  const [findText, setFindText] = React.useState("");
  const [replaceText, setReplaceText] = React.useState("");
  const [findScope, setFindScope] = React.useState<"page" | "all">("all");
  const [notice, setNotice] = React.useState<string | null>(null);

  const [undoStack, setUndoStack] = React.useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = React.useState<Snapshot[]>([]);

  // --- preview load ------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    previewPdf(file)
      .then((result) => {
        if (cancelled) return;
        setPreview(result);
        const loaded = result.pages.map((p) => ({ id: `p${p.index}`, src: p.index, rotate: 0 as const }));
        setPages(loaded);
        setAnnotations([]);
        setActiveId(loaded[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not preview this PDF.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Object URLs for overlay images, created once per asset list and revoked
  // when the assets change, so rendering never leaks a URL.
  const assetUrls = React.useMemo(() => {
    const urls = new Map<string, string>();
    for (const asset of assets) urls.set(asset.name, URL.createObjectURL(asset));
    return urls;
  }, [assets]);
  React.useEffect(() => {
    const urls = assetUrls;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, [assetUrls]);

  const snapshot = React.useCallback(
    (): Snapshot => ({ pages, annotations }),
    [pages, annotations],
  );

  /** Record the current state so the next mutation can be undone. */
  const commit = React.useCallback(() => {
    setUndoStack((stack) => [...stack.slice(-49), snapshot()]);
    setRedoStack([]);
  }, [snapshot]);

  const undo = React.useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((stack) => [...stack, snapshot()]);
    setUndoStack((stack) => stack.slice(0, -1));
    setPages(previous.pages);
    setAnnotations(previous.annotations);
  }, [redoStack, snapshot, undoStack]);

  const redo = React.useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((stack) => [...stack, snapshot()]);
    setRedoStack((stack) => stack.slice(0, -1));
    setPages(next.pages);
    setAnnotations(next.annotations);
  }, [redoStack, snapshot]);

  // --- page operations ---------------------------------------------------
  const rotatePage = (id: string, delta: number) => {
    commit();
    setPages((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, rotate: (((entry.rotate + delta) % 360) as WorkingPage["rotate"]) }
          : entry,
      ),
    );
  };

  const deletePage = (id: string) => {
    if (pages.length <= 1) return;
    commit();
    setAnnotations((prev) => prev.filter((ann) => ann.pageId !== id));
    setPages((prev) => prev.filter((entry) => entry.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const movePage = (id: string, delta: number) => {
    const index = pages.findIndex((entry) => entry.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= pages.length) return;
    commit();
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  // --- canvas ------------------------------------------------------------
  const activeIndex = activeId ? pages.findIndex((entry) => entry.id === activeId) : -1;
  const active = activeIndex >= 0 ? pages[activeIndex] : undefined;
  const page = preview && active ? preview.pages[active.src] : undefined;
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);

  // The canvas is an explicit pixel size so it can overflow and scroll when
  // zoomed in, instead of being squeezed back down by max-w-full.
  const displayWidth = page ? Math.round(page.width * NATIVE_SCALE * (zoom / 100)) : 0;
  const displayHeight = page ? Math.round(page.height * NATIVE_SCALE * (zoom / 100)) : 0;

  const clampZoom = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value)));

  /** Zoom so the whole page width is visible. */
  const fitWidth = React.useCallback((target?: { width: number; height: number }) => {
    const el = canvasRef.current;
    const dims = target ?? (preview && active ? preview.pages[active.src] : undefined);
    if (!el || !dims) return;
    // 32px of breathing room so the page never touches the scrollbar.
    const available = Math.max(160, el.clientWidth - 32);
    setZoom(clampZoom((available / (dims.width * NATIVE_SCALE)) * 100));
  }, [preview, active]);

  // Fit the width once the first preview is on screen.
  const previewToken = preview?.token;
  React.useEffect(() => {
    if (!previewToken) return;
    const frame = requestAnimationFrame(() => fitWidth());
    return () => cancelAnimationFrame(frame);
    // Only on a new document; later user zoom changes must stick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewToken]);

  // Ctrl/Cmd + wheel zooms like a normal document viewer.
  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((prev) => clampZoom(prev + (event.deltaY < 0 ? 25 : -25)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [loading, loadError]);

  /** Map a pointer event into PDF points on the active page. */
  const toPoints = (event: React.PointerEvent): [number, number] | null => {
    const svg = svgRef.current;
    if (!svg || !page) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * page.width;
    const y = ((event.clientY - rect.top) / rect.height) * page.height;
    return [Math.max(0, Math.min(page.width, x)), Math.max(0, Math.min(page.height, y))];
  };

  const placeText = (point: [number, number]) => {
    const value = window.prompt("Text to add:");
    if (!value || !value.trim() || !active) return;
    commit();
    setAnnotations((prev) => [
      ...prev,
      { kind: "text", pageId: active.id, x: point[0], y: point[1], size: fontSize, font, color, text: value },
    ]);
  };

  const chooseImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = () => {
      const picked = input.files?.[0];
      if (picked) {
        setAssets((prev) => [...prev, picked]);
        setTool("image");
      }
    };
    input.click();
  };

  const placeImage = (asset: File, point: [number, number]) => {
    if (!page || !active) return;
    // Fit the image to a quarter of the page width, preserving its aspect.
    const w = page.width / 4;
    const url = URL.createObjectURL(asset);
    const probe = new Image();
    probe.onload = () => {
      const ratio = probe.naturalHeight / probe.naturalWidth || 1;
      commit();
      setAnnotations((prev) => [
        ...prev,
        { kind: "image", pageId: active.id, x: point[0], y: point[1], w, h: w * ratio, asset: asset.name },
      ]);
      URL.revokeObjectURL(url);
    };
    probe.onerror = () => URL.revokeObjectURL(url);
    probe.src = url;
  };

  const currentAsset = assets[assets.length - 1];

  // --- inline text editing ----------------------------------------------
  const pageLines = React.useMemo<PdfTextLine[]>(() => page?.lines ?? [], [page]);

  /**
   * Which match of `text` this line represents, so an edit aimed at the third
   * "Total" on a page does not land on the first one.
   */
  const occurrenceOf = (lines: PdfTextLine[], text: string, index: number): number => {
    let seen = 0;
    for (let i = 0; i < index && i < lines.length; i += 1) {
      if (lines[i].text === text) seen += 1;
    }
    return seen;
  };

  const addReplace = (
    pageId: string,
    find: string,
    text: string,
    occurrence: number,
    previewLine?: PdfTextLine,
  ) => {
    commit();
    const annotation: WorkingAnnotation = {
      kind: "replace",
      pageId,
      find,
      text,
      occurrence,
      ...(previewLine ? { preview: previewLine } : {}),
    };
    setAnnotations((prev) => [...prev, annotation]);
  };

  const openLineEdit = (target: LineEditTarget) => {
    setLineEdit(target);
    setLineDraft(target.line.text);
    setNotice(null);
  };

  const saveLineEdit = () => {
    if (!lineEdit) return;
    const next = lineDraft;
    const original = lineEdit.line.text;
    // An unchanged line is a no-op rather than a pointless redaction.
    if (next !== original) {
      addReplace(
        lineEdit.pageId,
        original,
        next,
        occurrenceOf(pageLines, original, lineEdit.index),
        lineEdit.line,
      );
    }
    setLineEdit(null);
    setTool("edit-text");
  };

  /** Lines that contain the search text, across the chosen scope. */
  const findMatches = React.useMemo(() => {
    const needle = findText.trim();
    if (!needle || !preview) return [] as { pageId: string; line: PdfTextLine; index: number }[];
    const scope = findScope === "all" ? pages : active ? [active] : [];
    const hits: { pageId: string; line: PdfTextLine; index: number }[] = [];
    for (const entry of scope) {
      const lines = preview.pages[entry.src]?.lines ?? [];
      lines.forEach((line, index) => {
        if (line.text.toLowerCase().includes(needle.toLowerCase())) {
          hits.push({ pageId: entry.id, line, index });
        }
      });
    }
    return hits;
  }, [findText, findScope, pages, active, preview]);

  const replaceAllMatches = () => {
    if (findMatches.length === 0) return;
    commit();
    // One annotation per page with occurrence -1: the engine then rewrites
    // every hit on that page, which stays correct when a page holds several.
    const scope = findScope === "all" ? pages : active ? [active] : [];
    setAnnotations((prev) => {
      const next = [...prev];
      for (const entry of scope) {
        const lines = preview?.pages[entry.src]?.lines ?? [];
        const hasHit = lines.some((line) =>
          line.text.toLowerCase().includes(findText.trim().toLowerCase()),
        );
        if (hasHit) {
          next.push({
            kind: "replace",
            pageId: entry.id,
            find: findText.trim(),
            text: replaceText,
            occurrence: -1,
          });
        }
      }
      return next;
    });
    setNotice(
      `Replacing “${findText.trim()}” on ${scope.length} page${scope.length === 1 ? "" : "s"}. Apply to save.`,
    );
  };

  const apply = () => {
    if (pages.length === 0) return;
    // Resolve stable page ids into the positions the engine will see.
    const order = new Map(pages.map((entry, index) => [entry.id, index]));
    // `preview` is canvas-only bookkeeping and has no meaning to the engine.
    const resolved: PdfEditAnnotation[] = annotations.map(
      ({ pageId, preview: _preview, ...ann }) => ({ ...ann, page: order.get(pageId) ?? 0 }),
    ) as PdfEditAnnotation[];
    const plan: PdfEditPlan = {
      pages: pages.map((entry) => ({ src: entry.src, rotate: entry.rotate })),
      annotations: resolved.filter((ann) => ann.page < pages.length),
      metadata,
    };
    onApply(plan, assets);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm text-on-surface-variant">Rendering page previews…</p>
      </div>
    );
  }

  if (loadError || !preview || !page || !active) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="font-display text-sm font-semibold">Could not open this PDF</p>
        <p className="mt-1 text-sm text-on-surface-variant">{loadError ?? "No preview was returned."}</p>
      </div>
    );
  }

  const tools: { id: Tool; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "select", label: "Select", icon: Search },
    { id: "edit-text", label: "Edit text", icon: PencilLine },
    { id: "text", label: "Add text", icon: TypeIcon },
    { id: "draw", label: "Draw", icon: PencilLine },
    { id: "highlight", label: "Highlight", icon: Highlighter },
  ];

  const onSurface = annotations.map((ann, index) => ({ ann, index })).filter(
    ({ ann }) => ann.pageId === active.id,
  );
  const replaceEdits = onSurface.filter(({ ann }) => ann.kind === "replace");
  const lineBox = (line: PdfTextLine) => ({
    x: line.bbox[0],
    y: line.bbox[1],
    width: Math.max(1, line.bbox[2] - line.bbox[0]),
    height: Math.max(1, line.bbox[3] - line.bbox[1]),
  });

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-3">
        {tools.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tool === id ? "default" : "outline"}
            onClick={() => setTool(id)}
            className="gap-1.5"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={tool === "image" ? "default" : "outline"}
          onClick={chooseImage}
          className="gap-1.5"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Image
        </Button>

        <Button
          type="button"
          size="sm"
          variant={showFind ? "default" : "outline"}
          onClick={() => setShowFind((prev) => !prev)}
          className="gap-1.5"
        >
          <Search className="h-3.5 w-3.5" />
          Find &amp; replace
        </Button>

        <div className="mx-1 h-6 w-px bg-outline-variant/30" />

        <Button type="button" size="sm" variant="ghost" onClick={undo} disabled={undoStack.length === 0} aria-label="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={redo} disabled={redoStack.length === 0} aria-label="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="ml-auto flex items-center gap-1">
          {COLORS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setColor(value)}
              aria-label={`Colour ${value}`}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-transform",
                color === value ? "scale-110 border-primary" : "border-outline-variant/40",
              )}
              style={{ backgroundColor: value }}
            />
          ))}
        </div>
      </div>

      {/* text options */}
      {tool === "text" && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-3">
          <div className="space-y-1">
            <Label htmlFor="pdf-font">Font</Label>
            <select
              id="pdf-font"
              value={font}
              onChange={(e) => setFont(e.target.value as PdfEditFont)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {FONTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pdf-size">Size</Label>
            <Input
              id="pdf-size"
              type="number"
              min={4}
              max={200}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value) || 12)}
              className="h-9 w-20"
            />
          </div>
          <p className="pb-2 text-xs text-on-surface-variant">Click the page to place the text.</p>
        </div>
      )}

      {tool === "image" && (
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-3 text-xs text-on-surface-variant">
          {currentAsset
            ? `Click the page to place “${currentAsset.name}”.`
            : "Choose an image to overlay, then click the page to place it."}
        </div>
      )}

      {tool === "edit-text" && (
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-3 text-xs text-on-surface-variant">
          {pageLines.length > 0 ? (
            <>
              Click any line of text to rewrite it in place. {pageLines.length}
              {page.lineCount && page.lineCount > pageLines.length
                ? ` of ${page.lineCount} shown`
                : ""}{" "}
              — the original face, size and colour are kept.
            </>
          ) : (
            "No selectable text on this page. Scanned pages need OCR before their text can be edited."
          )}
        </div>
      )}

      {showFind && (
        <div className="space-y-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="pdf-find">Find</Label>
              <Input
                id="pdf-find"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder="Text to look for"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pdf-replace">Replace with</Label>
              <Input
                id="pdf-replace"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Leave empty to delete it"
                className="h-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-outline-variant/30">
              {(["all", "page"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setFindScope(scope)}
                  className={cn(
                    "px-2.5 py-1 text-xs capitalize transition-colors",
                    findScope === scope
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container",
                  )}
                >
                  {scope === "all" ? "All pages" : "This page"}
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={replaceAllMatches}
              disabled={findMatches.length === 0}
              className="gap-1.5"
            >
              <PencilLine className="h-3.5 w-3.5" />
              Replace all
            </Button>
            <p className="text-xs text-on-surface-variant">
              {findText.trim()
                ? `${findMatches.length} line${findMatches.length === 1 ? "" : "s"} matched`
                : "Type something to find."}
            </p>
          </div>
          {notice && (
            <p role="status" className="text-xs text-primary">
              {notice}
            </p>
          )}
        </div>
      )}

      {lineEdit && (
        <div className="space-y-2 rounded-2xl border border-primary/40 bg-primary/5 p-3">
          <Label htmlFor="pdf-line-edit">Edit this line</Label>
          <Input
            id="pdf-line-edit"
            value={lineDraft}
            autoFocus
            onChange={(e) => setLineDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveLineEdit();
              }
              if (e.key === "Escape") setLineEdit(null);
            }}
            className="h-9"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={saveLineEdit} className="gap-1.5">
              <PencilLine className="h-3.5 w-3.5" />
              {lineDraft.trim() ? "Save line" : "Delete line"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setLineEdit(null)}>
              Cancel
            </Button>
            <p className="text-xs text-on-surface-variant">
              Saving rewrites the text on its own baseline. Leave it empty to remove the line.
            </p>
          </div>
        </div>
      )}

      {/* page strip */}
      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold">Pages ({pages.length})</h3>
          <p className="text-xs text-on-surface-variant">Reorder, rotate or delete — changes apply on save.</p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {pages.map((entry, index) => {
            const info = preview.pages[entry.src];
            if (!info) return null;
            const isActive = entry.id === active.id;
            const portrait = info.height >= info.width;
            return (
              <div
                key={entry.id}
                className={cn(
                  "relative shrink-0 cursor-pointer rounded-xl border-2 p-1.5 transition-colors",
                  isActive ? "border-primary bg-primary/5" : "border-outline-variant/20 hover:border-primary/40",
                )}
                onClick={() => {
                  setActiveId(entry.id);
                  setSelected(null);
                }}
              >
                <div
                  className="overflow-hidden rounded-md bg-white"
                  style={{ width: portrait ? 64 : 84, height: portrait ? 84 : 64 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pdfPreviewUrl(preview, entry.src + 1)}
                    alt={`Page ${index + 1}`}
                    className="h-full w-full object-contain transition-transform duration-200"
                    style={{ transform: `rotate(${entry.rotate}deg)` }}
                  />
                </div>
                <p className="mt-1 text-center font-mono text-[11px] text-on-surface-variant">
                  {index + 1}
                  {entry.rotate ? ` · ${entry.rotate}°` : ""}
                </p>
                <div className="mt-1 flex justify-center gap-0.5">
                  <button type="button" title="Move left" aria-label="Move page left" onClick={(e) => { e.stopPropagation(); movePage(entry.id, -1); }} className="rounded p-0.5 text-on-surface-variant hover:text-primary">
                    <ArrowLeft className="h-3 w-3" />
                  </button>
                  <button type="button" title="Rotate left" aria-label="Rotate page left" onClick={(e) => { e.stopPropagation(); rotatePage(entry.id, -90); }} className="rounded p-0.5 text-on-surface-variant hover:text-primary">
                    <RotateCcw className="h-3 w-3" />
                  </button>
                  <button type="button" title="Rotate right" aria-label="Rotate page right" onClick={(e) => { e.stopPropagation(); rotatePage(entry.id, 90); }} className="rounded p-0.5 text-on-surface-variant hover:text-primary">
                    <RotateCw className="h-3 w-3" />
                  </button>
                  <button type="button" title="Move right" aria-label="Move page right" onClick={(e) => { e.stopPropagation(); movePage(entry.id, 1); }} className="rounded p-0.5 text-on-surface-variant hover:text-primary">
                    <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="Delete page"
                    aria-label="Delete page"
                    onClick={(e) => { e.stopPropagation(); deletePage(entry.id); }}
                    disabled={pages.length <= 1}
                    className="rounded p-0.5 text-on-surface-variant hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* canvas */}
      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold">
            Page {activeIndex + 1} of {pages.length}
          </h3>
          <div className="flex items-center gap-1">
            <div className="flex items-center overflow-hidden rounded-md border border-outline-variant/30">
              <button
                type="button"
                onClick={() => setZoom((prev) => clampZoom(prev - 25))}
                disabled={zoom <= ZOOM_MIN}
                aria-label="Zoom out"
                className="px-1.5 py-1 text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <select
                value={ZOOM_STEPS.includes(zoom) ? zoom : "custom"}
                onChange={(e) => setZoom(clampZoom(Number(e.target.value)))}
                aria-label="Zoom level"
                className="border-x border-outline-variant/30 bg-transparent px-1.5 py-1 text-xs tabular-nums text-on-surface-variant focus:outline-none"
              >
                {ZOOM_STEPS.includes(zoom) ? null : (
                  <option value="custom">{zoom}%</option>
                )}
                {ZOOM_STEPS.map((step) => (
                  <option key={step} value={step}>
                    {step}%
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setZoom((prev) => clampZoom(prev + 25))}
                disabled={zoom >= ZOOM_MAX}
                aria-label="Zoom in"
                className="px-1.5 py-1 text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => fitWidth()}
              className="gap-1.5"
              title="Fit page width"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Fit
            </Button>
          </div>
          {selected !== null && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1.5 text-destructive"
              onClick={() => {
                commit();
                setAnnotations((prev) => prev.filter((_, i) => i !== selected));
                setSelected(null);
              }}
            >
              <X className="h-3.5 w-3.5" />
              Remove overlay
            </Button>
          )}
        </div>

        <div
          ref={canvasRef}
          className="overflow-auto rounded-lg"
          style={{ maxHeight: "70vh" }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${page.width} ${page.height}`}
            width={displayWidth}
            height={displayHeight}
            className="mx-auto block select-none rounded-lg bg-white shadow-lg"
            style={{
              aspectRatio: `${page.width} / ${page.height}`,
              cursor: tool === "select" ? "default" : "crosshair",
              touchAction: "none",
            }}
            onPointerDown={(event) => {
              if (tool === "draw" || tool === "highlight") {
                const point = toPoints(event);
                if (!point) return;
                (event.currentTarget as SVGSVGElement).setPointerCapture?.(event.pointerId);
                setDraft([point]);
                return;
              }
              if (tool === "select") {
                setSelected(null);
                return;
              }
              // "edit-text" clicks are handled by the per-line hit areas.
              if (tool === "edit-text") return;
              const point = toPoints(event);
              if (!point) return;
              if (tool === "text") placeText(point);
              else if (tool === "image" && currentAsset) placeImage(currentAsset, point);
            }}
            onPointerMove={(event) => {
              if (!draft) return;
              const point = toPoints(event);
              if (point) setDraft([...draft, point]);
            }}
            onPointerUp={() => {
              if (!draft) return;
              if (draft.length >= 2 && active) {
                commit();
                setAnnotations((prev) => [
                  ...prev,
                  {
                    kind: tool === "highlight" ? "highlight" : "draw",
                    pageId: active.id,
                    color: tool === "highlight" ? "#ffe600" : color,
                    width: tool === "highlight" ? 14 : 2.5,
                    opacity: tool === "highlight" ? 0.45 : 1,
                    points: draft,
                  },
                ]);
              }
              setDraft(null);
            }}
          >
            {/* page content, with the working rotation applied */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <image
              href={pdfPreviewUrl(preview, active.src + 1)}
              x={0}
              y={0}
              width={page.width}
              height={page.height}
              transform={`rotate(${active.rotate} ${page.width / 2} ${page.height / 2})`}
            />

            {/* lines currently matched by find &amp; replace */}
            {showFind &&
              findText.trim() &&
              findMatches
                .filter((hit) => hit.pageId === active.id)
                .map((hit) => (
                  <rect
                    key={`find-${hit.index}`}
                    {...lineBox(hit.line)}
                    fill="#f59e0b"
                    fillOpacity={0.28}
                    stroke="#f59e0b"
                    strokeWidth={0.6}
                    strokeOpacity={0.7}
                    rx={1}
                    pointerEvents="none"
                  />
                ))}

            {/* click-to-edit hit areas over the page's own text */}
            {tool === "edit-text" &&
              pageLines.map((line, index) => (
                <g key={`line-${index}`}>
                  <rect
                    {...lineBox(line)}
                    fill="transparent"
                    className="transition-opacity hover:fill-[#2563eb] hover:fill-opacity-15"
                    stroke="#2563eb"
                    strokeWidth={0.5}
                    strokeOpacity={0.35}
                    rx={1}
                    onClick={() => openLineEdit({ pageId: active.id, line, index })}
                    style={{ cursor: "text" }}
                  >
                    <title>Click to edit this line</title>
                  </rect>
                </g>
              ))}

            {/* pending text rewrites, drawn on the original baseline */}
            {replaceEdits.map(({ ann, index }) => {
              if (ann.kind !== "replace") return null;
              if (ann.preview) {
                const line = ann.preview;
                const box = lineBox(line);
                return (
                  <g key={`rep-${index}`}>
                    <rect
                      x={box.x - 0.5}
                      y={box.y - 0.5}
                      width={box.width + 1}
                      height={box.height + 1}
                      fill={ann.bg ? `#${ann.bg.replace(/^#/, "")}` : "#ffffff"}
                      pointerEvents="none"
                    />
                    <rect
                      {...lineBox(line)}
                      fill="#2563eb"
                      fillOpacity={0.1}
                      stroke="#2563eb"
                      strokeWidth={0.6}
                      strokeDasharray="2 1.5"
                      rx={1}
                      pointerEvents="none"
                    />
                    {ann.text.trim() && (
                      <text
                        x={line.origin[0]}
                        y={line.origin[1]}
                        fontSize={line.size}
                        fontFamily={fontFamilyOf(line.font)}
                        fontWeight={fontWeightOf(line.font)}
                        fill={packedToCss(line.color)}
                        onClick={() => setSelected(index)}
                        style={{ cursor: "pointer" }}
                      >
                        {ann.text}
                      </text>
                    )}
                  </g>
                );
              }
              // A replace-all has no single line to sit on; mark every hit.
              return (
                <g key={`rep-all-${index}`} pointerEvents="none">
                  {pageLines
                    .filter((line) => line.text.toLowerCase().includes(ann.find.toLowerCase()))
                    .map((line, k) => (
                      <rect
                        key={k}
                        {...lineBox(line)}
                        fill="#2563eb"
                        fillOpacity={0.12}
                        stroke="#2563eb"
                        strokeWidth={0.6}
                        strokeDasharray="2 1.5"
                        rx={1}
                      />
                    ))}
                </g>
              );
            })}

            {/* overlays belonging to this page */}
            {onSurface.map(({ ann, index }) => {
              if (ann.kind === "replace") return null;
              if (ann.kind === "text") {
                return (
                  <text
                    key={index}
                    x={ann.x}
                    y={ann.y}
                    fontSize={ann.size}
                    fontFamily={ann.font === "cour" || ann.font === "cobo" ? "monospace" : "sans-serif"}
                    fontWeight={ann.font === "hebo" || ann.font === "cobo" ? 700 : 400}
                    fill={ann.color}
                    onClick={() => setSelected(index)}
                    style={{ cursor: "pointer" }}
                  >
                    {ann.text}
                  </text>
                );
              }
              if (ann.kind === "image") {
                const url = assetUrls.get(ann.asset);
                if (!url) return null;
                return (
                  <image
                    key={index}
                    href={url}
                    x={ann.x}
                    y={ann.y}
                    width={ann.w}
                    height={ann.h}
                    onClick={() => setSelected(index)}
                    style={{ cursor: "pointer" }}
                  />
                );
              }
              return (
                <polyline
                  key={index}
                  points={ann.points.map((p) => p.join(",")).join(" ")}
                  fill="none"
                  stroke={ann.color}
                  strokeWidth={ann.width}
                  strokeOpacity={ann.opacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  onClick={() => setSelected(index)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}

            {/* in-progress stroke */}
            {draft && draft.length > 1 && (
              <polyline
                points={draft.map((p) => p.join(",")).join(" ")}
                fill="none"
                stroke={tool === "highlight" ? "#ffe600" : color}
                strokeWidth={tool === "highlight" ? 14 : 2.5}
                strokeOpacity={tool === "highlight" ? 0.45 : 1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>
      </div>

      {/* metadata */}
      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-3">
        <h3 className="mb-2 font-display text-sm font-semibold">Document details (optional)</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["title", "author", "subject", "keywords"] as const).map((key) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`pdf-meta-${key}`} className="capitalize">
                {key}
              </Label>
              <Input
                id={`pdf-meta-${key}`}
                value={metadata[key] ?? ""}
                onChange={(e) => setMetadata((prev) => ({ ...prev, [key]: e.target.value }))}
                className="h-9"
              />
            </div>
          ))}
        </div>
      </div>

      <Button className="w-full gap-2" onClick={apply} disabled={running || pages.length === 0}>
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileCheck2 className="h-4 w-4" />
        )}
        Apply edits and save
      </Button>
    </div>
  );
}
