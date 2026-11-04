"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  AUDIO_FORMATS,
  FRAME_FORMATS,
  FRAME_INTERVALS,
  THUMBNAIL_FORMATS,
  VIDEO_AUDIO_BITRATES,
  VIDEO_AUDIO_MODES,
  VIDEO_FORMATS,
  VIDEO_FPS,
  VIDEO_OUTPUT_KINDS,
  VIDEO_RESOLUTIONS,
  VIDEO_SPEEDS,
  VIDEO_TARGET_PRESETS,
  type VideoSettings,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  value: VideoSettings;
  onChange: (settings: VideoSettings) => void;
  /** Duration (seconds) of the selected source video, when known. */
  duration?: number;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
      {children}
    </h3>
  );
}

function formatTarget(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(kb % 1024 === 0 ? 0 : 1)} MB` : `${kb} KB`;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function NumberField({
  label,
  value,
  min = 0,
  max = 86_400,
  step = 0.1,
  suffix,
  placeholder,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  placeholder?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
        {label}
      </label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
          }}
          className="bg-muted"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-on-surface-variant">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function VideoSettingsForm({ value, onChange, duration = 0 }: Props) {
  const set = <K extends keyof VideoSettings>(key: K, v: VideoSettings[K]) =>
    onChange({ ...value, [key]: v });

  const hasDuration = duration > 0;
  const clipLength = hasDuration
    ? Math.max(0, (value.trimEnd > 0 ? Math.min(value.trimEnd, duration) : duration) - value.trimStart)
    : 0;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <SectionTitle>Output type</SectionTitle>
        <div className="grid grid-cols-2 gap-2 xs:grid-cols-5">
          {VIDEO_OUTPUT_KINDS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => set("output", o.value)}
              className={cn(
                "flex h-11 items-center justify-center rounded-lg border font-display text-[13px] font-semibold transition-colors",
                value.output === o.value
                  ? "border-primary bg-primary-container/15 text-primary"
                  : "border-outline-variant/30 text-foreground hover:border-primary/50",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {value.output !== "thumbnail" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionTitle>Trim &amp; Timeline</SectionTitle>
            {hasDuration && (
              <span className="font-mono text-xs text-primary font-semibold">
                {clipLength.toFixed(1)}s ({formatClock(clipLength)})
              </span>
            )}
          </div>

          {hasDuration && (
            <div className="space-y-3 rounded-xl border border-outline-variant/15 bg-muted/40 p-3.5">
              {/* Timeline track visualizer */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-mono text-[11px] text-on-surface-variant">
                  <span>Start: {formatClock(value.trimStart)}</span>
                  <span>End: {formatClock(value.trimEnd > 0 ? Math.min(value.trimEnd, duration) : duration)}</span>
                </div>
                <div className="relative h-6 w-full rounded-lg bg-surface-container-high/80 overflow-hidden border border-outline-variant/30">
                  {/* Selected slice highlight */}
                  <div
                    className="absolute inset-y-0 bg-primary/25 border-x-2 border-primary transition-all"
                    style={{
                      left: `${Math.min(100, Math.max(0, (value.trimStart / duration) * 100))}%`,
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          (((value.trimEnd > 0 ? Math.min(value.trimEnd, duration) : duration) - value.trimStart) /
                            duration) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                  {/* Center time marker label */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="font-mono text-[10px] font-semibold text-foreground/80">
                      Total: {formatClock(duration)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Start scrubber slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-on-surface-variant font-medium">
                  <span>Scrub Start: {value.trimStart.toFixed(1)}s</span>
                  <span className="font-mono text-[11px]">{formatClock(value.trimStart)}</span>
                </div>
                <Slider
                  value={[value.trimStart]}
                  min={0}
                  max={Math.max(0, (value.trimEnd > 0 ? Math.min(value.trimEnd, duration) : duration) - 0.5)}
                  step={0.1}
                  onValueChange={([v]) => set("trimStart", Math.round(v * 10) / 10)}
                />
              </div>

              {/* End scrubber slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-on-surface-variant font-medium">
                  <span>
                    Scrub End:{" "}
                    {(value.trimEnd > 0 ? Math.min(value.trimEnd, duration) : duration).toFixed(1)}s
                  </span>
                  <span className="font-mono text-[11px]">
                    {formatClock(value.trimEnd > 0 ? Math.min(value.trimEnd, duration) : duration)}
                  </span>
                </div>
                <Slider
                  value={[value.trimEnd > 0 ? Math.min(value.trimEnd, duration) : duration]}
                  min={Math.min(duration, value.trimStart + 0.5)}
                  max={duration}
                  step={0.1}
                  onValueChange={([v]) => {
                    const rounded = Math.round(v * 10) / 10;
                    set("trimEnd", rounded >= duration ? 0 : rounded);
                  }}
                />
              </div>

              {/* Quick trim presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onChange({ ...value, trimStart: 0, trimEnd: 0 })}
                  className="rounded-md border border-outline-variant/30 bg-background px-2 py-1 font-mono text-[11px] text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                >
                  Full Video
                </button>
                {duration >= 15 && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, trimStart: 0, trimEnd: 15 })}
                    className="rounded-md border border-outline-variant/30 bg-background px-2 py-1 font-mono text-[11px] text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                  >
                    First 15s
                  </button>
                )}
                {duration >= 30 && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, trimStart: 0, trimEnd: 30 })}
                    className="rounded-md border border-outline-variant/30 bg-background px-2 py-1 font-mono text-[11px] text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                  >
                    First 30s
                  </button>
                )}
                {duration >= 60 && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, trimStart: 0, trimEnd: 60 })}
                    className="rounded-md border border-outline-variant/30 bg-background px-2 py-1 font-mono text-[11px] text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                  >
                    First 60s
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Start Time"
              value={value.trimStart}
              onChange={(v) => set("trimStart", v)}
              suffix="s"
            />
            <NumberField
              label="End Time"
              value={value.trimEnd}
              onChange={(v) => set("trimEnd", v)}
              placeholder={hasDuration ? `${duration.toFixed(1)} (full)` : "full"}
              suffix="s"
            />
          </div>
          <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
            {hasDuration ? (
              <>
                Source {formatClock(duration)} · clip{" "}
                <span className="font-semibold text-primary">{clipLength.toFixed(1)}s</span>. Leave End
                at 0 to keep the rest.
              </>
            ) : (
              "Enter seconds. Leave End at 0 to keep everything to the end."
            )}
          </p>
        </div>
      )}

      {(value.output === "video" || value.output === "gif") && (
        <div className="space-y-3">
          <SectionTitle>Speed</SectionTitle>
          <Select
            value={String(value.speed)}
            onValueChange={(speed) => set("speed", Number(speed) as VideoSettings["speed"])}
          >
            <SelectTrigger className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIDEO_SPEEDS.map((s) => (
                <SelectItem key={s.value} value={String(s.value)}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value.output === "video" && (
        <>
          <div className="space-y-4">
            <SectionTitle>Compression mode</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { mode: "target" as const, label: "Target size" },
                  { mode: "quality" as const, label: "Quality (CRF)" },
                ]
              ).map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set("mode", mode)}
                  className={cn(
                    "flex h-11 items-center justify-center rounded-lg border font-display text-[13px] font-semibold transition-colors",
                    value.mode === mode
                      ? "border-primary bg-primary-container/15 text-primary"
                      : "border-outline-variant/30 text-foreground hover:border-primary/50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {value.mode === "target" ? (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {VIDEO_TARGET_PRESETS.map((kb) => (
                    <button
                      key={kb}
                      type="button"
                      onClick={() => set("targetKb", kb)}
                      className={cn(
                        "flex h-11 items-center justify-center rounded-lg border font-mono text-xs font-semibold transition-colors",
                        value.targetKb === kb
                          ? "border-primary bg-primary-container/15 text-primary"
                          : "border-outline-variant/30 text-foreground hover:border-primary/50",
                      )}
                    >
                      {formatTarget(kb)}
                    </button>
                  ))}
                </div>
                <Slider
                  min={100}
                  max={200_000}
                  step={100}
                  value={[value.targetKb]}
                  onValueChange={(v) => set("targetKb", v[0])}
                  aria-label="Target size in KB"
                />
                <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
                  The engine re-encodes until the video fits under{" "}
                  <span className="font-semibold text-primary">{formatTarget(value.targetKb)}</span>,
                  keeping the highest quality it can.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <Slider
                  min={18}
                  max={40}
                  step={1}
                  value={[value.crf]}
                  onValueChange={(v) => set("crf", v[0])}
                  aria-label="Quality (CRF)"
                />
                <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
                  CRF <span className="font-semibold text-primary">{value.crf}</span> — lower is
                  higher quality. 18 is near-lossless, 28 is balanced, 40 is small.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <SectionTitle>Output</SectionTitle>
            <div>
              <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
                Resolution
              </label>
              <Select
                value={value.resolution}
                onValueChange={(resolution) => set("resolution", resolution as VideoSettings["resolution"])}
              >
                <SelectTrigger className="bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_RESOLUTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
                Format
              </label>
              <Select
                value={value.format}
                onValueChange={(format) => set("format", format as VideoSettings["format"])}
              >
                <SelectTrigger className="bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
              Videos smaller than the chosen resolution are never upscaled.
            </p>
          </div>

          <div className="space-y-3">
            <SectionTitle>Audio</SectionTitle>
            <Select
              value={value.audioMode}
              onValueChange={(audioMode) => set("audioMode", audioMode as VideoSettings["audioMode"])}
            >
              <SelectTrigger className="bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIDEO_AUDIO_MODES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {value.audioMode === "bitrate" && (
              <Select
                value={String(value.audioKbps)}
                onValueChange={(kbps) => set("audioKbps", Number(kbps))}
              >
                <SelectTrigger className="bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_AUDIO_BITRATES.map((kbps) => (
                    <SelectItem key={kbps} value={String(kbps)}>
                      {kbps} kbps
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </>
      )}

      {value.output === "gif" && (
        <div className="space-y-3">
          <SectionTitle>Animation</SectionTitle>
          <div>
            <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
              Frame rate
            </label>
            <Select
              value={String(value.fps)}
              onValueChange={(fps) => set("fps", Number(fps) as VideoSettings["fps"])}
            >
              <SelectTrigger className="bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIDEO_FPS.map((f) => (
                  <SelectItem key={f.value} value={String(f.value)}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
              Resolution
            </label>
            <Select
              value={value.resolution}
              onValueChange={(resolution) => set("resolution", resolution as VideoSettings["resolution"])}
            >
              <SelectTrigger className="bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIDEO_RESOLUTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
            GIFs have no sound. Lower frame rates produce smaller files.
          </p>
        </div>
      )}

      {value.output === "thumbnail" && (
        <div className="space-y-4">
          <SectionTitle>Thumbnail Frame</SectionTitle>
          {hasDuration && (
            <div className="space-y-2 rounded-xl border border-outline-variant/15 bg-muted/40 p-3.5">
              <div className="flex justify-between text-xs text-on-surface-variant font-medium">
                <span>Timeline Scrubber</span>
                <span className="font-mono text-primary font-semibold">
                  {formatClock(value.frameTime)} ({value.frameTime.toFixed(1)}s)
                </span>
              </div>
              <Slider
                value={[value.frameTime]}
                min={0}
                max={duration}
                step={0.1}
                onValueChange={([v]) => set("frameTime", Math.round(v * 10) / 10)}
              />
              <div className="flex justify-between font-mono text-[10px] text-on-surface-variant">
                <span>0:00</span>
                <span>{formatClock(duration / 2)}</span>
                <span>{formatClock(duration)}</span>
              </div>
            </div>
          )}
          <NumberField
            label="Capture Timestamp"
            value={value.frameTime}
            onChange={(v) => set("frameTime", v)}
            suffix="s"
          />
          <div>
            <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
              Image format
            </label>
            <Select
              value={value.thumbFormat}
              onValueChange={(thumbFormat) =>
                set("thumbFormat", thumbFormat as VideoSettings["thumbFormat"])
              }
            >
              <SelectTrigger className="bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THUMBNAIL_FORMATS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
              Resolution
            </label>
            <Select
              value={value.resolution}
              onValueChange={(resolution) => set("resolution", resolution as VideoSettings["resolution"])}
            >
              <SelectTrigger className="bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIDEO_RESOLUTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
            Exports a single frame as an image. {hasDuration && `Clip is ${formatClock(duration)} long.`}
          </p>
        </div>
      )}

      {value.output === "audio" && (
        <div className="space-y-3">
          <SectionTitle>Audio</SectionTitle>
          <div>
            <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
              Format
            </label>
            <Select
              value={value.audioFormat}
              onValueChange={(audioFormat) => set("audioFormat", audioFormat as VideoSettings["audioFormat"])}
            >
              <SelectTrigger className="bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIO_FORMATS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {value.audioFormat !== "wav" && (
            <div>
              <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
                Bitrate
              </label>
              <Select
                value={String(value.audioKbps)}
                onValueChange={(kbps) => set("audioKbps", Number(kbps))}
              >
                <SelectTrigger className="bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_AUDIO_BITRATES.map((kbps) => (
                    <SelectItem key={kbps} value={String(kbps)}>
                      {kbps} kbps
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
            Extracts the soundtrack as a single audio file. MP3/M4A are compressed; WAV is lossless.
          </p>
        </div>
      )}

      {value.output === "frames" && (
        <div className="space-y-3">
          <SectionTitle>Frames</SectionTitle>
          <div>
            <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
              Capture every
            </label>
            <Select
              value={String(value.framesInterval)}
              onValueChange={(v) => set("framesInterval", Number(v))}
            >
              <SelectTrigger className="bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FRAME_INTERVALS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}s
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
              Image format
            </label>
            <Select
              value={value.framesFormat}
              onValueChange={(framesFormat) => set("framesFormat", framesFormat as VideoSettings["framesFormat"])}
            >
              <SelectTrigger className="bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FRAME_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <NumberField
            label="Max frames"
            value={value.framesMax}
            min={1}
            max={2000}
            step={1}
            onChange={(v) => set("framesMax", Math.round(v))}
          />

          <div>
            <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
              Resolution
            </label>
            <Select
              value={value.resolution}
              onValueChange={(resolution) => set("resolution", resolution as VideoSettings["resolution"])}
            >
              <SelectTrigger className="bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIDEO_RESOLUTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
            Saves still frames every {value.framesInterval}s (up to {value.framesMax}) and bundles them
            into a ZIP.
          </p>
        </div>
      )}
    </div>
  );
}
