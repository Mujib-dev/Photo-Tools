"use client";

import * as React from "react";
import { MoveHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  onBeforeError?: () => void;
  onAfterError?: () => void;
}

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Before",
  afterLabel = "After",
  className,
  style,
  onBeforeError,
  onAfterError,
}: BeforeAfterSliderProps) {
  const [sliderPos, setSliderPos] = React.useState(50);
  const [isDragging, setIsDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const updatePosition = React.useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pos = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pos);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    updatePosition(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();
    updatePosition(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      e.stopPropagation();
    }
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      setSliderPos((prev) => Math.max(0, prev - 5));
    } else if (e.key === "ArrowRight") {
      setSliderPos((prev) => Math.min(100, prev + 5));
    }
  };

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="Before and after comparison slider"
      aria-valuenow={Math.round(sliderPos)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={style}
      className={cn(
        "relative z-10 select-none overflow-hidden rounded-md cursor-ew-resize touch-none",
        className,
      )}
    >
      {/* Background (After / Processed image) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterUrl}
        alt={afterLabel}
        draggable={false}
        onError={onAfterError}
        className="pointer-events-none block h-auto max-h-[420px] w-auto max-w-full rounded-md object-contain"
      />

      {/* Foreground (Before / Original image clipped) */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt={beforeLabel}
          draggable={false}
          onError={onBeforeError}
          className="block h-full w-full object-contain"
        />
      </div>

      {/* Badges */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur-sm">
        {beforeLabel}
      </div>
      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-primary/80 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur-sm">
        {afterLabel}
      </div>

      {/* Divider line */}
      <div
        className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]"
        style={{ left: `${sliderPos}%` }}
      >
        {/* Drag Handle */}
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-lg transition-transform hover:scale-110 active:scale-95">
          <MoveHorizontal className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
