"use client";

import * as React from "react";
import { X } from "lucide-react";

import type { EnhanceRegion } from "@/lib/types";

interface HostRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  /** The rendered <img> the selection is measured against. */
  imgRef: React.RefObject<HTMLImageElement | null>;
  value: EnhanceRegion | null;
  onChange: (region: EnhanceRegion | null) => void;
}

function fracToHost(
  img: HTMLImageElement | null,
  host: HTMLDivElement | null,
  region: EnhanceRegion,
): HostRect | null {
  if (!img || !host) return null;
  const ir = img.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  if (ir.width === 0 || ir.height === 0) return null;
  return {
    left: ir.left - hr.left + region.x * ir.width,
    top: ir.top - hr.top + region.y * ir.height,
    width: region.width * ir.width,
    height: region.height * ir.height,
  };
}

/**
 * Transparent overlay over the image preview that lets the user drag a
 * rectangle. The selection is stored as normalized (0..1) coordinates so it is
 * resolution independent and survives zoom/pan of the underlying image.
 */
export function RegionSelector({ imgRef, value, onChange }: Props) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const startRef = React.useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = React.useState<{ x: number; y: number } | null>(null);
  const [, tick] = React.useState(0);

  // Re-measure when the layout changes (resize, zoom, pan) so the box tracks
  // the image exactly.
  React.useEffect(() => {
    const onResize = () => tick((n) => n + 1);
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    if (imgRef.current) ro.observe(imgRef.current);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  }, [imgRef]);

  const toFraction = (clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img) return null;
    const ir = img.getBoundingClientRect();
    if (ir.width === 0 || ir.height === 0) return null;
    return {
      x: Math.min(1, Math.max(0, (clientX - ir.left) / ir.width)),
      y: Math.min(1, Math.max(0, (clientY - ir.top) / ir.height)),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const f = toFraction(e.clientX, e.clientY);
    if (!f) return;
    startRef.current = f;
    setDraft(f);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    e.stopPropagation();
    const f = toFraction(e.clientX, e.clientY);
    if (f) setDraft(f);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    e.stopPropagation();
    const start = startRef.current;
    const end = toFraction(e.clientX, e.clientY) ?? start;
    startRef.current = null;
    setDraft(null);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const region: EnhanceRegion = {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
    if (region.width < 0.03 || region.height < 0.03) {
      onChange(null);
      return;
    }
    onChange(region);
  };

  const draftRegion: EnhanceRegion | null =
    startRef.current && draft
      ? {
          x: Math.min(startRef.current.x, draft.x),
          y: Math.min(startRef.current.y, draft.y),
          width: Math.abs(draft.x - startRef.current.x),
          height: Math.abs(draft.y - startRef.current.y),
        }
      : null;

  const shown = draftRegion ?? value;
  const hostRect = shown ? fracToHost(imgRef.current, hostRef.current, shown) : null;

  return (
    <div
      ref={hostRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute inset-0 z-0 cursor-crosshair touch-none select-none"
    >
      {hostRect && hostRect.width > 0 && hostRect.height > 0 && (
        <div
          className="pointer-events-none absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
          style={{
            left: hostRect.left,
            top: hostRect.top,
            width: hostRect.width,
            height: hostRect.height,
          }}
        />
      )}

      {!shown && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-surface-container-lowest/90 px-3 py-1.5 font-display text-[11px] font-semibold text-on-surface-variant shadow">
          Drag to select an area to enhance
        </div>
      )}

      {value && !draftRegion && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onChange(null)}
          className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-lowest/90 px-3 py-1.5 font-display text-[11px] font-semibold text-foreground shadow transition-colors hover:text-destructive"
        >
          <X className="h-3 w-3" />
          Clear area
        </button>
      )}
    </div>
  );
}
