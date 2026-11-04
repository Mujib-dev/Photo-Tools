"use client";

import * as React from "react";
import { Check, Download, Eraser, PenTool, Type, Undo2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SignatureModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (file: File) => void;
}

const INK_COLORS = [
  { label: "Ink Blue", value: "#0f2b5c" },
  { label: "Midnight Black", value: "#111827" },
  { label: "Classic Navy", value: "#1d4ed8" },
];

const STROKE_WIDTHS = [
  { label: "Fine", value: 2 },
  { label: "Medium", value: 3.5 },
  { label: "Bold", value: 5 },
];

const FONT_STYLES = [
  { id: "dancing", label: "Flowing Script", font: "italic 38px 'Brush Script MT', 'Dancing Script', cursive" },
  { id: "edwardian", label: "Formal Calligraphy", font: "italic 36px 'Edwardian Script ITC', 'Lucida Calligraphy', cursive" },
  { id: "autograph", label: "Modern Autograph", font: "italic 34px 'Segoe Script', 'Caveat', cursive" },
  { id: "monogram", label: "Classic Signature", font: "italic 32px 'Georgia', serif" },
];

export function SignatureModal({ open, onClose, onSave }: SignatureModalProps) {
  const [tab, setTab] = React.useState<"draw" | "type" | "upload">("draw");
  const [color, setColor] = React.useState(INK_COLORS[0].value);
  const [strokeWidth, setStrokeWidth] = React.useState(3.5);

  // --- Draw state ---
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [strokes, setStrokes] = React.useState<{ points: [number, number][]; color: string; width: number }[]>([]);
  const currentStroke = React.useRef<[number, number][]>([]);

  // --- Type state ---
  const [typedName, setTypedName] = React.useState("John Doe");
  const [selectedFont, setSelectedFont] = React.useState(FONT_STYLES[0].id);

  // --- Upload state ---
  const [uploadedImage, setUploadedImage] = React.useState<string | null>(null);
  const [removeBg, setRemoveBg] = React.useState(true);

  // Redraw canvas when strokes or canvas change
  const redrawCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
      for (let i = 1; i < stroke.points.length; i++) {
        const xc = (stroke.points[i - 1][0] + stroke.points[i][0]) / 2;
        const yc = (stroke.points[i - 1][1] + stroke.points[i][1]) / 2;
        ctx.quadraticCurveTo(stroke.points[i - 1][0], stroke.points[i - 1][1], xc, yc);
      }
      ctx.stroke();
    }
  }, [strokes]);

  React.useEffect(() => {
    if (tab === "draw") {
      redrawCanvas();
    }
  }, [tab, redrawCanvas]);

  if (!open) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDrawing(true);
    currentStroke.current = [[x, y]];

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentStroke.current.push([x, y]);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pts = currentStroke.current;
    if (pts.length > 2) {
      const xc = (pts[pts.length - 2][0] + pts[pts.length - 1][0]) / 2;
      const yc = (pts[pts.length - 2][1] + pts[pts.length - 1][1]) / 2;
      ctx.quadraticCurveTo(pts[pts.length - 2][0], pts[pts.length - 2][1], xc, yc);
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.current.length > 0) {
      setStrokes((prev) => [
        ...prev,
        { points: [...currentStroke.current], color, width: strokeWidth },
      ]);
    }
    currentStroke.current = [];
  };

  const clearCanvas = () => {
    setStrokes([]);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const undoStroke = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const finishAndSave = async () => {
    const outCanvas = document.createElement("canvas");
    const ctx = outCanvas.getContext("2d");
    if (!ctx) return;

    if (tab === "draw") {
      if (strokes.length === 0) return;
      outCanvas.width = 600;
      outCanvas.height = 240;

      // Draw all strokes
      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
        for (let i = 1; i < stroke.points.length; i++) {
          const xc = (stroke.points[i - 1][0] + stroke.points[i][0]) / 2;
          const yc = (stroke.points[i - 1][1] + stroke.points[i][1]) / 2;
          ctx.quadraticCurveTo(stroke.points[i - 1][0], stroke.points[i - 1][1], xc, yc);
        }
        ctx.stroke();
      }
    } else if (tab === "type") {
      const text = typedName.trim();
      if (!text) return;
      outCanvas.width = 600;
      outCanvas.height = 200;
      const fontDef = FONT_STYLES.find((f) => f.id === selectedFont)?.font ?? FONT_STYLES[0].font;
      ctx.font = fontDef;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, outCanvas.width / 2, outCanvas.height / 2);
    } else if (tab === "upload" && uploadedImage) {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = uploadedImage;
      });

      outCanvas.width = img.naturalWidth || 600;
      outCanvas.height = img.naturalHeight || 240;
      ctx.drawImage(img, 0, 0);

      if (removeBg) {
        // Auto-remove white/near-white paper background
        const imgData = ctx.getImageData(0, 0, outCanvas.width, outCanvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          // If pixel is near white (threshold > 210)
          if (r > 205 && g > 205 && b > 205) {
            d[i + 3] = 0; // Transparent
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }
    }

    outCanvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `signature-${Date.now()}.png`, { type: "image/png" });
        onSave(file);
        onClose();
      }
    }, "image/png");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative flex w-full max-w-xl flex-col rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PenTool className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">Digital Signature</h2>
              <p className="text-xs text-on-surface-variant">
                Create your signature to stamp directly onto your PDF
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="mt-4 flex rounded-xl border border-outline-variant/20 bg-surface-container-low p-1">
          <button
            type="button"
            onClick={() => setTab("draw")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all",
              tab === "draw"
                ? "bg-surface-container-lowest text-primary shadow-sm"
                : "text-on-surface-variant hover:text-foreground",
            )}
          >
            <PenTool className="h-3.5 w-3.5" />
            Draw
          </button>
          <button
            type="button"
            onClick={() => setTab("type")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all",
              tab === "type"
                ? "bg-surface-container-lowest text-primary shadow-sm"
                : "text-on-surface-variant hover:text-foreground",
            )}
          >
            <Type className="h-3.5 w-3.5" />
            Type
          </button>
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all",
              tab === "upload"
                ? "bg-surface-container-lowest text-primary shadow-sm"
                : "text-on-surface-variant hover:text-foreground",
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
        </div>

        {/* Ink & Style options */}
        {tab !== "upload" && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-on-surface-variant">Ink:</Label>
              <div className="flex gap-1.5">
                {INK_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    style={{ backgroundColor: c.value }}
                    className={cn(
                      "h-6 w-6 rounded-full border border-black/10 transition-transform",
                      color === c.value && "scale-110 ring-2 ring-primary ring-offset-2",
                    )}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {tab === "draw" && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-on-surface-variant">Thickness:</Label>
                <div className="flex gap-1 rounded-lg border border-outline-variant/30 p-0.5">
                  {STROKE_WIDTHS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStrokeWidth(s.value)}
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                        strokeWidth === s.value ? "bg-primary text-on-primary" : "text-on-surface-variant",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content */}
        <div className="mt-4">
          {tab === "draw" && (
            <div className="space-y-2">
              <div className="relative h-60 w-full overflow-hidden rounded-xl border border-dashed border-outline-variant/40 bg-white">
                <canvas
                  ref={canvasRef}
                  width={560}
                  height={240}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="h-full w-full cursor-crosshair touch-none select-none"
                />
                <div className="pointer-events-none absolute bottom-4 left-6 right-6 border-b border-gray-300 text-center font-mono text-[10px] text-gray-400">
                  Sign above this line
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>Draw your signature with mouse or touch</span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={undoStroke}
                    disabled={strokes.length === 0}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    <Undo2 className="h-3 w-3" />
                    Undo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={clearCanvas}
                    disabled={strokes.length === 0}
                    className="h-7 gap-1 px-2 text-xs text-destructive"
                  >
                    <Eraser className="h-3 w-3" />
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}

          {tab === "type" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="sig-name" className="text-xs">
                  Your Name or Initials
                </Label>
                <Input
                  id="sig-name"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-on-surface-variant">Choose Style</Label>
                <div className="grid grid-cols-2 gap-2.5">
                  {FONT_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedFont(style.id)}
                      className={cn(
                        "relative flex h-20 flex-col items-center justify-center rounded-xl border p-3 transition-all bg-white",
                        selectedFont === style.id
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-outline-variant/30 hover:border-primary/50",
                      )}
                    >
                      <span
                        className="truncate text-xl"
                        style={{
                          color,
                          fontFamily: style.id === "dancing" ? "'Brush Script MT', 'Dancing Script', cursive" :
                                      style.id === "edwardian" ? "'Edwardian Script ITC', 'Lucida Calligraphy', cursive" :
                                      style.id === "autograph" ? "'Segoe Script', 'Caveat', cursive" : "Georgia, serif",
                          fontStyle: "italic",
                        }}
                      >
                        {typedName || "Signature"}
                      </span>
                      <span className="mt-1 text-[10px] text-gray-400 font-sans">{style.label}</span>
                      {selectedFont === style.id && (
                        <div className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-3">
              <div className="flex h-52 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/40 bg-surface-container-low p-4 text-center">
                {uploadedImage ? (
                  <div className="relative h-full w-full flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={uploadedImage}
                      alt="Uploaded signature"
                      className="max-h-full max-w-full object-contain"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setUploadedImage(null)}
                      className="absolute top-0 right-0 h-7 px-2 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center">
                    <Upload className="h-8 w-8 text-on-surface-variant mb-2" />
                    <span className="font-display text-sm font-semibold text-foreground">
                      Upload signature photo or scan
                    </span>
                    <span className="text-xs text-on-surface-variant mt-1">
                      PNG, JPG or WEBP (paper photo or handwritten scan)
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {uploadedImage && (
                <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={removeBg}
                    onChange={(e) => setRemoveBg(e.target.checked)}
                    className="rounded border-outline-variant text-primary"
                  />
                  <span>Automatically remove white paper background (pure transparent signature)</span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-outline-variant/10 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={finishAndSave}
            disabled={
              (tab === "draw" && strokes.length === 0) ||
              (tab === "type" && !typedName.trim()) ||
              (tab === "upload" && !uploadedImage)
            }
            className="gap-2"
          >
            <PenTool className="h-4 w-4" />
            Place Signature
          </Button>
        </div>
      </div>
    </div>
  );
}
