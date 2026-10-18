"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { ScanRotation } from "@/lib/types";

interface CornerEditorProps {
  src: string;
  alt: string;
  /** Displayed image dimensions (already swapped for the page rotation). */
  width: number;
  height: number;
  /** Clockwise rotation applied visually to the image to match `corners`. */
  rotate: ScanRotation;
  corners: [number, number][];
}

/** Map an image-space point to the preview's displayed position. */
function toDisplay(
  cw: number,
  ch: number,
  width: number,
  height: number,
  p: [number, number],
): [number, number] {
  const scale = Math.min(cw / width, ch / height);
  const ox = (cw - width * scale) / 2;
  const oy = (ch - height * scale) / 2;
  return [ox + p[0] * scale, oy + p[1] * scale];
}

export function CornerEditor({
  src,
  alt,
  width,
  height,
  rotate,
  corners,
}: CornerEditorProps) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState({ cw: 0, ch: 0 });

  React.useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setBox({ cw: el.clientWidth, ch: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = corners.map((p) => toDisplay(box.cw, box.ch, width, height, p));
  const poly = points.map(([x, y]) => `${x},${y}`).join(" ");

  // For 90°/270° the container aspect is already swapped, so a plain
  // object-contain img would be letterboxed *before* rotating and no longer
  // fill the box. Size the img to the pre-rotation dims and center it first;
  // after rotating, its bounding box exactly covers the container.
  const swapped = rotate % 180 !== 0 && box.cw > 0 && box.ch > 0;

  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden rounded-lg border border-white/5 bg-canvas"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={cn("object-contain", swapped ? "absolute" : "absolute inset-0 h-full w-full")}
        style={
          swapped
            ? {
                left: "50%",
                top: "50%",
                width: box.ch,
                height: box.cw,
                transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
              }
            : { transform: `rotate(${rotate}deg)` }
        }
      />

      {width > 0 && height > 0 && corners.length > 0 && (
        <div className="pointer-events-none absolute inset-0">
          <svg className="h-full w-full" viewBox={`0 0 ${box.cw} ${box.ch}`} preserveAspectRatio="none">
            <polygon
              points={poly}
              fill="rgba(37,99,235,0.12)"
              stroke="rgba(37,99,235,0.95)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
