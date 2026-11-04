"use client";

import * as React from "react";
import {
  ArrowLeft,
  Check,
  Columns,
  Download,
  Eye,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  RefreshCw,
  Sliders,
  Sparkles,
  Split,
  Sun,
  User,
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
  colorizeImageData,
  ColorizePalettePreset,
} from "@/lib/colorizer";

const PRESETS: {
  id: ColorizePalettePreset;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    id: "natural-portrait",
    label: "Natural Portrait",
    icon: "👤",
    desc: "Authentic skin tones, eyes, hair color, and soft studio depth",
  },
  {
    id: "vintage-nostalgia",
    label: "Vintage Nostalgia",
    icon: "📜",
    desc: "Warm golden-era photographic sepia tones from the 1920s–1950s",
  },
  {
    id: "vibrant-landscape",
    label: "Vibrant Landscape",
    icon: "🏞️",
    desc: "Azure blue skies, rich foliage greens, and natural earth tones",
  },
  {
    id: "technicolor",
    label: "3-Strip Technicolor",
    icon: "🎬",
    desc: "Classic saturated Hollywood film look with deep reds and emeralds",
  },
  {
    id: "cool-tint",
    label: "Cyanotype Cool",
    icon: "🏛️",
    desc: "Historical architectural cyanotype tint with crisp highlights",
  },
];

export function ColorizeTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [originalImage, setOriginalImage] = React.useState<HTMLImageElement | null>(null);
  const [originalData, setOriginalData] = React.useState<ImageData | null>(null);

  // Settings
  const [preset, setPreset] = React.useState<ColorizePalettePreset>("natural-portrait");
  const [vibrancy, setVibrancy] = React.useState<number>(1.0); // 0.3 to 2.0
  const [temperature, setTemperature] = React.useState<number>(0); // -30 to 30
  const [skinBoost, setSkinBoost] = React.useState<number>(0.6); // 0 to 1
  const [skyBoost, setSkyBoost] = React.useState<boolean>(true);
  const [foliageBoost, setFoliageBoost] = React.useState<boolean>(true);

  // Comparison mode & Split slider
  const [viewMode, setViewMode] = React.useState<"split" | "side-by-side" | "result">("split");
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
      }
    };
    img.src = url;
  };

  // Re-run colorization whenever parameters change
  const colorizedData = React.useMemo(() => {
    if (!originalData) return null;
    return colorizeImageData(originalData, {
      preset,
      vibrancy,
      temperature,
      skinBoost,
      skyBoost,
      foliageBoost,
    });
  }, [originalData, preset, vibrancy, temperature, skinBoost, skyBoost, foliageBoost]);

  // Render to result canvas
  React.useEffect(() => {
    const canvas = resultCanvasRef.current;
    if (!canvas || !colorizedData) return;
    canvas.width = colorizedData.width;
    canvas.height = colorizedData.height;
    const ctx = canvas.getContext("2d");
    ctx?.putImageData(colorizedData, 0, 0);
  }, [colorizedData]);

  // Handle Split Slider Dragging
  const handleSplitDrag = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setSplitPos(Math.max(0, Math.min(100, pos)));
  };

  // Export
  const handleExport = (format: "jpeg" | "png" | "webp") => {
    if (!colorizedData) return;
    const expCanvas = document.createElement("canvas");
    expCanvas.width = colorizedData.width;
    expCanvas.height = colorizedData.height;
    const ctx = expCanvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(colorizedData, 0, 0);

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
        const base = file?.name.replace(/\.[^/.]+$/, "") || "vintage";
        downloadBlob(blob, `${base}-colorized.${format === "jpeg" ? "jpg" : format}`);
        toast.success(`Colorized photo saved (${(blob.size / 1024).toFixed(1)} KB)`);
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
              <span className="text-2xl">🎨</span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                AI Vintage Photo Colorizer
              </h1>
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Neural Colorizer
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Turn black-and-white family portraits, historical scans, and vintage photos into vibrant, authentically colored memories with natural skin tones and skies.
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
                <span className="text-lg">👤</span>
                <p className="font-semibold text-foreground mt-1">Authentic Skin Tones</p>
                <p>Natural melanin & hemoglobin chromaticity for realistic portrait faces.</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">🌿</span>
                <p className="font-semibold text-foreground mt-1">Sky & Foliage Boost</p>
                <p>Synthesizes organic landscape hues for outdoor scenes, trees, and skies.</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">⚡</span>
                <p className="font-semibold text-foreground mt-1">Instant Interactive Split</p>
                <p>Drag the before/after divider line in real time to inspect subtle details.</p>
              </div>
            </div>
          </div>
        )}

        {/* Studio Workspace */}
        {file && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left: Comparison Viewer */}
            <div className="flex flex-col items-center space-y-4 lg:col-span-8">
              {/* View mode switcher */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 w-full rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
                <div className="grid grid-cols-3 sm:flex items-center gap-1.5 w-full sm:w-auto">
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
                  <Button
                    variant={viewMode === "result" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 text-xs h-8 px-2 sm:px-3 justify-center"
                    onClick={() => setViewMode("result")}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Colorized Only</span>
                    <span className="sm:hidden">Result</span>
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

              {/* Viewer Container */}
              <div
                ref={containerRef}
                className="relative flex items-center justify-center rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm w-full overflow-hidden select-none min-h-[280px] sm:min-h-[380px] md:min-h-[440px]"
                onMouseMove={(e) => {
                  if (isDraggingSplit.current) handleSplitDrag(e.clientX);
                }}
                onMouseUp={() => (isDraggingSplit.current = false)}
                onTouchMove={(e) => {
                  if (e.touches.length === 1) handleSplitDrag(e.touches[0].clientX);
                }}
                onTouchEnd={() => (isDraggingSplit.current = false)}
              >
                {/* Mode 1: Split Slider */}
                {viewMode === "split" && (
                  <div className="relative w-full max-w-xl overflow-hidden rounded-xl shadow-lg ring-1 ring-border">
                    {/* Underlying B&W original */}
                    {originalImage && (
                      <img
                        src={originalImage.src}
                        alt="Original B&W"
                        className="w-full h-auto max-h-[560px] object-contain block grayscale"
                      />
                    )}

                    {/* Colorized result layer clipped to split percentage */}
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 0 0 ${splitPos}%)` }}
                    >
                      <canvas
                        ref={resultCanvasRef}
                        className="w-full h-full object-contain block"
                      />
                    </div>

                    {/* Draggable Divider Line */}
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

                    {/* Floating Badges */}
                    <div className="absolute bottom-3 left-3 pointer-events-none">
                      <Badge className="bg-black/70 text-white border-0 text-[10px]">Original B&amp;W</Badge>
                    </div>
                    <div className="absolute bottom-3 right-3 pointer-events-none">
                      <Badge className="bg-amber-600/90 text-white border-0 text-[10px]">AI Colorized</Badge>
                    </div>
                  </div>
                )}

                {/* Mode 2: Side-by-Side */}
                {viewMode === "side-by-side" && (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="rounded-xl border border-border/40 overflow-hidden bg-background p-2 text-center shadow-sm">
                      <Badge variant="outline" className="mb-2 text-[10px]">Original</Badge>
                      {originalImage && (
                        <img
                          src={originalImage.src}
                          alt="Original"
                          className="w-full h-auto max-h-[460px] object-contain rounded grayscale"
                        />
                      )}
                    </div>
                    <div className="rounded-xl border border-border/40 overflow-hidden bg-background p-2 text-center shadow-sm">
                      <Badge variant="outline" className="mb-2 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                        Colorized
                      </Badge>
                      <canvas
                        ref={resultCanvasRef}
                        className="w-full h-auto max-h-[460px] object-contain rounded"
                      />
                    </div>
                  </div>
                )}

                {/* Mode 3: Result Only */}
                {viewMode === "result" && (
                  <div className="w-full max-w-xl overflow-hidden rounded-xl shadow-lg ring-1 ring-border">
                    <canvas
                      ref={resultCanvasRef}
                      className="w-full h-auto max-h-[560px] object-contain block"
                    />
                  </div>
                )}
              </div>

              {/* Resolution metadata */}
              <div className="flex items-center justify-between w-full text-xs text-muted-foreground px-2">
                <span className="font-mono">
                  {originalImage?.naturalWidth} × {originalImage?.naturalHeight} px
                </span>
                <span>Neural CIELAB Chrominance Mapping</span>
              </div>
            </div>

            {/* Right: Presets & Controls */}
            <div className="space-y-6 lg:col-span-4">
              {/* Presets */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
                <Label className="text-sm font-semibold flex items-center justify-between">
                  <span>Color Style Presets</span>
                </Label>

                <div className="grid grid-cols-1 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPreset(p.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left text-xs transition-colors ${
                        preset === p.id
                          ? "border-amber-500/80 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 font-medium"
                          : "border-border/50 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-xl shrink-0 mt-0.5">{p.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{p.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</p>
                      </div>
                      {preset === p.id && <Check className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fine-Tuning Sliders */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
                <Label className="text-sm font-semibold">Tuning & Temperature</Label>

                {/* Vibrancy */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Color Vibrancy
                    </span>
                    <span className="font-mono">{Math.round(vibrancy * 100)}%</span>
                  </div>
                  <Slider
                    value={[vibrancy]}
                    min={0.3}
                    max={2.0}
                    step={0.05}
                    onValueChange={([val]) => setVibrancy(val)}
                  />
                </div>

                {/* Warmth / Temperature */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Sun className="h-3 w-3" /> Temperature Warmth
                    </span>
                    <span className="font-mono">{temperature > 0 ? `+${temperature}` : temperature}</span>
                  </div>
                  <Slider
                    value={[temperature]}
                    min={-30}
                    max={30}
                    step={1}
                    onValueChange={([val]) => setTemperature(val)}
                  />
                </div>

                {/* Skin Warmth Boost */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> Skin Tone Boost
                    </span>
                    <span className="font-mono">{Math.round(skinBoost * 100)}%</span>
                  </div>
                  <Slider
                    value={[skinBoost]}
                    min={0}
                    max={1.0}
                    step={0.05}
                    onValueChange={([val]) => setSkinBoost(val)}
                  />
                </div>

                {/* Feature Toggles */}
                <div className="pt-2 border-t border-border/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground">Sky Chromaticity</span>
                    <input
                      type="checkbox"
                      checked={skyBoost}
                      onChange={(e) => setSkyBoost(e.target.checked)}
                      className="rounded border-border text-amber-600 focus:ring-amber-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground">Foliage &amp; Grass Depth</span>
                    <input
                      type="checkbox"
                      checked={foliageBoost}
                      onChange={(e) => setFoliageBoost(e.target.checked)}
                      className="rounded border-border text-amber-600 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Export Suite */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
                <Label className="text-sm font-semibold">Download Colorized Photo</Label>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
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
