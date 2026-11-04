"use client";

import * as React from "react";
import {
  Archive,
  ArrowRight,
  Check,
  Download,
  FileArchive,
  FileEdit,
  Grid,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  Monitor,
  Play,
  Plus,
  RefreshCw,
  Server,
  Sliders,
  Sparkles,
  Stamp,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ServerBatchPanel } from "@/components/batch-server-mode";
import { downloadBlob } from "@/lib/screenshot";
import {
  type BatchItem,
  type BatchRenameOptions,
  type BatchResizeOptions,
  type BatchWatermarkOptions,
  type WatermarkPosition,
  bundleBatchZip,
  computeRenamedFilename,
  processBatchImage,
} from "@/lib/batch-processor";

const DEFAULT_RENAME: BatchRenameOptions = {
  pattern: "{name}-{0index}",
  findText: "",
  replaceText: "",
  caseTransform: "none",
  prefix: "",
  suffix: "",
  startIndex: 1,
};

const DEFAULT_WATERMARK: BatchWatermarkOptions = {
  enabled: true,
  type: "text",
  text: "© PicTools",
  fontFamily: "sans-serif",
  fontSizePercent: 5,
  color: "#ffffff",
  opacity: 75,
  position: "bottom-right",
  logoScalePercent: 20,
};

const DEFAULT_RESIZE: BatchResizeOptions = {
  mode: "original",
  maxDimension: 1920,
  scalePercent: 100,
  format: "original",
  quality: 0.9,
};

const POSITIONS: { id: WatermarkPosition; label: string }[] = [
  { id: "top-left", label: "Top Left" },
  { id: "top-center", label: "Top Center" },
  { id: "top-right", label: "Top Right" },
  { id: "center-left", label: "Center Left" },
  { id: "center", label: "Center" },
  { id: "center-right", label: "Center Right" },
  { id: "bottom-left", label: "Bottom Left" },
  { id: "bottom-center", label: "Bottom Center" },
  { id: "bottom-right", label: "Bottom Right" },
];

export function BatchTool() {
  const [items, setItems] = React.useState<BatchItem[]>([]);
  const [renameOpts, setRenameOpts] = React.useState<BatchRenameOptions>(DEFAULT_RENAME);
  const [watermarkOpts, setWatermarkOpts] = React.useState<BatchWatermarkOptions>(DEFAULT_WATERMARK);
  const [resizeOpts, setResizeOpts] = React.useState<BatchResizeOptions>(DEFAULT_RESIZE);
  const [activeTab, setActiveTab] = React.useState<"rename" | "watermark" | "resize">("rename");
  /**
   * "browser" runs the Canvas pipeline locally; "server" uploads the whole
   * batch and lets the backend process it as real jobs.
   */
  const [mode, setMode] = React.useState<"browser" | "server">("browser");

  // Logo file state
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoImg, setLogoImg] = React.useState<HTMLImageElement | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progressPercent, setProgressPercent] = React.useState(0);
  const [processedCount, setProcessedCount] = React.useState(0);
  const [zipBlob, setZipBlob] = React.useState<Blob | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const logoInputRef = React.useRef<HTMLInputElement | null>(null);

  // Recompute renamed names whenever items or renameOpts change
  const updatedItems = React.useMemo(() => {
    return items.map((item, idx) => ({
      ...item,
      renamedName: computeRenamedFilename(item.originalName, idx, renameOpts, resizeOpts.format),
    }));
  }, [items, renameOpts, resizeOpts.format]);

  // Handle incoming files from dropzone
  const handleAddFiles = (files: File[]) => {
    if (files.length === 0) return;
    const newItems: BatchItem[] = files.map((f, i) => {
      const url = URL.createObjectURL(f);
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${i}`,
        file: f,
        previewUrl: url,
        width: 0,
        height: 0,
        originalName: f.name,
        renamedName: f.name,
        status: "pending",
      };
    });

    setItems((prev) => [...prev, ...newItems]);
    setZipBlob(null);
    toast.success(`Added ${files.length} photo${files.length > 1 ? "s" : ""} to batch queue`);
  };

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setLogoImg(img);
      setWatermarkOpts((prev) => ({ ...prev, logoImg: img }));
      toast.success("Logo watermark loaded");
    };
    img.src = url;
  };

  // Run Batch Processing
  const handleStartProcessing = async () => {
    if (updatedItems.length === 0) {
      toast.error("Please add photos to the batch queue first");
      return;
    }

    setIsProcessing(true);
    setProgressPercent(0);
    setProcessedCount(0);
    setZipBlob(null);

    const total = updatedItems.length;
    const processedItems: BatchItem[] = [...updatedItems];

    for (let i = 0; i < total; i++) {
      processedItems[i] = { ...processedItems[i], status: "processing" };
      setItems([...processedItems]);

      try {
        // Load image into HTMLImageElement
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load ${processedItems[i].originalName}`));
          img.src = processedItems[i].previewUrl;
        });

        // Run client-side watermark + resize + conversion
        const blob = await processBatchImage(
          img,
          { ...watermarkOpts, logoImg },
          resizeOpts,
          processedItems[i].file.type || "image/jpeg",
        );

        processedItems[i] = {
          ...processedItems[i],
          status: "done",
          processedBlob: blob,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Processing failed";
        processedItems[i] = {
          ...processedItems[i],
          status: "error",
          errorMessage: msg,
        };
      }

      setProcessedCount(i + 1);
      setProgressPercent(Math.round(((i + 1) / total) * 100));
      setItems([...processedItems]);
    }

    // Bundle into single ZIP Blob
    try {
      const zip = await bundleBatchZip(processedItems);
      setZipBlob(zip);
      toast.success(`Successfully processed ${total} photos! Ready for ZIP download.`);
    } catch {
      toast.error("Failed to bundle batch into ZIP");
    } finally {
      setIsProcessing(false);
    }
  };

  // Download All as ZIP
  const handleDownloadZip = () => {
    if (!zipBlob) return;
    downloadBlob(zipBlob, `batch-photos-${Date.now()}.zip`);
    toast.success("Downloaded batch ZIP package!");
  };

  // Download single item
  const handleDownloadItem = (item: BatchItem) => {
    if (!item.processedBlob) return;
    downloadBlob(item.processedBlob, item.renamedName);
    toast.success(`Downloaded ${item.renamedName}`);
  };

  const handleClearQueue = () => {
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setItems([]);
    setZipBlob(null);
    setProcessedCount(0);
    setProgressPercent(0);
    toast.info("Cleared batch queue");
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <AuthGate>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Stamp className="w-6 h-6" />
              </span>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Batch Watermark & Bulk Renamer
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              {mode === "server"
                ? "Upload the whole batch at once and let the server process every file as its own job."
                : "Stamp watermarks, bulk rename files with custom patterns, resize dimensions, and export everything into a ZIP file."}
            </p>
          </div>

          {items.length > 0 && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Photos
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleAddFiles(Array.from(e.target.files));
                }}
              />

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearQueue}
                disabled={isProcessing}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Clear
              </Button>

              {mode === "browser" &&
                (zipBlob ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleDownloadZip}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    Download ZIP ({updatedItems.filter((i) => i.status === "done").length} files)
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleStartProcessing}
                    disabled={isProcessing}
                    className="gap-1.5 shadow-md"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing ({processedCount}/{items.length})...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Process Batch ({items.length})
                      </>
                    )}
                  </Button>
                ))}
            </div>
          )}
        </div>

        {/* Mode switch */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border w-fit mb-6">
          <Button
            size="sm"
            variant={mode === "browser" ? "default" : "ghost"}
            onClick={() => setMode("browser")}
            className="gap-1.5 text-xs rounded-lg"
          >
            <Monitor className="w-3.5 h-3.5" />
            In browser
          </Button>
          <Button
            size="sm"
            variant={mode === "server" ? "default" : "ghost"}
            onClick={() => setMode("server")}
            className="gap-1.5 text-xs rounded-lg"
          >
            <Server className="w-3.5 h-3.5" />
            On the server
          </Button>
        </div>

        {/* Processing Progress Bar */}
        {isProcessing && (
          <div className="mb-6 p-4 rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium mb-2">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                Processing photo {processedCount + 1} of {items.length}...
              </span>
              <span className="font-mono">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Empty State / Initial Dropzone */}
        {items.length === 0 ? (
          <div className="max-w-2xl mx-auto my-12">
            <Dropzone
              kind="image"
              multiple={true}
              onFiles={handleAddFiles}
            />
          </div>
        ) : mode === "server" ? (
          <ServerBatchPanel
            files={updatedItems.map((item) => ({
              id: item.id,
              file: item.file,
              originalName: item.originalName,
            }))}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Configuration Panels */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              {/* Configuration Navigation */}
              <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border">
                <Button
                  size="sm"
                  variant={activeTab === "rename" ? "default" : "ghost"}
                  onClick={() => setActiveTab("rename")}
                  className="gap-1.5 text-xs flex-1 rounded-lg"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Bulk Rename</span>
                  <span className="sm:hidden">Rename</span>
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "watermark" ? "default" : "ghost"}
                  onClick={() => setActiveTab("watermark")}
                  className="gap-1.5 text-xs flex-1 rounded-lg"
                >
                  <Stamp className="w-3.5 h-3.5" />
                  <span>Watermark</span>
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "resize" ? "default" : "ghost"}
                  onClick={() => setActiveTab("resize")}
                  className="gap-1.5 text-xs flex-1 rounded-lg"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Resize & Export</span>
                  <span className="sm:hidden">Resize</span>
                </Button>
              </div>

              {/* Tab 1: Bulk Renamer Config */}
              {activeTab === "rename" && (
                <div className="bg-card border rounded-2xl p-5 shadow-sm flex flex-col gap-5">
                  <div>
                    <h3 className="font-semibold text-sm">Filename Pattern Template</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Define a naming structure using tokens like original name, index counter, and shoot date.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Pattern</Label>
                    <Input
                      value={renameOpts.pattern}
                      onChange={(e) => setRenameOpts({ ...renameOpts, pattern: e.target.value })}
                      className="font-mono text-xs"
                      placeholder="{name}-{0index}"
                    />
                    {/* Quick Insert Tokens */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                      <span className="text-[11px] text-muted-foreground mr-1">Insert:</span>
                      {[
                        { token: "{name}", label: "Original Name" },
                        { token: "{0index}", label: "01, 02..." },
                        { token: "{00index}", label: "001, 002..." },
                        { token: "{date}", label: "YYYYMMDD" },
                      ].map(({ token, label }) => (
                        <Badge
                          key={token}
                          variant="secondary"
                          className="font-mono text-[10px] cursor-pointer hover:bg-primary/20 transition-colors"
                          onClick={() => setRenameOpts({ ...renameOpts, pattern: renameOpts.pattern + token })}
                          title={`Click to add ${token}`}
                        >
                          {token}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Start Index & Prefix / Suffix */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Start Index</Label>
                      <Input
                        type="number"
                        min={0}
                        value={renameOpts.startIndex}
                        onChange={(e) => setRenameOpts({ ...renameOpts, startIndex: parseInt(e.target.value) || 1 })}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Case Transform</Label>
                      <select
                        value={renameOpts.caseTransform}
                        onChange={(e) => setRenameOpts({ ...renameOpts, caseTransform: e.target.value as any })}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs"
                      >
                        <option value="none">Keep Original Case</option>
                        <option value="lower">lowercase</option>
                        <option value="upper">UPPERCASE</option>
                        <option value="title">Title Case</option>
                      </select>
                    </div>
                  </div>

                  {/* Find and Replace */}
                  <div className="border-t pt-4 space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground">Find & Replace (Optional)</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Find text</Label>
                        <Input
                          value={renameOpts.findText}
                          onChange={(e) => setRenameOpts({ ...renameOpts, findText: e.target.value })}
                          placeholder="e.g. IMG_"
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Replace with</Label>
                        <Input
                          value={renameOpts.replaceText}
                          onChange={(e) => setRenameOpts({ ...renameOpts, replaceText: e.target.value })}
                          placeholder="e.g. Shoot_"
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Watermark Config */}
              {activeTab === "watermark" && (
                <div className="bg-card border rounded-2xl p-5 shadow-sm flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">Watermark Settings</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Stamp text or transparent logo across all photos.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={watermarkOpts.enabled ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setWatermarkOpts({ ...watermarkOpts, enabled: !watermarkOpts.enabled })}
                    >
                      {watermarkOpts.enabled ? "Enabled" : "Disabled"}
                    </Button>
                  </div>

                  {watermarkOpts.enabled && (
                    <>
                      {/* Watermark Type Selector */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={watermarkOpts.type === "text" ? "secondary" : "ghost"}
                          className="h-8 text-xs flex-1"
                          onClick={() => setWatermarkOpts({ ...watermarkOpts, type: "text" })}
                        >
                          Text Watermark
                        </Button>
                        <Button
                          size="sm"
                          variant={watermarkOpts.type === "logo" ? "secondary" : "ghost"}
                          className="h-8 text-xs flex-1"
                          onClick={() => setWatermarkOpts({ ...watermarkOpts, type: "logo" })}
                        >
                          Logo Graphic
                        </Button>
                      </div>

                      {watermarkOpts.type === "text" ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">Watermark Text</Label>
                            <Input
                              value={watermarkOpts.text}
                              onChange={(e) => setWatermarkOpts({ ...watermarkOpts, text: e.target.value })}
                              placeholder="© Your Name / Brand"
                              className="text-xs"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs font-medium">Font Family</Label>
                              <select
                                value={watermarkOpts.fontFamily}
                                onChange={(e) => setWatermarkOpts({ ...watermarkOpts, fontFamily: e.target.value })}
                                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs"
                              >
                                <option value="sans-serif">Sans-serif</option>
                                <option value="serif">Serif</option>
                                <option value="monospace">Monospace</option>
                                <option value="cursive">Script / Cursive</option>
                                <option value="Impact">Bold Impact</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs font-medium">Color</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={watermarkOpts.color}
                                  onChange={(e) => setWatermarkOpts({ ...watermarkOpts, color: e.target.value })}
                                  className="w-8 h-9 rounded cursor-pointer border p-0.5 bg-transparent"
                                />
                                <span className="font-mono text-xs text-muted-foreground">{watermarkOpts.color}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Relative Font Size</span>
                              <span className="font-mono font-semibold">{watermarkOpts.fontSizePercent}%</span>
                            </div>
                            <Slider
                              min={2}
                              max={16}
                              step={1}
                              value={[watermarkOpts.fontSizePercent]}
                              onValueChange={(val) => setWatermarkOpts({ ...watermarkOpts, fontSizePercent: val[0] })}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">Upload Logo (PNG)</Label>
                            <div className="flex items-center gap-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 text-xs gap-1.5"
                                onClick={() => logoInputRef.current?.click()}
                              >
                                <Upload className="w-3.5 h-3.5" />
                                {logoFile ? logoFile.name : "Choose PNG Logo"}
                              </Button>
                              <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/png,image/webp,image/svg+xml"
                                className="hidden"
                                onChange={handleLogoUpload}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Logo Scale</span>
                              <span className="font-mono font-semibold">{watermarkOpts.logoScalePercent}%</span>
                            </div>
                            <Slider
                              min={5}
                              max={45}
                              step={5}
                              value={[watermarkOpts.logoScalePercent]}
                              onValueChange={(val) => setWatermarkOpts({ ...watermarkOpts, logoScalePercent: val[0] })}
                            />
                          </div>
                        </div>
                      )}

                      {/* Opacity Slider */}
                      <div className="space-y-1.5 pt-1 border-t">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Opacity</span>
                          <span className="font-mono font-semibold">{watermarkOpts.opacity}%</span>
                        </div>
                        <Slider
                          min={10}
                          max={100}
                          step={5}
                          value={[watermarkOpts.opacity]}
                          onValueChange={(val) => setWatermarkOpts({ ...watermarkOpts, opacity: val[0] })}
                        />
                      </div>

                      {/* Placement Grid */}
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium">Watermark Placement</Label>
                          <Button
                            size="sm"
                            variant={watermarkOpts.position === "tile" ? "secondary" : "ghost"}
                            className="h-6 text-[10px] px-2"
                            onClick={() => setWatermarkOpts({ ...watermarkOpts, position: "tile" })}
                          >
                            Tile Diagonal Repeat
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 max-w-[210px] mx-auto p-2 rounded-xl border bg-muted/20">
                          {POSITIONS.map((pos) => {
                            const isSelected = watermarkOpts.position === pos.id;
                            return (
                              <button
                                key={pos.id}
                                type="button"
                                onClick={() => setWatermarkOpts({ ...watermarkOpts, position: pos.id })}
                                className={`h-8 rounded-md text-[11px] font-medium transition-all ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground shadow"
                                    : "bg-card hover:bg-muted text-muted-foreground"
                                }`}
                                title={pos.label}
                              >
                                •
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tab 3: Resize & Format Config */}
              {activeTab === "resize" && (
                <div className="bg-card border rounded-2xl p-5 shadow-sm flex flex-col gap-5">
                  <div>
                    <h3 className="font-semibold text-sm">Resize & Format Conversion</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Optionally downscale dimensions and convert file formats.
                    </p>
                  </div>

                  {/* Mode selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Dimensions Mode</Label>
                    <select
                      value={resizeOpts.mode}
                      onChange={(e) => setResizeOpts({ ...resizeOpts, mode: e.target.value as any })}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs"
                    >
                      <option value="original">Original Dimensions (No Resize)</option>
                      <option value="max-dim">Max Dimension Constraint (Fit Box)</option>
                      <option value="scale">Percentage Scale</option>
                    </select>
                  </div>

                  {resizeOpts.mode === "max-dim" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Max Width / Height</span>
                        <span className="font-mono font-semibold">{resizeOpts.maxDimension} px</span>
                      </div>
                      <Slider
                        min={640}
                        max={3840}
                        step={160}
                        value={[resizeOpts.maxDimension]}
                        onValueChange={(val) => setResizeOpts({ ...resizeOpts, maxDimension: val[0] })}
                      />
                    </div>
                  )}

                  {resizeOpts.mode === "scale" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Scale</span>
                        <span className="font-mono font-semibold">{resizeOpts.scalePercent}%</span>
                      </div>
                      <Slider
                        min={10}
                        max={100}
                        step={5}
                        value={[resizeOpts.scalePercent]}
                        onValueChange={(val) => setResizeOpts({ ...resizeOpts, scalePercent: val[0] })}
                      />
                    </div>
                  )}

                  {/* Output Format */}
                  <div className="space-y-1.5 border-t pt-4">
                    <Label className="text-xs font-medium">Output Format</Label>
                    <select
                      value={resizeOpts.format}
                      onChange={(e) => setResizeOpts({ ...resizeOpts, format: e.target.value as any })}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs"
                    >
                      <option value="original">Keep Original Format</option>
                      <option value="jpeg">Convert all to JPG</option>
                      <option value="png">Convert all to PNG</option>
                      <option value="webp">Convert all to WebP</option>
                    </select>
                  </div>

                  {/* Quality */}
                  {resizeOpts.format !== "png" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Compression Quality</span>
                        <span className="font-mono font-semibold">{Math.round(resizeOpts.quality * 100)}%</span>
                      </div>
                      <Slider
                        min={30}
                        max={100}
                        step={5}
                        value={[Math.round(resizeOpts.quality * 100)]}
                        onValueChange={(val) => setResizeOpts({ ...resizeOpts, quality: val[0] / 100 })}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Live Batch Preview & File List */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base">Batch Queue</h3>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {updatedItems.length} photos
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  Live preview of original vs renamed filenames
                </span>
              </div>

              {/* Items Table Card */}
              <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                <div className="max-h-[620px] overflow-y-auto divide-y divide-border">
                  {updatedItems.map((item, idx) => {
                    return (
                      <div
                        key={item.id}
                        className="p-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                      >
                        {/* Thumbnail & Names */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.previewUrl}
                            alt="Thumb"
                            className="w-12 h-12 rounded-lg object-cover border shrink-0 bg-muted"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                              <span className="truncate max-w-[110px] sm:max-w-[180px] md:max-w-[260px]">{item.originalName}</span>
                              <ArrowRight className="w-3 h-3 shrink-0" />
                            </div>
                            <div className="font-mono font-semibold text-xs text-foreground truncate max-w-[140px] sm:max-w-[220px] md:max-w-[300px] mt-0.5">
                              {item.renamedName}
                            </div>
                          </div>
                        </div>

                        {/* Status & Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === "pending" && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Ready
                            </Badge>
                          )}
                          {item.status === "processing" && (
                            <Badge variant="secondary" className="text-[10px] gap-1 text-primary">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Processing
                            </Badge>
                          )}
                          {item.status === "done" && (
                            <div className="flex items-center gap-1.5">
                              <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                                <Check className="w-3 h-3 mr-1" />
                                Done
                              </Badge>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                onClick={() => handleDownloadItem(item)}
                                title="Download single file"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                          {item.status === "error" && (
                            <Badge variant="destructive" className="text-[10px]">
                              Error
                            </Badge>
                          )}

                          {!isProcessing && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 text-muted-foreground hover:text-destructive opacity-50 hover:opacity-100"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
