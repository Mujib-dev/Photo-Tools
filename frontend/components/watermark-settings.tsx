"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  ENHANCE_FORMATS,
  WATERMARK_POSITIONS,
  type WatermarkPosition,
  type WatermarkSettings,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  value: WatermarkSettings;
  onChange: (settings: WatermarkSettings) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
      {children}
    </h3>
  );
}

export function WatermarkSettingsForm({ value, onChange }: Props) {
  const set = <K extends keyof WatermarkSettings>(key: K, v: WatermarkSettings[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <SectionTitle>Watermark text</SectionTitle>
        <Input
          value={value.text}
          maxLength={60}
          placeholder="© Your Name"
          onChange={(e) => set("text", e.target.value)}
          aria-label="Watermark text"
        />
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
          Up to 60 characters. Rendered into the image pixels.
        </p>
      </div>

      <div className="space-y-3">
        <SectionTitle>Placement</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {WATERMARK_POSITIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => set("position", p.value)}
              className={cn(
                "flex h-10 items-center justify-center rounded-lg border font-mono text-xs font-semibold transition-colors",
                value.position === p.value
                  ? "border-primary bg-primary-container/15 text-primary"
                  : "border-outline-variant/30 text-foreground hover:border-primary/50",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <SectionTitle>Appearance</SectionTitle>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-display text-[13px] font-semibold text-on-surface-variant">
              Opacity
            </label>
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-primary">
              {value.opacity}%
            </span>
          </div>
          <Slider
            min={5}
            max={100}
            step={1}
            value={[value.opacity]}
            onValueChange={(v) => set("opacity", v[0])}
            aria-label="Opacity"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-display text-[13px] font-semibold text-on-surface-variant">
              Size
            </label>
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-primary">
              {value.size}% width
            </span>
          </div>
          <Slider
            min={2}
            max={30}
            step={1}
            value={[value.size]}
            onValueChange={(v) => set("size", v[0])}
            aria-label="Font size"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["white", "black"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("color", c)}
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-lg border font-mono text-sm font-semibold capitalize transition-colors",
                value.color === c
                  ? "border-primary bg-primary-container/15 text-primary"
                  : "border-outline-variant/30 text-foreground hover:border-primary/50",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full border border-outline-variant/50",
                  c === "white" ? "bg-white" : "bg-black",
                )}
              />
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle>Output settings</SectionTitle>
        <Select
          value={value.format}
          onValueChange={(format) => set("format", format as WatermarkSettings["format"])}
        >
          <SelectTrigger className="bg-muted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENHANCE_FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export type { WatermarkPosition };
