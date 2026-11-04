"use client";

import * as React from "react";
import { Check, Download, Loader2, RefreshCw, Server, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { downloadAllUrl, downloadUrl, submitBatch, subscribeJob, type BatchJobResult } from "@/lib/api";
import type { JobState } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The backend reports progress inside the job stage, e.g. "Processing… 42%".
 */
function parseStageProgress(stage: string | undefined): number {
  if (!stage) return 0;
  const match = /(\d{1,3})\s*%/.exec(stage);
  if (!match) return 0;
  return Math.max(0, Math.min(100, Number.parseInt(match[1], 10)));
}

/**
 * Server-side batch processing.
 *
 * The browser mode (Canvas) is fast for a handful of photos but the server
 * does the real work: it accepts the whole batch in one request, processes
 * each file as its own job, and can hand back a ZIP of every output.
 */

type ServerOperation = "resize" | "convert" | "compress" | "watermark";

const OPERATIONS: { value: ServerOperation; label: string; hint: string }[] = [
  { value: "resize", label: "Resize", hint: "Scale every image to fixed dimensions." },
  { value: "convert", label: "Convert", hint: "Change the image format (or build an .ico)." },
  { value: "compress", label: "Compress", hint: "Shrink each image to a target size." },
  { value: "watermark", label: "Watermark", hint: "Stamp a text watermark on every image." },
];

/** Per-item job state, keyed by the batch item id. */
interface ItemJob {
  jobId: string | null;
  state: JobState | "rejected";
  error: string | null;
  progress: number;
}

export interface ServerBatchFile {
  id: string;
  file: File;
  originalName: string;
}

export function ServerBatchPanel({ files }: { files: ServerBatchFile[] }) {
  const [operation, setOperation] = React.useState<ServerOperation>("resize");
  const [running, setRunning] = React.useState(false);
  const [jobs, setJobs] = React.useState<Record<string, ItemJob>>({});
  const [renameTemplate, setRenameTemplate] = React.useState("{name}-{index}");

  // Resize settings
  const [width, setWidth] = React.useState(1920);
  const [height, setHeight] = React.useState(1080);
  const [resizeFormat, setResizeFormat] = React.useState("jpg");
  // Convert settings
  const [convertFormat, setConvertFormat] = React.useState("webp");
  const [icoSizes, setIcoSizes] = React.useState("16,32,48,64,128,256");
  // Compress settings
  const [targetKb, setTargetKb] = React.useState(500);
  const [compressFormat, setCompressFormat] = React.useState("keep");
  // Watermark settings
  const [watermarkText, setWatermarkText] = React.useState("© PicTools");
  const [watermarkSize, setWatermarkSize] = React.useState(8);
  const [watermarkOpacity, setWatermarkOpacity] = React.useState(60);
  const [watermarkPosition, setWatermarkPosition] = React.useState("bottom-right");
  const [watermarkColor, setWatermarkColor] = React.useState("white");

  const unsubs = React.useRef<Map<string, () => void>>(new Map());

  React.useEffect(() => {
    const map = unsubs.current;
    return () => {
      map.forEach((unsub) => unsub());
      map.clear();
    };
  }, []);

  /** The settings payload the backend expects for the chosen operation. */
  const buildSettings = React.useCallback((): Record<string, unknown> => {
    switch (operation) {
      case "resize":
        return { mode: "px", width, height, dpi: 96, format: resizeFormat };
      case "convert":
        return { format: convertFormat, sizes: icoSizes };
      case "compress":
        return { targetKb, format: compressFormat };
      case "watermark":
        return {
          watermarkType: "text",
          text: watermarkText,
          size: watermarkSize,
          opacity: watermarkOpacity,
          position: watermarkPosition,
          color: watermarkColor,
        };
      default:
        return {};
    }
  }, [operation, width, height, resizeFormat, convertFormat, icoSizes, targetKb, compressFormat, watermarkText, watermarkSize, watermarkOpacity, watermarkPosition, watermarkColor]);

  /** Queue a set of files on the server and stream their progress. */
  const run = React.useCallback(
    async (targets: ServerBatchFile[]) => {
      if (targets.length === 0) return;
      setRunning(true);
      try {
        const result = await submitBatch(
          operation,
          targets.map((t) => t.file),
          buildSettings(),
          renameTemplate.trim() || undefined,
        );

        const next: Record<string, ItemJob> = {};
        for (const entry of result.jobs) {
          const target = targets[entry.index];
          if (!target) continue;
          next[target.id] = {
            jobId: entry.jobId,
            state: entry.jobId ? "queued" : "rejected",
            error: entry.error,
            progress: 0,
          };
        }
        setJobs((prev) => ({ ...prev, ...next }));

        const queued = result.jobs.filter((entry): entry is BatchJobResult & { jobId: string } =>
          Boolean(entry.jobId),
        );
        const rejected = result.jobs.filter((entry) => !entry.jobId);
        if (rejected.length > 0) {
          toast.error(`${rejected.length} file${rejected.length === 1 ? "" : "s"} could not be queued.`);
        }

        // Stream each job's progress.
        for (const entry of queued) {
          const target = targets[entry.index];
          if (!target) continue;
          const unsub = subscribeJob(
            entry.jobId,
            (record) => {
              setJobs((prev) => {
                const current = prev[target.id];
                if (!current) return prev;
                const progress =
                  record.state === "completed" ? 100 : parseStageProgress(record.stage);
                return {
                  ...prev,
                  [target.id]: { ...current, state: record.state, progress },
                };
              });
            },
            () => {
              setJobs((prev) => {
                const current = prev[target.id];
                if (!current) return prev;
                return { ...prev, [target.id]: { ...current, state: "failed" } };
              });
            },
          );
          unsubs.current.set(target.id, unsub);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not queue the batch.");
      } finally {
        setRunning(false);
      }
    },
    [operation, buildSettings, renameTemplate],
  );

  const completed = Object.values(jobs).filter((j) => j.state === "completed");
  const failed = Object.values(jobs).filter(
    (j) => j.state === "failed" || j.state === "rejected",
  );
  const readyIds = completed.map((j) => j.jobId).filter((id): id is string => Boolean(id));
  const allDone =
    Object.keys(jobs).length > 0 &&
    Object.values(jobs).every((j) => j.state === "completed" || j.state === "failed" || j.state === "rejected");
  const overall = Object.keys(jobs).length
    ? Math.round(
        Object.values(jobs).reduce((sum, j) => sum + j.progress, 0) / Object.keys(jobs).length,
      )
    : 0;

  const failedFiles = files.filter((f) => {
    const job = jobs[f.id];
    return job && (job.state === "failed" || job.state === "rejected");
  });

  const inputClass =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs";

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Settings */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              Server operation
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Files are uploaded in one request and processed as separate jobs.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {OPERATIONS.map((op) => (
              <button
                key={op.value}
                type="button"
                onClick={() => setOperation(op.value)}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                  operation === op.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-outline-variant/40 hover:bg-muted text-muted-foreground",
                )}
              >
                {op.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {OPERATIONS.find((o) => o.value === operation)?.hint}
          </p>

          {operation === "resize" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Width (px)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={4000}
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Height (px)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={4000}
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Output format</Label>
                <select
                  value={resizeFormat}
                  onChange={(e) => setResizeFormat(e.target.value)}
                  className={inputClass}
                >
                  <option value="jpg">JPG</option>
                  <option value="png">PNG</option>
                  <option value="bmp">BMP</option>
                  <option value="tiff">TIFF</option>
                </select>
              </div>
            </div>
          )}

          {operation === "convert" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Output format</Label>
                <select
                  value={convertFormat}
                  onChange={(e) => setConvertFormat(e.target.value)}
                  className={inputClass}
                >
                  <option value="ico">ICO (icon)</option>
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                  <option value="webp">WebP</option>
                  <option value="gif">GIF</option>
                  <option value="tiff">TIFF</option>
                </select>
              </div>
              {convertFormat === "ico" && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Icon sizes</Label>
                  <Input
                    value={icoSizes}
                    onChange={(e) => setIcoSizes(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Comma-separated, up to 512 px each.
                  </p>
                </div>
              )}
            </div>
          )}

          {operation === "compress" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Target size</span>
                  <span className="font-mono font-semibold">{targetKb} KB</span>
                </div>
                <Slider
                  min={10}
                  max={5000}
                  step={10}
                  value={[targetKb]}
                  onValueChange={(v) => setTargetKb(v[0])}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Output format</Label>
                <select
                  value={compressFormat}
                  onChange={(e) => setCompressFormat(e.target.value)}
                  className={inputClass}
                >
                  <option value="keep">Keep original</option>
                  <option value="jpg">JPG</option>
                  <option value="webp">WebP</option>
                </select>
              </div>
            </div>
          )}

          {operation === "watermark" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Text</Label>
                <Input
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  maxLength={120}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Size</span>
                  <span className="font-mono font-semibold">{watermarkSize}%</span>
                </div>
                <Slider
                  min={2}
                  max={50}
                  step={1}
                  value={[watermarkSize]}
                  onValueChange={(v) => setWatermarkSize(v[0])}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Opacity</span>
                  <span className="font-mono font-semibold">{watermarkOpacity}%</span>
                </div>
                <Slider
                  min={5}
                  max={100}
                  step={5}
                  value={[watermarkOpacity]}
                  onValueChange={(v) => setWatermarkOpacity(v[0])}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Position</Label>
                <select
                  value={watermarkPosition}
                  onChange={(e) => setWatermarkPosition(e.target.value)}
                  className={inputClass}
                >
                  <option value="center">Center</option>
                  <option value="top-left">Top left</option>
                  <option value="top-right">Top right</option>
                  <option value="bottom-left">Bottom left</option>
                  <option value="bottom-right">Bottom right</option>
                  <option value="tile">Tile</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Colour</Label>
                <select
                  value={watermarkColor}
                  onChange={(e) => setWatermarkColor(e.target.value)}
                  className={inputClass}
                >
                  <option value="white">White</option>
                  <option value="black">Black</option>
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1 border-t pt-4">
            <Label className="text-xs font-medium">Rename template</Label>
            <Input
              value={renameTemplate}
              onChange={(e) => setRenameTemplate(e.target.value)}
              maxLength={120}
              className="h-9 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Tokens: <code className="font-mono">{"{name}"}</code>,{" "}
              <code className="font-mono">{"{index}"}</code>,{" "}
              <code className="font-mono">{"{ext}"}</code>. Leave empty to keep the
              original names.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void run(files)}
            disabled={running || files.length === 0}
            className="gap-1.5"
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Server className="w-4 h-4" />
            )}
            {running ? "Uploading…" : `Process ${files.length} on the server`}
          </Button>

          {failedFiles.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={running}
              onClick={() => void run(failedFiles)}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry {failedFiles.length}
            </Button>
          )}

          {readyIds.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                window.location.href = downloadAllUrl(readyIds);
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Download all ({readyIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* File list */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        {Object.keys(jobs).length > 0 && (
          <div className="bg-card border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium mb-2">
              <span className="flex items-center gap-2">
                {allDone ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                {allDone
                  ? `${completed.length} done${failed.length ? `, ${failed.length} failed` : ""}`
                  : "Processing on the server…"}
              </span>
              <span className="font-mono">{overall}%</span>
            </div>
            <Progress value={overall} className="h-2" />
          </div>
        )}

        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <div className="max-h-[620px] overflow-y-auto divide-y divide-border">
            {files.map((item) => {
              const job = jobs[item.id];
              return (
                <div
                  key={item.id}
                  className="p-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground max-w-[320px]">
                      {item.originalName}
                    </p>
                    {job?.error && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-destructive">
                        <TriangleAlert className="w-3 h-3 shrink-0" />
                        {job.error}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {job?.state === "queued" && (
                      <Badge variant="secondary" className="text-[10px] gap-1 text-primary">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Queued
                      </Badge>
                    )}
                    {job?.state === "processing" && (
                      <Badge variant="secondary" className="text-[10px] gap-1 text-primary">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {job.progress}%
                      </Badge>
                    )}
                    {job?.state === "completed" && (
                      <>
                        <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                          <Check className="w-3 h-3 mr-1" />
                          Done
                        </Badge>
                        {job.jobId && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground"
                            title="Download this file"
                            onClick={() => {
                              window.location.href = downloadUrl(job.jobId as string);
                            }}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </>
                    )}
                    {(job?.state === "failed" || job?.state === "rejected") && (
                      <Badge variant="destructive" className="text-[10px]">
                        Failed
                      </Badge>
                    )}
                    {!job && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Ready
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
