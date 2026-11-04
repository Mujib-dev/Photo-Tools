"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Crown,
  Download,
  Flame,
  Layers,
  Loader2,
  Megaphone,
  Package,
  Palette,
  RefreshCw,
  ShoppingBag,
  Sliders,
  Sparkles,
  Star,
  Sun,
  Tag,
  Type,
  Upload,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { downloadBlob } from "@/lib/screenshot";
import {
  AD_TEMPLATES,
  AdOverlayConfig,
  createDemoProductCanvas,
  extractProductCutout,
  generateAmazonProductListing,
  renderProductScene,
  STUDIO_SURFACES,
  StudioSurface,
} from "@/lib/product-studio-engine";

type StudioTabMode = "studio" | "ad" | "ai";

const AI_SCENE_PRESETS = [
  {
    label: "🏝️ Tropical Beach",
    prompt: "sunlit golden beach sand with tropical palm leaf soft shadow, crystal ocean horizon bokeh, photorealistic product photography studio lighting",
  },
  {
    label: "🌊 Water Splash",
    prompt: "crystal clear splashing water droplets, turquoise ripples, clean luxury product pedestal, high-speed photography lighting",
  },
  {
    label: "☕ Sunlit Cafe Table",
    prompt: "warm natural morning window light on polished white marble cafe table, roasted coffee beans and linen, soft bokeh background",
  },
  {
    label: "🌿 Botanical Spa",
    prompt: "serene wellness spa counter, natural smooth river stones, green monstera and eucalyptus leaves, soft warm daylight",
  },
  {
    label: "💎 Dark Velvet & Gold",
    prompt: "luxurious black velvet draped background, golden rim lighting, cinematic dramatic spotlight, luxury commercial ad",
  },
  {
    label: "🌌 Cyberpunk Neon",
    prompt: "futuristic dark concrete stage with electric blue and magenta neon light reflections, soft atmospheric mist, commercial tech product",
  },
];

export function ProductStudioTool() {
  const [productCutout, setProductCutout] = React.useState<HTMLCanvasElement | null>(null);
  const [renderedScene, setRenderedScene] = React.useState<HTMLCanvasElement | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<StudioTabMode>("studio");

  // Core Studio Settings
  const [selectedSurface, setSelectedSurface] = React.useState<StudioSurface>("carrara-marble");
  const [surfaceCategory, setSurfaceCategory] = React.useState<string>("All");
  const [aspectRatio, setAspectRatio] = React.useState<"1:1" | "4:5" | "16:9" | "9:16">("1:1");
  const [productScale, setProductScale] = React.useState(0.82);
  const [productOffsetY, setProductOffsetY] = React.useState(0);
  const [productOffsetX, setProductOffsetX] = React.useState(0);
  const [shadowIntensity, setShadowIntensity] = React.useState(65);
  const [reflectionIntensity, setReflectionIntensity] = React.useState(40);
  const [lightAngle, setLightAngle] = React.useState(15);
  const [exportFormat, setExportFormat] = React.useState<"png" | "jpeg" | "webp">("png");

  // Custom Brand Logo State
  const [brandLogoCanvas, setBrandLogoCanvas] = React.useState<HTMLCanvasElement | null>(null);
  const [brandLogoUrl, setBrandLogoUrl] = React.useState<string | null>(null);

  // AI Custom Scene Background
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [isGeneratingAiBg, setIsGeneratingAiBg] = React.useState(false);
  const [customBgCanvas, setCustomBgCanvas] = React.useState<HTMLCanvasElement | null>(null);

  // Commercial Ad Overlay State
  const [isAdMode, setIsAdMode] = React.useState(false);
  const [adConfig, setAdConfig] = React.useState<AdOverlayConfig>({
    enabled: false,
    templateId: "flash-sale",
    headline: "LIMITED TIME OFFER",
    subheadline: "Exclusive online discount • Free express delivery",
    badgeText: "🔥 50% OFF FLASH SALE",
    badgeColor: "#ef4444",
    priceCurrent: "$39.99",
    priceOriginal: "$79.99",
    ctaText: "SHOP NOW →",
    ctaColor: "#ef4444",
    ratingText: "⭐⭐⭐⭐⭐ 4.9 (3,200+ Reviews)",
    brandName: "LYNKZONE STORE",
    theme: "vibrant",
  });

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Load user image
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

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = img.naturalWidth || img.width;
      tempCanvas.height = img.naturalHeight || img.height;
      const ctx = tempCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context");
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      // Auto-extract product foreground
      const cutout = extractProductCutout(tempCanvas);
      setProductCutout(cutout);
      toast.success("Product isolated! Ready for commercial photoshoot & ad creation.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load product image");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Load sample demo product (luxury perfume)
  const handleLoadDemo = React.useCallback(() => {
    setIsProcessing(true);
    try {
      const demoCutout = createDemoProductCanvas();
      setProductCutout(demoCutout);
      toast.success("Loaded luxury perfume sample product!");
    } catch (err) {
      console.error(err);
      toast.error("Could not load demo product");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Apply Ad Template
  const handleApplyTemplate = (templateKey: string) => {
    const tpl = AD_TEMPLATES[templateKey];
    if (!tpl) return;
    setAdConfig((prev) => ({
      ...prev,
      ...tpl,
      enabled: true,
    }));
    setIsAdMode(true);
    toast.success(`Applied "${templateKey.replace("-", " ").toUpperCase()}" Ad Template!`);
  };

  // Generate Custom AI Background Scene
  const handleGenerateAiScene = async () => {
    const promptToUse = aiPrompt.trim() || AI_SCENE_PRESETS[0].prompt;
    setIsGeneratingAiBg(true);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `commercial product photography background, empty pedestal stage, ${promptToUse}, 8k uhd, photorealistic, no text, no product`,
          width: 1024,
          height: 1024,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "AI background generation failed");
      }

      const blob = await res.blob();
      const img = new Image();
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load synthesized AI background"));
        img.src = url;
      });

      const bgCanvas = document.createElement("canvas");
      bgCanvas.width = img.naturalWidth || 1024;
      bgCanvas.height = img.naturalHeight || 1024;
      const bCtx = bgCanvas.getContext("2d");
      if (bCtx) bCtx.drawImage(img, 0, 0);

      setCustomBgCanvas(bgCanvas);
      setSelectedSurface("custom-ai");
      toast.success("✨ AI Scene generated & product staged!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI generation failed";
      toast.error(msg);
    } finally {
      setIsGeneratingAiBg(false);
    }
  };

  // Re-render scene when options change
  React.useEffect(() => {
    if (!productCutout) return;

    try {
      const scene = renderProductScene(productCutout, {
        surface: selectedSurface,
        productScale,
        productOffsetY,
        productOffsetX,
        shadowIntensity,
        shadowBlur: 22,
        reflectionIntensity,
        aspectRatio,
        lightAngle,
        outputWidth: 1200,
        customBgCanvas: selectedSurface === "custom-ai" ? customBgCanvas : null,
        adOverlay: isAdMode ? { ...adConfig, enabled: true, logoCanvas: brandLogoCanvas } : undefined,
      });

      setRenderedScene(scene);

      const displayCanvas = canvasRef.current;
      if (displayCanvas) {
        displayCanvas.width = scene.width;
        displayCanvas.height = scene.height;
        const dCtx = displayCanvas.getContext("2d");
        if (dCtx) {
          dCtx.clearRect(0, 0, scene.width, scene.height);
          dCtx.drawImage(scene, 0, 0);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [
    productCutout,
    selectedSurface,
    productScale,
    productOffsetY,
    productOffsetX,
    shadowIntensity,
    reflectionIntensity,
    aspectRatio,
    lightAngle,
    customBgCanvas,
    isAdMode,
    adConfig,
    brandLogoCanvas,
  ]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setBrandLogoCanvas(c);
        setBrandLogoUrl(url);
        toast.success("Brand logo uploaded & placed on ad!");
      }
    };
    img.onerror = () => toast.error("Could not read logo image");
    img.src = url;
  };

  const handleRemoveLogo = () => {
    if (brandLogoUrl) URL.revokeObjectURL(brandLogoUrl);
    setBrandLogoCanvas(null);
    setBrandLogoUrl(null);
    toast.success("Removed custom brand logo");
  };

  const handleDownload = () => {
    if (!renderedScene) return;

    const mime =
      exportFormat === "webp"
        ? "image/webp"
        : exportFormat === "jpeg"
        ? "image/jpeg"
        : "image/png";
    const ext = exportFormat === "jpeg" ? "jpg" : exportFormat;

    renderedScene.toBlob(
      (blob) => {
        if (!blob) return;
        const prefix = isAdMode ? "commercial-ad" : "product-studio";
        downloadBlob(blob, `${prefix}-${selectedSurface}-${Date.now()}.${ext}`);
        toast.success(`Exported high-res ${isAdMode ? "Commercial Ad" : "Product Shot"} (${ext.toUpperCase()})`);
      },
      mime,
      exportFormat === "png" ? undefined : 0.95
    );
  };

  const handleDownloadAmazonListing = () => {
    if (!productCutout) return;
    try {
      const amazonCanvas = generateAmazonProductListing(productCutout);
      amazonCanvas.toBlob(
        (blob) => {
          if (!blob) return;
          downloadBlob(blob, `amazon-listing-2000x2000-${Date.now()}.jpg`);
          toast.success("Exported Amazon-compliant 2000×2000 Pure White listing photo!");
        },
        "image/jpeg",
        0.98
      );
    } catch (err) {
      toast.error("Could not export Amazon listing");
    }
  };

  const handleDownloadCutout = () => {
    if (!productCutout) return;
    productCutout.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `product-cutout-transparent-${Date.now()}.png`);
      toast.success("Exported transparent product cutout PNG");
    }, "image/png");
  };

  const filteredSurfaces = React.useMemo(() => {
    if (surfaceCategory === "All") return STUDIO_SURFACES;
    return STUDIO_SURFACES.filter((s) => s.category === surfaceCategory);
  }, [surfaceCategory]);

  return (
    <AuthGate>
      <div className="container max-w-6xl mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">AI Product Photography & Commercial Ad Studio</h1>
                <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 max-w-2xl">
                  Upload simple product photos to isolate them onto luxury studio pedestals, generate custom AI scenes, and design high-converting marketing ads for Amazon, Instagram, and TikTok.
                </p>
              </div>
            </div>
          </div>

          {productCutout && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Export format pill */}
              <div className="flex items-center rounded-lg border bg-card p-0.5 text-xs">
                {(["png", "jpeg", "webp"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setExportFormat(fmt)}
                    className={`px-2 py-1 rounded text-xs font-medium uppercase transition-colors cursor-pointer ${
                      exportFormat === fmt
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {fmt === "jpeg" ? "jpg" : fmt}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAmazonListing}
                className="gap-1.5 border-neutral-300 dark:border-neutral-700 text-xs cursor-pointer"
                title="2000×2000 Pure White listing photo per Amazon requirements"
              >
                <Package className="w-3.5 h-3.5 text-amber-500" /> Amazon Pure White
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setProductCutout(null);
                  setRenderedScene(null);
                  setCustomBgCanvas(null);
                }}
                className="text-xs cursor-pointer"
              >
                Change Product
              </Button>

              <Button
                size="sm"
                onClick={handleDownload}
                className="gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold text-xs shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" /> {isAdMode ? "Download Commercial Ad" : "Download Staged Shot"}
              </Button>
            </div>
          )}
        </div>

        {!productCutout ? (
          /* Empty state & Upload */
          <div className="space-y-6">
            <Dropzone
              onFiles={handleFileDrop}
              accept="image/*"
            />

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
              <span className="text-xs text-muted-foreground">Don&apos;t have a product photo on hand?</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadDemo}
                className="gap-2 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
              >
                <Package className="w-4 h-4 text-amber-500" /> Try Sample Luxury Perfume Product
              </Button>
            </div>

            {/* Commercial Value Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
              <div className="p-4 rounded-xl border bg-card/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Check className="w-4 h-4 text-emerald-500" /> 1-Click Background Cutout
                </div>
                <p className="text-xs text-muted-foreground">
                  Isolates your product from casual photos taken on tables, floors, or plain backgrounds automatically.
                </p>
              </div>

              <div className="p-4 rounded-xl border bg-card/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Architectural Pedestals & AI
                </div>
                <p className="text-xs text-muted-foreground">
                  Stages products on Carrara marble, Scandinavian oak, concrete, tropical beach, or prompt-driven AI scenes.
                </p>
              </div>

              <div className="p-4 rounded-xl border bg-card/50 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Megaphone className="w-4 h-4 text-orange-500" /> Commercial Ad Generator
                </div>
                <p className="text-xs text-muted-foreground">
                  Creates ready-to-run marketing ads with sale badges, 5-star ratings, price tags, and high-converting CTA buttons.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Staging & Ad Editor */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Interactive Canvas (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border bg-neutral-950/20 flex items-center justify-center p-3 min-h-[280px] sm:min-h-[380px] md:min-h-[480px] shadow-sm">
                <canvas
                  ref={canvasRef}
                  className="max-w-full max-h-[600px] object-contain rounded-xl shadow-md transition-all"
                />

                {isProcessing && (
                  <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                    <span className="text-sm font-medium">Synthesizing commercial scene...</span>
                  </div>
                )}

                {/* Aspect ratio overlay badge */}
                <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
                  <Badge variant="outline" className="bg-background/80 backdrop-blur-md shadow-sm border text-xs">
                    {aspectRatio} · {renderedScene ? `${renderedScene.width}×${renderedScene.height}px` : ""}
                  </Badge>
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-md text-xs">
                    {isAdMode ? "📢 Ad Creator Active" : STUDIO_SURFACES.find((s) => s.id === selectedSurface)?.label}
                  </Badge>
                </div>
              </div>

              {/* Aspect Ratio Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border bg-card">
                <span className="text-xs font-medium text-muted-foreground">Canvas Ratio:</span>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                  {(["1:1", "4:5", "16:9", "9:16"] as const).map((ratio) => (
                    <Button
                      key={ratio}
                      variant={aspectRatio === ratio ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAspectRatio(ratio)}
                      className="text-xs h-8 px-2 sm:px-3 justify-center cursor-pointer"
                    >
                      <span>
                        {ratio === "1:1" && "1:1 Square (Feed)"}
                        {ratio === "4:5" && "4:5 Portrait (Social)"}
                        {ratio === "16:9" && "16:9 Banner (Hero)"}
                        {ratio === "9:16" && "9:16 Story (Reels)"}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Mode Toggle Bar */}
              <div className="grid grid-cols-2 gap-3 p-1.5 bg-muted/60 rounded-2xl border border-border/50">
                <button
                  type="button"
                  onClick={() => setIsAdMode(false)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    !isAdMode
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ShoppingBag className="w-4 h-4 text-amber-500" />
                  📸 Clean Product Staging
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdMode(true)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    isAdMode
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Megaphone className="w-4 h-4 text-orange-500" />
                  📢 Commercial Ad Creator
                </button>
              </div>
            </div>

            {/* Studio Controls Sidebar (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Tab Switcher for Sidebar */}
              <div className="flex border-b border-border/50 gap-2 pb-2">
                <Button
                  variant={activeTab === "studio" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("studio")}
                  className="text-xs h-8 gap-1.5"
                >
                  <Palette className="w-3.5 h-3.5" /> Surfaces
                </Button>
                <Button
                  variant={activeTab === "ad" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setActiveTab("ad");
                    setIsAdMode(true);
                  }}
                  className="text-xs h-8 gap-1.5"
                >
                  <Tag className="w-3.5 h-3.5" /> Ad Copy & Badges
                </Button>
                <Button
                  variant={activeTab === "ai" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("ai")}
                  className="text-xs h-8 gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-pink-500" /> AI Scene
                </Button>
              </div>

              {/* TAB 1: Surfaces & Lighting */}
              {activeTab === "studio" && (
                <div className="space-y-6">
                  {/* Studio Surfaces Grid */}
                  <div className="p-5 rounded-xl border bg-card space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-amber-500" />
                        <span className="font-semibold text-sm">Studio Surface & Pedestal</span>
                      </div>
                    </div>

                    {/* Categories */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                      {["All", "E-Commerce", "Luxury", "Modern", "Creative"].map((cat) => (
                        <Button
                          key={cat}
                          variant={surfaceCategory === cat ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setSurfaceCategory(cat)}
                          className="h-7 text-xs px-2.5 cursor-pointer"
                        >
                          {cat}
                        </Button>
                      ))}
                    </div>

                    {/* Surface tiles */}
                    <div className="grid grid-cols-2 gap-2.5 max-h-[290px] overflow-y-auto pr-1">
                      {filteredSurfaces.map((s) => {
                        const isSelected = selectedSurface === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedSurface(s.id)}
                            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                              isSelected
                                ? "border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500"
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
                            {s.badge && (
                              <div className="mt-2 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                                {s.badge}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Staging & Lighting Controls */}
                  <div className="p-5 rounded-xl border bg-card space-y-4">
                    <div className="flex items-center gap-2 border-b pb-3">
                      <Sliders className="w-4 h-4 text-amber-500" />
                      <span className="font-semibold text-sm">Product Geometry & Lighting</span>
                    </div>

                    {/* Product Scale */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <Label>Product Size</Label>
                        <span className="text-muted-foreground">{Math.round(productScale * 100)}%</span>
                      </div>
                      <Slider
                        value={[productScale]}
                        min={0.4}
                        max={1.1}
                        step={0.02}
                        onValueChange={(val) => setProductScale(val[0])}
                      />
                    </div>

                    {/* Vertical Elevation / Offset */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <Label>Ground Elevation (Y-Offset)</Label>
                        <span className="text-muted-foreground">{productOffsetY}</span>
                      </div>
                      <Slider
                        value={[productOffsetY]}
                        min={-60}
                        max={60}
                        step={2}
                        onValueChange={(val) => setProductOffsetY(val[0])}
                      />
                    </div>

                    {/* Ground Shadow Intensity */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <Label>Floor Contact Shadow</Label>
                        <span className="text-muted-foreground">{shadowIntensity}%</span>
                      </div>
                      <Slider
                        value={[shadowIntensity]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(val) => setShadowIntensity(val[0])}
                      />
                    </div>

                    {/* Reflection Intensity */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <Label>Floor Specular Reflection</Label>
                        <span className="text-muted-foreground">{reflectionIntensity}%</span>
                      </div>
                      <Slider
                        value={[reflectionIntensity]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(val) => setReflectionIntensity(val[0])}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Commercial Ad Creator */}
              {activeTab === "ad" && (
                <div className="space-y-6">
                  {/* Ad Templates */}
                  <div className="p-5 rounded-xl border bg-card space-y-3">
                    <div className="flex items-center justify-between border-b pb-2.5">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span className="font-semibold text-sm">1-Click Ad Templates</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={adConfig.templateId === "flash-sale" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleApplyTemplate("flash-sale")}
                        className="text-xs justify-start h-9 gap-1.5"
                      >
                        🔥 Flash Sale (-50%)
                      </Button>
                      <Button
                        variant={adConfig.templateId === "luxury" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleApplyTemplate("luxury")}
                        className="text-xs justify-start h-9 gap-1.5"
                      >
                        ✨ Luxury Reserve
                      </Button>
                      <Button
                        variant={adConfig.templateId === "organic" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleApplyTemplate("organic")}
                        className="text-xs justify-start h-9 gap-1.5"
                      >
                        🌿 100% Organic
                      </Button>
                      <Button
                        variant={adConfig.templateId === "new-drop" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleApplyTemplate("new-drop")}
                        className="text-xs justify-start h-9 gap-1.5"
                      >
                        ⚡ New Collection
                      </Button>
                    </div>
                  </div>

                  {/* Ad Copy Customizer */}
                  <div className="p-5 rounded-xl border bg-card space-y-4">
                    <div className="flex items-center gap-2 border-b pb-3">
                      <Type className="w-4 h-4 text-amber-500" />
                      <span className="font-semibold text-sm">Ad Copy & Marketing Elements</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Brand Name (Text)</Label>
                      <Input
                        value={adConfig.brandName}
                        onChange={(e) => setAdConfig((prev) => ({ ...prev, brandName: e.target.value }))}
                        placeholder="e.g. LYNKZONE STORE"
                        className="text-xs h-8"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Brand Logo Image (PNG / SVG)</Label>
                      {brandLogoUrl ? (
                        <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={brandLogoUrl}
                              alt="Brand Logo"
                              className="h-7 w-auto max-w-[80px] object-contain rounded"
                            />
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              Logo placed on ad
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={handleRemoveLogo}
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive cursor-pointer"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 p-2 rounded-lg border border-dashed border-border hover:border-amber-500/50 hover:bg-amber-500/5 cursor-pointer text-xs text-muted-foreground transition-all">
                          <Upload className="w-3.5 h-3.5 text-amber-500" />
                          <span>Upload Logo Image</span>
                          <input
                            type="file"
                            accept="image/png,image/svg+xml,image/webp"
                            className="hidden"
                            onChange={handleLogoUpload}
                          />
                        </label>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Sale Badge / Offer Tag</Label>
                      <Input
                        value={adConfig.badgeText}
                        onChange={(e) => setAdConfig((prev) => ({ ...prev, badgeText: e.target.value }))}
                        placeholder="e.g. 🔥 50% OFF FLASH SALE"
                        className="text-xs h-8"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Main Commercial Headline</Label>
                      <Input
                        value={adConfig.headline}
                        onChange={(e) => setAdConfig((prev) => ({ ...prev, headline: e.target.value }))}
                        placeholder="e.g. LIMITED TIME OFFER"
                        className="text-xs h-8"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Subheadline / Key Benefits</Label>
                      <Input
                        value={adConfig.subheadline}
                        onChange={(e) => setAdConfig((prev) => ({ ...prev, subheadline: e.target.value }))}
                        placeholder="e.g. All-day hydration • Free express delivery"
                        className="text-xs h-8"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Sale Price</Label>
                        <Input
                          value={adConfig.priceCurrent}
                          onChange={(e) => setAdConfig((prev) => ({ ...prev, priceCurrent: e.target.value }))}
                          placeholder="$39.99"
                          className="text-xs h-8"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Original (Strikethrough)</Label>
                        <Input
                          value={adConfig.priceOriginal}
                          onChange={(e) => setAdConfig((prev) => ({ ...prev, priceOriginal: e.target.value }))}
                          placeholder="$79.99"
                          className="text-xs h-8"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Call To Action (CTA) Button</Label>
                      <Input
                        value={adConfig.ctaText}
                        onChange={(e) => setAdConfig((prev) => ({ ...prev, ctaText: e.target.value }))}
                        placeholder="e.g. SHOP NOW →"
                        className="text-xs h-8"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Social Proof & Star Rating</Label>
                      <Input
                        value={adConfig.ratingText}
                        onChange={(e) => setAdConfig((prev) => ({ ...prev, ratingText: e.target.value }))}
                        placeholder="⭐⭐⭐⭐⭐ 4.9 (3,200+ Reviews)"
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: AI Scene Generator */}
              {activeTab === "ai" && (
                <div className="p-5 rounded-xl border border-pink-500/30 bg-gradient-to-b from-pink-500/5 to-transparent space-y-4">
                  <div className="flex items-center justify-between border-b border-pink-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-pink-500" />
                      <span className="font-semibold text-sm">Neural Diffusion Scene Generator</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-pink-500 border-pink-500/30">
                      Flux Studio
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Describe any commercial environment. The AI generates the custom photoshoot backdrop and places your product with realistic contact shadows!
                  </p>

                  {/* Preset prompt pills */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Preset Scene Environments</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {AI_SCENE_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setAiPrompt(p.prompt)}
                          className="text-left p-2 rounded-lg border border-border/60 bg-card hover:bg-muted/50 text-xs transition-all cursor-pointer"
                        >
                          <span className="font-medium text-[11px] block">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Prompt Input */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Custom Scene Prompt</Label>
                    <Input
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g. Floating in clear water with splashing citrus slices..."
                      className="text-xs h-9"
                    />
                  </div>

                  <Button
                    onClick={handleGenerateAiScene}
                    disabled={isGeneratingAiBg}
                    className="w-full gap-2 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-700 hover:to-rose-700 text-white font-semibold text-xs h-10 cursor-pointer shadow-md"
                  >
                    {isGeneratingAiBg ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Synthesizing AI Photoshoot...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Generate Custom AI Scene
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Export Panel */}
              <div className="p-5 rounded-xl border bg-card space-y-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Commercial Export
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={exportFormat === "png" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setExportFormat("png")}
                    className="text-xs cursor-pointer"
                  >
                    PNG (Lossless)
                  </Button>
                  <Button
                    variant={exportFormat === "jpeg" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setExportFormat("jpeg")}
                    className="text-xs cursor-pointer"
                  >
                    JPG (Marketplace Web)
                  </Button>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    onClick={handleDownload}
                    className="w-full gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold cursor-pointer shadow-md"
                  >
                    <Download className="w-4 h-4" /> {isAdMode ? "Download Commercial Ad" : "Download Commercial Photo"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadCutout}
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    Export Isolated Transparent PNG
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
