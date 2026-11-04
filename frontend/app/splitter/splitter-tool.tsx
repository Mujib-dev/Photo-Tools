"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns,
  Download,
  Eye,
  Grid,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Split,
  Trash2,
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
  type AspectRatioPreset,
  type CarouselOptions,
  type GridOptions,
  type SlicedTile,
  type SplitMode,
  bundleTilesZip,
  sliceCarousel,
  sliceGrid,
} from "@/lib/image-splitter";

const DEFAULT_CAROUSEL_OPTS: CarouselOptions = {
  slides: 3,
  aspectRatio: "4:5",
  format: "jpeg",
  quality: 0.92,
};

const DEFAULT_GRID_OPTS: GridOptions = {
  rows: 3,
  cols: 3,
  format: "jpeg",
  quality: 0.92,
  instagramOrder: true,
};

export function SplitterTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [imgUrl, setImgUrl] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<SplitMode>("carousel");
  const [carouselOpts, setCarouselOpts] = React.useState<CarouselOptions>(DEFAULT_CAROUSEL_OPTS);
  const [gridOpts, setGridOpts] = React.useState<GridOptions>(DEFAULT_GRID_OPTS);

  const [tiles, setTiles] = React.useState<SlicedTile[]>([]);
  const [isSlicing, setIsSlicing] = React.useState(false);
  const [swipeIndex, setSwipeIndex] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<"tiles" | "simulator">("tiles");

  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const touchStartXRef = React.useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartXRef.current;
    if (Math.abs(diff) > 40) {
      if (diff < 0) {
        // Swipe Left => Next Slide
        setSwipeIndex((prev) => Math.min(tiles.length - 1, prev + 1));
      } else {
        // Swipe Right => Prev Slide
        setSwipeIndex((prev) => Math.max(0, prev - 1));
      }
    }
    touchStartXRef.current = null;
  };

  // Run slicing whenever options change
  const executeSlicing = React.useCallback(
    async (img: HTMLImageElement, currentMode: SplitMode, cOpts: CarouselOptions, gOpts: GridOptions) => {
      setIsSlicing(true);
      try {
        const base = file ? file.name.replace(/\.[^/.]+$/, "") : "split";
        let result: SlicedTile[];
        if (currentMode === "carousel") {
          result = await sliceCarousel(img, cOpts, base);
        } else {
          result = await sliceGrid(img, gOpts, base);
        }
        setTiles(result);
        setSwipeIndex(0);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to slice image";
        toast.error(msg);
      } finally {
        setIsSlicing(false);
      }
    },
    [file],
  );

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
      executeSlicing(img, mode, carouselOpts, gridOpts);
      toast.success("Image loaded and sliced!");
    };
    img.src = url;
  };

  const handleModeChange = (newMode: SplitMode) => {
    setMode(newMode);
    if (imgRef.current) {
      executeSlicing(imgRef.current, newMode, carouselOpts, gridOpts);
    }
  };

  const handleCarouselChange = (patch: Partial<CarouselOptions>) => {
    const updated = { ...carouselOpts, ...patch };
    setCarouselOpts(updated);
    if (imgRef.current) {
      executeSlicing(imgRef.current, "carousel", updated, gridOpts);
    }
  };

  const handleGridChange = (patch: Partial<GridOptions>) => {
    const updated = { ...gridOpts, ...patch };
    setGridOpts(updated);
    if (imgRef.current) {
      executeSlicing(imgRef.current, "grid", carouselOpts, updated);
    }
  };

  // Download All as ZIP
  const handleDownloadZip = async () => {
    if (tiles.length === 0) return;
    try {
      toast.info("Bundling sliced tiles into ZIP...");
      const zipBlob = await bundleTilesZip(tiles);
      const base = file ? file.name.replace(/\.[^/.]+$/, "") : "split";
      downloadBlob(zipBlob, `${base}-${mode}-package.zip`);
      toast.success(`Downloaded ZIP with ${tiles.length} sliced images!`);
    } catch {
      toast.error("Failed to generate ZIP");
    }
  };

  // Download single tile
  const handleDownloadSingle = (tile: SlicedTile) => {
    downloadBlob(tile.blob, tile.filename);
    toast.success(`Downloaded ${tile.filename}`);
  };

  return (
    <AuthGate>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400">
                <Split className="w-6 h-6" />
              </span>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Social Carousel Slicer & Grid Splitter
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Slice panoramas into seamless swipe carousels (4:5, 1:1) and create 3x3 profile puzzle grids with instant ZIP export.
            </p>
          </div>

          {tiles.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadZip}
                className="gap-1.5 bg-pink-600 hover:bg-pink-700 text-white shadow-sm"
              >
                <Download className="w-4 h-4" />
                Download All as ZIP ({tiles.length} files)
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
            {/* Left Column: Interactive Preview & Tiles / Simulator */}
            <div className="lg:col-span-8 flex flex-col gap-5">
              <div className="bg-card border rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b mb-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={activeTab === "tiles" ? "default" : "ghost"}
                      onClick={() => setActiveTab("tiles")}
                      className="h-8 text-xs gap-1.5"
                    >
                      <Grid className="w-3.5 h-3.5" />
                      Sliced Tiles ({tiles.length})
                    </Button>
                    {mode === "carousel" && (
                      <Button
                        size="sm"
                        variant={activeTab === "simulator" ? "default" : "ghost"}
                        onClick={() => setActiveTab("simulator")}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Swipe Simulator
                      </Button>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setImgUrl(null);
                      setFile(null);
                      setTiles([]);
                      imgRef.current = null;
                    }}
                  >
                    Change Image
                  </Button>
                </div>

                {/* Sliced Cutlines Visual Overlay */}
                <div className="relative rounded-xl border bg-slate-950/20 p-2 flex items-center justify-center overflow-hidden mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt="Source"
                    className="max-h-[220px] w-full object-contain"
                  />

                  {/* Cutline overlays for Carousel */}
                  {mode === "carousel" && (
                    <div className="absolute inset-2 flex pointer-events-none">
                      {Array.from({ length: carouselOpts.slides }).map((_, idx) => (
                        <div
                          key={idx}
                          className="flex-1 border-r-2 border-dashed border-pink-400/90 relative first:border-l-2 last:border-r-2 flex items-start justify-center p-1.5"
                        >
                          <span className="text-[10px] font-mono font-bold bg-pink-600 text-white px-1.5 py-0.5 rounded shadow">
                            Slide {idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cutline overlays for Grid */}
                  {mode === "grid" && (
                    <div
                      className="absolute inset-2 grid pointer-events-none"
                      style={{
                        gridTemplateColumns: `repeat(${gridOpts.cols}, 1fr)`,
                        gridTemplateRows: `repeat(${gridOpts.rows}, 1fr)`,
                      }}
                    >
                      {Array.from({ length: gridOpts.rows * gridOpts.cols }).map((_, idx) => (
                        <div
                          key={idx}
                          className="border border-dashed border-pink-400/90 flex items-center justify-center"
                        >
                          <span className="text-[10px] font-mono font-bold bg-pink-600 text-white px-1 py-0.5 rounded shadow">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tab 1: Sliced Tiles Grid View */}
                {activeTab === "tiles" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span>Generated Slices (Click to download individual tile)</span>
                      <span>{tiles[0]?.width}&times;{tiles[0]?.height} px per tile</span>
                    </div>

                    <div
                      className={`grid gap-3 ${
                        mode === "grid" ? "" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                      }`}
                      style={{
                        gridTemplateColumns:
                          mode === "grid" ? `repeat(${gridOpts.cols}, minmax(0, 1fr))` : undefined,
                      }}
                    >
                      {tiles.map((tile) => (
                        <div
                          key={tile.filename}
                          className="group relative rounded-xl border p-2 bg-card hover:border-pink-400 transition-all flex flex-col gap-2"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={tile.previewUrl}
                            alt={tile.filename}
                            className="w-full aspect-[4/5] object-cover rounded-lg border bg-muted"
                          />
                          <div className="flex items-center justify-between min-w-0">
                            <span className="font-mono text-xs font-semibold truncate text-foreground">
                              #{tile.index}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 text-muted-foreground group-hover:text-pink-600"
                              onClick={() => handleDownloadSingle(tile)}
                              title={`Download ${tile.filename}`}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 2: Carousel Swipe Simulator */}
                {activeTab === "simulator" && tiles.length > 0 && (
                  <div className="flex flex-col items-center justify-center p-4">
                    <div
                      onTouchStart={handleTouchStart}
                      onTouchEnd={handleTouchEnd}
                      className="relative max-w-sm w-full rounded-2xl border-4 border-slate-800 shadow-2xl overflow-hidden bg-black aspect-[4/5] flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tiles[swipeIndex]?.previewUrl}
                        alt={`Slide ${swipeIndex + 1}`}
                        className="w-full h-full object-cover"
                      />

                      {/* Carousel Indicator Pill */}
                      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white font-mono text-[11px] px-2 py-0.5 rounded-full">
                        {swipeIndex + 1} / {tiles.length}
                      </div>

                      {/* Prev Button */}
                      {swipeIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => setSwipeIndex((prev) => Math.max(0, prev - 1))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center shadow hover:bg-black/75 transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                      )}

                      {/* Next Button */}
                      {swipeIndex < tiles.length - 1 && (
                        <button
                          type="button"
                          onClick={() => setSwipeIndex((prev) => Math.min(tiles.length - 1, prev + 1))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center shadow hover:bg-black/75 transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    {/* Dot Pagination */}
                    <div className="flex items-center gap-1.5 mt-3">
                      {tiles.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSwipeIndex(i)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            swipeIndex === i ? "w-5 bg-pink-600" : "bg-muted-foreground/40"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Slicing Controls Sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              {/* Mode Selector */}
              <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Split className="w-4 h-4 text-pink-500" />
                  Split Mode
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant={mode === "carousel" ? "default" : "outline"}
                    className={`h-9 text-xs flex-col py-1 ${
                      mode === "carousel" ? "bg-pink-600 hover:bg-pink-700 text-white" : ""
                    }`}
                    onClick={() => handleModeChange("carousel")}
                  >
                    <Columns className="w-3.5 h-3.5 mb-0.5" />
                    Seamless Carousel
                  </Button>
                  <Button
                    size="sm"
                    variant={mode === "grid" ? "default" : "outline"}
                    className={`h-9 text-xs flex-col py-1 ${
                      mode === "grid" ? "bg-pink-600 hover:bg-pink-700 text-white" : ""
                    }`}
                    onClick={() => handleModeChange("grid")}
                  >
                    <Grid3X3 className="w-3.5 h-3.5 mb-0.5" />
                    Profile Grid (3x3)
                  </Button>
                </div>

                {/* Carousel Controls */}
                {mode === "carousel" && (
                  <div className="space-y-4 pt-2 border-t">
                    {/* Slides count */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Number of Slides</span>
                        <span className="font-mono font-semibold">{carouselOpts.slides} Slides</span>
                      </div>
                      <Slider
                        min={2}
                        max={10}
                        step={1}
                        value={[carouselOpts.slides]}
                        onValueChange={(val) => handleCarouselChange({ slides: val[0] })}
                      />
                    </div>

                    {/* Aspect Ratio Selector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Slide Aspect Ratio</Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: "4:5", label: "4:5 Portrait (IG Feed)" },
                          { id: "1:1", label: "1:1 Square" },
                          { id: "9:16", label: "9:16 Stories / Reel" },
                          { id: "original", label: "Original Ratio" },
                        ].map((ar) => (
                          <Button
                            key={ar.id}
                            size="sm"
                            variant={carouselOpts.aspectRatio === ar.id ? "secondary" : "ghost"}
                            className="h-8 text-[11px] justify-start px-2"
                            onClick={() => handleCarouselChange({ aspectRatio: ar.id as AspectRatioPreset })}
                          >
                            {ar.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* AI Smart Focal Crop */}
                    <div className="pt-2 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                          <span className="text-xs font-semibold text-foreground">AI Smart Focal Crop</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={carouselOpts.smartFocalCrop ?? false}
                          onChange={(e) => handleCarouselChange({ smartFocalCrop: e.target.checked })}
                          className="rounded border-border text-pink-600 focus:ring-pink-500"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Detects people &amp; faces in the panorama and shifts cutlines so subjects are never sliced awkwardly in half.
                      </p>
                    </div>
                  </div>
                )}

                {/* Grid Controls */}
                {mode === "grid" && (
                  <div className="space-y-4 pt-2 border-t">
                    <Label className="text-xs font-medium">Grid Layout Presets</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { rows: 3, cols: 3, label: "3x3 (9 Posts)" },
                        { rows: 2, cols: 3, label: "3x2 (6 Posts)" },
                        { rows: 1, cols: 3, label: "3x1 Banner" },
                      ].map((preset) => {
                        const isSelected = gridOpts.rows === preset.rows && gridOpts.cols === preset.cols;
                        return (
                          <Button
                            key={preset.label}
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            className={`h-9 text-xs flex-col py-1 ${
                              isSelected ? "bg-pink-600 hover:bg-pink-700 text-white" : ""
                            }`}
                            onClick={() => handleGridChange({ rows: preset.rows, cols: preset.cols })}
                          >
                            {preset.label}
                          </Button>
                        );
                      })}
                    </div>

                    {/* Instagram Chronological Numbering */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <Label className="text-xs font-medium">Instagram Chrono Order</Label>
                        <p className="text-[10px] text-muted-foreground">
                          Numbers bottom-to-top so feed puzzle assembles in order.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={gridOpts.instagramOrder ? "default" : "outline"}
                        className="h-6 text-xs px-2"
                        onClick={() => handleGridChange({ instagramOrder: !gridOpts.instagramOrder })}
                      >
                        {gridOpts.instagramOrder ? "Enabled" : "Standard"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Format & Quality Settings */}
              <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold text-sm">Export Format</h3>

                <div className="grid grid-cols-3 gap-1.5">
                  {(["jpeg", "png", "webp"] as const).map((fmt) => {
                    const isSelected =
                      mode === "carousel"
                        ? carouselOpts.format === fmt
                        : gridOpts.format === fmt;
                    return (
                      <Button
                        key={fmt}
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className="h-8 text-xs uppercase"
                        onClick={() => {
                          if (mode === "carousel") handleCarouselChange({ format: fmt });
                          else handleGridChange({ format: fmt });
                        }}
                      >
                        {fmt}
                      </Button>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Export Quality</span>
                    <span className="font-mono">
                      {Math.round(
                        (mode === "carousel" ? carouselOpts.quality : gridOpts.quality) * 100,
                      )}
                      %
                    </span>
                  </div>
                  <Slider
                    min={50}
                    max={100}
                    step={5}
                    value={[
                      Math.round(
                        (mode === "carousel" ? carouselOpts.quality : gridOpts.quality) * 100,
                      ),
                    ]}
                    onValueChange={(val) => {
                      if (mode === "carousel") handleCarouselChange({ quality: val[0] / 100 });
                      else handleGridChange({ quality: val[0] / 100 });
                    }}
                  />
                </div>

                <Button
                  onClick={handleDownloadZip}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white gap-1.5 pt-1"
                >
                  <Download className="w-4 h-4" />
                  Download All as ZIP
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
