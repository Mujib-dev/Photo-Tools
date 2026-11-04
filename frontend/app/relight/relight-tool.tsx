"use client";

import * as React from "react";
import {
  ArrowLeft,
  Check,
  Columns,
  Download,
  Eye,
  Layers,
  Lightbulb,
  Maximize2,
  RefreshCw,
  Sliders,
  Sparkles,
  Split,
  Sun,
  Wand2,
  Zap,
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
  DEFAULT_RELIGHT_SETTINGS,
  RELIGHT_PRESETS,
  relightImageData,
  RelightPreset,
  RelightSettings,
} from "@/lib/relight-engine";

export function RelightTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [originalImage, setOriginalImage] = React.useState<HTMLImageElement | null>(null);
  const [originalData, setOriginalData] = React.useState<ImageData | null>(null);

  // Settings
  const [settings, setSettings] = React.useState<RelightSettings>(DEFAULT_RELIGHT_SETTINGS);

  // Comparison mode & Split slider
  const [viewMode, setViewMode] = React.useState<"split" | "side-by-side" | "result">("result");
  const [splitPos, setSplitPos] = React.useState<number>(50);
  const [isComparing, setIsComparing] = React.useState<boolean>(false);

  // Light dragging state
  const isDraggingLight = React.useRef<boolean>(false);
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

  // Re-run 3D relighting whenever settings or image change
  const relightedData = React.useMemo(() => {
    if (!originalData) return null;
    return relightImageData(originalData, settings);
  }, [originalData, settings]);

  // Render to result canvas
  React.useEffect(() => {
    const canvas = resultCanvasRef.current;
    if (!canvas || !relightedData) return;
    canvas.width = relightedData.width;
    canvas.height = relightedData.height;
    const ctx = canvas.getContext("2d");
    ctx?.putImageData(relightedData, 0, 0);
  }, [relightedData]);

  // Select Preset
  const handleSelectPreset = (pKey: Exclude<RelightPreset, "custom">) => {
    const preset = RELIGHT_PRESETS[pKey];
    setSettings({
      preset: pKey,
      ...preset.settings,
    });
    toast.success(`Applied ${preset.label}`);
  };

  // Handle Dragging Virtual 3D Light Puck
  const handleLightPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    isDraggingLight.current = true;
  };

  const handleContainerPointerMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (isDraggingSplit.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const pos = ((clientX - rect.left) / rect.width) * 100;
      setSplitPos(Math.max(0, Math.min(100, pos)));
      return;
    }

    if (!isDraggingLight.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const normX = Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width));
    const normY = Math.max(0.05, Math.min(0.95, (clientY - rect.top) / rect.height));

    setSettings((prev) => ({
      ...prev,
      preset: "custom",
      primaryLight: {
        ...prev.primaryLight,
        x: normX,
        y: normY,
      },
    }));
  };

  const handlePointerUp = () => {
    isDraggingLight.current = false;
    isDraggingSplit.current = false;
  };

  // Export
  const handleExport = (format: "jpeg" | "png" | "webp") => {
    if (!relightedData) return;
    const expCanvas = document.createElement("canvas");
    expCanvas.width = relightedData.width;
    expCanvas.height = relightedData.height;
    const ctx = expCanvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(relightedData, 0, 0);

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
        const base = file?.name.replace(/\.[^/.]+$/, "") || "relighted";
        downloadBlob(blob, `${base}-relighted.${format === "jpeg" ? "jpg" : format}`);
        toast.success(`Relighted photo saved (${(blob.size / 1024).toFixed(1)} KB)`);
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
              <span className="text-2xl">💡</span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                AI Virtual Studio Relighter
              </h1>
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                3D Directional Light
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Cast realistic 3D directional light, cheekbone specular highlights, and studio rim glows by dragging an interactive light source in real time.
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
                <span className="text-lg">🎯</span>
                <p className="font-semibold text-foreground mt-1">Interactive 3D Light Puck</p>
                <p>Drag the light source freely across the photo to sculpt directional shadows and highlights.</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">👔</span>
                <p className="font-semibold text-foreground mt-1">Studio Lighting Presets</p>
                <p>Curated setups for LinkedIn executive headshots, golden hour sunset, and dual-neon rim light.</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">⚡</span>
                <p className="font-semibold text-foreground mt-1">Real-Time 60 FPS Canvas</p>
                <p>Fast Blinn-Phong reflectance normal mapping with zero upload latency.</p>
              </div>
            </div>
          </div>
        )}

        {/* Studio Workspace */}
        {file && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left: Viewport & Light Puck */}
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
                    <Lightbulb className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Interactive Relight</span>
                    <span className="sm:hidden">Relight</span>
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

                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1 select-none flex-1 sm:flex-initial"
                    onMouseDown={() => setIsComparing(true)}
                    onMouseUp={() => setIsComparing(false)}
                    onMouseLeave={() => setIsComparing(false)}
                    onTouchStart={() => setIsComparing(true)}
                    onTouchEnd={() => setIsComparing(false)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Hold to Compare</span>
                    <span className="sm:hidden">Compare</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 flex-1 sm:flex-initial"
                    onClick={() => {
                      setFile(null);
                      setOriginalImage(null);
                      setOriginalData(null);
                    }}
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span className="hidden sm:inline">Change Photo</span>
                    <span className="sm:hidden">Change</span>
                  </Button>
                </div>
              </div>

              {/* Viewport Box */}
              <div
                ref={containerRef}
                onMouseMove={handleContainerPointerMove}
                onMouseUp={handlePointerUp}
                onTouchMove={handleContainerPointerMove}
                onTouchEnd={handlePointerUp}
                className="relative flex items-center justify-center rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm w-full overflow-hidden select-none min-h-[280px] sm:min-h-[380px] md:min-h-[460px]"
              >
                {/* Result Canvas & Light Target */}
                {viewMode === "result" && (
                  <div className="relative max-w-xl w-full rounded-xl shadow-lg ring-1 ring-border overflow-hidden">
                    {/* Rendered image or original if comparing */}
                    {isComparing && originalImage ? (
                      <img
                        src={originalImage.src}
                        alt="Original"
                        className="w-full h-auto max-h-[560px] object-contain block"
                      />
                    ) : (
                      <canvas
                        ref={resultCanvasRef}
                        className="w-full h-auto max-h-[560px] object-contain block"
                      />
                    )}

                    {/* Interactive 3D Draggable Light Puck */}
                    {!isComparing && (
                      <div
                        className="absolute cursor-grab active:cursor-grabbing transform -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center group select-none"
                        style={{
                          left: `${settings.primaryLight.x * 100}%`,
                          top: `${settings.primaryLight.y * 100}%`,
                          touchAction: "none",
                        }}
                        onMouseDown={handleLightPointerDown}
                        onTouchStart={handleLightPointerDown}
                      >
                        {/* Glow halo */}
                        <div
                          className="w-12 h-12 rounded-full blur-md opacity-70 group-hover:opacity-100 transition-opacity absolute"
                          style={{ backgroundColor: settings.primaryLight.color }}
                        />
                        {/* Core light puck */}
                        <div
                          className="w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-xs font-bold text-slate-800 transition-transform group-hover:scale-110 z-10"
                          style={{ backgroundColor: settings.primaryLight.color }}
                        >
                          💡
                        </div>
                        <span className="mt-1 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm text-[9px] text-white font-mono uppercase tracking-wider pointer-events-none">
                          Light 1
                        </span>
                      </div>
                    )}

                    {/* Secondary Rim Light Indicator */}
                    {!isComparing && settings.enableRimLight && (
                      <div
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center pointer-events-none opacity-80"
                        style={{
                          left: `${(1.0 - settings.primaryLight.x) * 100}%`,
                          top: `${settings.primaryLight.y * 90}%`,
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-full border border-white/80 shadow-md flex items-center justify-center text-[10px]"
                          style={{ backgroundColor: settings.rimLightColor }}
                        >
                          ✨
                        </div>
                        <span className="mt-0.5 px-1 py-0.2 rounded bg-black/60 text-[8px] text-white font-mono">
                          Rim
                        </span>
                      </div>
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
                        className="w-full h-auto max-h-[560px] object-contain block"
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
                      <Badge variant="outline" className="mb-2 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                        3D Relighted
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
                  {originalImage?.naturalWidth} × {originalImage?.naturalHeight} px
                </span>
                <span>Drag the 💡 light puck directly on the canvas to move the light source</span>
              </div>
            </div>

            {/* Right: Presets & Controls */}
            <div className="space-y-6 lg:col-span-4">
              {/* Presets */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
                <Label className="text-sm font-semibold flex items-center justify-between">
                  <span>Studio Lighting Presets</span>
                </Label>

                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(RELIGHT_PRESETS) as (keyof typeof RELIGHT_PRESETS)[]).map((pKey) => {
                    const p = RELIGHT_PRESETS[pKey];
                    const isSelected = settings.preset === pKey;
                    return (
                      <button
                        key={pKey}
                        onClick={() => handleSelectPreset(pKey)}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-left text-xs transition-colors ${
                          isSelected
                            ? "border-amber-500/80 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 font-medium"
                            : "border-border/50 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="text-xl shrink-0 mt-0.5">{p.icon}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{p.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Light Controls */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
                <Label className="text-sm font-semibold">Light Tuning &amp; Colors</Label>

                {/* Intensity */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Key Light Intensity</span>
                    <span className="font-mono">{Math.round(settings.primaryLight.intensity * 100)}%</span>
                  </div>
                  <Slider
                    value={[settings.primaryLight.intensity]}
                    min={0.2}
                    max={2.0}
                    step={0.05}
                    onValueChange={([val]) =>
                      setSettings((s) => ({
                        ...s,
                        preset: "custom",
                        primaryLight: { ...s.primaryLight, intensity: val },
                      }))
                    }
                  />
                </div>

                {/* Elevation / Distance */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Light Distance / Softness</span>
                    <span className="font-mono">{settings.primaryLight.distance.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[settings.primaryLight.distance]}
                    min={0.3}
                    max={1.8}
                    step={0.05}
                    onValueChange={([val]) =>
                      setSettings((s) => ({
                        ...s,
                        preset: "custom",
                        primaryLight: { ...s.primaryLight, distance: val },
                      }))
                    }
                  />
                </div>

                {/* Color Swatches */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Light Color:</span>
                  <div className="flex items-center gap-2 pt-1">
                    {[
                      { label: "Studio 5600K", color: "#ffffff" },
                      { label: "Warm 3200K", color: "#fef08a" },
                      { label: "Golden Hour", color: "#f59e0b" },
                      { label: "Neon Magenta", color: "#ec4899" },
                      { label: "Cyan", color: "#06b6d4" },
                      { label: "Soft Violet", color: "#a855f7" },
                    ].map((swatch) => (
                      <button
                        key={swatch.color}
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            preset: "custom",
                            primaryLight: { ...s.primaryLight, color: swatch.color },
                          }))
                        }
                        title={swatch.label}
                        className={`h-6 w-6 rounded-full border border-slate-300 shadow-sm transition-transform ${
                          settings.primaryLight.color === swatch.color ? "scale-125 ring-2 ring-amber-500 ring-offset-2" : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: swatch.color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Secondary Rim Light */}
                <div className="pt-3 border-t border-border/40 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-semibold flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      Secondary Rim Light
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.enableRimLight}
                      onChange={(e) => setSettings((s) => ({ ...s, enableRimLight: e.target.checked }))}
                      className="rounded border-border text-amber-600 focus:ring-amber-500"
                    />
                  </div>

                  {settings.enableRimLight && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Rim Intensity</span>
                        <span className="font-mono">{Math.round(settings.rimLightIntensity * 100)}%</span>
                      </div>
                      <Slider
                        value={[settings.rimLightIntensity]}
                        min={0.1}
                        max={1.8}
                        step={0.05}
                        onValueChange={([val]) => setSettings((s) => ({ ...s, rimLightIntensity: val }))}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Export Suite */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
                <Label className="text-sm font-semibold">Download Relighted Image</Label>

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
