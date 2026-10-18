import { useCallback, useEffect, useRef, useState } from "react";

import * as api from "./api";
import type { JobRecord } from "./types";

export type ItemState =
  | "pending"
  | "uploading"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "saved";

export interface JobItem {
  key: string;
  file: api.UploadFile;
  previewUri: string;
  width: number;
  height: number;
  jobId: string | null;
  state: ItemState;
  stage: string;
  error: string | null;
  record: JobRecord | null;
  /** Local copy of the output, downloaded as soon as the job completes. */
  localUri: string | null;
}

const POLL_MS = 900;

/**
 * A phone on Wi-Fi drops packets constantly, so a single failed poll must not
 * kill a job the way it does in the web client. Tolerate a few consecutive
 * failures before giving up, and reset the counter after any success.
 */
const MAX_CONSECUTIVE_POLL_FAILURES = 4;

let keyCounter = 0;
const nextKey = () => `item-${(keyCounter += 1)}-${Date.now()}`;

export function useJobBatch(submit: (file: api.UploadFile) => Promise<{ jobId: string }>) {
  const [items, setItems] = useState<JobItem[]>([]);
  const [running, setRunning] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const itemsRef = useRef<JobItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failuresRef = useRef(0);
  const mountedRef = useRef(true);

  // Keep the latest submit callback without restarting the poll loop.
  const submitRef = useRef(submit);
  submitRef.current = submit;

  const update = useCallback((key: string, patch: Partial<JobItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  // Reflect state into the ref so the interval always reads fresh values.
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const addFiles = useCallback(
    (files: { uri: string; fileName: string; mimeType: string; width: number; height: number }[]) => {
      setItems((prev) => [
        ...prev,
        ...files.map((f) => ({
          key: nextKey(),
          file: { uri: f.uri, fileName: f.fileName, mimeType: f.mimeType },
          previewUri: f.uri,
          width: f.width,
          height: f.height,
          jobId: null,
          state: "pending" as ItemState,
          stage: "Waiting",
          error: null,
          record: null,
          localUri: null,
        })),
      ]);
    },
    [],
  );

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const clearFinished = useCallback(() => {
    setItems((prev) =>
      prev.filter((item) => item.state === "pending" || item.state === "uploading"),
    );
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setItems([]);
    setRunning(false);
    setFatalError(null);
    failuresRef.current = 0;
  }, [stopPolling]);

  /** Download a completed output to the device so it survives server cleanup. */
  const archive = useCallback(async (key: string, record: JobRecord) => {
    try {
      const file = await api.downloadOutput(record.id, record.downloadName ?? record.id);
      if (!mountedRef.current) return;
      update(key, { localUri: file.uri, state: "saved" });
    } catch (err) {
      if (!mountedRef.current) return;
      // The job itself succeeded; only the local copy failed.
      update(key, {
        state: "completed",
        error: err instanceof Error ? err.message : "Could not save the file on this device.",
      });
    }
  }, [update]);

  const poll = useCallback(async () => {
    const active = itemsRef.current.filter(
      (i) => i.jobId && (i.state === "queued" || i.state === "processing"),
    );
    if (active.length === 0) {
      stopPolling();
      setRunning(false);
      return;
    }

    const results = await Promise.all(
      active.map(async (item) => {
        try {
          return { key: item.key, record: await api.getJob(item.jobId as string) };
        } catch (err) {
          if (err instanceof api.ApiError && err.isUnauthorized) {
            return { key: item.key, unauthorized: true as const };
          }
          return {
            key: item.key,
            error: err instanceof Error ? err.message : "Could not reach the server.",
          };
        }
      }),
    );

    if (!mountedRef.current) return;

    const unauthorized = results.some((r) => "unauthorized" in r && r.unauthorized);
    if (unauthorized) {
      stopPolling();
      setRunning(false);
      setFatalError("Your session expired. Please sign in again.");
      return;
    }

    const succeeded = results.some((r) => "record" in r && r.record);
    failuresRef.current = succeeded ? 0 : failuresRef.current + 1;

    if (failuresRef.current >= MAX_CONSECUTIVE_POLL_FAILURES) {
      stopPolling();
      setRunning(false);
      setFatalError("Lost contact with the server. Check that your computer is still reachable.");
      for (const r of results) {
        if ("error" in r && r.error) update(r.key, { state: "failed", error: r.error });
      }
      return;
    }

    for (const r of results) {
      if (!("record" in r) || !r.record) continue;
      const record = r.record;
      if (record.state === "completed") {
        update(r.key, { state: "completed", stage: "Completed", record });
        void archive(r.key, record);
      } else if (record.state === "failed") {
        update(r.key, {
          state: "failed",
          stage: record.stage,
          error: record.error ?? "Processing failed.",
          record,
        });
      } else {
        update(r.key, { state: record.state, stage: record.stage, record });
      }
    }
  }, [archive, stopPolling, update]);

  const startPolling = useCallback(() => {
    if (timerRef.current) return;
    failuresRef.current = 0;
    timerRef.current = setInterval(() => {
      void poll();
    }, POLL_MS);
  }, [poll]);

  /**
   * Upload every pending (or previously failed) item, sequentially so a large
   * batch does not saturate a phone's uplink, then start polling.
   */
  const start = useCallback(async () => {
    setFatalError(null);
    const pending = itemsRef.current.filter(
      (i) => i.state === "pending" || i.state === "failed",
    );
    if (pending.length === 0) return;

    setRunning(true);
    for (const item of pending) {
      if (!mountedRef.current) return;
      update(item.key, { state: "uploading", stage: "Uploading\u2026", error: null, jobId: null });
      try {
        const res = await submitRef.current(item.file);
        update(item.key, { jobId: res.jobId, state: "queued", stage: "Queued" });
      } catch (err) {
        update(item.key, {
          state: "failed",
          error: err instanceof Error ? err.message : "Upload failed.",
        });
      }
    }
    startPolling();
  }, [startPolling, update]);

  const dismissFatal = useCallback(() => setFatalError(null), []);

  return {
    items,
    running,
    fatalError,
    addFiles,
    remove,
    reset,
    clearFinished,
    start,
    dismissFatal,
  };
}
