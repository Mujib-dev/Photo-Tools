"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building,
  Check,
  Crown,
  Download,
  Eye,
  Home,
  Layers,
  Maximize2,
  RefreshCw,
  Sliders,
  Sparkles,
  Split,
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
import {
  createSampleHouseCanvas,
  detectSkyMask,
  REAL_ESTATE_SKIES,
  RealEstateSkyPreset,
  stageRealEstatePhoto,
} from "@/lib/real-estate-engine";

export function RealEstateTool() {
  const [sourceImage, setSourceImage] = React.useState<HTMLCanvasElement | null>(null);
  const [skyMask, setSkyMask] = React.useState<HTMLCanvasElement | null>(null);
  const [stagedImage, setStagedImage] = React.useState<HTMLCanvasElement | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Settings
  const [skyPreset, setSkyPreset] = React.useState<RealEstateSkyPreset>("twilight-dusk");
  const [lawnGreening, setLawnGreening] = React.useState(50);
  const [windowWarmGlow, setWindowWarmGlow] = React.useState(45);
  const [hdrClarity, setHdrClarity] = React.useState(35);
  const [skyThreshold, setSkyThreshold] = React.useState(55);

  // View state
  const [splitPos, setSplitPos] = React.useState(50);
  const [isPeekingOriginal, setIsPeekingOriginal] = React.useState(false);
  const [showSkyMask, setShowSkyMask] = React.useState(false);

  const displayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Handle uploaded file
  const handleFileDrop = React.useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context");
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      setSourceImage(canvas);

      // Auto-detect sky mask
      const mask = detectSkyMask(canvas, 55);
      setSkyMask(mask);

      // Stage photo
      const staged = stageRealEstatePhoto(canvas, mask, {
        skyPreset: "twilight-dusk",
        skyExposure: 75,
        lawnGreening: 50,
        windowWarmGlow: 45,
        hdrClarity: 35,
        skyThreshold: 55,
      });
      setStagedImage(staged);
      toast.success("Listing photo staged! Replaced sky and revitalized lawn.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load real estate photo");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle demo photo
  const handleLoadDemo = React.useCallback(() => {
    setIsProcessing(true);
    try {
      const demo = createSampleHouseCanvas();
      setSourceImage(demo);

      const mask = detectSkyMask(demo, skyThreshold);
      setSkyMask(mask);

      const staged = stageRealEstatePhoto(demo, mask, {
        skyPreset,
        skyExposure: 75,
        lawnGreening,
        windowWarmGlow,
        hdrClarity,
        skyThreshold,
      });
      setStagedImage(staged);
      toast.success("Loaded overcast suburban property sample!");
    } catch (err) {
      console.error(err);
      toast.error("Could not load sample property");
    } finally {
      setIsProcessing(false);
    }
  }, [skyPreset, lawnGreening, windowWarmGlow, hdrClarity, skyThreshold]);

  // Re-run staging when sliders or presets change
  React.useEffect(() => {
    if (!sourceImage) return;

    try {
      const mask = detectSkyMask(sourceImage, skyThreshold);
      setSkyMask(mask);

      const staged = stageRealEstatePhoto(sourceImage, mask, {
        skyPreset,
        skyExposure: 75,
        lawnGreening,
        windowWarmGlow,
        hdrClarity,
        skyThreshold,
      });
      setStagedImage(staged);
    } catch (err) {
      console.error(err);
    }
  }, [sourceImage, skyPreset, lawnGreening, windowWarmGlow, hdrClarity, skyThreshold]);

  // Draw on display canvas (split comparison or peek)
  React.useEffect(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !sourceImage || !stagedImage) return;

    const w = sourceImage.width;
    const h = sourceImage.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    if (isPeekingOriginal) {
      ctx.drawImage(sourceImage, 0, 0);
    } else {
      ctx.drawImage(stagedImage, 0, 0);

      // Split view: original on left
      if (splitPos < 100 && splitPos > 0) {
        const splitX = Math.round((splitPos / 100) * w);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, splitX, h);
        ctx.clip();
        ctx.drawImage(sourceImage, 0, 0);
        ctx.restore();

        // White split divider line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(splitX, 0);
        ctx.lineTo(splitX, h);
        ctx.stroke();
      }
    }

    // Sky mask overlay
    if (showSkyMask && skyMask) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(skyMask, 0, 0);
      ctx.restore();
    }
  }, [sourceImage, stagedImage, skyMask, isPeekingOriginal, splitPos, showSkyMask]);

  const handleDownload = () => {
    if (!stagedImage) return;
    stagedImage.toBlob(
      (blob) => {
        if (!blob) return;
        downloadBlob(blob, `real-estate-staged-${skyPreset}-${Date.now()}.jpg`);
        toast.success("Downloaded MLS listing photo (High-Res JPG)");
      },
      "image/jpeg",
      0.95
    );
  };

  return (
    <AuthGate>
      <div className="container max-w-6xl mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Home className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">AI Real Estate & Exterior Stager</h1>
              <Badge variant="secondary" className="gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
                <Crown className="w-3 h-3" /> MLS & Airbnb Pro
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Turn gloomy overcast property photos into sunny, golden-hour, or high-ticket luxury twilight blue hour listings. Revitalize dry grass into lush manicured lawns.
            </p>
          </div>

          {sourceImage && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSourceImage(null);
                  setSkyMask(null);
                  setStagedImage(null);
                }}
                className="text-xs sm:text-sm"
              >
                Upload Another Listing
              </Button>
              <Button size="sm" onClick={handleDownload} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm">
                <Download className="w-4 h-4" /> Download Staged Photo
              </Button>
            </div>
          )}
        </div>

        {!sourceImage ? (
          /* Empty state & Upload */
          <div className="space-y-6">
            <Dropzone
              onFiles={handleFileDrop}
              accept="image/*"
            />

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
              <span className="text-xs text-muted-foreground">Don&apos;t have a property photo on hand?</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadDemo}
                className="gap-2 border-amber-500/30 hover:bg-amber-500/10"
              >
                <Building className="w-4 h-4 text-amber-500" /> Try Overcast Property Sample
              </Button>
            </div>

            {/* Commercial Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
              <div className="p-4 rounded-xl border bg-card/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Sun className="w-4 h-4 text-amber-500" /> AI Sky Replacement
                </div>
                <p className="text-xs text-muted-foreground">
                  Replace dreary gray clouds with bright sunny blue skies, warm sunsets, or high-converting evening blue hour.
                </p>
              </div>

              <div className="p-4 rounded-xl border bg-card/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Sparkles className="w-4 h-4 text-emerald-500" /> Lawn & Foliage Greening
                </div>
                <p className="text-xs text-muted-foreground">
                  Transforms dry, patchy, winter lawns into vibrant green manicured curb appeal that attracts more buyers.
                </p>
              </div>

              <div className="p-4 rounded-xl border bg-card/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Check className="w-4 h-4 text-amber-500" /> Twilight Window Warm Glow
                </div>
                <p className="text-xs text-muted-foreground">
                  Injects warm 3000K interior lighting into windows to create inviting luxury dusk architectural shots.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Active Editor */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Canvas Viewer (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border bg-neutral-950/20 flex items-center justify-center p-2 min-h-[280px] sm:min-h-[380px] md:min-h-[460px] shadow-sm select-none">
                <canvas
                  ref={displayCanvasRef}
                  className="max-w-full max-h-[580px] object-contain rounded-xl shadow-md transition-all"
                />

                {isProcessing && (
                  <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                    <span className="text-sm font-medium">Staging exterior listing...</span>
                  </div>
                )}

                {/* Overlays / Badges */}
                <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
                  {isPeekingOriginal ? (
                    <Badge variant="destructive" className="bg-amber-600/90 text-white text-xs">
                      Original Gloomy Property
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-background/80 backdrop-blur-md text-xs">
                      {REAL_ESTATE_SKIES.find((s) => s.id === skyPreset)?.label}
                    </Badge>
                  )}
                </div>
              </div>

              {/* View & Split Controls Toolbar */}
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
                    variant={showSkyMask ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setShowSkyMask(!showSkyMask)}
                    className="gap-2 flex-1 sm:flex-initial text-xs sm:text-sm"
                  >
                    <Layers className="w-4 h-4 text-amber-500" />
                    {showSkyMask ? "Hide Sky Mask" : "Inspect Sky"}
                  </Button>
                </div>

                {/* Split Slider */}
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto sm:min-w-[200px]">
                  <span className="text-xs text-muted-foreground font-medium">Original</span>
                  <Slider
                    value={[splitPos]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(val) => setSplitPos(val[0])}
                    className="flex-1 sm:flex-initial sm:w-32"
                  />
                  <span className="text-xs text-muted-foreground font-medium">Staged</span>
                </div>
              </div>

              {/* Commercial Upgrade Callout */}
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-sm text-amber-600 dark:text-amber-400">
                    <Crown className="w-4 h-4" /> Real Estate Agency / Broker Tier
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Stage unlimited properties, remove agent signs, and export uncompressed 4K MLS photo packages.
                  </p>
                </div>
                <Link href="/pricing">
                  <Button size="sm" variant="outline" className="text-xs gap-1.5 border-amber-500/30 whitespace-nowrap">
                    View Broker Plans <ArrowUpRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Sidebar Staging Controls (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Sky Presets Grid */}
              <div className="p-5 rounded-xl border bg-card space-y-4">
                <div className="flex items-center gap-2 border-b pb-3">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-sm">Sky Replacement Presets</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {REAL_ESTATE_SKIES.map((s) => {
                    const isSelected = skyPreset === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSkyPreset(s.id)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? "border-amber-500 bg-amber-500/10 shadow-sm"
                            : "border-border/60 hover:border-border hover:bg-muted/40"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="font-medium text-xs flex items-center justify-between">
                            {s.label}
                            {isSelected && <Check className="w-3.5 h-3.5 text-amber-600" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-2">{s.desc}</p>
                        </div>
                        <div className="mt-2 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                          {s.badge}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Property Staging Sliders */}
              <div className="p-5 rounded-xl border bg-card space-y-4">
                <div className="flex items-center gap-2 border-b pb-3">
                  <Sliders className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-sm">Curb Appeal & Atmosphere</span>
                </div>

                {/* Lawn Greening */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <Label>Lawn & Foliage Greening</Label>
                    <span className="text-muted-foreground">{lawnGreening}%</span>
                  </div>
                  <Slider
                    value={[lawnGreening]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(val) => setLawnGreening(val[0])}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Revitalizes yellow or dried grass into lush green lawn without oversaturating the house.
                  </p>
                </div>

                {/* Twilight Window Glow */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <Label>Twilight Window Warm Glow</Label>
                    <span className="text-muted-foreground">{windowWarmGlow}%</span>
                  </div>
                  <Slider
                    value={[windowWarmGlow]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(val) => setWindowWarmGlow(val[0])}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Adds warm inviting 3000K interior illumination into window panes during twilight/dusk.
                  </p>
                </div>

                {/* HDR Clarity */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <Label>Architectural HDR Clarity</Label>
                    <span className="text-muted-foreground">{hdrClarity}%</span>
                  </div>
                  <Slider
                    value={[hdrClarity]}
                    min={0}
                    max={80}
                    step={5}
                    onValueChange={(val) => setHdrClarity(val[0])}
                  />
                </div>

                {/* Sky Sensitivity Threshold */}
                <div className="space-y-2 pt-1 border-t">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <Label>Sky Cut Boundary Sensitivity</Label>
                    <span className="text-muted-foreground">{skyThreshold}%</span>
                  </div>
                  <Slider
                    value={[skyThreshold]}
                    min={20}
                    max={85}
                    step={5}
                    onValueChange={(val) => setSkyThreshold(val[0])}
                  />
                </div>
              </div>

              {/* Export Panel */}
              <div className="p-5 rounded-xl border bg-card space-y-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  MLS Ready Export
                </span>

                <Button onClick={handleDownload} className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                  <Download className="w-4 h-4" /> Download Staged Photo (MLS JPG)
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
