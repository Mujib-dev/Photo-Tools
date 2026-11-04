"use client";

import * as React from "react";
import {
  ArrowLeft,
  Check,
  Columns,
  Download,
  Expand,
  Eye,
  Layers,
  Maximize2,
  RefreshCw,
  Sliders,
  Sparkles,
  Split,
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
  calculatePaddingForAspect,
  uncropImageData,
  UncropAspectRatio,
  UncropPadding,
  OutpaintMode,
} from "@/lib/uncrop-engine";

const ASPECT_PRESETS: {
  id: UncropAspectRatio;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    id: "9:16",
    label: "9:16 Story / Reel",
    icon: "📱",
    desc: "Vertical format for Instagram Stories, TikTok, Reels & Phone Wallpapers",
  },
  {
    id: "16:9",
    label: "16:9 Banner",
    icon: "🖥️",
    desc: "Horizontal wide landscape for YouTube banners, monitors & presentations",
  },
  {
    id: "4:5",
    label: "4:5 Portrait Feed",
    icon: "🖼️",
    desc: "Classic Instagram Feed portrait aspect ratio that maximizes screen real estate",
  },
  {
    id: "1:1",
    label: "1:1 Square",
    icon: "🔲",
    desc: "Square format for profile avatars, grid posts, and product showcases",
  },
  {
    id: "custom",
    label: "Custom Free Expand",
    icon: "🌐",
    desc: "Manually expand any edge (top, bottom, left, right) by specific pixels",
  },
];

export function UncropTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [originalImage, setOriginalImage] = React.useState<HTMLImageElement | null>(null);
  const [originalData, setOriginalData] = React.useState<ImageData | null>(null);

  // Settings
  const [aspect, setAspect] = React.useState<UncropAspectRatio>("9:16");
  const [padding, setPadding] = React.useState<UncropPadding>({ top: 0, bottom: 0, left: 0, right: 0 });
  const [outpaintMode, setOutpaintMode] = React.useState<OutpaintMode>("blur-bokeh");

  // Comparison mode & Split slider
  const [viewMode, setViewMode] = React.useState<"result" | "split" | "side-by-side">("result");
  const [splitPos, setSplitPos] = React.useState<number>(50);
  const isDraggingSplit = React.useRef<boolean>(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Canvases
  const resultCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

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

      // Create initial ImageData
      const offCanvas = document.createElement("canvas");
      offCanvas.width = img.naturalWidth;
      offCanvas.height = img.naturalHeight;
      const ctx = offCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
        setOriginalData(data);

        // Calculate initial padding for 9:16
        const pad = calculatePaddingForAspect(img.naturalWidth, img.naturalHeight, "9:16");
        setPadding(pad);
      }
    };
    img.src = url;
  };

  // Switch aspect preset
  const handleSelectAspect = (preset: UncropAspectRatio) => {
    setAspect(preset);
    if (!originalData) return;

    if (preset === "custom") {
      // Default to 10% expand all sides
      const margin = Math.round(originalData.width * 0.1);
      setPadding({ top: margin, bottom: margin, left: margin, right: margin });
    } else {
      const pad = calculatePaddingForAspect(originalData.width, originalData.height, preset);
      setPadding(pad);
    }
  };

  // Re-run generative outpainting
  const uncroppedData = React.useMemo(() => {
    if (!originalData) return null;
    return uncropImageData(originalData, { padding, mode: outpaintMode });
  }, [originalData, padding, outpaintMode]);

  // Render to result canvas
  React.useEffect(() => {
    const canvas = resultCanvasRef.current;
    if (!canvas || !uncroppedData) return;
    canvas.width = uncroppedData.width;
    canvas.height = uncroppedData.height;
    const ctx = canvas.getContext("2d");
    ctx?.putImageData(uncroppedData, 0, 0);
  }, [uncroppedData]);

  // Split drag
  const handleSplitDrag = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setSplitPos(Math.max(0, Math.min(100, pos)));
  };

  // Export
  const handleExport = (format: "jpeg" | "png" | "webp") => {
    if (!uncroppedData) return;
    const expCanvas = document.createElement("canvas");
    expCanvas.width = uncroppedData.width;
    expCanvas.height = uncroppedData.height;
    const ctx = expCanvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(uncroppedData, 0, 0);

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
        const base = file?.name.replace(/\.[^/.]+$/, "") || "uncrop";
        downloadBlob(blob, `${base}-expanded-${aspect}.${format === "jpeg" ? "jpg" : format}`);
        toast.success(`Expanded image saved (${(blob.size / 1024).toFixed(1)} KB)`);
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
              <span className="text-2xl">🔄</span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                AI Canvas Expander &amp; Generative Uncrop
              </h1>
              <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                Generative Expand
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Expand photos beyond their original borders with AI outpainting to fit Instagram Stories (9:16), YouTube Banners (16:9), or custom wallpapers.
            </p>
          </div>
        </div>

        {/* Upload Zone */}
        {!file && (
          <div className="mx-auto max-w-2xl py-8">
            <Dropzone
              onFiles={handleFileDrop}
              accept="image/*"
              kind="image"
            />
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 text-center text-xs text-muted-foreground">
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">📱</span>
                <p className="font-semibold text-foreground mt-1">Instant Story &amp; Reel Fit</p>
                <p>Convert 1:1 square or 4:3 photos into full-screen 9:16 vertical stories with zero black bars.</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">🌊</span>
                <p className="font-semibold text-foreground mt-1">Seamless Background Fill</p>
                <p>Synthesizes continuous skies, ground, walls, and ambient textures outward naturally.</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">⚡</span>
                <p className="font-semibold text-foreground mt-1">Subject Untouched</p>
                <p>The original photo pixels remain 100% crisp and uncompressed in the center.</p>
              </div>
            </div>
          </div>
        )}

        {/* Studio Workspace */}
        {file && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left: Viewport */}
            <div className="flex flex-col items-center space-y-4 lg:col-span-8">
              {/* View mode switcher */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 w-full rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
                <div className="grid grid-cols-3 sm:flex items-center gap-1.5 w-full sm:w-auto">
                  <Button
                    variant={viewMode === "result" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 text-xs h-8 px-2 sm:px-3 justify-center"
                    onClick={() => setViewMode("result")}
                  >
                    <Expand className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Expanded Canvas</span>
                    <span className="sm:hidden">Canvas</span>
                  </Button>
                  <Button
                    variant={viewMode === "split" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 text-xs h-8 px-2 sm:px-3 justify-center"
                    onClick={() => setViewMode("split")}
                  >
                    <Split className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Split Slider</span>
                    <span className="sm:hidden">Split</span>
                  </Button>
                  <Button
                    variant={viewMode === "side-by-side" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 text-xs h-8 px-2 sm:px-3 justify-center"
                    onClick={() => setViewMode("side-by-side")}
                  >
                    <Columns className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Side-by-Side</span>
                    <span className="sm:hidden">Side</span>
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 w-full sm:w-auto justify-center"
                  onClick={() => {
                    setFile(null);
                    setOriginalImage(null);
                    setOriginalData(null);
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                  Change Photo
                </Button>
              </div>

              {/* Viewport Box */}
              <div
                ref={containerRef}
                onMouseMove={(e) => {
                  if (isDraggingSplit.current) handleSplitDrag(e.clientX);
                }}
                onMouseUp={() => (isDraggingSplit.current = false)}
                onTouchMove={(e) => {
                  if (isDraggingSplit.current && e.touches[0]) {
                    handleSplitDrag(e.touches[0].clientX);
                  }
                }}
                onTouchEnd={() => (isDraggingSplit.current = false)}
                className="relative flex items-center justify-center rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm w-full overflow-hidden select-none min-h-[280px] sm:min-h-[380px] md:min-h-[460px]"
              >
                {/* Result Canvas */}
                {viewMode === "result" && (
                  <div className="relative max-w-xl w-full rounded-xl shadow-lg ring-1 ring-border overflow-hidden">
                    <canvas
                      ref={resultCanvasRef}
                      className="w-full h-auto max-h-[560px] object-contain block"
                    />

                    {/* Subtle boundary guide showing original image bounds */}
                    {uncroppedData && (
                      <div
                        className="pointer-events-none absolute border border-blue-400/40 rounded-sm"
                        style={{
                          left: `${(padding.left / uncroppedData.width) * 100}%`,
                          top: `${(padding.top / uncroppedData.height) * 100}%`,
                          width: `${(originalData?.width! / uncroppedData.width) * 100}%`,
                          height: `${(originalData?.height! / uncroppedData.height) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Split Slider Mode */}
                {viewMode === "split" && (
                  <div className="relative w-full max-w-xl overflow-hidden rounded-xl shadow-lg ring-1 ring-border">
                    {originalImage && (
                      <img
                        src={originalImage.src}
                        alt="Original"
                        className="w-full h-auto max-h-[560px] object-contain block mx-auto"
                      />
                    )}
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 0 0 ${splitPos}%)` }}
                    >
                      <canvas
                        ref={resultCanvasRef}
                        className="w-full h-full object-contain block"
                      />
                    </div>
                    {/* Divider */}
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize shadow-[0_0_8px_rgba(0,0,0,0.5)] z-20 flex items-center justify-center"
                      style={{ left: `${splitPos}%`, touchAction: "none" }}
                      onMouseDown={() => (isDraggingSplit.current = true)}
                      onTouchStart={() => (isDraggingSplit.current = true)}
                    >
                      <div className="h-8 w-8 rounded-full bg-white shadow-md border border-slate-300 flex items-center justify-center text-slate-700 text-xs font-bold">
                        ↔
                      </div>
                    </div>
                  </div>
                )}

                {/* Side-by-Side Mode */}
                {viewMode === "side-by-side" && (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="rounded-xl border border-border/40 overflow-hidden bg-background p-2 text-center shadow-sm">
                      <Badge variant="outline" className="mb-2 text-[10px]">Original</Badge>
                      {originalImage && (
                        <img
                          src={originalImage.src}
                          alt="Original"
                          className="w-full h-auto max-h-[460px] object-contain rounded"
                        />
                      )}
                    </div>
                    <div className="rounded-xl border border-border/40 overflow-hidden bg-background p-2 text-center shadow-sm">
                      <Badge variant="outline" className="mb-2 text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                        Generative Expanded
                      </Badge>
                      <canvas
                        ref={resultCanvasRef}
                        className="w-full h-auto max-h-[460px] object-contain rounded"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Status footer */}
              <div className="flex items-center justify-between w-full text-xs text-muted-foreground px-2">
                <span className="font-mono">
                  Original: {originalData?.width}×{originalData?.height} px ➔ Expanded: {uncroppedData?.width}×{uncroppedData?.height} px
                </span>
                <span>Aspect: {aspect.toUpperCase()}</span>
              </div>
            </div>

            {/* Right: Aspect Presets & Padding Sliders */}
            <div className="space-y-6 lg:col-span-4">
              {/* Presets */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
                <Label className="text-sm font-semibold">Target Aspect Ratio</Label>

                <div className="grid grid-cols-1 gap-2">
                  {ASPECT_PRESETS.map((p) => {
                    const isSelected = aspect === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectAspect(p.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-left text-xs transition-colors ${
                          isSelected
                            ? "border-blue-500/80 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 font-medium"
                            : "border-border/50 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="text-xl shrink-0 mt-0.5">{p.icon}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{p.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Outpainting Style */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
                <Label className="text-sm font-semibold">Outpaint Extension Style</Label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: "blur-bokeh" as const, label: "DSLR Blur Bokeh", desc: "Cinematic focal blur of image edges (Industry Standard for 9:16 Reels & Shorts)" },
                    { id: "seamless-texture" as const, label: "Seamless Texture Mirror", desc: "Content-aware edge mirror with subtle grain matching" },
                    { id: "dominant-gradient" as const, label: "Vignette Color Gradient", desc: "Smooth vignette gradient derived from outer border palette" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setOutpaintMode(m.id)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left text-xs transition-colors ${
                        outpaintMode === m.id
                          ? "border-blue-500/80 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 font-medium"
                          : "border-border/50 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{m.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
                      </div>
                      {outpaintMode === m.id && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Directional Padding Adjustment */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
                <Label className="text-sm font-semibold">Edge Padding Expansion</Label>

                {/* Top */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Top Expansion</span>
                    <span className="font-mono">+{padding.top} px</span>
                  </div>
                  <Slider
                    value={[padding.top]}
                    min={0}
                    max={Math.round((originalData?.height || 1000) * 0.8)}
                    step={10}
                    onValueChange={([val]) => setPadding((p) => ({ ...p, top: val }))}
                  />
                </div>

                {/* Bottom */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Bottom Expansion</span>
                    <span className="font-mono">+{padding.bottom} px</span>
                  </div>
                  <Slider
                    value={[padding.bottom]}
                    min={0}
                    max={Math.round((originalData?.height || 1000) * 0.8)}
                    step={10}
                    onValueChange={([val]) => setPadding((p) => ({ ...p, bottom: val }))}
                  />
                </div>

                {/* Left */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Left Expansion</span>
                    <span className="font-mono">+{padding.left} px</span>
                  </div>
                  <Slider
                    value={[padding.left]}
                    min={0}
                    max={Math.round((originalData?.width || 1000) * 0.8)}
                    step={10}
                    onValueChange={([val]) => setPadding((p) => ({ ...p, left: val }))}
                  />
                </div>

                {/* Right */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Right Expansion</span>
                    <span className="font-mono">+{padding.right} px</span>
                  </div>
                  <Slider
                    value={[padding.right]}
                    min={0}
                    max={Math.round((originalData?.width || 1000) * 0.8)}
                    step={10}
                    onValueChange={([val]) => setPadding((p) => ({ ...p, right: val }))}
                  />
                </div>
              </div>

              {/* Export Suite */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
                <Label className="text-sm font-semibold">Download Expanded Image</Label>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
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
