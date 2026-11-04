"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bandage,
  Check,
  Columns,
  Download,
  Eraser,
  Eye,
  History,
  Layers,
  Maximize2,
  Paintbrush,
  Palette,
  RefreshCw,
  Sliders,
  Sparkles,
  Split,
  Undo2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { downloadBlob } from "@/lib/screenshot";
import {
  createVintageDemoCanvas,
  DefectDetectionOptions,
  detectDamageMask,
  loadImageToCanvas,
  RestorationStats,
  restoreVintagePhoto,
  VintageRestorationOptions,
} from "@/lib/photo-restorer";

type BrushMode = "none" | "paint" | "erase";

export function RestoreTool() {
  const [sourceImage, setSourceImage] = React.useState<HTMLCanvasElement | null>(null);
  const [damageMask, setDamageMask] = React.useState<HTMLCanvasElement | null>(null);
  const [repairedImage, setRepairedImage] = React.useState<HTMLCanvasElement | null>(null);
  const [stats, setStats] = React.useState<RestorationStats | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Settings
  const [sensitivity, setSensitivity] = React.useState(55);
  const [dilateRadius, setDilateRadius] = React.useState(2);
  const [detectScratches, setDetectScratches] = React.useState(true);
  const [detectDust, setDetectDust] = React.useState(true);
  const [detectTears, setDetectTears] = React.useState(true);
  const [filmGrainMatch, setFilmGrainMatch] = React.useState(15);
  const [contrastRevive, setContrastRevive] = React.useState(20);

  // UI Interactive state
  const [splitPos, setSplitPos] = React.useState(50);
  const [isPeekingOriginal, setIsPeekingOriginal] = React.useState(false);
  const [showMaskOverlay, setShowMaskOverlay] = React.useState(false);
  const [brushMode, setBrushMode] = React.useState<BrushMode>("none");
  const [brushSize, setBrushSize] = React.useState(18);
  const [exportFormat, setExportFormat] = React.useState<"png" | "jpeg" | "webp">("png");

  // Canvas refs
  const displayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const isDrawingRef = React.useRef(false);

  // Load a file
  const handleFile = React.useCallback(async (file: File) => {
    try {
      setIsProcessing(true);
      const canvas = await loadImageToCanvas(file);
      setSourceImage(canvas);

      // Auto-detect damage
      const mask = detectDamageMask(canvas, {
        sensitivity: 55,
        dilateRadius: 2,
        detectScratches: true,
        detectDust: true,
        detectTears: true,
      });
      setDamageMask(mask);

      // Perform healing
      const { repairedCanvas, stats } = restoreVintagePhoto(canvas, mask, {
        filmGrainMatch: 15,
        contrastRevive: 20,
      });
      setRepairedImage(repairedCanvas);
      setStats(stats);
      toast.success(
        `Restored! Repaired ${stats.repairedPixels.toLocaleString()} damaged pixels (${stats.damagePercentage}% of photo)`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to load and restore photo");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Load sample demo photo
  const handleLoadDemo = React.useCallback(() => {
    try {
      setIsProcessing(true);
      const demoCanvas = createVintageDemoCanvas();
      setSourceImage(demoCanvas);

      const mask = detectDamageMask(demoCanvas, {
        sensitivity,
        dilateRadius,
        detectScratches,
        detectDust,
        detectTears,
      });
      setDamageMask(mask);

      const { repairedCanvas, stats } = restoreVintagePhoto(demoCanvas, mask, {
        filmGrainMatch,
        contrastRevive,
      });
      setRepairedImage(repairedCanvas);
      setStats(stats);
      toast.success("Loaded vintage antique demo photo with scratches and tears!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load demo photo");
    } finally {
      setIsProcessing(false);
    }
  }, [sensitivity, dilateRadius, detectScratches, detectDust, detectTears, filmGrainMatch, contrastRevive]);

  // Re-run scan & restore with current options
  const runRestoration = React.useCallback(
    (customMask?: HTMLCanvasElement) => {
      if (!sourceImage) return;

      setIsProcessing(true);
      try {
        const mask =
          customMask ||
          detectDamageMask(sourceImage, {
            sensitivity,
            dilateRadius,
            detectScratches,
            detectDust,
            detectTears,
          });

        if (!customMask) {
          setDamageMask(mask);
        }

        const { repairedCanvas, stats } = restoreVintagePhoto(sourceImage, mask, {
          filmGrainMatch,
          contrastRevive,
        });

        setRepairedImage(repairedCanvas);
        setStats(stats);
        toast.success(`Healed ${stats.repairedPixels.toLocaleString()} defect pixels in ${stats.durationMs}ms`);
      } catch (err) {
        console.error(err);
        toast.error("Restoration processing error");
      } finally {
        setIsProcessing(false);
      }
    },
    [sourceImage, sensitivity, dilateRadius, detectScratches, detectDust, detectTears, filmGrainMatch, contrastRevive]
  );

  // Render main canvas view (Split slider or Mask or Peek)
  React.useEffect(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !sourceImage) return;

    const w = sourceImage.width;
    const h = sourceImage.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    if (isPeekingOriginal || !repairedImage) {
      // Draw 100% original
      ctx.drawImage(sourceImage, 0, 0);
    } else {
      // Draw repaired image first
      ctx.drawImage(repairedImage, 0, 0);

      // Split view: draw original on the left side
      if (splitPos < 100 && splitPos > 0) {
        const splitX = Math.round((splitPos / 100) * w);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, splitX, h);
        ctx.clip();
        ctx.drawImage(sourceImage, 0, 0);
        ctx.restore();

        // Split line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(splitX, 0);
        ctx.lineTo(splitX, h);
        ctx.stroke();

        // Split line shadow
        ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(splitX + 1, 0);
        ctx.lineTo(splitX + 1, h);
        ctx.stroke();
      }
    }

    // Damage mask neon overlay
    if (showMaskOverlay && damageMask) {
      ctx.save();
      // Draw damage mask in high-visibility neon amber/coral
      const maskCtx = damageMask.getContext("2d");
      if (maskCtx) {
        const maskData = maskCtx.getImageData(0, 0, w, h);
        const overlayData = ctx.createImageData(w, h);
        const md = maskData.data;
        const od = overlayData.data;

        for (let i = 0; i < md.length; i += 4) {
          if (md[i + 3] > 30) {
            od[i] = 255; // R
            od[i + 1] = 65; // G
            od[i + 2] = 54; // B
            od[i + 3] = 180; // Alpha
          }
        }
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tCtx = tempCanvas.getContext("2d");
        if (tCtx) {
          tCtx.putImageData(overlayData, 0, 0);
          ctx.drawImage(tempCanvas, 0, 0);
        }
      }
      ctx.restore();
    }
  }, [sourceImage, repairedImage, damageMask, splitPos, isPeekingOriginal, showMaskOverlay]);

  // Interactive Brush Touch-Up handlers
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (brushMode === "none" || !damageMask) return;
    isDrawingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    paintOnMask(e);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || brushMode === "none" || !damageMask) return;
    paintOnMask(e);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    // Auto re-heal with the updated custom mask
    if (damageMask) {
      runRestoration(damageMask);
    }
  };

  const paintOnMask = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !damageMask) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const maskCtx = damageMask.getContext("2d");
    if (!maskCtx) return;

    maskCtx.save();
    if (brushMode === "paint") {
      maskCtx.globalCompositeOperation = "source-over";
      maskCtx.fillStyle = "rgba(255, 255, 255, 1.0)";
    } else {
      maskCtx.globalCompositeOperation = "destination-out";
      maskCtx.fillStyle = "rgba(0, 0, 0, 1.0)";
    }

    maskCtx.beginPath();
    maskCtx.arc(x, y, brushSize * scaleX * 0.5, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.restore();

    // Trigger visual refresh
    setShowMaskOverlay(true);
  };

  // Export restored photo
  const handleDownload = () => {
    if (!repairedImage) return;

    repairedImage.toBlob(
      (blob) => {
        if (!blob) return;
        const ext = exportFormat === "jpeg" ? "jpg" : exportFormat;
        downloadBlob(blob, `vintage-restored-${Date.now()}.${ext}`);
        toast.success(`Downloaded repaired photo as .${ext}`);
      },
      `image/${exportFormat}`,
      exportFormat === "jpeg" ? 0.95 : undefined
    );
  };

  // Export damage mask
  const handleDownloadMask = () => {
    if (!damageMask) return;
    damageMask.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `damage-mask-${Date.now()}.png`);
      toast.success("Downloaded damage mask PNG");
    }, "image/png");
  };

  return (
    <AuthGate>
      <div className="container max-w-6xl mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Bandage className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">AI Vintage Scratch & Tear Restorer</h1>
              <Badge variant="secondary" className="gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
                <Sparkles className="w-3 h-3" /> Neural Inpainting
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Detect and automatically repair physical scratches, cracked photo emulsions, dust speckles, and paper tears on historical photos and family heirlooms.
            </p>
          </div>

          {sourceImage && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSourceImage(null);
                  setDamageMask(null);
                  setRepairedImage(null);
                  setStats(null);
                }}
                className="text-xs sm:text-sm"
              >
                Upload Another
              </Button>
              <Button size="sm" onClick={handleDownload} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm">
                <Download className="w-4 h-4" /> Download Healed Photo
              </Button>
            </div>
          )}
        </div>

        {!sourceImage ? (
          /* Empty state & Dropzone */
          <div className="space-y-6">
            <Dropzone
              onFiles={(files: File[]) => files[0] && handleFile(files[0])}
              accept="image/*"
            />

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
              <span className="text-xs text-muted-foreground">Don&apos;t have an old photo on hand?</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadDemo}
                className="gap-2 border-amber-500/30 hover:bg-amber-500/10"
              >
                <History className="w-4 h-4 text-amber-500" /> Try Vintage Demo Photo (With Tears & Cracks)
              </Button>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
              <div className="p-4 rounded-xl border bg-card/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Wand2 className="w-4 h-4 text-amber-500" /> Auto Crack Detection
                </div>
                <p className="text-xs text-muted-foreground">
                  Directional second-order gradient analysis isolates thin white scratches, dark emulsion fractures, and folding creases.
                </p>
              </div>

              <div className="p-4 rounded-xl border bg-card/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Fast Marching Inpainting
                </div>
                <p className="text-xs text-muted-foreground">
                  Propagates healthy surrounding photo textures inwards across damaged regions without leaving blurry smudges.
                </p>
              </div>

              <div className="p-4 rounded-xl border bg-card/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Palette className="w-4 h-4 text-amber-500" /> Film Grain & Tone Matching
                </div>
                <p className="text-xs text-muted-foreground">
                  Dithers authentic microscopic silver-gelatin grain into healed patches so the repairs blend seamlessly with vintage film.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Active Editor */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Interactive Canvas Viewer (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div
                ref={containerRef}
                className="relative rounded-2xl overflow-hidden border bg-neutral-950/40 aspect-auto flex items-center justify-center p-2 min-h-[280px] sm:min-h-[380px] md:min-h-[460px] shadow-sm select-none"
              >
                <canvas
                  ref={displayCanvasRef}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  className={`max-w-full max-h-[620px] object-contain rounded-lg shadow-md transition-all ${
                    brushMode !== "none" ? "cursor-crosshair" : "cursor-default"
                  }`}
                />

                {isProcessing && (
                  <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                    <span className="text-sm font-medium">Scanning defects & synthesizing repair...</span>
                  </div>
                )}

                {/* Badges / Status Overlays */}
                <div className="absolute top-4 left-4 flex flex-wrap gap-2 pointer-events-none">
                  <Badge variant="outline" className="bg-background/80 backdrop-blur-md shadow-sm border text-xs">
                    {sourceImage.width} × {sourceImage.height} px
                  </Badge>
                  {isPeekingOriginal ? (
                    <Badge variant="destructive" className="bg-amber-600/90 text-white text-xs">
                      Viewing Original Scratched Photo
                    </Badge>
                  ) : showMaskOverlay ? (
                    <Badge variant="destructive" className="bg-rose-600/90 text-white text-xs">
                      Overlaying Damage Mask
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-background/80 backdrop-blur-md text-xs">
                      Repaired & Restored
                    </Badge>
                  )}
                </div>
              </div>

              {/* View Controls & Comparison Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border bg-card">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant={isPeekingOriginal ? "default" : "outline"}
                    size="sm"
                    onMouseDown={() => setIsPeekingOriginal(true)}
                    onMouseUp={() => setIsPeekingOriginal(false)}
                    onTouchStart={() => setIsPeekingOriginal(true)}
                    onTouchEnd={() => setIsPeekingOriginal(false)}
                    className="gap-2 select-none flex-1 sm:flex-initial text-xs sm:text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">Hold to Peek Original</span>
                    <span className="sm:hidden">Peek Original</span>
                  </Button>

                  <Button
                    variant={showMaskOverlay ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setShowMaskOverlay(!showMaskOverlay)}
                    className="gap-2 flex-1 sm:flex-initial text-xs sm:text-sm"
                  >
                    <Layers className="w-4 h-4 text-amber-500" />
                    {showMaskOverlay ? "Hide Mask" : "Highlight Defects"}
                  </Button>
                </div>

                {/* Split Slider */}
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto sm:min-w-[220px]">
                  <span className="text-xs text-muted-foreground font-medium">Original</span>
                  <Slider
                    value={[splitPos]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(val) => setSplitPos(val[0])}
                    className="flex-1 sm:flex-initial sm:w-32"
                  />
                  <span className="text-xs text-muted-foreground font-medium">Healed</span>
                </div>
              </div>

              {/* Manual Brush Touch-Up Bar */}
              <div className="p-3.5 sm:p-4 rounded-xl border bg-muted/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Paintbrush className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-semibold">Touch-Up Brush Tool</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">(Paint over missed tears or erase false detections)</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant={brushMode === "none" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBrushMode("none")}
                      className="text-xs h-8"
                    >
                      View Only
                    </Button>
                    <Button
                      variant={brushMode === "paint" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setBrushMode("paint");
                        setShowMaskOverlay(true);
                      }}
                      className="text-xs h-8 gap-1.5"
                    >
                      <Paintbrush className="w-3.5 h-3.5" /> Paint Defect
                    </Button>
                    <Button
                      variant={brushMode === "erase" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setBrushMode("erase");
                        setShowMaskOverlay(true);
                      }}
                      className="text-xs h-8 gap-1.5"
                    >
                      <Eraser className="w-3.5 h-3.5" /> Protect Feature
                    </Button>
                  </div>
                </div>

                {brushMode !== "none" && (
                  <div className="flex items-center gap-4 pt-1">
                    <Label className="text-xs text-muted-foreground">Brush Size: {brushSize}px</Label>
                    <Slider
                      value={[brushSize]}
                      min={4}
                      max={60}
                      step={2}
                      onValueChange={(val) => setBrushSize(val[0])}
                      className="max-w-[200px]"
                    />
                  </div>
                )}
              </div>

              {/* Vintage Trilogy Workflow Banner */}
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-sm text-amber-600 dark:text-amber-400">
                    <Sparkles className="w-4 h-4" /> Complete Vintage Restoration Trilogy
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Next step: Turn your repaired monochrome scan into lifelike color or upscale it 4x!
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/colorize">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs border-amber-500/30">
                      <Palette className="w-3.5 h-3.5 text-purple-500" /> AI Colorizer
                    </Button>
                  </Link>
                  <Link href="/upscale">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs border-amber-500/30">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" /> AI Super-Resolution
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Sidebar Settings (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Stats Card */}
              {stats && (
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Restoration Metrics
                    </span>
                    <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                      Healed
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-2.5 rounded-lg bg-muted/40">
                      <div className="text-lg font-bold text-amber-500">
                        {stats.repairedPixels.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Pixels Repaired</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/40">
                      <div className="text-lg font-bold text-amber-500">{stats.damagePercentage}%</div>
                      <div className="text-[11px] text-muted-foreground">Damaged Area</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-center text-muted-foreground">
                    Processing time: {stats.durationMs}ms · {stats.totalPixels.toLocaleString()} total pixels
                  </div>
                </div>
              )}

              {/* Detection Settings */}
              <div className="p-5 rounded-xl border bg-card space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-sm">Defect Detection</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSensitivity(55);
                      setDilateRadius(2);
                      setDetectScratches(true);
                      setDetectDust(true);
                      setDetectTears(true);
                    }}
                    className="h-7 text-xs text-muted-foreground"
                  >
                    Reset
                  </Button>
                </div>

                {/* Sensitivity Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <Label>Detection Sensitivity</Label>
                    <span className="text-muted-foreground">{sensitivity}%</span>
                  </div>
                  <Slider
                    value={[sensitivity]}
                    min={15}
                    max={95}
                    step={5}
                    onValueChange={(val) => setSensitivity(val[0])}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Higher values pick up subtle hairline scratches; lower values only target large obvious tears.
                  </p>
                </div>

                {/* Crack Dilation Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <Label>Repair Margin (Dilation)</Label>
                    <span className="text-muted-foreground">{dilateRadius}px</span>
                  </div>
                  <Slider
                    value={[dilateRadius]}
                    min={1}
                    max={4}
                    step={1}
                    onValueChange={(val) => setDilateRadius(val[0])}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Expands crack boundaries to ensure frayed or discolored edges around tears are fully inpainted.
                  </p>
                </div>

                {/* Defect Type Checkboxes */}
                <div className="space-y-3 pt-2 border-t">
                  <span className="text-xs font-medium">Defect Targets</span>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="scratches" className="text-xs cursor-pointer">
                      Scratches & Folds
                    </Label>
                    <button
                      id="scratches"
                      type="button"
                      role="switch"
                      aria-checked={detectScratches}
                      onClick={() => setDetectScratches(!detectScratches)}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                        detectScratches ? "bg-amber-600" : "bg-muted-foreground/30"
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                          detectScratches ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="dust" className="text-xs cursor-pointer">
                      Dust & Mold Spots
                    </Label>
                    <button
                      id="dust"
                      type="button"
                      role="switch"
                      aria-checked={detectDust}
                      onClick={() => setDetectDust(!detectDust)}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                        detectDust ? "bg-amber-600" : "bg-muted-foreground/30"
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                          detectDust ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="tears" className="text-xs cursor-pointer">
                      Edge Tears & Paper Rips
                    </Label>
                    <button
                      id="tears"
                      type="button"
                      role="switch"
                      aria-checked={detectTears}
                      onClick={() => setDetectTears(!detectTears)}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                        detectTears ? "bg-amber-600" : "bg-muted-foreground/30"
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                          detectTears ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Antique Texture & Tone Settings */}
              <div className="p-5 rounded-xl border bg-card space-y-5">
                <div className="flex items-center gap-2 border-b pb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-sm">Texture & Tone Revive</span>
                </div>

                {/* Film Grain Match */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <Label>Film Grain Dither</Label>
                    <span className="text-muted-foreground">{filmGrainMatch}%</span>
                  </div>
                  <Slider
                    value={[filmGrainMatch]}
                    min={0}
                    max={50}
                    step={5}
                    onValueChange={(val) => setFilmGrainMatch(val[0])}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Synthesizes authentic microscopic grain into repaired areas to eliminate artificial smoothness.
                  </p>
                </div>

                {/* Faded Tone Revitalization */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <Label>Contrast & Tone Revive</Label>
                    <span className="text-muted-foreground">{contrastRevive}%</span>
                  </div>
                  <Slider
                    value={[contrastRevive]}
                    min={0}
                    max={50}
                    step={5}
                    onValueChange={(val) => setContrastRevive(val[0])}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Restores faded silver blacks and antique contrast without clipping highlights.
                  </p>
                </div>

                {/* Re-Scan & Heal Button */}
                <Button
                  onClick={() => runRestoration()}
                  disabled={isProcessing}
                  className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`} />
                  Re-Scan & Heal Photo
                </Button>
              </div>

              {/* Export Panel */}
              <div className="p-5 rounded-xl border bg-card space-y-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Export Repaired Image
                </span>

                <div className="grid grid-cols-3 gap-2">
                  {(["png", "jpeg", "webp"] as const).map((fmt) => (
                    <Button
                      key={fmt}
                      variant={exportFormat === fmt ? "default" : "outline"}
                      size="sm"
                      onClick={() => setExportFormat(fmt)}
                      className="text-xs uppercase"
                    >
                      {fmt === "jpeg" ? "JPG" : fmt}
                    </Button>
                  ))}
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button onClick={handleDownload} className="w-full gap-2">
                    <Download className="w-4 h-4" /> Download Repaired Photo
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDownloadMask} className="text-xs text-muted-foreground">
                    Download Damage Mask PNG
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
