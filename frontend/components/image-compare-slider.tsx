"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ImageCompareSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  aspectRatio?: string;
  zoomScale?: number;
  zoomOrigin?: string;
}

export function ImageCompareSlider({
  beforeImage,
  afterImage,
  beforeLabel = "Original",
  afterLabel = "Enhanced (4x)",
  className,
  aspectRatio = "aspect-video",
  zoomScale = 1,
  zoomOrigin = "50% 30%",
}: ImageCompareSliderProps) {
  const [sliderPosition, setSliderPosition] = React.useState<number>(50); // percentage (0 - 100)
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const updatePosition = React.useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    updatePosition(e.clientX);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();
    updatePosition(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      e.stopPropagation();
    }
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  React.useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      updatePosition(e.clientX);
    };
    const onUp = () => {
      setIsDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isDragging, updatePosition]);

  const transformStyle: React.CSSProperties =
    zoomScale > 1
      ? {
          transform: `scale(${zoomScale})`,
          transformOrigin: zoomOrigin,
          transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }
      : {
          transform: "scale(1)",
          transformOrigin: "center center",
          transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "relative select-none overflow-hidden rounded-2xl border border-outline-variant/30 bg-muted/40 cursor-ew-resize touch-none shadow-md",
        aspectRatio,
        className
      )}
    >
      {/* After (Enhanced) Image - Full background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterImage}
        alt={afterLabel}
        className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none will-change-transform"
        style={transformStyle}
      />

      {/* Before (Original) Image - Clipped cleanly to sliderPosition with zero measurement lag */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beforeImage}
        alt={beforeLabel}
        className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none will-change-transform"
        style={{
          ...transformStyle,
          clipPath: `inset(0 calc(100% - ${sliderPosition}%) 0 0)`,
          WebkitClipPath: `inset(0 calc(100% - ${sliderPosition}%) 0 0)`,
        }}
      />

      {/* Vertical Divider Line with Grab Handle */}
      <div
        className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.6)] pointer-events-none"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-900 shadow-xl border border-gray-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l-3 3 3 3m8-6l3 3-3 3" />
          </svg>
        </div>
      </div>

      {/* Label Badges */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/75 px-3 py-1 font-mono text-[11px] font-semibold text-white backdrop-blur-xs">
        {beforeLabel}
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-primary/90 px-3 py-1 font-mono text-[11px] font-semibold text-primary-foreground backdrop-blur-xs shadow-sm">
        {afterLabel}
      </div>
    </div>
  );
}
