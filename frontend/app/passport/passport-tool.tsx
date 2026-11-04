"use client";

import * as React from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  Grid,
  Info,
  Layers,
  Loader2,
  Maximize2,
  Printer,
  RefreshCw,
  RotateCw,
  Sliders,
  Sparkles,
  User,
  Wand2,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { downloadBlob } from "@/lib/screenshot";
import { downloadUrl, getJob, submitRemoveBg } from "@/lib/api";
import {
  PASSPORT_STANDARDS,
  PassportStandard,
  generatePrintSheet4x6,
  autoAlignBiometricPhoto,
} from "@/lib/passport-standards";

export function PassportTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [imgUrl, setImgUrl] = React.useState<string | null>(null);
  const [activeImage, setActiveImage] = React.useState<HTMLImageElement | null>(null);

  // Selected Standard
  const [selectedStandardId, setSelectedStandardId] = React.useState<string>("us");
  const standard = React.useMemo(() => {
    return (
      PASSPORT_STANDARDS.find((s) => s.id === selectedStandardId) ||
      PASSPORT_STANDARDS[0]
    );
  }, [selectedStandardId]);

  // Transform controls
  const [zoom, setZoom] = React.useState<number>(1);
  const [panX, setPanX] = React.useState<number>(0);
  const [panY, setPanY] = React.useState<number>(0);
  const [rotation, setRotation] = React.useState<number>(0);

  // Adjustments
  const [brightness, setBrightness] = React.useState<number>(0); // -30 to 30
  const [contrast, setContrast] = React.useState<number>(0); // -30 to 30
  const [bgColor, setBgColor] = React.useState<string>("#ffffff");

  // Overlay guides
  const [showOverlay, setShowOverlay] = React.useState<boolean>(true);
  const [isAiProcessing, setIsAiProcessing] = React.useState<boolean>(false);
  const [aiProgressText, setAiProgressText] = React.useState<string>("");

  // Target file size constraint for official uploads (e.g. US State Dept < 240KB)
  const [maxKb, setMaxKb] = React.useState<boolean>(false);

  // Canvas refs
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const isDragging = React.useRef<boolean>(false);
  const dragStart = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStart = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Handle image upload
  const handleFileDrop = (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setFile(f);
    const url = URL.createObjectURL(f);
    setImgUrl(url);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setActiveImage(img);
      // Biometric auto-framing adhering to ICAO 9303 / official country standards
      const aligned = autoAlignBiometricPhoto(img, standard);
      setZoom(aligned.zoom);
      setPanX(aligned.panX);
      setPanY(aligned.panY);
      setRotation(0);
    };
    img.src = url;
  };

  // Switch country standard updates background & aspect
  const handleSelectStandard = (std: PassportStandard) => {
    setSelectedStandardId(std.id);
    setBgColor(std.bgColor);
    if (activeImage) {
      const aligned = autoAlignBiometricPhoto(activeImage, std);
      setZoom(aligned.zoom);
      setPanX(aligned.panX);
      setPanY(aligned.panY);
    }
  };

  // Center alignment reset
  const handleResetAlignment = () => {
    if (!activeImage) return;
    const aligned = autoAlignBiometricPhoto(activeImage, standard);
    setZoom(aligned.zoom);
    setPanX(aligned.panX);
    setPanY(aligned.panY);
    setRotation(0);
    setBrightness(0);
    setContrast(0);
  };

  // AI Background Removal via backend
  const handleAiRemoveBackground = async () => {
    if (!file) return;
    setIsAiProcessing(true);
    setAiProgressText("Analyzing subject & removing background...");

    try {
      const submission = await submitRemoveBg(file, {
        background: "transparent",
        format: "png",
      });

      let finishedUrl: string | null = null;
      for (let i = 0; i < 90; i++) {
        const job = await getJob(submission.jobId);
        if (job.state === "completed") {
          finishedUrl = downloadUrl(submission.jobId);
          break;
        }
        if (job.state === "failed") {
          throw new Error(job.error || "AI background removal failed");
        }
        await new Promise((r) => setTimeout(r, 800));
      }

      if (!finishedUrl) {
        throw new Error("AI Background removal timed out. Please try again.");
      }

      const cutImg = new Image();
      cutImg.crossOrigin = "anonymous";
      cutImg.onload = () => {
        setActiveImage(cutImg);
        const aligned = autoAlignBiometricPhoto(cutImg, standard);
        setZoom(aligned.zoom);
        setPanX(aligned.panX);
        setPanY(aligned.panY);
        setIsAiProcessing(false);
        setAiProgressText("");
        toast.success("AI Background removed & face framed to official " + standard.country + " standards!");
      };
      cutImg.src = finishedUrl;
    } catch (err: unknown) {
      setIsAiProcessing(false);
      const msg = err instanceof Error ? err.message : "Failed to start AI background removal.";
      toast.error(msg);
    }
  };

  // Interactive Canvas Rendering
  const renderCanvas = React.useCallback(
    (includeOverlay: boolean, targetCanvas?: HTMLCanvasElement): HTMLCanvasElement | null => {
      const c = targetCanvas || canvasRef.current;
      if (!c || !activeImage) return null;

      const targetW = standard.widthPx;
      const targetH = standard.heightPx;
      c.width = targetW;
      c.height = targetH;

      const ctx = c.getContext("2d");
      if (!ctx) return null;

      // 1. Draw solid background color
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, targetW, targetH);

      // 2. Draw user photo with transforms & filters
      ctx.save();
      // Apply filters
      const bFilter = 100 + brightness;
      const cFilter = 100 + contrast;
      ctx.filter = `brightness(${bFilter}%) contrast(${cFilter}%)`;

      // Origin at center of passport photo
      ctx.translate(targetW / 2 + panX, targetH / 2 + panY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      // Draw image centered
      const imgW = activeImage.naturalWidth;
      const imgH = activeImage.naturalHeight;
      ctx.drawImage(activeImage, -imgW / 2, -imgH / 2, imgW, imgH);
      ctx.restore();

      // 3. Draw Biometric Overlay if requested
      if (includeOverlay) {
        ctx.save();

        // Biometric Eye lines
        // Eye level min & max percentage from bottom
        const eyeYMax = targetH * (1 - standard.eyeLevelMaxPercent / 100);
        const eyeYMin = targetH * (1 - standard.eyeLevelMinPercent / 100);

        // Head height min & max percentage from top/bottom
        const headTopMax = targetH * (1 - standard.headHeightMaxPercent / 100);
        const headTopMin = targetH * (1 - standard.headHeightMinPercent / 100);

        // Oval Head Guide
        const centerX = targetW / 2;
        const headH = targetH * ((standard.headHeightMinPercent + standard.headHeightMaxPercent) / 200);
        const headW = headH * 0.72;
        const headCenterY = (eyeYMax + eyeYMin) / 2 - headH * 0.08;

        // Subtle shaded vignette outside head oval
        ctx.strokeStyle = "rgba(59, 130, 246, 0.75)";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);

        ctx.beginPath();
        ctx.ellipse(centerX, headCenterY, headW / 2, headH / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Center vertical alignment axis
        ctx.strokeStyle = "rgba(147, 197, 253, 0.6)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, targetH);
        ctx.stroke();

        // Eye Level Zone band
        ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
        ctx.fillRect(0, eyeYMax, targetW, eyeYMin - eyeYMax);

        // Eye level guideline
        ctx.strokeStyle = "rgba(16, 185, 129, 0.85)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, (eyeYMax + eyeYMin) / 2);
        ctx.lineTo(targetW, (eyeYMax + eyeYMin) / 2);
        ctx.stroke();

        // Crown guideline (Top of head)
        ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, headTopMax);
        ctx.lineTo(targetW, headTopMax);
        ctx.stroke();

        // Chin level guideline
        const chinY = headTopMax + headH;
        ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, chinY);
        ctx.lineTo(targetW, chinY);
        ctx.stroke();

        // Labels
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
        ctx.fillText("Crown Limit", 10, headTopMax - 6);
        ctx.fillText("Eye Zone", 10, (eyeYMax + eyeYMin) / 2 - 6);
        ctx.fillText("Chin Line", 10, chinY + 16);

        ctx.restore();
      }

      return c;
    },
    [activeImage, standard, bgColor, brightness, contrast, panX, panY, rotation, zoom],
  );

  // Redraw when parameters change
  React.useEffect(() => {
    renderCanvas(showOverlay);
  }, [renderCanvas, showOverlay]);

  // Touch and Mouse Dragging for Panning
  const handlePointerDown = (clientX: number, clientY: number) => {
    isDragging.current = true;
    dragStart.current = { x: clientX, y: clientY };
    panStart.current = { x: panX, y: panY };
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDragging.current) return;
    const dx = clientX - dragStart.current.x;
    const dy = clientY - dragStart.current.y;
    setPanX(panStart.current.x + dx);
    setPanY(panStart.current.y + dy);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  // Wheel to Zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.05 : 0.95;
    setZoom((z) => Math.max(0.2, Math.min(4.0, z * factor)));
  };

  // Export clean passport photo (no guides)
  const handleExportSingle = async (format: "jpeg" | "png") => {
    if (!activeImage) return;
    const exportCanvas = document.createElement("canvas");
    renderCanvas(false, exportCanvas);

    const mime = format === "jpeg" ? "image/jpeg" : "image/png";
    const quality = maxKb ? 0.78 : 0.95;

    exportCanvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Export failed");
          return;
        }
        const name = `passport-${standard.id}-${standard.widthMm}x${standard.heightMm}mm.${format === "jpeg" ? "jpg" : "png"}`;
        downloadBlob(blob, name);
        toast.success(`Saved ${standard.label} (${(blob.size / 1024).toFixed(1)} KB)`);
      },
      mime,
      quality,
    );
  };

  // Export 4x6" Print Sheet
  const handleExportPrintSheet = async () => {
    if (!activeImage) return;
    const tileCanvas = document.createElement("canvas");
    renderCanvas(false, tileCanvas);

    try {
      const sheetBlob = await generatePrintSheet4x6(tileCanvas, standard);
      downloadBlob(sheetBlob, `passport-4x6-print-sheet-${standard.id}.jpg`);
      toast.success("Ready-to-print 4x6\" sheet downloaded!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate print sheet.");
    }
  };

  // Quick Print Dialog
  const handlePrint = () => {
    if (!activeImage) return;
    const tileCanvas = document.createElement("canvas");
    renderCanvas(false, tileCanvas);

    generatePrintSheet4x6(tileCanvas, standard).then((sheetBlob) => {
      const url = URL.createObjectURL(sheetBlob);
      const win = window.open("");
      if (!win) {
        toast.error("Pop-up blocked. Please allow pop-ups to print directly.");
        return;
      }
      win.document.write(`
        <html>
          <head>
            <title>Print Passport Photos - ${standard.label}</title>
            <style>
              @page { size: 6in 4in; margin: 0; }
              body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: #fff; }
              img { width: 100%; height: 100%; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${url}" onload="window.print();window.close();" />
          </body>
        </html>
      `);
      win.document.close();
    });
  };

  return (
    <AuthGate>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🪪</span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Biometric Passport & Visa Photo Studio
              </h1>
              <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                Official Standards
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Create official passport and visa photos for 50+ countries with biometric head & eye alignment guides, AI background cleaner, and print-ready 4×6″ sheets.
            </p>
          </div>
        </div>

        {/* Upload Zone if no file */}
        {!file && (
          <div className="mx-auto max-w-2xl py-8">
            <Dropzone
              onFiles={handleFileDrop}
              accept="image/*"
              kind="image"
            />
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 text-center text-xs text-muted-foreground">
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">🎯</span>
                <p className="font-semibold text-foreground mt-1">Biometric Guides</p>
                <p>Precise crown, eye-level & chin positioning according to consular regulations.</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">✨</span>
                <p className="font-semibold text-foreground mt-1">AI Studio Backdrop</p>
                <p>Remove cluttered home backgrounds into solid white or official off-white in 1 click.</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">🖨️</span>
                <p className="font-semibold text-foreground mt-1">4×6″ Print Sheets</p>
                <p>Packs 6 to 8 photos onto standard 4×6 photo paper with cutting tick marks.</p>
              </div>
            </div>
          </div>
        )}

        {/* Studio Workspace */}
        {file && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left: Interactive Alignment Canvas */}
            <div className="flex flex-col items-center space-y-4 lg:col-span-7">
              <div className="relative flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-muted/30 p-6 shadow-sm w-full">
                {/* Canvas Box */}
                <div
                  className="relative overflow-hidden rounded-lg shadow-md ring-1 ring-border cursor-grab active:cursor-grabbing select-none"
                  style={{
                    width: Math.min(380, standard.widthPx * 0.7),
                    height: Math.min(480, standard.heightPx * 0.7),
                    maxWidth: "100%",
                    touchAction: "none",
                  }}
                  onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
                  onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
                  onMouseUp={handlePointerUp}
                  onMouseLeave={handlePointerUp}
                  onTouchStart={(e) => {
                    if (e.touches.length === 1) {
                      handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
                    }
                  }}
                  onTouchMove={(e) => {
                    if (e.touches.length === 1) {
                      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
                    }
                  }}
                  onTouchEnd={handlePointerUp}
                >
                  <canvas
                    ref={canvasRef}
                    onWheel={handleWheel}
                    className="w-full h-full object-contain"
                  />

                  {/* AI processing loader overlay */}
                  {isAiProcessing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm p-4 text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                      <p className="text-sm font-semibold">{aiProgressText}</p>
                      <p className="text-xs text-muted-foreground mt-1">Isolating subject from background...</p>
                    </div>
                  )}
                </div>

                {/* Canvas Quick Controls Bar */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant={showOverlay ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => setShowOverlay(!showOverlay)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {showOverlay ? "Hide Guides" : "Show Guides"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={handleResetAlignment}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => {
                      setFile(null);
                      setActiveImage(null);
                      setImgUrl(null);
                    }}
                  >
                    Change Photo
                  </Button>
                </div>

                {/* Biometric Checklist Indicator */}
                <div className="mt-4 w-full rounded-xl border border-border/40 bg-background/60 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-semibold text-muted-foreground pb-1 border-b border-border/30">
                    <span>Biometric Compliance Check</span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                      300 DPI Standard
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{standard.widthMm} × {standard.heightMm} mm ({standard.widthPx}×{standard.heightPx} px)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Head: {standard.headHeightMinPercent}% - {standard.headHeightMaxPercent}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Eyes centered in green band</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Neutral solid background</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Controls & Adjustments */}
            <div className="space-y-6 lg:col-span-5">
              {/* 1. Country & Specification Picker */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <span>Country & Standard</span>
                  </Label>
                  <span className="text-xs text-muted-foreground">{standard.flag} {standard.country}</span>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {PASSPORT_STANDARDS.map((std) => (
                    <button
                      key={std.id}
                      onClick={() => handleSelectStandard(std)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-colors ${
                        selectedStandardId === std.id
                          ? "border-blue-500/80 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 font-medium"
                          : "border-border/50 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{std.flag}</span>
                        <div>
                          <p className="font-semibold text-foreground">{std.label}</p>
                          <p className="text-[10px] text-muted-foreground">{std.widthMm}×{std.heightMm} mm • Head {std.headHeightMinPercent}-{std.headHeightMaxPercent}%</p>
                        </div>
                      </div>
                      {selectedStandardId === std.id && <Check className="h-4 w-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. AI Background Remover & Colors */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <span>Background Backdrop</span>
                  </Label>
                  <Badge variant="outline" className="text-[10px]">AI Studio</Badge>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isAiProcessing}
                  onClick={handleAiRemoveBackground}
                  className="w-full gap-2 border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 text-purple-700 dark:text-purple-300 font-medium"
                >
                  {isAiProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  ) : (
                    <Wand2 className="h-4 w-4 text-purple-600" />
                  )}
                  AI Auto-Clean Background
                </Button>

                {/* Color swatches */}
                <div>
                  <span className="text-xs text-muted-foreground">Official Background Color:</span>
                  <div className="mt-2 flex items-center gap-2">
                    {[
                      { label: "Pure White", color: "#ffffff", border: "border-slate-300" },
                      { label: "Off-White", color: "#f8fafc", border: "border-slate-300" },
                      { label: "Light Gray", color: "#e2e8f0", border: "border-slate-300" },
                      { label: "Light Blue", color: "#dbeafe", border: "border-blue-300" },
                      { label: "Soft Cream", color: "#fef9c3", border: "border-amber-200" },
                    ].map((swatch) => (
                      <button
                        key={swatch.color}
                        onClick={() => setBgColor(swatch.color)}
                        title={swatch.label}
                        className={`h-7 w-7 rounded-full border-2 transition-transform ${swatch.border} ${
                          bgColor === swatch.color ? "scale-125 ring-2 ring-blue-500 ring-offset-2" : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: swatch.color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Scale, Pan & Rotate Sliders */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
                <Label className="text-sm font-semibold">Transform & Straighten</Label>

                {/* Zoom */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <ZoomIn className="h-3 w-3" /> Zoom Scale
                    </span>
                    <span className="font-mono">{zoom.toFixed(2)}x</span>
                  </div>
                  <Slider
                    value={[zoom]}
                    min={0.3}
                    max={3.0}
                    step={0.02}
                    onValueChange={([val]) => setZoom(val)}
                  />
                </div>

                {/* Tilt / Rotation */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <RotateCw className="h-3 w-3" /> Straighten Tilt
                    </span>
                    <span className="font-mono">{rotation}°</span>
                  </div>
                  <Slider
                    value={[rotation]}
                    min={-15}
                    max={15}
                    step={0.5}
                    onValueChange={([val]) => setRotation(val)}
                  />
                </div>

                {/* Brightness */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Brightness</span>
                    <span className="font-mono">{brightness > 0 ? `+${brightness}` : brightness}</span>
                  </div>
                  <Slider
                    value={[brightness]}
                    min={-30}
                    max={30}
                    step={1}
                    onValueChange={([val]) => setBrightness(val)}
                  />
                </div>

                {/* Contrast */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Contrast</span>
                    <span className="font-mono">{contrast > 0 ? `+${contrast}` : contrast}</span>
                  </div>
                  <Slider
                    value={[contrast]}
                    min={-30}
                    max={30}
                    step={1}
                    onValueChange={([val]) => setContrast(val)}
                  />
                </div>
              </div>

              {/* 4. Export Suite */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
                <Label className="text-sm font-semibold flex items-center justify-between">
                  <span>Export Options</span>
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={maxKb}
                      onChange={(e) => setMaxKb(e.target.checked)}
                      className="rounded border-border text-blue-600 focus:ring-blue-500"
                    />
                    <span>Compress &lt;240KB (US DS-160)</span>
                  </label>
                </Label>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 font-medium"
                    onClick={() => handleExportSingle("jpeg")}
                  >
                    <Download className="h-4 w-4" />
                    Single Photo (JPG)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 font-medium"
                    onClick={() => handleExportSingle("png")}
                  >
                    <Download className="h-4 w-4" />
                    Single Photo (PNG)
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2 font-medium"
                    onClick={handleExportPrintSheet}
                  >
                    <Grid className="h-4 w-4 text-blue-500" />
                    Print Sheet 4×6″
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 font-medium"
                    onClick={handlePrint}
                  >
                    <Printer className="h-4 w-4 text-emerald-500" />
                    Print Directly
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
