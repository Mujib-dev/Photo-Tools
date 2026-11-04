"use client";

import * as React from "react";
import {
  Check,
  Code2,
  Copy,
  Download,
  FileCode,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  RefreshCw,
  Scale,
  Sliders,
  Sparkles,
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
  type VectorizeMode,
  type VectorizeOptions,
  type VectorizeResult,
  DEFAULT_VECTORIZE_OPTIONS,
  svgToReactComponent,
  traceImageToSvg,
} from "@/lib/vectorizer";

export function VectorizeTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [imgUrl, setImgUrl] = React.useState<string | null>(null);
  const [options, setOptions] = React.useState<VectorizeOptions>(DEFAULT_VECTORIZE_OPTIONS);
  const [result, setResult] = React.useState<VectorizeResult | null>(null);
  const [isTracing, setIsTracing] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<"preview" | "code" | "react">("preview");

  const imgRef = React.useRef<HTMLImageElement | null>(null);

  const runVectorization = React.useCallback((img: HTMLImageElement, opts: VectorizeOptions) => {
    setIsTracing(true);
    // Allow UI to update before executing synchronous contour tracing
    setTimeout(() => {
      try {
        const res = traceImageToSvg(img, opts);
        setResult(res);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Vectorization failed";
        toast.error(msg);
      } finally {
        setIsTracing(false);
      }
    }, 20);
  }, []);

  const handleFileDrop = (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setFile(f);
    const url = URL.createObjectURL(f);
    setImgUrl(url);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      runVectorization(img, options);
      toast.success("Image loaded and vectorized into SVG!");
    };
    img.src = url;
  };

  const handleOptionChange = (newOpts: Partial<VectorizeOptions>) => {
    const updated = { ...options, ...newOpts };
    setOptions(updated);
    if (imgRef.current) {
      runVectorization(imgRef.current, updated);
    }
  };

  const handleCopy = (text: string, label: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDownloadSvg = () => {
    if (!result) return;
    const blob = new Blob([result.svgString], { type: "image/svg+xml;charset=utf-8" });
    const name = file ? file.name.replace(/\.[^/.]+$/, "") : "vectorized";
    downloadBlob(blob, `${name}.svg`);
    toast.success("Downloaded SVG file!");
  };

  const handleDownloadHighResPng = async (scale = 4) => {
    if (!result) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = result.width * scale;
      canvas.height = result.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      const svgBlob = new Blob([result.svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            const name = file ? file.name.replace(/\.[^/.]+$/, "") : "vectorized";
            downloadBlob(pngBlob, `${name}-${scale}x.png`);
            toast.success(`Downloaded ${scale}x High-Res PNG!`);
          }
        }, "image/png");
      };
      img.src = url;
    } catch {
      toast.error("Failed to render high-res PNG");
    }
  };

  return (
    <AuthGate>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Zap className="w-6 h-6" />
              </span>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Bitmap to SVG Vectorizer & Tracer
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Trace raster logos, icons, signatures, and sketches into infinitely scalable, lightweight SVG vector graphics.
            </p>
          </div>

          {result && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadHighResPng(4)}
                className="gap-1.5"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                Export 4x PNG
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadSvg}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <Download className="w-4 h-4" />
                Download SVG
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
            {/* Left Column: Side-by-Side Comparison Workspace */}
            <div className="lg:col-span-8 flex flex-col gap-5">
              <div className="bg-card border rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b mb-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={activeTab === "preview" ? "default" : "ghost"}
                      onClick={() => setActiveTab("preview")}
                      className="h-8 text-xs gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Vector Preview
                    </Button>
                    <Button
                      size="sm"
                      variant={activeTab === "code" ? "default" : "ghost"}
                      onClick={() => setActiveTab("code")}
                      className="h-8 text-xs gap-1.5"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      SVG Markup
                    </Button>
                    <Button
                      size="sm"
                      variant={activeTab === "react" ? "default" : "ghost"}
                      onClick={() => setActiveTab("react")}
                      className="h-8 text-xs gap-1.5"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      React JSX
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setImgUrl(null);
                      setFile(null);
                      setResult(null);
                      imgRef.current = null;
                    }}
                  >
                    Change Image
                  </Button>
                </div>

                {/* Tab 1: Vector Visual Preview */}
                {activeTab === "preview" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Original Raster */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                        <span>Original Raster Bitmap</span>
                        <span>{file?.name}</span>
                      </div>
                      <div className="h-[260px] sm:h-[340px] md:h-[420px] rounded-xl border bg-slate-950/20 p-4 flex items-center justify-center overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrl}
                          alt="Original"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    </div>

                    {/* Right: Scalable Vector SVG */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                          <Check className="w-3.5 h-3.5" />
                          Traced SVG Vector
                        </span>
                        {result && (
                          <span className="font-mono text-[11px]">
                            {result.width}&times;{result.height} px
                          </span>
                        )}
                      </div>
                      <div className="h-[260px] sm:h-[340px] md:h-[420px] rounded-xl border bg-white dark:bg-slate-950 p-4 flex items-center justify-center overflow-hidden relative shadow-inner">
                        {isTracing && (
                          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center gap-2 z-10">
                            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                            <span className="text-xs font-medium">Tracing vector contours...</span>
                          </div>
                        )}
                        {result && (
                          <div
                            className="max-h-full max-w-full flex items-center justify-center"
                            dangerouslySetInnerHTML={{ __html: result.svgString }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Raw SVG Code */}
                {activeTab === "code" && result && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Standard XML SVG Markup</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleCopy(result.svgString, "SVG Markup", "copy-svg")}
                      >
                        {copiedKey === "copy-svg" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        Copy SVG
                      </Button>
                    </div>
                    <pre className="p-4 rounded-xl border bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-[440px]">
                      {result.svgString}
                    </pre>
                  </div>
                )}

                {/* Tab 3: React JSX Component */}
                {activeTab === "react" && result && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">React / Next.js Component Code</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleCopy(svgToReactComponent(result.svgString), "React JSX", "copy-jsx")}
                      >
                        {copiedKey === "copy-jsx" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        Copy JSX Component
                      </Button>
                    </div>
                    <pre className="p-4 rounded-xl border bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-[440px]">
                      {svgToReactComponent(result.svgString)}
                    </pre>
                  </div>
                )}

                {/* Vector Metrics Bar */}
                {result && (
                  <div className="mt-4 pt-3 border-t grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-lg bg-muted/30">
                      <div className="text-[11px] text-muted-foreground">Vector Paths</div>
                      <div className="font-mono font-bold text-sm text-foreground">
                        {result.pathCount} paths
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <div className="text-[11px] text-muted-foreground">Color Layers</div>
                      <div className="font-mono font-bold text-sm text-foreground">
                        {result.colorCount} colors
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <div className="text-[11px] text-muted-foreground">File Size</div>
                      <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        {Number((result.byteSize / 1024).toFixed(1))} KB
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Tracing Controls Sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              {/* Tracing Mode */}
              <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  Tracing Mode
                </h3>

                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    size="sm"
                    variant={options.mode === "color" ? "default" : "outline"}
                    className={`h-9 text-xs flex-col py-1 ${
                      options.mode === "color" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                    }`}
                    onClick={() => handleOptionChange({ mode: "color" })}
                  >
                    <Palette className="w-3.5 h-3.5 mb-0.5" />
                    Color
                  </Button>
                  <Button
                    size="sm"
                    variant={options.mode === "monochrome" ? "default" : "outline"}
                    className={`h-9 text-xs flex-col py-1 ${
                      options.mode === "monochrome" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                    }`}
                    onClick={() => handleOptionChange({ mode: "monochrome" })}
                  >
                    <Scale className="w-3.5 h-3.5 mb-0.5" />
                    B&W
                  </Button>
                  <Button
                    size="sm"
                    variant={options.mode === "outline" ? "default" : "outline"}
                    className={`h-9 text-xs flex-col py-1 ${
                      options.mode === "outline" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                    }`}
                    onClick={() => handleOptionChange({ mode: "outline" })}
                  >
                    <Code2 className="w-3.5 h-3.5 mb-0.5" />
                    Outline
                  </Button>
                </div>

                {/* Mode Specific Controls */}
                {options.mode === "color" && (
                  <div className="space-y-1.5 pt-2 border-t">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Color Palette Depth</span>
                      <span className="font-mono font-semibold">{options.colors} Colors</span>
                    </div>
                    <Slider
                      min={2}
                      max={18}
                      step={1}
                      value={[options.colors]}
                      onValueChange={(val) => handleOptionChange({ colors: val[0] })}
                    />
                  </div>
                )}

                {(options.mode === "monochrome" || options.mode === "outline") && (
                  <div className="space-y-1.5 pt-2 border-t">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Contrast Threshold</span>
                      <span className="font-mono font-semibold">{options.threshold}</span>
                    </div>
                    <Slider
                      min={10}
                      max={240}
                      step={5}
                      value={[options.threshold]}
                      onValueChange={(val) => handleOptionChange({ threshold: val[0] })}
                    />
                  </div>
                )}

                {options.mode === "outline" && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Stroke Width</span>
                      <span className="font-mono font-semibold">{options.strokeWidth} px</span>
                    </div>
                    <Slider
                      min={0.5}
                      max={6}
                      step={0.5}
                      value={[options.strokeWidth]}
                      onValueChange={(val) => handleOptionChange({ strokeWidth: val[0] })}
                    />
                  </div>
                )}
              </div>

              {/* Curve Smoothing & Denoise */}
              <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  Path Geometry
                </h3>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Curve Smoothing</span>
                    <span className="font-mono font-semibold">
                      {options.smoothing === 0 ? "Polygon" : `Bézier Level ${options.smoothing}`}
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={4}
                    step={1}
                    value={[options.smoothing]}
                    onValueChange={(val) => handleOptionChange({ smoothing: val[0] })}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Speckle Noise Filter</span>
                    <span className="font-mono font-semibold">{options.filterSpeckles} px</span>
                  </div>
                  <Slider
                    min={0}
                    max={20}
                    step={1}
                    value={[options.filterSpeckles]}
                    onValueChange={(val) => handleOptionChange({ filterSpeckles: val[0] })}
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <Label className="text-xs font-medium cursor-pointer">Invert Foreground / Background</Label>
                  <Button
                    size="sm"
                    variant={options.invert ? "default" : "outline"}
                    className="h-6 text-xs px-2"
                    onClick={() => handleOptionChange({ invert: !options.invert })}
                  >
                    {options.invert ? "Inverted" : "Normal"}
                  </Button>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="font-semibold text-sm">Download & Export</h3>
                <Button
                  onClick={handleDownloadSvg}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Download Scalable .SVG
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => handleDownloadHighResPng(2)}
                  >
                    2x PNG
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => handleDownloadHighResPng(8)}
                  >
                    8x Ultra HD
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
