"use client";

import * as React from "react";
import { Mic2, Sparkles, Volume2 } from "lucide-react";

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
  AUDIO_BITRATES,
  AUDIO_CHANNELS,
  AUDIO_OUTPUT_FORMATS,
  AUDIO_SAMPLE_RATES,
  type AudioSettings,
} from "@/lib/types";
import { VOICE_CHARACTERS } from "@/lib/voice-presets";
import { cn } from "@/lib/utils";

interface Props {
  value: AudioSettings;
  onChange: (settings: AudioSettings) => void;
  duration?: number;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
      {children}
    </h3>
  );
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const FORMAT_LABELS: Record<AudioSettings["format"], { label: string; desc: string }> = {
  mp3: { label: "MP3 (MPEG Audio)", desc: "Universal compatibility with great compression" },
  wav: { label: "WAV (Uncompressed PCM)", desc: "Lossless studio quality; larger file size" },
  m4a: { label: "M4A (Apple AAC)", desc: "High quality audio preferred by Apple devices" },
  aac: { label: "AAC (Advanced Audio)", desc: "Standard streaming codec with high fidelity" },
  flac: { label: "FLAC (Lossless Free Audio)", desc: "Bit-perfect lossless compression" },
  ogg: { label: "OGG (Vorbis)", desc: "Open-source high efficiency lossy codec" },
  opus: { label: "OPUS (Interactive Audio)", desc: "Next-gen codec for voice and music" },
};

export function AudioSettingsForm({ value, onChange, duration = 0 }: Props) {
  const set = <K extends keyof AudioSettings>(key: K, v: AudioSettings[K]) =>
    onChange({ ...value, [key]: v });

  const isLossless = value.format === "wav" || value.format === "flac";
  const hasDuration = duration > 0;
  const effectiveEnd = value.trimEnd && value.trimEnd > 0 ? Math.min(value.trimEnd, duration) : duration;
  const clipLength = hasDuration ? Math.max(0, effectiveEnd - (value.trimStart ?? 0)) : 0;
  const volumePercent = Math.round((value.volume ?? 1) * 100);

  return (
    <div className="space-y-6">
      {/* Format Selection */}
      <div className="space-y-3">
        <SectionTitle>Output Format</SectionTitle>
        <div className="grid grid-cols-2 gap-2 xs:grid-cols-4">
          {AUDIO_OUTPUT_FORMATS.map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => set("format", fmt)}
              className={cn(
                "flex h-11 items-center justify-center rounded-lg border font-display text-[13px] font-semibold uppercase transition-colors",
                value.format === fmt
                  ? "border-primary bg-primary-container/15 text-primary"
                  : "border-outline-variant/30 text-foreground hover:border-primary/50",
              )}
            >
              {fmt}
            </button>
          ))}
        </div>
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
          {FORMAT_LABELS[value.format].desc}
        </p>
      </div>

      {/* Bitrate Selection (Lossy only) */}
      {!isLossless && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Audio Bitrate</SectionTitle>
            <span className="font-mono text-xs text-primary font-semibold">{value.bitrate} kbps</span>
          </div>
          <Select
            value={String(value.bitrate)}
            onValueChange={(b) => set("bitrate", Number(b))}
          >
            <SelectTrigger className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIO_BITRATES.map((b) => (
                <SelectItem key={b} value={String(b)}>
                  {b} kbps {b >= 256 ? "(Highest Quality)" : b >= 192 ? "(Recommended)" : "(Compact)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Channels & Sample Rate */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
            Channels
          </label>
          <Select
            value={value.channels ?? "keep"}
            onValueChange={(ch) => set("channels", ch as AudioSettings["channels"])}
          >
            <SelectTrigger className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep">Keep Original</SelectItem>
              <SelectItem value="mono">Mono (1-ch)</SelectItem>
              <SelectItem value="stereo">Stereo (2-ch)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
            Sample Rate
          </label>
          <Select
            value={String(value.sampleRate ?? "original")}
            onValueChange={(sr) => set("sampleRate", sr === "original" ? undefined : Number(sr))}
          >
            <SelectTrigger className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original</SelectItem>
              {AUDIO_SAMPLE_RATES.map((sr) => (
                <SelectItem key={sr} value={String(sr)}>
                  {(sr / 1000).toFixed(1)} kHz {sr === 44100 ? "(CD)" : sr === 48000 ? "(Studio)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Volume Adjustment */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionTitle>Volume Adjustment</SectionTitle>
          <span className="font-mono text-xs text-primary font-semibold">{volumePercent}%</span>
        </div>
        <div className="flex items-center gap-3">
          <Volume2 className="h-4 w-4 text-on-surface-variant shrink-0" />
          <Slider
            value={[value.volume ?? 1]}
            min={0.25}
            max={2.0}
            step={0.05}
            onValueChange={([v]) => set("volume", Math.round(v * 100) / 100)}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => set("volume", 1)}
            className="rounded border border-outline-variant/30 px-2 py-0.5 font-mono text-[11px] text-on-surface-variant hover:border-primary hover:text-primary cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Voice Character & Pitch Morphing */}
      <div className="space-y-3 rounded-xl border border-outline-variant/20 bg-muted/30 p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <SectionTitle>Voice Changer & Character Morpher</SectionTitle>
          </div>
          {value.voicePreset && value.voicePreset !== "none" && (
            <button
              type="button"
              onClick={() => {
                onChange({
                  ...value,
                  voicePreset: "none",
                  pitchShift: 0,
                  speed: 1,
                  reverb: 0,
                });
              }}
              className="font-mono text-[11px] text-muted-foreground hover:text-primary cursor-pointer"
            >
              Reset to Original
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {VOICE_CHARACTERS.map((char) => {
            const isSelected = (value.voicePreset ?? "none") === char.id;
            return (
              <button
                key={char.id}
                type="button"
                onClick={() => {
                  onChange({
                    ...value,
                    voicePreset: char.id,
                    pitchShift: char.pitchShift,
                    speed: char.speed,
                    reverb: char.reverb,
                  });
                }}
                className={cn(
                  "flex flex-col items-start rounded-lg border p-2 text-left transition-all cursor-pointer",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary"
                    : "border-outline-variant/25 bg-surface-container-low hover:border-primary/40",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-base">{char.emoji}</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {char.badge}
                  </span>
                </div>
                <span className="mt-1 font-display text-xs font-semibold leading-tight text-foreground">
                  {char.name}
                </span>
                <span className="text-[10px] text-muted-foreground leading-snug line-clamp-1">
                  {char.transformation}
                </span>
              </button>
            );
          })}
        </div>

        {/* Fine-Tuning Pitch & Speed */}
        {value.voicePreset && value.voicePreset !== "none" && (
          <div className="space-y-3 pt-2 border-t border-outline-variant/15">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Pitch Shift</span>
                <span className="font-mono font-semibold text-primary">
                  {(value.pitchShift ?? 0) > 0 ? `+${value.pitchShift}` : value.pitchShift ?? 0} semitones
                </span>
              </div>
              <Slider
                value={[value.pitchShift ?? 0]}
                min={-12}
                max={12}
                step={0.5}
                onValueChange={([p]) => set("pitchShift", Math.round(p * 10) / 10)}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Speed / Tempo</span>
                <span className="font-mono font-semibold text-primary">
                  {(value.speed ?? 1).toFixed(2)}x
                </span>
              </div>
              <Slider
                value={[value.speed ?? 1]}
                min={0.5}
                max={1.8}
                step={0.05}
                onValueChange={([s]) => set("speed", Math.round(s * 100) / 100)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Timeline Trimmer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Trim & Duration</SectionTitle>
          {hasDuration && (
            <span className="font-mono text-xs text-primary font-semibold">
              {clipLength.toFixed(1)}s ({formatClock(clipLength)})
            </span>
          )}
        </div>

        {hasDuration && (
          <div className="space-y-3 rounded-xl border border-outline-variant/15 bg-muted/40 p-3.5">
            <div className="flex justify-between font-mono text-[11px] text-on-surface-variant">
              <span>Start: {formatClock(value.trimStart ?? 0)}</span>
              <span>End: {formatClock(effectiveEnd)}</span>
            </div>
            <div className="relative h-6 w-full rounded-lg bg-surface-container-high/80 overflow-hidden border border-outline-variant/30">
              <div
                className="absolute inset-y-0 bg-primary/25 border-x-2 border-primary transition-all"
                style={{
                  left: `${Math.min(100, Math.max(0, ((value.trimStart ?? 0) / duration) * 100))}%`,
                  width: `${Math.min(
                    100,
                    Math.max(0, ((effectiveEnd - (value.trimStart ?? 0)) / duration) * 100),
                  )}%`,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="font-mono text-[10px] font-semibold text-foreground/80">
                  Total: {formatClock(duration)}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-on-surface-variant">
                <span>Scrub Start: {(value.trimStart ?? 0).toFixed(1)}s</span>
              </div>
              <Slider
                value={[value.trimStart ?? 0]}
                min={0}
                max={Math.max(0, effectiveEnd - 0.5)}
                step={0.1}
                onValueChange={([v]) => set("trimStart", Math.round(v * 10) / 10)}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-on-surface-variant">
                <span>Scrub End: {effectiveEnd.toFixed(1)}s</span>
              </div>
              <Slider
                value={[effectiveEnd]}
                min={Math.min(duration, (value.trimStart ?? 0) + 0.5)}
                max={duration}
                step={0.1}
                onValueChange={([v]) => {
                  const rounded = Math.round(v * 10) / 10;
                  set("trimEnd", rounded >= duration ? 0 : rounded);
                }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block font-mono text-xs text-on-surface-variant">Start (s)</label>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={value.trimStart ?? 0}
              onChange={(e) => set("trimStart", Math.max(0, Number(e.target.value) || 0))}
              className="bg-muted"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs text-on-surface-variant">End (s)</label>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={value.trimEnd ?? 0}
              placeholder={hasDuration ? `${duration.toFixed(1)} (full)` : "full"}
              onChange={(e) => set("trimEnd", Math.max(0, Number(e.target.value) || 0))}
              className="bg-muted"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
