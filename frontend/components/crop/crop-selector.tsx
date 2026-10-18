"use client";

import * as React from "react";

import type { NormRect } from "@/lib/image-edit";

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const HANDLE_STYLE: Record<Handle, { left: string; top: string; cursor: string }> = {
  nw: { left: "0%", top: "0%", cursor: "nwse-resize" },
  n: { left: "50%", top: "0%", cursor: "ns-resize" },
  ne: { left: "100%", top: "0%", cursor: "nesw-resize" },
  e: { left: "100%", top: "50%", cursor: "ew-resize" },
  se: { left: "100%", top: "100%", cursor: "nwse-resize" },
  s: { left: "50%", top: "100%", cursor: "ns-resize" },
  sw: { left: "0%", top: "100%", cursor: "nesw-resize" },
  w: { left: "0%", top: "50%", cursor: "ew-resize" },
};

const MIN = 0.02;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function rectFromPoints(ax: number, ay: number, bx: number, by: number): NormRect {
  return { x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay) };
}

function clampRect(rect: NormRect): NormRect {
  const width = clamp(rect.width, MIN, 1);
  const height = clamp(rect.height, MIN, 1);
  return {
    x: clamp(rect.x, 0, 1 - width),
    y: clamp(rect.y, 0, 1 - height),
    width,
    height,
  };
}

function resizeRect(snap: NormRect, handle: Handle, point: { x: number; y: number }, normAspect: number | null): NormRect {
  const fixedLeft = snap.x;
  const fixedRight = snap.x + snap.width;
  const fixedTop = snap.y;
  const fixedBottom = snap.y + snap.height;

  if (normAspect && normAspect > 0) {
    const movedW = handle.includes("w") || handle.includes("e");
    const movedH = handle.includes("n") || handle.includes("s");
    const widthDriven = movedW || !movedH;
    const hAnchorRight = handle.includes("w");
    const vAnchorBottom = handle.includes("n");

    if (widthDriven) {
      const availH = hAnchorRight ? fixedRight : 1 - fixedLeft;
      let availV: number;
      if (vAnchorBottom) availV = fixedBottom;
      else if (!movedH) {
        const cy = fixedTop + snap.height / 2;
        availV = 2 * Math.min(cy, 1 - cy);
      } else availV = 1 - fixedTop;

      let width = Math.abs(point.x - (hAnchorRight ? fixedRight : fixedLeft));
      width = Math.min(Math.max(width, MIN), availH, availV * normAspect, 1);
      const height = width / normAspect;
      const x = hAnchorRight ? fixedRight - width : fixedLeft;
      let y: number;
      if (vAnchorBottom) y = fixedBottom - height;
      else if (!movedH) {
        const cy = fixedTop + snap.height / 2;
        y = cy - height / 2;
      } else y = fixedTop;
      return clampRect({ x, y, width, height });
    }

    const availV = vAnchorBottom ? fixedBottom : 1 - fixedTop;
    const cx = fixedLeft + snap.width / 2;
    const availH = 2 * Math.min(cx, 1 - cx);
    let height = Math.abs(point.y - (vAnchorBottom ? fixedBottom : fixedTop));
    height = Math.min(Math.max(height, MIN), availV, availH / normAspect, 1);
    const width = height * normAspect;
    const y = vAnchorBottom ? fixedBottom - height : fixedTop;
    return clampRect({ x: cx - width / 2, y, width, height });
  }

  let left = handle.includes("w") ? point.x : fixedLeft;
  let right = handle.includes("e") ? point.x : fixedRight;
  let top = handle.includes("n") ? point.y : fixedTop;
  let bottom = handle.includes("s") ? point.y : fixedBottom;
  if (left > right) [left, right] = [right, left];
  if (top > bottom) [top, bottom] = [bottom, top];
  left = clamp(left, 0, 1);
  right = clamp(right, 0, 1);
  top = clamp(top, 0, 1);
  bottom = clamp(bottom, 0, 1);
  if (right - left < MIN) {
    if (handle.includes("w")) left = right - MIN;
    else if (handle.includes("e")) right = left + MIN;
  }
  if (bottom - top < MIN) {
    if (handle.includes("n")) top = bottom - MIN;
    else if (handle.includes("s")) bottom = top + MIN;
  }
  return clampRect(rectFromPoints(left, top, right, bottom));
}

interface CropSelectorProps {
  /** Preview image (already rotated/flipped) the crop is drawn over. */
  imageUrl: string;
  /** Target pixel aspect ratio (width / height) or null for a freeform crop. */
  aspect: number | null;
  /** Starting rectangle, normalised to the image. */
  initial: NormRect;
  onChange: (rect: NormRect) => void;
}

interface DragState {
  mode: Handle | "move" | "new";
  sx: number;
  sy: number;
  snap: NormRect;
}

export function CropSelector({ imageUrl, aspect, initial, onChange }: CropSelectorProps) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [rect, setRect] = React.useState<NormRect>(initial);
  const dragRef = React.useRef<DragState | null>(null);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const normAspect = aspect && size.w > 0 && size.h > 0 ? aspect * (size.h / size.w) : null;

  const toNorm = (clientX: number, clientY: number) => {
    const box = wrapRef.current!.getBoundingClientRect();
    return {
      x: clamp((clientX - box.left) / box.width, 0, 1),
      y: clamp((clientY - box.top) / box.height, 0, 1),
    };
  };

  const commit = (next: NormRect) => {
    setRect(next);
    onChange(next);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const handleEl = target.closest<HTMLElement>("[data-handle]");
    const handle = handleEl?.dataset.handle as Handle | undefined;
    const mode: DragState["mode"] = handle ? handle : target.closest("[data-rect]") ? "move" : "new";
    const point = toNorm(event.clientX, event.clientY);
    dragRef.current = { mode, sx: point.x, sy: point.y, snap: rect };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toNorm(event.clientX, event.clientY);

    if (drag.mode === "move") {
      const x = clamp(drag.snap.x + (point.x - drag.sx), 0, 1 - drag.snap.width);
      const y = clamp(drag.snap.y + (point.y - drag.sy), 0, 1 - drag.snap.height);
      commit({ ...drag.snap, x, y });
      return;
    }

    if (drag.mode === "new") {
      if (normAspect) {
        const width = Math.max(Math.abs(point.x - drag.sx), MIN);
        const height = width / normAspect;
        const x = point.x >= drag.sx ? drag.sx : drag.sx - width;
        const y = point.y >= drag.sy ? drag.sy : drag.sy - height;
        commit(clampRect({ x, y, width, height }));
      } else {
        commit(clampRect(rectFromPoints(drag.sx, drag.sy, point.x, point.y)));
      }
      return;
    }

    commit(resizeRect(drag.snap, drag.mode, point, normAspect));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const style = {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };

  return (
    <div ref={wrapRef} className="relative inline-block max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Image to crop"
        draggable={false}
        className="block max-h-[58vh] w-auto max-w-full select-none rounded-md"
      />
      <div
        className="absolute inset-0 touch-none select-none overflow-hidden rounded-md"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          data-rect
          className="absolute cursor-move border border-primary"
          style={{ ...style, boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
            <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
            <div className="absolute left-0 top-1/3 h-px w-full bg-white/40" />
            <div className="absolute left-0 top-2/3 h-px w-full bg-white/40" />
          </div>
          {HANDLES.map((handle) => (
            <span
              key={handle}
              data-handle={handle}
              className="absolute h-3 w-3 rounded-sm border border-primary bg-white shadow"
              style={{
                left: HANDLE_STYLE[handle].left,
                top: HANDLE_STYLE[handle].top,
                cursor: HANDLE_STYLE[handle].cursor,
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
