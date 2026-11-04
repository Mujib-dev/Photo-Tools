"use client";

import * as React from "react";
import { Clock, RotateCcw, X } from "lucide-react";

interface DraftBannerProps {
  hasDraft: boolean;
  draftDate: Date | null;
  onRestore: () => void;
  onDiscard: () => void;
  className?: string;
}

export function DraftBanner({
  hasDraft,
  draftDate,
  onRestore,
  onDiscard,
  className = "",
}: DraftBannerProps) {
  if (!hasDraft || !draftDate) return null;

  const timeFormatted = draftDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateFormatted = draftDate.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      role="region"
      aria-label="Unsaved draft recovery"
      className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-foreground shadow-sm ${className}`}
    >
      <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400">
        <Clock className="h-4 w-4 shrink-0" />
        <span className="font-medium text-foreground">
          Unsaved draft found from {dateFormatted} at {timeFormatted}.
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRestore}
          className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-black transition-transform hover:scale-105 hover:bg-amber-400"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restore Draft
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="flex items-center gap-1 rounded-lg border border-border/80 px-2.5 py-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          title="Dismiss draft"
        >
          <X className="h-3.5 w-3.5" />
          Discard
        </button>
      </div>
    </div>
  );
}
