import { useState, useCallback, useEffect, useRef } from "react";

export interface UseHistoryOptions {
  /** Maximum number of history snapshots to retain (default: 30) */
  capacity?: number;
  /** Whether to bind Ctrl+Z and Ctrl+Y keyboard shortcuts automatically (default: true) */
  enableKeyboardShortcuts?: boolean;
}

export interface UseHistoryReturn<T> {
  state: T;
  set: (next: T | ((prev: T) => T), opts?: { overwrite?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (initial: T) => void;
  historyLength: number;
  currentIndex: number;
}

/**
 * Reusable Undo/Redo state management hook with deep snapshotting and keyboard shortcut support.
 */
export function useHistory<T>(
  initialPresent: T,
  options: UseHistoryOptions = {}
): UseHistoryReturn<T> {
  const { capacity = 30, enableKeyboardShortcuts = true } = options;

  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initialPresent);
  const [future, setFuture] = useState<T[]>([]);

  // Keep ref to avoid stale closures in event listeners
  const pastRef = useRef(past);
  const presentRef = useRef(present);
  const futureRef = useRef(future);
  pastRef.current = past;
  presentRef.current = present;
  futureRef.current = future;

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;

    const previous = pastRef.current[pastRef.current.length - 1];
    const newPast = pastRef.current.slice(0, pastRef.current.length - 1);

    setPast(newPast);
    setFuture([presentRef.current, ...futureRef.current]);
    setPresent(previous);
  }, []);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;

    const next = futureRef.current[0];
    const newFuture = futureRef.current.slice(1);

    setPast([...pastRef.current, presentRef.current]);
    setPresent(next);
    setFuture(newFuture);
  }, []);

  const set = useCallback(
    (next: T | ((prev: T) => T), opts?: { overwrite?: boolean }) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: T) => T)(presentRef.current)
          : next;

      if (opts?.overwrite) {
        setPresent(resolved);
        return;
      }

      setPast((prevPast) => {
        const updated = [...prevPast, presentRef.current];
        if (updated.length > capacity) {
          return updated.slice(updated.length - capacity);
        }
        return updated;
      });
      setPresent(resolved);
      setFuture([]);
    },
    [capacity]
  );

  const reset = useCallback((initial: T) => {
    setPast([]);
    setPresent(initial);
    setFuture([]);
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing inside an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      if (e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          // Ctrl+Shift+Z or Cmd+Shift+Z => Redo
          e.preventDefault();
          redo();
        } else {
          // Ctrl+Z or Cmd+Z => Undo
          e.preventDefault();
          undo();
        }
      } else if (e.key.toLowerCase() === "y" && !isMac) {
        // Ctrl+Y on Windows/Linux => Redo
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboardShortcuts, undo, redo]);

  return {
    state: present,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    historyLength: past.length + 1 + future.length,
    currentIndex: past.length,
  };
}
