"use client";

import * as React from "react";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

export function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

export interface ZoomPan {
  zoom: number;
  offset: { x: number; y: number };
  dragging: boolean;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  zoomBy: (factor: number) => void;
  resetZoom: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  /** Spread on the zoomable element — applies the pan/scale transform. */
  contentStyle: React.CSSProperties;
  /** Spread on the clipping viewport — cursor + touch-action. */
  viewportStyle: React.CSSProperties;
}

/**
 * Shared wheel-to-zoom / drag-to-pan / double-click-toggle behaviour for image
 * previews. Attach `viewportRef` + the pointer handlers to a clipping container
 * and spread `contentStyle` on the image or canvas inside it.
 *
 * Pass `resetKey` (e.g. the selected file key) to snap back to 100% when it changes.
 */
export function useZoomPan(resetKey?: unknown): ZoomPan {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const dragState = React.useRef({ active: false, x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  React.useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [resetKey]);

  const zoomBy = React.useCallback((factor: number) => {
    setZoom((z) => {
      const next = clampZoom(z * factor);
      if (next === MIN_ZOOM) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const resetZoom = React.useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    dragState.current = { active: true, x: e.clientX, y: e.clientY };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    const dx = e.clientX - dragState.current.x;
    const dy = e.clientY - dragState.current.y;
    dragState.current.x = e.clientX;
    dragState.current.y = e.clientY;
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const onDoubleClick = () => {
    if (zoom > 1) resetZoom();
    else setZoom(2.5);
  };

  const contentStyle: React.CSSProperties = {
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
    transformOrigin: "center",
    transition: dragging ? "none" : "transform 80ms ease-out",
  };

  const viewportStyle: React.CSSProperties = {
    cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
    touchAction: "none",
  };

  return {
    zoom,
    offset,
    dragging,
    viewportRef,
    zoomBy,
    resetZoom,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick,
    contentStyle,
    viewportStyle,
  };
}
