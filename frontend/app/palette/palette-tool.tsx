"use client";

import * as React from "react";
import {
  Check,
  Copy,
  Download,
  Eye,
  FileCode,
  Image as ImageIcon,
  Layers,
  Palette,
  Pipette,
  RefreshCw,
  Sliders,
  Sparkles,
  SunMoon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { downloadBlob } from "@/lib/screenshot";
import {
  type ColorInfo,
  type PaletteResult,
  extractPaletteFromImage,
  generateHarmonies,
  generateGradientCss,
  exportAsCssVariables,
  exportAsTailwind,
  exportAsJson,
  generateSwatchCardBlob,
  makeColorInfo,
} from "@/lib/color-palette";

export function PaletteTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [imgUrl, setImgUrl] = React.useState<string | null>(null);
  const [paletteResult, setPaletteResult] = React.useState<PaletteResult | null>(null);
  const [swatchCount, setSwatchCount] = React.useState<number>(8);
  const [selectedColor, setSelectedColor] = React.useState<ColorInfo | null>(null);
  const [activeTab, setActiveTab] = React.useState<"palette" | "moods" | "harmonies" | "gradient" | "export">("palette");

  // Eyedropper / Loupe state
  const [isEyedropperActive, setIsEyedropperActive] = React.useState(false);
  const [hoverColor, setHoverColor] = React.useState<ColorInfo | null>(null);
  const [cursorPos, setCursorPos] = React.useState<{ x: number; y: number } | null>(null);

  // Gradient studio state
  const [gradientAngle, setGradientAngle] = React.useState<number>(135);
  const [gradientType, setGradientType] = React.useState<"linear" | "radial">("linear");
  const [gradientStops, setGradientStops] = React.useState<{ color: string; position: number }[]>([]);

  // Copied indicator
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const handleCopy = (text: string, label: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${label}: ${text}`);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const processImage = React.useCallback((img: HTMLImageElement, count: number) => {
    try {
      const result = extractPaletteFromImage(img, count);
      setPaletteResult(result);
      if (result.colors.length > 0) {
        setSelectedColor(result.colors[0]);
        // Initialize gradient stops from top 2 colors
        if (result.colors.length >= 2) {
          setGradientStops([
            { color: result.colors[0].hex, position: 0 },
            { color: result.colors[1].hex, position: 100 },
          ]);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to extract palette";
      toast.error(msg);
    }
  }, []);

  const handleFileDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const f = acceptedFiles[0];
    setFile(f);
    const url = URL.createObjectURL(f);
    setImgUrl(url);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      processImage(img, swatchCount);
    };
    img.src = url;
  };

  const handleCountChange = (val: number[]) => {
    const newCount = val[0];
    setSwatchCount(newCount);
    if (imgRef.current) {
      processImage(imgRef.current, newCount);
    }
  };

  // Eyedropper canvas sampling (supports both mouse & touch screens)
  const sampleAtClientCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current || !imgRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    setCursorPos({ x, y });

    if (!canvasRef.current) {
      const c = document.createElement("canvas");
      canvasRef.current = c;
      c.width = imgRef.current.naturalWidth;
      c.height = imgRef.current.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (ctx) ctx.drawImage(imgRef.current, 0, 0);
    }

    const c = canvasRef.current;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Map container coords to natural image coords
    const naturalX = Math.floor((x / rect.width) * c.width);
    const naturalY = Math.floor((y / rect.height) * c.height);

    if (naturalX >= 0 && naturalX < c.width && naturalY >= 0 && naturalY < c.height) {
      const pixel = ctx.getImageData(naturalX, naturalY, 1, 1).data;
      if (pixel[3] > 10) {
        setHoverColor(makeColorInfo(pixel[0], pixel[1], pixel[2]));
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    sampleAtClientCoords(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      sampleAtClientCoords(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleImageClick = () => {
    if (hoverColor) {
      setSelectedColor(hoverColor);
      toast.success(`Selected color ${hoverColor.hex} (${hoverColor.name})`);
    }
  };

  // Harmonies of selected color
  const harmonies = React.useMemo(() => {
    return selectedColor ? generateHarmonies(selectedColor) : null;
  }, [selectedColor]);

  // Gradient CSS string
  const gradientCss = React.useMemo(() => {
    if (gradientStops.length === 0) return "";
    return generateGradientCss(gradientType, gradientAngle, gradientStops);
  }, [gradientType, gradientAngle, gradientStops]);

  // Export card download
  const handleDownloadCard = async () => {
    if (!imgRef.current || !paletteResult) return;
    try {
      toast.info("Generating high-resolution swatch card...");
      const blob = await generateSwatchCardBlob(imgRef.current, paletteResult.colors);
      downloadBlob(blob, `palette-swatches-${Date.now()}.png`);
      toast.success("Swatch card downloaded successfully!");
    } catch {
      toast.error("Failed to generate swatch card");
    }
  };

  return (
    <AuthGate>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Palette className="w-6 h-6" />
              </span>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Color Palette & Gradient Studio
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Extract dominant harmonies, calculate WCAG accessibility contrast, and synthesize CSS gradients directly from your images.
            </p>
          </div>

          {paletteResult && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCard}
                className="gap-1.5 shadow-sm"
              >
                <Download className="w-4 h-4 text-violet-600" />
                Download Swatch Card (PNG)
              </Button>
            </div>
          )}
        </div>

        {/* Upload State */}
        {!imgUrl ? (
          <div className="max-w-2xl mx-auto my-12">
            <Dropzone
              kind="image"
              onFiles={handleFileDrop}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Image with Eyedropper & Swatch Count */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="bg-card border rounded-2xl p-4 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <span>{file?.name || "Uploaded Image"}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setImgUrl(null);
                      setPaletteResult(null);
                      setSelectedColor(null);
                      canvasRef.current = null;
                    }}
                  >
                    Change Image
                  </Button>
                </div>

                {/* Image Container with Loupe / Eyedropper */}
                <div
                  ref={containerRef}
                  className="relative rounded-xl overflow-hidden cursor-crosshair border bg-slate-950/20 flex items-center justify-center select-none touch-none"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => {
                    setCursorPos(null);
                    setHoverColor(null);
                  }}
                  onTouchStart={handleTouchMove}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleImageClick}
                  onClick={handleImageClick}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt="Source"
                    className="w-full max-h-[460px] object-contain"
                  />

                  {/* Magnifying Loupe Overlay */}
                  {cursorPos && hoverColor && (
                    <div
                      className="pointer-events-none absolute w-14 h-14 rounded-full border-2 border-white shadow-2xl flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: cursorPos.x,
                        top: cursorPos.y,
                        backgroundColor: hoverColor.hex,
                      }}
                    >
                      <div className="w-2 h-2 rounded-full border border-black/40 bg-white/70" />
                    </div>
                  )}
                </div>

                {/* Eyedropper live readout */}
                <div className="mt-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Pipette className="w-3.5 h-3.5" />
                    <span>Hover image to sample • Click to select</span>
                  </div>
                  {hoverColor && (
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border border-black/20"
                        style={{ backgroundColor: hoverColor.hex }}
                      />
                      <span className="font-mono text-xs font-semibold">{hoverColor.hex}</span>
                    </div>
                  )}
                </div>

                {/* Palette Size Slider */}
                <div className="mt-5 pt-4 border-t">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
                      Swatches Extracted
                    </span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {swatchCount} Colors
                    </Badge>
                  </div>
                  <Slider
                    min={4}
                    max={16}
                    step={1}
                    value={[swatchCount]}
                    onValueChange={handleCountChange}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Selected Color Inspector Card */}
              {selectedColor && (
                <div className="bg-card border rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Eye className="w-4 h-4 text-violet-500" />
                      Color Inspector
                    </h3>
                    <Badge variant="outline" className="font-medium text-xs">
                      {selectedColor.name}
                    </Badge>
                  </div>

                  {/* Large Swatch Display */}
                  <div
                    className="h-20 rounded-xl w-full mb-4 flex items-center justify-between px-4 shadow-inner border border-black/10 transition-colors"
                    style={{ backgroundColor: selectedColor.hex }}
                  >
                    <span
                      className="font-mono font-bold text-lg drop-shadow"
                      style={{ color: selectedColor.isDark ? "#ffffff" : "#000000" }}
                    >
                      {selectedColor.hex}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1 text-xs backdrop-blur-md bg-white/20 hover:bg-white/30 text-white border-0 shadow"
                        onClick={() => handleCopy(selectedColor.hex, "HEX", "inspect-hex")}
                      >
                        {copiedKey === "inspect-hex" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        Copy
                      </Button>
                    </div>
                  </div>

                  {/* Format Values Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div
                      className="p-2.5 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                      onClick={() => handleCopy(`rgb(${selectedColor.rgb.join(", ")})`, "RGB", "inspect-rgb")}
                    >
                      <div className="text-muted-foreground font-medium mb-0.5">RGB</div>
                      <div className="font-mono font-medium truncate">
                        {selectedColor.rgb.join(", ")}
                      </div>
                    </div>
                    <div
                      className="p-2.5 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                      onClick={() => handleCopy(`hsl(${selectedColor.hsl[0]}, ${selectedColor.hsl[1]}%, ${selectedColor.hsl[2]}%)`, "HSL", "inspect-hsl")}
                    >
                      <div className="text-muted-foreground font-medium mb-0.5">HSL</div>
                      <div className="font-mono font-medium truncate">
                        {selectedColor.hsl[0]}°, {selectedColor.hsl[1]}%, {selectedColor.hsl[2]}%
                      </div>
                    </div>
                    <div
                      className="p-2.5 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                      onClick={() => handleCopy(`cmyk(${selectedColor.cmyk.join("%, ")}%)`, "CMYK", "inspect-cmyk")}
                    >
                      <div className="text-muted-foreground font-medium mb-0.5">CMYK</div>
                      <div className="font-mono font-medium truncate">
                        {selectedColor.cmyk.join("%, ")}%
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border bg-muted/30">
                      <div className="text-muted-foreground font-medium mb-0.5">Prominence</div>
                      <div className="font-mono font-medium">{selectedColor.population}% of image</div>
                    </div>
                  </div>

                  {/* Accessibility Contrast Ratios (WCAG 2.1) */}
                  <div className="mt-4 pt-3 border-t">
                    <div className="flex items-center gap-1.5 text-xs font-semibold mb-2 text-muted-foreground">
                      <SunMoon className="w-3.5 h-3.5" />
                      WCAG 2.1 Accessibility Contrast
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg border bg-white text-slate-900 flex items-center justify-between">
                        <span className="font-medium">On White</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold">{selectedColor.contrastWhite}:1</span>
                          <Badge
                            variant={selectedColor.contrastWhite >= 4.5 ? "default" : "secondary"}
                            className="text-[10px] px-1 py-0 h-4"
                          >
                            {selectedColor.contrastWhite >= 7 ? "AAA" : selectedColor.contrastWhite >= 4.5 ? "AA" : "Fail"}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-2 rounded-lg border bg-slate-950 text-white flex items-center justify-between">
                        <span className="font-medium">On Black</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold">{selectedColor.contrastBlack}:1</span>
                          <Badge
                            variant={selectedColor.contrastBlack >= 4.5 ? "default" : "secondary"}
                            className="text-[10px] px-1 py-0 h-4"
                          >
                            {selectedColor.contrastBlack >= 7 ? "AAA" : selectedColor.contrastBlack >= 4.5 ? "AA" : "Fail"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Studio Tabs (Palette, Moods, Harmonies, Gradient, Export) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {/* Tab Navigation */}
              <div className="flex items-center gap-2 p-1 bg-muted/60 rounded-xl border overflow-x-auto">
                <Button
                  size="sm"
                  variant={activeTab === "palette" ? "default" : "ghost"}
                  onClick={() => setActiveTab("palette")}
                  className="gap-1.5 text-xs rounded-lg"
                >
                  <Palette className="w-3.5 h-3.5" />
                  Palette
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "moods" ? "default" : "ghost"}
                  onClick={() => setActiveTab("moods")}
                  className="gap-1.5 text-xs rounded-lg"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Vibrancy & Moods
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "harmonies" ? "default" : "ghost"}
                  onClick={() => setActiveTab("harmonies")}
                  className="gap-1.5 text-xs rounded-lg"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Harmonies
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "gradient" ? "default" : "ghost"}
                  onClick={() => setActiveTab("gradient")}
                  className="gap-1.5 text-xs rounded-lg"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Gradient Studio
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "export" ? "default" : "ghost"}
                  onClick={() => setActiveTab("export")}
                  className="gap-1.5 text-xs rounded-lg"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  Code Export
                </Button>
              </div>

              {/* Tab 1: Dominant Swatches */}
              {activeTab === "palette" && paletteResult && (
                <div className="bg-card border rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-base">Extracted Dominant Palette</h3>
                    <span className="text-xs text-muted-foreground">
                      Click any color to inspect and set as active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {paletteResult.colors.map((color, idx) => {
                      const isSelected = selectedColor?.hex === color.hex;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedColor(color)}
                          className={`group cursor-pointer rounded-xl border p-2 transition-all hover:shadow-md ${
                            isSelected
                              ? "ring-2 ring-violet-500 border-transparent shadow-sm bg-violet-50/10"
                              : "hover:border-violet-300 dark:hover:border-violet-700 bg-card"
                          }`}
                        >
                          <div
                            className="h-20 rounded-lg w-full mb-2.5 relative shadow-inner border border-black/5 flex items-end justify-end p-1.5"
                            style={{ backgroundColor: color.hex }}
                          >
                            <span
                              className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded backdrop-blur-md"
                              style={{
                                backgroundColor: color.isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.6)",
                                color: color.isDark ? "#ffffff" : "#000000",
                              }}
                            >
                              {color.population}%
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-mono font-semibold text-xs text-foreground">
                                {color.hex}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                                {color.name}
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 opacity-70 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(color.hex, "HEX", `hex-${idx}`);
                              }}
                            >
                              {copiedKey === `hex-${idx}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: Vibrancy & Moods */}
              {activeTab === "moods" && paletteResult && (
                <div className="bg-card border rounded-2xl p-6 shadow-sm">
                  <div className="mb-4">
                    <h3 className="font-semibold text-base">Material Mood Palette</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Intelligently filtered by saturation, luminance, and photographic warmth.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Dominant", info: paletteResult.moods.dominant, desc: "Most prominent overall tone" },
                      { label: "Vibrant", info: paletteResult.moods.vibrant, desc: "High saturation, balanced tone" },
                      { label: "Light Vibrant", info: paletteResult.moods.lightVibrant, desc: "High saturation with bright luminance" },
                      { label: "Dark Vibrant", info: paletteResult.moods.darkVibrant, desc: "Deep rich contrast and saturation" },
                      { label: "Muted", info: paletteResult.moods.muted, desc: "Subtle, low-saturation tone" },
                      { label: "Light Muted", info: paletteResult.moods.lightMuted, desc: "Gentle pastel and tint" },
                      { label: "Dark Muted", info: paletteResult.moods.darkMuted, desc: "Deep earthy undertone" },
                    ].map(({ label, info, desc }, idx) => {
                      if (!info) return null;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedColor(info)}
                          className="flex items-center gap-3 p-3 rounded-xl border hover:border-violet-500/50 cursor-pointer transition-colors bg-card group"
                        >
                          <div
                            className="w-14 h-14 rounded-lg shadow-inner border border-black/10 shrink-0"
                            style={{ backgroundColor: info.hex }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-foreground">{label}</span>
                              <span className="font-mono text-xs font-medium text-violet-600 dark:text-violet-400">
                                {info.hex}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">{desc}</div>
                            <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                              {info.name} • {info.population}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 3: Harmonies */}
              {activeTab === "harmonies" && harmonies && selectedColor && (
                <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col gap-5">
                  <div>
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <span>Harmonies based on</span>
                      <span className="font-mono text-violet-600 dark:text-violet-400">
                        {selectedColor.hex}
                      </span>
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/10 inline-block"
                        style={{ backgroundColor: selectedColor.hex }}
                      />
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Classical color theory wheel relationships calculated mathematically.
                    </p>
                  </div>

                  {[
                    { label: "Complementary (180° Contrast)", colors: harmonies.complementary },
                    { label: "Analogous (Adjacent ±30°)", colors: harmonies.analogous },
                    { label: "Triadic (Equilateral 120°)", colors: harmonies.triadic },
                    { label: "Tetradic (Rectangle 90°)", colors: harmonies.tetradic },
                    { label: "Split-Complementary (150° & 210°)", colors: harmonies.splitComplementary },
                    { label: "Monochromatic (Lightness Scale)", colors: harmonies.monochromatic },
                  ].map(({ label, colors }, hIdx) => (
                    <div key={hIdx} className="border-t pt-3.5 first:border-0 first:pt-0">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">{label}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {colors.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            onClick={() => setSelectedColor(c)}
                            className="flex items-center gap-2 p-1.5 pr-3 rounded-lg border bg-muted/20 hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <div
                              className="w-7 h-7 rounded-md border border-black/10 shadow-inner"
                              style={{ backgroundColor: c.hex }}
                            />
                            <div>
                              <div className="font-mono text-xs font-semibold">{c.hex}</div>
                              <div className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                                {c.name}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 4: Gradient Studio */}
              {activeTab === "gradient" && paletteResult && (
                <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col gap-6">
                  <div>
                    <h3 className="font-semibold text-base">CSS Gradient Studio</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Generate high-performance CSS linear and radial gradients from your extracted colors.
                    </p>
                  </div>

                  {/* Gradient Visual Box */}
                  <div
                    className="h-44 rounded-2xl border shadow-lg flex items-end justify-between p-4 transition-all"
                    style={{ background: gradientCss }}
                  >
                    <Badge variant="secondary" className="backdrop-blur-md bg-black/40 text-white border-0 font-mono text-xs">
                      {gradientType === "linear" ? `${gradientAngle}° Linear` : "Radial"}
                    </Badge>
                    <Button
                      size="sm"
                      className="gap-1.5 backdrop-blur-md bg-white/20 hover:bg-white/30 text-white border-0 shadow"
                      onClick={() => handleCopy(`background: ${gradientCss};`, "CSS Gradient", "grad-css")}
                    >
                      {copiedKey === "grad-css" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      Copy CSS
                    </Button>
                  </div>

                  {/* Gradient Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Direction & Type */}
                    <div className="p-4 rounded-xl border bg-muted/20 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Gradient Style</span>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={gradientType === "linear" ? "default" : "outline"}
                            className="h-7 text-xs px-2.5"
                            onClick={() => setGradientType("linear")}
                          >
                            Linear
                          </Button>
                          <Button
                            size="sm"
                            variant={gradientType === "radial" ? "default" : "outline"}
                            className="h-7 text-xs px-2.5"
                            onClick={() => setGradientType("radial")}
                          >
                            Radial
                          </Button>
                        </div>
                      </div>

                      {gradientType === "linear" && (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-muted-foreground">Angle</span>
                            <span className="font-mono font-semibold">{gradientAngle}°</span>
                          </div>
                          <Slider
                            min={0}
                            max={360}
                            step={15}
                            value={[gradientAngle]}
                            onValueChange={(val) => setGradientAngle(val[0])}
                          />
                          {/* Angle Quick Buttons */}
                          <div className="flex items-center gap-1.5 mt-3 justify-between">
                            {[0, 45, 90, 135, 180, 270].map((deg) => (
                              <Button
                                key={deg}
                                size="sm"
                                variant={gradientAngle === deg ? "secondary" : "ghost"}
                                className="h-6 text-[10px] px-1.5 font-mono"
                                onClick={() => setGradientAngle(deg)}
                              >
                                {deg}°
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Color Stops from Palette */}
                    <div className="p-4 rounded-xl border bg-muted/20 flex flex-col gap-3">
                      <div className="text-xs font-semibold text-muted-foreground">Add Colors from Palette</div>
                      <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto">
                        {paletteResult.colors.map((c, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              if (gradientStops.length >= 5) {
                                toast.error("Maximum 5 gradient stops");
                                return;
                              }
                              const pos = Math.round(
                                (gradientStops.length / (gradientStops.length + 1)) * 100,
                              );
                              setGradientStops([...gradientStops, { color: c.hex, position: pos }]);
                              toast.success(`Added ${c.hex} to gradient`);
                            }}
                            className="w-8 h-8 rounded-lg border border-black/10 cursor-pointer shadow-sm hover:scale-110 transition-transform"
                            style={{ backgroundColor: c.hex }}
                            title={`Add ${c.hex} (${c.name})`}
                          />
                        ))}
                      </div>

                      {/* Active Stops list */}
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {gradientStops.map((stop, sIdx) => (
                          <Badge
                            key={sIdx}
                            variant="outline"
                            className="font-mono text-xs gap-1.5 py-1 px-2 cursor-pointer hover:bg-destructive/10"
                            onClick={() => {
                              if (gradientStops.length <= 2) {
                                toast.error("Gradient must have at least 2 stops");
                                return;
                              }
                              setGradientStops(gradientStops.filter((_, idx) => idx !== sIdx));
                            }}
                            title="Click to remove stop"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block border border-black/20"
                              style={{ backgroundColor: stop.color }}
                            />
                            {stop.color} ({stop.position}%) &times;
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Generated CSS Box */}
                  <div className="p-3.5 rounded-xl border bg-slate-950 font-mono text-xs text-emerald-400 overflow-x-auto flex items-center justify-between">
                    <code>background: {gradientCss};</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-white hover:bg-white/10 shrink-0 ml-3"
                      onClick={() => handleCopy(`background: ${gradientCss};`, "CSS", "grad-snippet")}
                    >
                      {copiedKey === "grad-snippet" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Tab 5: Code Export */}
              {activeTab === "export" && paletteResult && (
                <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col gap-6">
                  <div>
                    <h3 className="font-semibold text-base">Export Palette Code</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ready-to-use snippets for CSS, Tailwind CSS, and Figma / JSON design tokens.
                    </p>
                  </div>

                  {/* Format 1: CSS Variables */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">CSS Custom Properties (:root)</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleCopy(exportAsCssVariables(paletteResult.colors), "CSS Variables", "exp-css")}
                      >
                        {copiedKey === "exp-css" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        Copy CSS
                      </Button>
                    </div>
                    <pre className="p-3.5 rounded-xl border bg-slate-950 font-mono text-xs text-slate-200 overflow-x-auto max-h-40">
                      {exportAsCssVariables(paletteResult.colors)}
                    </pre>
                  </div>

                  {/* Format 2: Tailwind Config */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Tailwind CSS (tailwind.config.js)</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleCopy(exportAsTailwind(paletteResult.colors), "Tailwind Config", "exp-tw")}
                      >
                        {copiedKey === "exp-tw" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        Copy Tailwind
                      </Button>
                    </div>
                    <pre className="p-3.5 rounded-xl border bg-slate-950 font-mono text-xs text-slate-200 overflow-x-auto max-h-40">
                      {exportAsTailwind(paletteResult.colors)}
                    </pre>
                  </div>

                  {/* Format 3: JSON Design Tokens */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">JSON Design Tokens</span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => handleCopy(exportAsJson(paletteResult.colors), "JSON", "exp-json")}
                        >
                          {copiedKey === "exp-json" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          Copy JSON
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => {
                            const blob = new Blob([exportAsJson(paletteResult.colors)], { type: "application/json" });
                            downloadBlob(blob, `palette-${Date.now()}.json`);
                            toast.success("Downloaded palette.json");
                          }}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download .json
                        </Button>
                      </div>
                    </div>
                    <pre className="p-3.5 rounded-xl border bg-slate-950 font-mono text-xs text-slate-200 overflow-x-auto max-h-40">
                      {exportAsJson(paletteResult.colors)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
