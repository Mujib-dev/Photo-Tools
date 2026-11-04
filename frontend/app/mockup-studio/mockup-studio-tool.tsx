"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  Smartphone,
  Laptop,
  Globe,
  Tablet,
  Upload,
  Download,
  RotateCcw,
  Sparkles,
  Layers,
  Palette,
  Check,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { isShareSupported, shareBlob } from "@/lib/share";
import {
  DEFAULT_MOCKUP_CONFIG,
  MockupConfig,
  MockupDevice,
  drawBrowserMockup,
  drawIpadMockup,
  drawIphoneMockup,
  drawMacbookMockup,
  drawMockupBackground,
} from "@/lib/mockup-engine";

export function MockupStudioTool() {
  const [config, setConfig] = useState<MockupConfig>(DEFAULT_MOCKUP_CONFIG);
  const [screenImg, setScreenImg] = useState<HTMLImageElement | null>(null);

  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft<MockupConfig>(
    "mockup-studio",
    config,
    (saved) => setConfig(saved),
  );

  const [shareSupported, setShareSupported] = useState(false);
  useEffect(() => {
    setShareSupported(isShareSupported());
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  // Load uploaded screenshot
  const handleScreenshotSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setScreenImg(img);
      toast.success("Loaded screenshot into device frame!");
    };
    img.src = url;
  };

  // Render Mockup Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = config.canvasWidth;
    canvas.height = config.canvasHeight;

    // 1. Draw Background
    drawMockupBackground(ctx, canvas.width, canvas.height, config);

    // 2. Draw Selected Device Frame
    if (config.device === "iphone16") {
      drawIphoneMockup(ctx, canvas.width, canvas.height, screenImg, config.shadowBlur);
    } else if (config.device === "macbook") {
      drawMacbookMockup(ctx, canvas.width, canvas.height, screenImg, config.shadowBlur);
    } else if (config.device === "ipad") {
      drawIpadMockup(ctx, canvas.width, canvas.height, screenImg, config.shadowBlur);
    } else if (config.device === "browser") {
      drawBrowserMockup(ctx, canvas.width, canvas.height, screenImg, config.shadowBlur);
    }
  }, [config, screenImg]);

  // Download High-Res Mockup
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `3d-mockup-${config.device}-${Date.now()}.png`;
    a.click();
    toast.success("Downloaded high-res 3D device mockup!");
  };

  const handleShare = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const filename = `3d-mockup-${config.device}-${Date.now()}.png`;
      const shared = await shareBlob(blob, filename, {
        title: filename,
        text: "3D Mockup created with PicTools",
      });
      if (shared) toast.success("Shared successfully!");
    }, "image/png");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
          <Smartphone className="h-3.5 w-3.5" />
          Product Marketing & App Packaging
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          3D Device Mockup Studio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Wrap your app screenshots, websites, and designs inside realistic iPhone 16 Pro, MacBook Pro, and browser frames with dynamic shadows and gradient backdrops.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Canvas Preview */}
        <div className="space-y-4 lg:col-span-8">
          <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-border/80 bg-black/60 shadow-2xl p-2 flex items-center justify-center">
            <canvas ref={canvasRef} className="h-full w-full object-contain rounded-2xl" />
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition"
            >
              <Upload className="h-4 w-4" />
              {screenImg ? "Replace Screenshot" : "Upload Screenshot"}
            </button>
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleScreenshotSelect(e.target.files[0])}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 transition"
              >
                <Download className="h-4 w-4" />
                Download (PNG)
              </button>
              {shareSupported && (
                <button
                  type="button"
                  onClick={() => handleShare()}
                  className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition"
                  title="Share"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Device & Backdrop Customizer */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
            {/* Device Frame Selector */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Device Frame
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "iphone16", label: "iPhone", icon: Smartphone },
                  { id: "ipad", label: "iPad", icon: Tablet },
                  { id: "macbook", label: "MacBook", icon: Laptop },
                  { id: "browser", label: "Browser", icon: Globe },
                ].map((d) => {
                  const Icon = d.icon;
                  const active = config.device === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setConfig({ ...config, device: d.id as MockupDevice })}
                      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-2.5 text-center transition ${
                        active
                          ? "border-indigo-500 bg-indigo-500/10 text-foreground ring-1 ring-indigo-500/40"
                          : "border-border/60 bg-background hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[11px] font-semibold">{d.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Background Style */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Background Theme
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "gradient-mesh", label: "Mesh Gradient" },
                  { id: "dark-studio", label: "Dark Studio" },
                  { id: "sunset", label: "Sunset Flare" },
                  { id: "cyberpunk", label: "Cyberpunk Neon" },
                  { id: "aurora", label: "Aurora Borealis" },
                  { id: "nordic", label: "Nordic Frost" },
                  { id: "warm-mocha", label: "Warm Mocha" },
                  { id: "transparent", label: "Transparent PNG" },
                ].map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setConfig({ ...config, backgroundType: bg.id as any })}
                    className={`rounded-xl border p-2 text-xs font-semibold text-left transition ${
                      config.backgroundType === bg.id
                        ? "border-indigo-500 bg-indigo-500/10 text-foreground"
                        : "border-border/60 bg-background hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drop Shadow Slider */}
            <div className="pt-2 border-t border-border/40 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Realistic Drop Shadow</span>
                <span className="font-mono">{config.shadowBlur}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                value={config.shadowBlur}
                onChange={(e) =>
                  setConfig({ ...config, shadowBlur: parseInt(e.target.value, 10) })
                }
                className="w-full accent-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
