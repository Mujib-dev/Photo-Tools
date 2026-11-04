"use client";

import * as React from "react";
import Link from "next/link";
import {
  Briefcase,
  Check,
  Columns,
  Download,
  Eye,
  Loader2,
  RotateCcw,
  Sliders,
  Sparkles,
  Sun,
  Upload,
  UserCheck,
} from "lucide-react";

import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { Slider } from "@/components/ui/slider";
import {
  HEADSHOT_BACKDROPS,
  renderHeadshot,
  type HeadshotBackdrop,
  type HeadshotLighting,
  type HeadshotOptions,
} from "@/lib/headshot-engine";
import { cn } from "@/lib/utils";

export function HeadshotTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [rawImageUrl, setRawImageUrl] = React.useState<string | null>(null);
  const [resultDataUrl, setResultDataUrl] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [splitPos, setSplitPos] = React.useState(50);
  const [isComparing, setIsComparing] = React.useState(true);

  // Settings
  const [options, setOptions] = React.useState<HeadshotOptions>({
    backdrop: "city-skyline",
    lighting: "warm-executive",
    rimLightIntensity: 0.5,
    contrastBoost: 1.05,
    smoothSkin: true,
    aspectRatio: "1:1",
  });

  const sourceImgRef = React.useRef<HTMLImageElement | null>(null);

  // Clean up object URLs
  React.useEffect(() => {
    return () => {
      if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    };
  }, [rawImageUrl]);

  const handleSelectFile = (f: File) => {
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    setFile(f);
    const url = URL.createObjectURL(f);
    setRawImageUrl(url);
    setResultDataUrl(null);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      sourceImgRef.current = img;
      await processHeadshot(img, options);
    };
    img.src = url;
  };

  const processHeadshot = async (img: HTMLImageElement, opts: HeadshotOptions) => {
    setIsProcessing(true);
    try {
      const renderedCanvas = await renderHeadshot(img, opts);
      setResultDataUrl(renderedCanvas.toDataURL("image/jpeg", 0.95));
    } catch (err) {
      console.error("Failed to render headshot:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateOption = <K extends keyof HeadshotOptions>(key: K, val: HeadshotOptions[K]) => {
    const updated = { ...options, [key]: val };
    setOptions(updated);
    if (sourceImgRef.current) {
      processHeadshot(sourceImgRef.current, updated);
    }
  };

  const handleDownload = () => {
    if (!resultDataUrl) return;
    const a = document.createElement("a");
    a.href = resultDataUrl;
    a.download = `professional-headshot-${options.aspectRatio.replace(":", "x")}.jpg`;
    a.click();
  };

  return (
    <AuthGate>
      <div className="container max-w-5xl py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-xs text-primary mb-3">
            <Briefcase className="h-3.5 w-3.5" />
            AI Corporate & Executive Headshot Studio
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            AI Professional Headshot Studio
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base max-w-2xl">
            Turn everyday selfies and phone portraits into LinkedIn-ready executive headshots.
            Includes architectural studio backdrops, directional rim lighting, and business framing.
          </p>
        </div>

        {/* Studio Workspace */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Column: Visual Canvas & Split Comparison */}
          <div className="space-y-6 lg:col-span-7">
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 sm:p-5 shadow-xs space-y-4">
              {!rawImageUrl ? (
                <div>
                  <Dropzone
                    kind="image"
                    onFiles={(files) => {
                      if (files.length > 0) handleSelectFile(files[0]);
                    }}
                  />
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Upload any portrait, selfie, or headshot photo (JPG, PNG, WEBP).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground truncate max-w-[200px]">
                      {file?.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsComparing(!isComparing)}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline cursor-pointer"
                      >
                        <Columns className="h-3 w-3" />
                        {isComparing ? "Side Split" : "Final Only"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          setRawImageUrl(null);
                          setResultDataUrl(null);
                        }}
                        className="font-mono text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        Change Photo
                      </button>
                    </div>
                  </div>

                  {/* Interactive Split Viewport */}
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-xl border border-outline-variant/25 bg-black/80 mx-auto select-none",
                      options.aspectRatio === "1:1"
                        ? "aspect-square max-w-[500px]"
                        : options.aspectRatio === "4:5"
                        ? "aspect-[4/5] max-w-[440px]"
                        : options.aspectRatio === "3:4"
                        ? "aspect-[3/4] max-w-[420px]"
                        : "aspect-video max-w-[540px]",
                    )}
                  >
                    {/* Rendered Headshot (Underneath) */}
                    {resultDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resultDataUrl}
                        alt="AI Headshot"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}

                    {/* Raw Original (Overlaid with clip-path if comparing) */}
                    {isComparing && rawImageUrl && (
                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={{ clipPath: `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={rawImageUrl}
                          alt="Original"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute top-3 left-3 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white">
                          Original
                        </div>
                      </div>
                    )}

                    {/* Split line scrubber */}
                    {isComparing && (
                      <>
                        <div
                          className="absolute inset-y-0 w-0.5 bg-white shadow-lg pointer-events-none"
                          style={{ left: `${splitPos}%` }}
                        />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-xl pointer-events-none text-xs font-bold"
                          style={{ left: `${splitPos}%` }}
                        >
                          ↔
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={splitPos}
                          onChange={(e) => setSplitPos(Number(e.target.value))}
                          className="absolute inset-0 opacity-0 cursor-ew-resize h-full w-full z-10"
                        />
                      </>
                    )}

                    {/* Badge */}
                    <div className="absolute top-3 right-3 rounded-full bg-primary/90 px-2 py-0.5 font-mono text-[10px] text-primary-foreground font-semibold shadow-xs">
                      AI Studio Headshot
                    </div>
                  </div>
                </div>
              )}

              {isProcessing && (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-primary font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rendering Studio Lighting &amp; Composition...
                </div>
              )}
            </div>

            {/* Backdrops Selection */}
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Executive Studio Backdrops
                </h2>
                <span className="font-mono text-[10px] text-primary">6 Backdrops</span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {HEADSHOT_BACKDROPS.map((bd) => {
                  const isSelected = options.backdrop === bd.id;
                  return (
                    <button
                      key={bd.id}
                      type="button"
                      onClick={() => updateOption("backdrop", bd.id)}
                      className={cn(
                        "flex flex-col items-start rounded-xl border p-2.5 text-left transition-all cursor-pointer relative",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary"
                          : "border-outline-variant/25 bg-surface-container-low hover:border-primary/40",
                      )}
                    >
                      <span className="font-display text-xs font-bold text-foreground">
                        {bd.name}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                        {bd.badge}
                      </span>
                      <p className="mt-1 text-[10px] text-muted-foreground line-clamp-1">
                        {bd.tagline}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Lighting & Studio Adjustments */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-xs space-y-4">
              <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                Studio Lighting &amp; Framing
              </h3>

              {/* Aspect Ratio Presets */}
              <div className="space-y-2">
                <label className="block font-mono text-xs text-muted-foreground">
                  Target Framing &amp; Format
                </label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {(["1:1", "4:5", "3:4", "16:9"] as const).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => updateOption("aspectRatio", ratio)}
                      className={cn(
                        "rounded-lg border py-2 text-center font-mono text-xs font-semibold transition-colors cursor-pointer",
                        options.aspectRatio === ratio
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-outline-variant/30 text-on-surface-variant hover:border-primary/50",
                      )}
                    >
                      {ratio}
                      <span className="block text-[9px] font-normal opacity-80">
                        {ratio === "1:1"
                          ? "LinkedIn"
                          : ratio === "4:5"
                          ? "Resume/CV"
                          : ratio === "3:4"
                          ? "ID Badge"
                          : "Website"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lighting Mood Profile */}
              <div className="space-y-2 pt-2 border-t border-outline-variant/15">
                <label className="block font-mono text-xs text-muted-foreground">
                  Studio Lighting Profile
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "neutral-daylight", label: "☀️ Neutral Daylight", desc: "5500K balanced" },
                    { id: "warm-executive", label: "☕ Warm Executive", desc: "4500K golden hour" },
                    { id: "cool-modern", label: "❄️ Cool Modern", desc: "6500K high-tech" },
                    { id: "studio-dramatic", label: "🎭 Studio Dramatic", desc: "Key & fill contrast" },
                  ].map((lt) => (
                    <button
                      key={lt.id}
                      type="button"
                      onClick={() => updateOption("lighting", lt.id as HeadshotLighting)}
                      className={cn(
                        "rounded-lg border p-2 text-left text-xs transition-colors cursor-pointer",
                        options.lighting === lt.id
                          ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                          : "border-outline-variant/25 hover:border-primary/40",
                      )}
                    >
                      <span>{lt.label}</span>
                      <span className="block font-mono text-[9px] text-muted-foreground mt-0.5">
                        {lt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders: Rim Glow & Contrast */}
              <div className="space-y-4 pt-2 border-t border-outline-variant/15">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant flex items-center gap-1">
                      <Sun className="h-3.5 w-3.5" />
                      Directional Rim Glow
                    </span>
                    <span className="font-mono font-semibold text-primary">
                      {Math.round(options.rimLightIntensity * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[options.rimLightIntensity]}
                    min={0}
                    max={1}
                    step={0.05}
                    onValueChange={([v]) => updateOption("rimLightIntensity", v)}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      Portrait Contrast &amp; Depth
                    </span>
                    <span className="font-mono font-semibold text-primary">
                      {options.contrastBoost.toFixed(2)}x
                    </span>
                  </div>
                  <Slider
                    value={[options.contrastBoost]}
                    min={0.85}
                    max={1.25}
                    step={0.05}
                    onValueChange={([c]) => updateOption("contrastBoost", c)}
                  />
                </div>
              </div>

              {/* Download Action */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!resultDataUrl}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-semibold shadow-md transition-all cursor-pointer",
                    !resultDataUrl
                      ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/95 active:scale-[0.99]",
                  )}
                >
                  <Download className="h-4 w-4" />
                  Download Executive Headshot (HD)
                </button>
              </div>
            </div>

            {/* Related Tools */}
            <div className="rounded-xl border border-outline-variant/15 bg-muted/20 p-4 text-xs space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                More Portrait Studio Tools
              </p>
              <div className="flex flex-col gap-1.5">
                <Link
                  href="/passport"
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-muted text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span>🪪 Passport &amp; Visa Photo Studio</span>
                  <UserCheck className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/upscale"
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-muted text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span>🔍 AI Super-Resolution &amp; Face Restorer</span>
                  <Sparkles className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/remove-bg"
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-muted text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span>✂️ AI Background Remover</span>
                  <Sparkles className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
