"use client";

import * as React from "react";
import { Crop, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CaptureShot } from "@/lib/screenshot";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Full-screen overlay for drawing a crop rectangle over a captured screenshot.
 * Coordinates are returned in the screenshot's natural pixel space.
 */
export function RegionSelector({
  shot,
  onCancel,
  onConfirm,
}: {
  shot: CaptureShot;
  onCancel: () => void;
  onConfirm: (rect: CropRect) => void;
}) {
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = React.useState<SelectionRect | null>(null);
  const startRef = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onCancel]);

  const pointFromEvent = (event: React.PointerEvent) => {
    const box = overlayRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(event.clientX - box.left, 0), box.width),
      y: Math.min(Math.max(event.clientY - box.top, 0), box.height),
    };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    const point = pointFromEvent(event);
    startRef.current = point;
    setRect({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!startRef.current) return;
    const point = pointFromEvent(event);
    setRect({
      x: Math.min(startRef.current.x, point.x),
      y: Math.min(startRef.current.y, point.y),
      width: Math.abs(point.x - startRef.current.x),
      height: Math.abs(point.y - startRef.current.y),
    });
  };

  const onPointerUp = () => {
    startRef.current = null;
  };

  const ready = rect && rect.width >= 4 && rect.height >= 4;

  const confirm = () => {
    if (!ready || !overlayRef.current || !rect) return;
    const scale = shot.width / overlayRef.current.getBoundingClientRect().width;
    onConfirm({
      x: rect.x * scale,
      y: rect.y * scale,
      width: rect.width * scale,
      height: rect.height * scale,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/85 p-4 sm:p-6">
      <div className="mb-3 flex items-start justify-between gap-4 text-white">
        <div>
          <p className="font-display text-sm font-semibold">Select a region</p>
          <p className="font-mono text-xs text-white/70">
            Drag across the screenshot to keep just that part.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <div className="relative inline-block max-h-full max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shot.dataUrl}
            alt="Captured screen"
            draggable={false}
            className="block max-h-[72vh] max-w-full select-none rounded-md"
          />
          <div
            ref={overlayRef}
            className="absolute inset-0 cursor-crosshair touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {rect && (
              <div
                className="pointer-events-none absolute border-2 border-primary bg-primary/20"
                style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <Button variant="outline" onClick={() => setRect(null)} disabled={!rect} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Button onClick={confirm} disabled={!ready} className="gap-2">
          <Crop className="h-4 w-4" />
          Keep selection
        </Button>
      </div>
    </div>
  );
}
