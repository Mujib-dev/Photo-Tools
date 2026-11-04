"use client";

import * as React from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Small "?"-style tooltip for tool pages. Opens on hover, keyboard focus or
 * click (touch), closes on Escape / outside click — no positioning library
 * needed since it anchors to the trigger.
 */
export function ToolHint({
  children,
  label = "About this tool",
  className,
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLSpanElement | null>(null);
  const tooltipId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className={cn("group/hint relative inline-flex align-middle", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="relative flex h-5 w-5 items-center justify-center rounded-full border border-outline-variant/50 text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring before:absolute before:-inset-3 before:content-['']"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="fixed inset-x-3 bottom-3 z-50 block w-auto rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left text-xs leading-5 text-on-surface shadow-[0_12px_32px_rgba(0,0,0,0.18)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-full sm:mt-2 sm:w-64 sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2"
        >
          {children}
        </span>
      )}
    </span>
  );
}
