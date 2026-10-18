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
import { COMPRESS_FORMATS, COMPRESS_PRESETS, type CompressSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  value: CompressSettings;
  onChange: (settings: CompressSettings) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
      {children}
    </h3>
  );
}

export function CompressSettingsForm({ value, onChange }: Props) {
  const set = <K extends keyof CompressSettings>(key: K, v: CompressSettings[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <SectionTitle>Target size</SectionTitle>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {COMPRESS_PRESETS.map((kb) => (
            <button
              key={kb}
              type="button"
              onClick={() => set("targetKb", kb)}
              className={cn(
                "flex h-11 items-center justify-center rounded-lg border font-mono text-sm font-semibold transition-colors",
                value.targetKb === kb
                  ? "border-primary bg-primary-container/15 text-primary"
                  : "border-outline-variant/30 text-foreground hover:border-primary/50",
              )}
            >
              {kb >= 1000 ? `${kb / 1000}MB` : `${kb}KB`}
            </button>
          ))}
        </div>
        <Slider
          min={10}
          max={5000}
          step={10}
          value={[value.targetKb]}
          onValueChange={(v) => set("targetKb", v[0])}
          aria-label="Target size in KB"
        />
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
          The engine finds the highest quality that fits under{" "}
          <span className="font-semibold text-primary">{value.targetKb} KB</span>.
          Perfect for government and job application uploads.
        </p>
      </div>

      <div className="space-y-3">
        <SectionTitle>Output settings</SectionTitle>
        <div>
          <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
            Format
          </label>
          <Select
            value={value.format}
            onValueChange={(format) => set("format", format as CompressSettings["format"])}
          >
            <SelectTrigger className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPRESS_FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
          Dimensions are kept; only quality is reduced (downscaling happens only
          if the target cannot be met otherwise).
        </p>
      </div>
    </div>
  );
}
