"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OcrPage, OcrWord } from "@/lib/types";

interface OcrPreviewProps {
  file: File;
  pages: OcrPage[];
  currentPage: number;
  onPageChange: (page: number) => void;
  hoveredWord?: string | null;
  onWordHover?: (word: string | null) => void;
}

export function OcrPreview({
  file,
  pages,
  currentPage,
  onPageChange,
  hoveredWord,
  onWordHover,
}: OcrPreviewProps) {
  const [zoom, setZoom] = React.useState(100);
  const [showBoxes, setShowBoxes] = React.useState(true);
  const [activeWord, setActiveWord] = React.useState<OcrWord | null>(null);

  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const activePageData = pages.find((p) => p.page === currentPage) ?? pages[0];

  React.useEffect(() => {
    // If it's an image, create an object URL
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImageUrl(null);
    }
  }, [file]);

  const copyWord = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`Copied "${text}"`);
  };

  const pageWidth = activePageData?.width || 800;
  const pageHeight = activePageData?.height || 1000;

  return (
    <div className="flex flex-col rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
      {/* Top controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/10 pb-3">
        <div className="flex items-center gap-1.5">
          {pages.length > 1 && (
            <div className="flex items-center gap-1 rounded-lg border border-outline-variant/20 bg-surface-container-low px-1.5 py-0.5 text-xs">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="rounded p-0.5 hover:bg-surface-container disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono font-medium">
                {currentPage} / {pages.length}
              </span>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(pages.length, currentPage + 1))}
                disabled={currentPage >= pages.length}
                className="rounded p-0.5 hover:bg-surface-container disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <span className="text-xs text-on-surface-variant font-mono">
            {pageWidth} × {pageHeight} px
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowBoxes((v) => !v)}
            className="h-8 gap-1.5 px-2 text-xs"
            title="Toggle word bounding boxes"
          >
            {showBoxes ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5" />}
            {showBoxes ? "Boxes on" : "Boxes off"}
          </Button>

          <div className="flex items-center rounded-lg border border-outline-variant/20 bg-surface-container-low">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 20))}
              className="px-2 py-1 hover:bg-surface-container disabled:opacity-30"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5 text-on-surface-variant" />
            </button>
            <span className="px-1 text-xs font-mono text-on-surface-variant">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(250, z + 20))}
              className="px-2 py-1 hover:bg-surface-container disabled:opacity-30"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5 text-on-surface-variant" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="border-l border-outline-variant/20 px-2 py-1 text-xs hover:bg-surface-container"
              title="Reset Zoom"
            >
              <Maximize2 className="h-3 w-3 text-on-surface-variant" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas / Image Area */}
      <div
        ref={containerRef}
        className="relative flex max-h-[640px] min-h-[380px] w-full items-center justify-center overflow-auto rounded-xl bg-muted/30 p-4"
      >
        <div
          className="relative select-none shadow-md transition-transform duration-100"
          style={{
            width: `${(pageWidth * zoom) / 100}px`,
            height: `${(pageHeight * zoom) / 100}px`,
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="OCR document page"
              className="h-full w-full rounded-lg object-contain bg-white"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-lg border border-outline-variant/20 bg-white font-mono text-sm text-on-surface-variant">
              Page {currentPage} of PDF
            </div>
          )}

          {/* Overlay SVG with Bounding Boxes */}
          {showBoxes && activePageData && (
            <svg
              viewBox={`0 0 ${pageWidth} ${pageHeight}`}
              className="absolute inset-0 h-full w-full pointer-events-auto"
            >
              {activePageData.lines.map((line, lIdx) =>
                line.words.map((word, wIdx) => {
                  const isHovered =
                    hoveredWord && word.text.toLowerCase().includes(hoveredWord.toLowerCase());
                  const isActive = activeWord?.text === word.text;

                  return (
                    <g key={`w-${lIdx}-${wIdx}`}>
                      <rect
                        x={word.rect.x}
                        y={word.rect.y}
                        width={word.rect.w}
                        height={word.rect.h}
                        fill={isHovered || isActive ? "#2563eb" : "#3b82f6"}
                        fillOpacity={isHovered || isActive ? 0.35 : 0.12}
                        stroke={isHovered || isActive ? "#1d4ed8" : "#3b82f6"}
                        strokeWidth={isHovered || isActive ? 1.5 : 0.8}
                        rx={1}
                        className="cursor-pointer transition-all hover:fill-primary/40 hover:stroke-primary"
                        onMouseEnter={() => {
                          setActiveWord(word);
                          onWordHover?.(word.text);
                        }}
                        onMouseLeave={() => {
                          setActiveWord(null);
                          onWordHover?.(null);
                        }}
                        onClick={() => copyWord(word.text)}
                      >
                        <title>{word.text} (click to copy)</title>
                      </rect>
                    </g>
                  );
                }),
              )}
            </svg>
          )}
        </div>
      </div>

      {activeWord && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary animate-in fade-in">
          <span className="font-semibold">
            Word: <span className="font-mono text-foreground font-normal">“{activeWord.text}”</span>
          </span>
          <span className="font-mono text-[11px] text-on-surface-variant">
            Box: [{Math.round(activeWord.rect.x)}, {Math.round(activeWord.rect.y)}] · {Math.round(activeWord.rect.w)}×{Math.round(activeWord.rect.h)} px
          </span>
        </div>
      )}
    </div>
  );
}
