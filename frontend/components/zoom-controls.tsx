"use client";

import { ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_ZOOM, MIN_ZOOM } from "@/lib/use-zoom-pan";

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  className,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  className?: string;
}) {
  return (
    <div
      title="Scroll to zoom · drag to pan · double-click to reset"
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-outline-variant/20 bg-surface-container-lowest/90 px-1 py-1 shadow-sm backdrop-blur",
        className,
      )}
    >
      {zoom <= MIN_ZOOM && (
        <span className="hidden select-none pl-1.5 pr-1 text-[11px] text-on-surface-variant sm:inline">
          Scroll to zoom
        </span>
      )}
      <Button
        size="icon"
        variant="ghost"
        aria-label="Zoom out"
        className="h-7 w-7"
        disabled={zoom <= MIN_ZOOM}
        onClick={onZoomOut}
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <button
        type="button"
        onClick={onReset}
        title="Reset zoom"
        className="min-w-[46px] rounded px-1 font-mono text-xs text-on-surface-variant hover:text-foreground"
      >
        {Math.round(zoom * 100)}%
      </button>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Zoom in"
        className="h-7 w-7"
        disabled={zoom >= MAX_ZOOM}
        onClick={onZoomIn}
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
    </div>
  );
}
