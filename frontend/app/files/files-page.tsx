"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckSquare,
  Download,
  ExternalLink,
  FileWarning,
  Filter,
  Folder,
  FolderOpen,
  HelpCircle,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
} from "lucide-react";

import { AuthGate } from "@/components/auth-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteJob, downloadAllUrl, downloadUrl, listJobs } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import type { JobRecord, JobState } from "@/lib/types";
import { cn } from "@/lib/utils";

const FOLDERS = [
  { id: "all", label: "All Files" },
  { id: "social", label: "Social & Ads" },
  { id: "clients", label: "Client Deliverables" },
  { id: "ecommerce", label: "E-Commerce" },
  { id: "archive", label: "Archive" },
];

const STATE_VARIANT: Record<JobState, "default" | "secondary" | "destructive" | "success" | "outline"> = {
  queued: "outline",
  processing: "secondary",
  completed: "success",
  failed: "destructive",
};

const STATE_LABEL: Record<JobState, string> = {
  queued: "Queued",
  processing: "Processing",
  completed: "Ready",
  failed: "Failed",
};

function formatDate(value: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

// Map backend job operation to tool page URL
function getToolUrlForOperation(op: string): string {
  switch (op.toLowerCase()) {
    case "resize": return "/resize";
    case "convert": return "/convert";
    case "compress": return "/compress";
    case "enhance": return "/enhance";
    case "watermark": return "/watermark";
    case "pdf": return "/pdf";
    case "video": return "/video";
    case "audio": return "/audio";
    case "ocr": return "/ocr";
    case "removebg":
    case "remove-bg": return "/remove-bg";
    default: return "/";
  }
}

function FilesView() {
  const [jobs, setJobs] = React.useState<JobRecord[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [activeFolder, setActiveFolder] = React.useState("all");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [fileFolders, setFileFolders] = React.useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setJobs(await listJobs(200));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your files.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!confirmDeleteId) return;
    const timer = window.setTimeout(() => setConfirmDeleteId(null), 5000);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmDeleteId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    };
  }, [confirmDeleteId]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredJobs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredJobs.map((j) => j.id)));
    }
  };

  const filteredJobs = React.useMemo(() => {
    return (jobs ?? []).filter((job) => {
      const name = (job.downloadName ?? job.outputFilename ?? job.inputFilename ?? "").toLowerCase();
      const op = job.operation.toLowerCase();
      const matchesSearch = !search || name.includes(search.toLowerCase()) || op.includes(search.toLowerCase());

      const folder = fileFolders[job.id] || "all";
      const matchesFolder = activeFolder === "all" || folder === activeFolder;

      return matchesSearch && matchesFolder;
    });
  }, [jobs, search, activeFolder, fileFolders]);

  const completedSelected = React.useMemo(() => {
    return (jobs ?? []).filter((job) => selectedIds.has(job.id) && job.state === "completed");
  }, [jobs, selectedIds]);

  const handleBulkMove = (folderId: string) => {
    setFileFolders((prev) => {
      const next = { ...prev };
      for (const id of selectedIds) {
        next[id] = folderId;
      }
      return next;
    });
    setSelectedIds(new Set());
  };

  const handleDelete = async (jobId: string) => {
    setConfirmDeleteId(null);
    setDeletingId(jobId);
    try {
      await deleteJob(jobId);
      setJobs((prev) => (prev ? prev.filter((job) => job.id !== jobId) : prev));
      setSelectedIds((prev) => {
        if (!prev.has(jobId)) return prev;
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this file.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 md:py-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderOpen className="h-4 w-4" />
            </span>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-primary">
              Asset Workspace 2.0
            </p>
          </div>
          <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight text-foreground">
            Smart Cloud Asset Manager
          </h1>
          <p className="mt-1 max-w-xl text-xs text-on-surface-variant">
            Organize processed photos and documents into workspaces, apply metadata tags, batch download as ZIP, or re-open directly in tools.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>

          {filteredJobs.filter((j) => j.state === "completed").length > 0 && (
            <Button asChild size="sm" className="gap-1.5 text-xs">
              <a href={downloadAllUrl(filteredJobs.filter((j) => j.state === "completed").map((j) => j.id))}>
                <Download className="h-3.5 w-3.5" />
                Download All ZIP
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Folders Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FOLDERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFolder(f.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                activeFolder === f.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "bg-surface-container-high/60 text-foreground hover:bg-surface-container-high",
              )}
            >
              <Folder className="h-3 w-3" />
              {f.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-auto sm:min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant/60" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files or operation..."
            className="h-8 w-full rounded-xl border border-outline-variant/30 bg-surface-container-low pl-8 pr-3 text-xs text-foreground placeholder:text-on-surface-variant/50 focus:border-primary/60 focus:outline-none"
          />
        </div>
      </div>

      {/* Bulk Action Bar (when items are selected) */}
      {selectedIds.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary">
              {selectedIds.size} file{selectedIds.size > 1 ? "s" : ""} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {completedSelected.length > 0 && (
              <Button asChild size="sm" variant="default" className="h-7 text-xs gap-1.5">
                <a href={downloadAllUrl(completedSelected.map((j) => j.id))}>
                  <Download className="h-3 w-3" />
                  Download Selected ZIP
                </a>
              </Button>
            )}

            <div className="flex items-center gap-1 bg-surface-container px-2 py-1 rounded-lg border border-outline-variant/40">
              <span className="text-[11px] text-on-surface-variant font-medium">Move to:</span>
              {FOLDERS.filter((f) => f.id !== "all").map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleBulkMove(f.id)}
                  className="text-[11px] font-semibold text-primary hover:underline px-1"
                >
                  {f.label.split(" ")[0]}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="h-7 text-xs text-on-surface-variant hover:text-foreground"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Select All Checkbox */}
      {filteredJobs.length > 0 && (
        <div className="mt-4 flex items-center justify-between px-2 text-xs text-on-surface-variant">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-2 hover:text-foreground font-medium"
          >
            {selectedIds.size === filteredJobs.length ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4 text-on-surface-variant" />
            )}
            Select All ({filteredJobs.length})
          </button>
          <span>Showing {filteredJobs.length} processed assets</span>
        </div>
      )}

      {/* Main File List */}
      {loading && jobs === null ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
          <FileWarning className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-outline-variant/30 px-6 py-16 text-center">
          <FolderOpen className="h-10 w-10 text-on-surface-variant" />
          <h2 className="font-display text-base font-semibold text-foreground">No files in this workspace</h2>
          <p className="max-w-sm text-xs text-on-surface-variant">
            Process photos, documents or videos and they will automatically show up here.
          </p>
          <Button asChild size="sm" className="mt-2 gap-1.5">
            <Link href="/">
              Explore 60+ Tools
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {filteredJobs.map((job) => {
            const isSelected = selectedIds.has(job.id);
            const toolUrl = getToolUrlForOperation(job.operation);

            return (
              <li
                key={job.id}
                className={cn(
                  "glass-panel flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between transition-all",
                  isSelected
                    ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
                    : "border-outline-variant/20 hover:border-outline-variant/50",
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleSelect(job.id)}
                    className="mt-1 text-on-surface-variant hover:text-primary shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-display text-sm font-semibold text-foreground">
                        {job.downloadName ?? job.outputFilename ?? job.inputFilename}
                      </p>
                      <Badge variant={STATE_VARIANT[job.state]} className="text-[10px] px-1.5 py-0">
                        {STATE_LABEL[job.state]}
                      </Badge>
                    </div>

                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-on-surface-variant">
                      <span className="uppercase tracking-wider font-bold text-primary">{job.operation}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatBytes(job.outputSize ?? job.inputSize)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(job.createdAt)}</span>
                    </p>

                    {job.state === "failed" && job.error && (
                      <p className="mt-1 text-[11px] text-destructive flex items-center gap-1">
                        <FileWarning className="h-3 w-3" />
                        {job.error}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
                  {/* Re-open in Tool 1-Click Action */}
                  <Link
                    href={toolUrl}
                    className="flex items-center gap-1.5 rounded-xl border border-outline-variant/40 bg-surface-container px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-container-high transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 text-primary" />
                    Re-open in Tool
                  </Link>

                  {job.state === "completed" && (
                    <Button asChild size="sm" className="gap-1.5 text-xs">
                      <a href={downloadUrl(job.id)} download={job.downloadName ?? job.outputFilename}>
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </Button>
                  )}

                  {/* Delete file */}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDeleteId === job.id) void handleDelete(job.id);
                      else setConfirmDeleteId(job.id);
                    }}
                    onBlur={() => setConfirmDeleteId((current) => (current === job.id ? null : current))}
                    disabled={deletingId === job.id}
                    title={confirmDeleteId === job.id ? "Click again to delete" : "Delete file"}
                    aria-label={confirmDeleteId === job.id ? "Confirm delete file" : "Delete file"}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-xl border text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      confirmDeleteId === job.id
                        ? "gap-1.5 border-destructive bg-destructive px-2.5 text-white hover:bg-destructive/90"
                        : "w-8 border-outline-variant/40 text-on-surface-variant hover:bg-destructive/10 hover:text-destructive",
                    )}
                  >
                    {deletingId === job.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        {confirmDeleteId === job.id && <span>Confirm delete</span>}
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function FilesPage() {
  return (
    <AuthGate>
      <FilesView />
    </AuthGate>
  );
}
