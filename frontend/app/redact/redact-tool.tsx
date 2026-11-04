"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  Eye,
  EyeOff,
  FileText,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Scan,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { downloadBlob } from "@/lib/screenshot";
import {
  applyRedactionsToCanvas,
  autoDetectSensitiveRegions,
  RedactionBox,
  RedactionStyle,
} from "@/lib/privacy-redactor";

export function RedactTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [originalImage, setOriginalImage] = React.useState<HTMLImageElement | null>(null);

  // Redaction boxes list
  const [boxes, setBoxes] = React.useState<RedactionBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = React.useState<string | null>(null);

  // Interaction mode: "select" or "draw"
  const [interactionMode, setInteractionMode] = React.useState<"draw" | "navigate">("draw");
  const [defaultStyle, setDefaultStyle] = React.useState<RedactionStyle>("blur");

  // Detection state
  const [isScanning, setIsScanning] = React.useState<boolean>(false);

  // Canvas
  const displayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const isDrawingBox = React.useRef<boolean>(false);
  const drawStart = React.useRef<{ x: number; y: number } | null>(null);
  const [tempBox, setTempBox] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Handle image upload
  const handleFileDrop = (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setFile(f);

    const url = URL.createObjectURL(f);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setOriginalImage(img);

      // Auto-scan on load
      const offCanvas = document.createElement("canvas");
      offCanvas.width = img.naturalWidth;
      offCanvas.height = img.naturalHeight;
      const ctx = offCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
        const detected = autoDetectSensitiveRegions(data);
        setBoxes(detected);
        if (detected.length > 0) {
          toast.success(`Auto-detected ${detected.length} sensitive privacy regions!`);
        }
      }
    };
    img.src = url;
  };

  // Re-run Auto-Detection
  const handleAutoDetect = () => {
    if (!originalImage) return;
    setIsScanning(true);

    setTimeout(() => {
      const offCanvas = document.createElement("canvas");
      offCanvas.width = originalImage.naturalWidth;
      offCanvas.height = originalImage.naturalHeight;
      const ctx = offCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(originalImage, 0, 0);
        const data = ctx.getImageData(0, 0, originalImage.naturalWidth, originalImage.naturalHeight);
        const detected = autoDetectSensitiveRegions(data, {
          detectFaces: true,
          detectPlates: true,
          detectCards: true,
        });
        setBoxes(detected);
        setIsScanning(false);
        const faceCount = detected.filter((b) => b.category === "face").length;
        const plateCount = detected.filter((b) => b.category === "plate").length;
        const cardCount = detected.filter((b) => b.category === "card").length;
        toast.success(
          `AI PII Guard: ${detected.length} zones protected (${faceCount} faces, ${plateCount} plates, ${cardCount} cards/IDs).`,
        );
      }
    }, 200);
  };

  // Render Redacted Result to Canvas
  const redraw = React.useCallback(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !originalImage) return;

    canvas.width = originalImage.naturalWidth;
    canvas.height = originalImage.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Draw base photo
    ctx.drawImage(originalImage, 0, 0);

    // 2. Apply irreversible redaction effects
    applyRedactionsToCanvas(canvas, boxes);

    // 3. Draw UI bounding box guidelines over the rendered canvas
    ctx.save();
    for (const box of boxes) {
      const isSelected = box.id === selectedBoxId;
      ctx.strokeStyle = isSelected ? "#3b82f6" : "rgba(239, 68, 68, 0.85)";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      // Label badge
      ctx.fillStyle = isSelected ? "#2563eb" : "#ef4444";
      ctx.fillRect(box.x, Math.max(0, box.y - 20), Math.min(box.width, 100), 20);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
      ctx.fillText(box.label.toUpperCase(), box.x + 5, Math.max(14, box.y - 6));
    }

    // Draw active drawing drag box
    if (tempBox) {
      ctx.strokeStyle = "#3b82f6";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(tempBox.x, tempBox.y, tempBox.w, tempBox.h);
    }

    ctx.restore();
  }, [originalImage, boxes, selectedBoxId, tempBox]);

  React.useEffect(() => {
    redraw();
  }, [redraw]);

  // Coordinate mapping
  const getImageCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Drawing Custom Redaction Box
  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getImageCoordinates(e);
    if (!coords) return;

    // Check if clicked inside existing box
    const clickedBox = boxes.find(
      (b) =>
        coords.x >= b.x &&
        coords.x <= b.x + b.width &&
        coords.y >= b.y &&
        coords.y <= b.y + b.height,
    );

    if (clickedBox && interactionMode === "navigate") {
      setSelectedBoxId(clickedBox.id);
      return;
    }

    isDrawingBox.current = true;
    drawStart.current = coords;
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingBox.current || !drawStart.current) return;
    const coords = getImageCoordinates(e);
    if (!coords) return;

    const x = Math.min(drawStart.current.x, coords.x);
    const y = Math.min(drawStart.current.y, coords.y);
    const w = Math.abs(coords.x - drawStart.current.x);
    const h = Math.abs(coords.y - drawStart.current.y);

    setTempBox({ x, y, w, h });
  };

  const handlePointerUp = () => {
    if (!isDrawingBox.current || !tempBox) {
      isDrawingBox.current = false;
      drawStart.current = null;
      return;
    }

    isDrawingBox.current = false;
    drawStart.current = null;

    if (tempBox.w > 10 && tempBox.h > 10) {
      const newBox: RedactionBox = {
        id: `custom-${Date.now()}`,
        x: Math.round(tempBox.x),
        y: Math.round(tempBox.y),
        width: Math.round(tempBox.w),
        height: Math.round(tempBox.h),
        category: "custom",
        label: "Redacted",
        style: defaultStyle,
      };
      setBoxes((prev) => [...prev, newBox]);
      setSelectedBoxId(newBox.id);
      toast.success("Redaction area added");
    }
    setTempBox(null);
  };

  // Update box style
  const handleUpdateBoxStyle = (boxId: string, style: RedactionStyle) => {
    setBoxes((prev) =>
      prev.map((b) => (b.id === boxId ? { ...b, style } : b)),
    );
  };

  // Delete box
  const handleDeleteBox = (boxId: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== boxId));
    if (selectedBoxId === boxId) setSelectedBoxId(null);
  };

  // Export clean irreversible redacted image
  const handleExport = (format: "jpeg" | "png" | "webp") => {
    if (!originalImage) return;

    // Export offscreen canvas without debug stroke borders
    const expCanvas = document.createElement("canvas");
    expCanvas.width = originalImage.naturalWidth;
    expCanvas.height = originalImage.naturalHeight;
    const ctx = expCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(originalImage, 0, 0);
    applyRedactionsToCanvas(expCanvas, boxes);

    const mime =
      format === "jpeg"
        ? "image/jpeg"
        : format === "webp"
        ? "image/webp"
        : "image/png";

    expCanvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Export failed");
          return;
        }
        const base = file?.name.replace(/\.[^/.]+$/, "") || "doc";
        downloadBlob(blob, `${base}-redacted.${format === "jpeg" ? "jpg" : format}`);
        toast.success(`Exported secure redacted image (${(blob.size / 1024).toFixed(1)} KB)`);
      },
      mime,
      0.95,
    );
  };

  return (
    <AuthGate>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛡️</span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                AI Smart Privacy Redactor
              </h1>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                PII &amp; Face Guard
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Automatically detect and irreversibly blur or black out faces, car license plates, credit cards, and confidential text before public sharing.
            </p>
          </div>
        </div>

        {/* Upload Zone */}
        {!file && (
          <div className="mx-auto max-w-2xl py-8">
            <Dropzone
              onFiles={handleFileDrop}
              accept="image/*"
              kind="document"
            />
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 text-center text-xs text-muted-foreground">
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">🤖</span>
                <p className="font-semibold text-foreground mt-1">Auto Face &amp; Plate Scan</p>
                <p>Detects human faces, car plates, and card blocks automatically in milliseconds.</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">🔒</span>
                <p className="font-semibold text-foreground mt-1">Irreversible Pixel Burning</p>
                <p>Redactions are permanently burned into the image pixels — zero recoverable metadata.</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">⬛</span>
                <p className="font-semibold text-foreground mt-1">Legal Blackout &amp; Blur</p>
                <p>Choose between classic censorship blackout bars, Gaussian blur, or mosaic pixelation.</p>
              </div>
            </div>
          </div>
        )}

        {/* Studio Workspace */}
        {file && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left: Interactive Canvas */}
            <div className="flex flex-col items-center space-y-4 lg:col-span-8">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-2xl border border-border/60 bg-card p-3 shadow-sm w-full">
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Button
                    variant={interactionMode === "draw" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 text-xs h-8 flex-1 sm:flex-initial"
                    onClick={() => setInteractionMode("draw")}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Draw Redaction Box</span>
                    <span className="sm:hidden">Draw Box</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isScanning}
                    onClick={handleAutoDetect}
                    className="gap-1.5 text-xs h-8 flex-1 sm:flex-initial"
                  >
                    {isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scan className="h-3.5 w-3.5 text-blue-500" />}
                    <span className="hidden sm:inline">Auto-Scan PII</span>
                    <span className="sm:hidden">Auto-Scan</span>
                  </Button>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-red-500 hover:text-red-600 gap-1 flex-1 sm:flex-initial"
                    disabled={boxes.length === 0}
                    onClick={() => setBoxes([])}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Clear All</span>
                    <span className="sm:hidden">Clear</span> ({boxes.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 flex-1 sm:flex-initial"
                    onClick={() => {
                      setFile(null);
                      setOriginalImage(null);
                      setBoxes([]);
                    }}
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span className="hidden sm:inline">Change Image</span>
                    <span className="sm:hidden">Change</span>
                  </Button>
                </div>
              </div>

              {/* Viewport Box */}
              <div className="relative flex items-center justify-center rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm w-full overflow-hidden select-none min-h-[280px] sm:min-h-[380px] md:min-h-[440px]">
                <canvas
                  ref={displayCanvasRef}
                  onMouseDown={handlePointerDown}
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp}
                  onTouchStart={handlePointerDown}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                  className="max-w-full max-h-[560px] object-contain rounded-lg shadow-md ring-1 ring-border cursor-crosshair"
                  style={{ touchAction: "none" }}
                />
              </div>

              {/* Status footer */}
              <div className="flex items-center justify-between w-full text-xs text-muted-foreground px-2">
                <span className="font-mono">
                  {originalImage?.naturalWidth} × {originalImage?.naturalHeight} px
                </span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {boxes.length} active redaction zone{boxes.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {/* Right: Redaction Management & Export */}
            <div className="space-y-6 lg:col-span-4">
              {/* Default Style Selector */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
                <Label className="text-sm font-semibold">Redaction Style Preset</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "blur", label: "Gaussian Blur", icon: "🌫️" },
                    { id: "blackout", label: "Blackout Bar", icon: "⬛" },
                    { id: "pixelate", label: "Pixelate / Mosaic", icon: "👾" },
                    { id: "whiteout", label: "Whiteout Tape", icon: "⬜" },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setDefaultStyle(style.id as RedactionStyle)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs transition-colors ${
                        defaultStyle === style.id
                          ? "border-blue-500/80 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 font-medium"
                          : "border-border/50 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>{style.icon}</span>
                      <span className="font-semibold">{style.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Redaction Zones List */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Redaction Zones ({boxes.length})</Label>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {boxes.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      No redaction zones yet. Click &amp; drag on the image or use &quot;Auto-Scan PII&quot;.
                    </p>
                  ) : (
                    boxes.map((box) => (
                      <div
                        key={box.id}
                        onClick={() => setSelectedBoxId(box.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                          selectedBoxId === box.id
                            ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/30"
                            : "border-border/40 hover:bg-muted/30"
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-foreground flex items-center gap-1.5">
                            <span>{box.category === "face" ? "👤" : box.category === "plate" ? "🚗" : "🔒"}</span>
                            <span>{box.label}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {box.width}×{box.height} px • {box.style.toUpperCase()}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <select
                            value={box.style}
                            onChange={(e) => handleUpdateBoxStyle(box.id, e.target.value as RedactionStyle)}
                            className="h-7 text-[11px] rounded border border-border bg-background px-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="blur">Blur</option>
                            <option value="blackout">Blackout</option>
                            <option value="pixelate">Pixelate</option>
                            <option value="whiteout">Whiteout</option>
                          </select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBox(box.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Export Suite */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
                <Label className="text-sm font-semibold">Download Redacted Document</Label>
                <p className="text-xs text-muted-foreground">
                  Permanently destroys confidential underlying pixel data before downloading.
                </p>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleExport("jpeg")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    JPG
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => handleExport("png")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    PNG
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => handleExport("webp")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    WEBP
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
