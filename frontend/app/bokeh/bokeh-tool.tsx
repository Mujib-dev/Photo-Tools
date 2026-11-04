"use client";

import * as React from "react";
import {
  Aperture,
  Camera,
  Check,
  ChevronRight,
  Download,
  Eye,
  Focus,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  RefreshCw,
  Sliders,
  Sparkles,
  Sun,
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
import { downloadUrl, getJob, submitRemoveBg } from "@/lib/api";
import {
  type BokehMode,
  type BokehSettings,
  APERTURE_PRESETS,
  DEFAULT_BOKEH_SETTINGS,
  renderBokehCanvas,
  renderDepthMapVisualization,
} from "@/lib/bokeh-engine";

export function BokehTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [imgUrl, setImgUrl] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<BokehSettings>(DEFAULT_BOKEH_SETTINGS);
  const [format, setFormat] = React.useState<"jpeg" | "png" | "webp">("jpeg");
  const [quality, setQuality] = React.useState(0.92);

  // View states
  const [showOriginal, setShowOriginal] = React.useState(false);
  const [viewDepthMap, setViewDepthMap] = React.useState(false);
  const [isAiIsolating, setIsAiIsolating] = React.useState(false);

  // Canvases
  const sourceCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const subjectMaskCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Redraw preview whenever settings, view mode, or source changes
  const redraw = React.useCallback(() => {
    if (!sourceCanvasRef.current || !previewCanvasRef.current) return;
    const src = sourceCanvasRef.current;
    const dest = previewCanvasRef.current;

    dest.width = src.width;
    dest.height = src.height;
    const ctx = dest.getContext("2d");
    if (!ctx) return;

    if (showOriginal) {
      ctx.drawImage(src, 0, 0);
      return;
    }

    if (viewDepthMap) {
      const depthCanvas = renderDepthMapVisualization(src.width, src.height, settings);
      ctx.drawImage(depthCanvas, 0, 0);
      return;
    }

    const resultCanvas = renderBokehCanvas(src, settings, subjectMaskCanvasRef.current);
    ctx.drawImage(resultCanvas, 0, 0);
  }, [settings, showOriginal, viewDepthMap]);

  React.useEffect(() => {
    redraw();
  }, [redraw]);

  // Load incoming image
  const handleFileDrop = (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setFile(f);
    const url = URL.createObjectURL(f);
    setImgUrl(url);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0);
      sourceCanvasRef.current = canvas;
      subjectMaskCanvasRef.current = null;
      redraw();
      toast.success("Image loaded. Click anywhere on the image to set the focus point!");
    };
    img.src = url;
  };

  // Interactive Tap / Click / Touch to Focus
  const setFocusAtClientCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current || !sourceCanvasRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    setSettings((prev) => ({
      ...prev,
      focusX: Number(x.toFixed(3)),
      focusY: Number(y.toFixed(3)),
    }));
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    setFocusAtClientCoords(e.clientX, e.clientY);
  };

  const handleCanvasTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      setFocusAtClientCoords(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Run AI Subject Isolation
  const handleRunAiSubject = async () => {
    if (!file || !sourceCanvasRef.current) return;
    setIsAiIsolating(true);
    try {
      toast.info("Analyzing portrait depth & separating subject...");
      const submission = await submitRemoveBg(file, { background: "transparent", format: "png" });
      
      // Poll job until complete
      let finishedUrl: string | null = null;
      for (let i = 0; i < 40; i++) {
        const job = await getJob(submission.jobId);
        if (job.state === "completed") {
          finishedUrl = downloadUrl(submission.jobId);
          break;
        }
        if (job.state === "failed") {
          throw new Error(job.error || "Subject isolation failed");
        }
        await new Promise((r) => setTimeout(r, 600));
      }

      if (!finishedUrl) throw new Error("Timed out waiting for subject isolation");

      const maskImg = new Image();
      maskImg.crossOrigin = "anonymous";
      maskImg.onload = () => {
        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = sourceCanvasRef.current!.width;
        maskCanvas.height = sourceCanvasRef.current!.height;
        const mctx = maskCanvas.getContext("2d");
        if (mctx) mctx.drawImage(maskImg, 0, 0, maskCanvas.width, maskCanvas.height);
        subjectMaskCanvasRef.current = maskCanvas;
        setSettings((prev) => ({ ...prev, mode: "subject" }));
        setIsAiIsolating(false);
        toast.success("AI Subject isolated! Background blurred automatically.");
      };
      maskImg.src = finishedUrl;
    } catch {
      setIsAiIsolating(false);
      toast.error("Could not run AI subject isolation, using radial focus instead.");
    }
  };

  // Download high-resolution result
  const handleDownloadResult = () => {
    if (!sourceCanvasRef.current) return;
    try {
      const resultCanvas = renderBokehCanvas(
        sourceCanvasRef.current,
        settings,
        subjectMaskCanvasRef.current,
      );
      const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
      resultCanvas.toBlob(
        (blob) => {
          if (blob) {
            downloadBlob(blob, `bokeh-portrait-${Date.now()}.${format === "jpeg" ? "jpg" : format}`);
            toast.success("Portrait photo downloaded!");
          }
        },
        mime,
        quality,
      );
    } catch {
      toast.error("Failed to export image");
    }
  };

  // Download Depth Map
  const handleDownloadDepthMap = () => {
    if (!sourceCanvasRef.current) return;
    const depthCanvas = renderDepthMapVisualization(
      sourceCanvasRef.current.width,
      sourceCanvasRef.current.height,
      settings,
    );
    depthCanvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, `depth-map-${Date.now()}.png`);
        toast.success("Depth map downloaded!");
      }
    }, "image/png");
  };

  return (
    <AuthGate>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Aperture className="w-6 h-6" />
              </span>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                AI Portrait Bokeh & Depth Studio
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Simulate DSLR lens depth-of-field, specular highlight bloom, and tilt-shift miniature optics.
            </p>
          </div>

          {imgUrl && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={showOriginal ? "secondary" : "outline"}
                size="sm"
                onMouseDown={() => setShowOriginal(true)}
                onMouseUp={() => setShowOriginal(false)}
                onMouseLeave={() => setShowOriginal(false)}
                onTouchStart={() => setShowOriginal(true)}
                onTouchEnd={() => setShowOriginal(false)}
                className="gap-1.5 select-none"
              >
                <Eye className="w-4 h-4" />
                Hold for Original
              </Button>

              <Button
                variant={viewDepthMap ? "default" : "outline"}
                size="sm"
                onClick={() => setViewDepthMap(!viewDepthMap)}
                className="gap-1.5"
              >
                <Layers className="w-4 h-4" />
                {viewDepthMap ? "Exit Depth View" : "Depth Map"}
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadResult}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export Photo
              </Button>
            </div>
          )}
        </div>

        {/* Empty State / Initial Dropzone */}
        {!imgUrl ? (
          <div className="max-w-2xl mx-auto my-12">
            <Dropzone
              kind="image"
              onFiles={handleFileDrop}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Interactive Canvas */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="bg-card border rounded-2xl p-4 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Focus className="w-4 h-4 text-amber-500" />
                    <span>Click anywhere on photo to focus</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setImgUrl(null);
                      setFile(null);
                      sourceCanvasRef.current = null;
                      subjectMaskCanvasRef.current = null;
                    }}
                  >
                    Change Image
                  </Button>
                </div>

                {/* Canvas Container with Interactive Crosshair */}
                <div
                  ref={containerRef}
                  onClick={handleCanvasClick}
                  onTouchStart={handleCanvasTouch}
                  onTouchMove={handleCanvasTouch}
                  className="relative rounded-xl overflow-hidden cursor-crosshair border bg-slate-950/20 flex items-center justify-center select-none touch-none"
                >
                  <canvas
                    ref={previewCanvasRef}
                    className="max-h-[580px] w-full object-contain"
                  />

                  {/* Focus Target Indicator */}
                  {!viewDepthMap && !showOriginal && settings.mode === "radial" && (
                    <div
                      className="pointer-events-none absolute w-12 h-12 rounded-full border-2 border-dashed border-white/90 shadow-2xl flex items-center justify-center -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                      style={{
                        left: `${settings.focusX * 100}%`,
                        top: `${settings.focusY * 100}%`,
                      }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-md" />
                    </div>
                  )}

                  {/* Tilt-shift indicator line */}
                  {!viewDepthMap && !showOriginal && settings.mode === "tilt-shift" && (
                    <div
                      className="pointer-events-none absolute w-[140%] h-0.5 border-t-2 border-dashed border-amber-400 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${settings.focusX * 100}%`,
                        top: `${settings.focusY * 100}%`,
                        transform: `translate(-50%, -50%) rotate(${settings.tiltAngle}deg)`,
                      }}
                    />
                  )}
                </div>

                {/* Status Bar */}
                <div className="mt-3 flex items-center justify-between px-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-500" />
                    <span>Focus Point: ({Math.round(settings.focusX * 100)}%, {Math.round(settings.focusY * 100)}%)</span>
                  </div>
                  <div className="font-mono">
                    Aperture Blur: {settings.aperture}px
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Controls Sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              {/* Aperture / f-Stop Presets */}
              <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Aperture className="w-4 h-4 text-amber-500" />
                    Lens Aperture
                  </h3>
                  <Badge variant="outline" className="font-mono text-xs">
                    {settings.aperture === 0
                      ? "Pin Sharp"
                      : `${settings.aperture}px blur`}
                  </Badge>
                </div>

                {/* f-stop pill buttons */}
                <div className="grid grid-cols-3 gap-1.5">
                  {APERTURE_PRESETS.map((p) => {
                    const isSelected = settings.aperture === p.aperture;
                    return (
                      <Button
                        key={p.fStop}
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className={`h-9 flex flex-col items-center justify-center py-1 ${
                          isSelected ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                        }`}
                        onClick={() => setSettings({ ...settings, aperture: p.aperture })}
                      >
                        <span className="font-mono font-bold text-xs">{p.fStop}</span>
                        <span className="text-[9px] opacity-80 truncate">{p.label}</span>
                      </Button>
                    );
                  })}
                </div>

                {/* Continuous Slider */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Custom Blur Radius</span>
                    <span className="font-mono">{settings.aperture} px</span>
                  </div>
                  <Slider
                    min={0}
                    max={48}
                    step={2}
                    value={[settings.aperture]}
                    onValueChange={(val) => setSettings({ ...settings, aperture: val[0] })}
                  />
                </div>
              </div>

              {/* Focus Mode & Depth Controls */}
              <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Focus className="w-4 h-4 text-amber-500" />
                  Depth of Field Mode
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <Button
                    size="sm"
                    variant={settings.mode === "radial" ? "secondary" : "ghost"}
                    className="h-8 text-xs"
                    onClick={() => setSettings({ ...settings, mode: "radial" })}
                  >
                    DSLR Radial
                  </Button>
                  <Button
                    size="sm"
                    variant={settings.mode === "tilt-shift" ? "secondary" : "ghost"}
                    className="h-8 text-xs"
                    onClick={() => setSettings({ ...settings, mode: "tilt-shift" })}
                  >
                    Tilt-Shift
                  </Button>
                  <Button
                    size="sm"
                    variant={settings.mode === "multiplane" ? "secondary" : "ghost"}
                    className="h-8 text-xs"
                    onClick={() => setSettings({ ...settings, mode: "multiplane" })}
                  >
                    3D Multiplane
                  </Button>
                  <Button
                    size="sm"
                    variant={settings.mode === "subject" ? "secondary" : "ghost"}
                    className="h-8 text-xs"
                    onClick={() => {
                      if (!subjectMaskCanvasRef.current) {
                        handleRunAiSubject();
                      } else {
                        setSettings({ ...settings, mode: "subject" });
                      }
                    }}
                  >
                    AI Subject
                  </Button>
                </div>

                {/* Radial Focus Settings */}
                {settings.mode === "radial" && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Focus Sweetspot Radius</span>
                        <span className="font-mono">{Math.round(settings.focusRadius * 100)}%</span>
                      </div>
                      <Slider
                        min={5}
                        max={60}
                        step={2}
                        value={[Math.round(settings.focusRadius * 100)]}
                        onValueChange={(val) => setSettings({ ...settings, focusRadius: val[0] / 100 })}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Falloff / Feathering</span>
                        <span className="font-mono">{Math.round(settings.feather * 100)}%</span>
                      </div>
                      <Slider
                        min={10}
                        max={80}
                        step={5}
                        value={[Math.round(settings.feather * 100)]}
                        onValueChange={(val) => setSettings({ ...settings, feather: val[0] / 100 })}
                      />
                    </div>
                  </div>
                )}

                {/* Tilt Shift Settings */}
                {settings.mode === "tilt-shift" && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tilt Angle</span>
                        <span className="font-mono">{settings.tiltAngle}°</span>
                      </div>
                      <Slider
                        min={0}
                        max={180}
                        step={5}
                        value={[settings.tiltAngle]}
                        onValueChange={(val) => setSettings({ ...settings, tiltAngle: val[0] })}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Band Width</span>
                        <span className="font-mono">{Math.round(settings.tiltBandWidth * 100)}%</span>
                      </div>
                      <Slider
                        min={5}
                        max={50}
                        step={2}
                        value={[Math.round(settings.tiltBandWidth * 100)]}
                        onValueChange={(val) => setSettings({ ...settings, tiltBandWidth: val[0] / 100 })}
                      />
                    </div>
                  </div>
                )}

                {/* 3D Multi-Plane Settings */}
                {settings.mode === "multiplane" && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Focal Plane Depth</span>
                        <span className="font-mono">
                          {Math.round((settings.focalPlaneDepth ?? 0.35) * 100)}% ({((settings.focalPlaneDepth ?? 0.35) < 0.3 ? "Foreground" : (settings.focalPlaneDepth ?? 0.35) < 0.7 ? "Midground" : "Background")})
                        </span>
                      </div>
                      <Slider
                        min={0}
                        max={100}
                        step={2}
                        value={[Math.round((settings.focalPlaneDepth ?? 0.35) * 100)]}
                        onValueChange={(val) => setSettings({ ...settings, focalPlaneDepth: val[0] / 100 })}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Depth-of-Field Window</span>
                        <span className="font-mono">{Math.round((settings.depthSpread ?? 0.22) * 100)}%</span>
                      </div>
                      <Slider
                        min={5}
                        max={50}
                        step={2}
                        value={[Math.round((settings.depthSpread ?? 0.22) * 100)]}
                        onValueChange={(val) => setSettings({ ...settings, depthSpread: val[0] / 100 })}
                      />
                    </div>
                  </div>
                )}

                {/* AI Subject Settings */}
                {settings.mode === "subject" && (
                  <div className="pt-2 border-t space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Subject is isolated via neural network segmentation. Background is blurred smoothly.
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isAiIsolating}
                      onClick={handleRunAiSubject}
                      className="w-full text-xs gap-1.5"
                    >
                      {isAiIsolating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Analyzing Subject...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                          Re-Analyze Subject
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Optical Character & Specular Bloom */}
              <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-500" />
                  Optics & Lighting
                </h3>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Specular Highlight Bloom</span>
                    <span className="font-mono">{settings.specularBoost}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[settings.specularBoost]}
                    onValueChange={(val) => setSettings({ ...settings, specularBoost: val[0] })}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Edge Vignette</span>
                    <span className="font-mono">{settings.vignette}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={60}
                    step={5}
                    value={[settings.vignette]}
                    onValueChange={(val) => setSettings({ ...settings, vignette: val[0] })}
                  />
                </div>

                <div className="flex items-center justify-between pt-1 border-t">
                  <Label className="text-xs font-medium cursor-pointer">Invert Focus (Blur Center)</Label>
                  <Button
                    size="sm"
                    variant={settings.invert ? "default" : "outline"}
                    className="h-6 text-xs px-2"
                    onClick={() => setSettings({ ...settings, invert: !settings.invert })}
                  >
                    {settings.invert ? "Inverted" : "Normal"}
                  </Button>
                </div>
              </div>

              {/* Export Panel */}
              <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold text-sm">Export Options</h3>

                <div className="grid grid-cols-3 gap-1.5">
                  {(["jpeg", "png", "webp"] as const).map((fmt) => (
                    <Button
                      key={fmt}
                      size="sm"
                      variant={format === fmt ? "default" : "outline"}
                      className="h-8 text-xs uppercase"
                      onClick={() => setFormat(fmt)}
                    >
                      {fmt}
                    </Button>
                  ))}
                </div>

                {format !== "png" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Quality</span>
                      <span className="font-mono">{Math.round(quality * 100)}%</span>
                    </div>
                    <Slider
                      min={40}
                      max={100}
                      step={5}
                      value={[Math.round(quality * 100)]}
                      onValueChange={(val) => setQuality(val[0] / 100)}
                    />
                  </div>
                )}

                <div className="pt-2 border-t flex flex-col gap-2">
                  <Button
                    onClick={handleDownloadResult}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    Download Portrait Photo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadDepthMap}
                    className="w-full text-xs gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Download Depth Map (PNG)
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
