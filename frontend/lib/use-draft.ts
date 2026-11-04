"use client";

import * as React from "react";

interface DraftPayload<T> {
  savedAt: number;
  data: T;
}

const DRAFT_PREFIX = "pictools_draft_";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_DRAFT_BYTES = 250 * 1024; // 250 KB max to avoid freezing localStorage

function sanitizeForDraft(val: unknown, depth = 0): unknown {
  if (depth > 6 || val === null || val === undefined) return val;
  if (typeof val === "string") {
    // Strip large binary data URLs or huge strings that freeze localStorage
    if (val.startsWith("data:") && val.length > 2048) {
      return "";
    }
    if (val.length > 50000) {
      return "";
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeForDraft(item, depth + 1));
  }
  if (typeof val === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      cleaned[k] = sanitizeForDraft(v, depth + 1);
    }
    return cleaned;
  }
  return val;
}

export function useToolDraft<T>(
  toolKey: string,
  currentState: T,
  onRestore: (saved: T) => void,
) {
  const [hasDraft, setHasDraft] = React.useState(false);
  const [draftDate, setDraftDate] = React.useState<Date | null>(null);
  const storageKey = `${DRAFT_PREFIX}${toolKey}`;
  const isInitialMount = React.useRef(true);

  // Check for existing draft on initial mount
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DraftPayload<T>;
      if (parsed && typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt < MAX_AGE_MS) {
        setHasDraft(true);
        setDraftDate(new Date(parsed.savedAt));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Storage unavailable or invalid JSON
    }
  }, [storageKey]);

  // Debounced auto-save current state
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const saveToStorage = () => {
        try {
          const sanitized = sanitizeForDraft(currentState) as T;
          const payload: DraftPayload<T> = {
            savedAt: Date.now(),
            data: sanitized,
          };
          const serialized = JSON.stringify(payload);
          if (serialized.length <= MAX_DRAFT_BYTES) {
            localStorage.setItem(storageKey, serialized);
          }
        } catch {
          // Storage full or quota exceeded
        }
      };

      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(saveToStorage);
      } else {
        saveToStorage();
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [currentState, storageKey]);

  const restoreDraft = React.useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DraftPayload<T>;
      if (parsed?.data) {
        onRestore(parsed.data);
        setHasDraft(false);
      }
    } catch {
      // ignore
    }
  }, [storageKey, onRestore]);

  const discardDraft = React.useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setDraftDate(null);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return {
    hasDraft,
    draftDate,
    restoreDraft,
    discardDraft,
  };
}
