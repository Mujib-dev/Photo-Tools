"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONVERT_FORMATS, ICO_SIZES, type ConvertSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  value: ConvertSettings;
  onChange: (settings: ConvertSettings) => void;
}

const PRESETS: { id: string; label: string; sizes: number[] }[] = [
  { id: "standard", label: "Standard (all sizes)", sizes: [16, 32, 48, 64, 128, 256] },
  { id: "app", label: "App icon (256)", sizes: [256] },
  { id: "favicon", label: "Favicon (16, 32, 48)", sizes: [16, 32, 48] },
  { id: "high", label: "HiDPI (128, 256)", sizes: [128, 256] },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
      {children}
    </h3>
  );
}

export function ConvertSettingsForm({ value, onChange }: Props) {
  const isIco = value.format === "ico";

  const toggleSize = (size: number) => {
    const has = value.sizes.includes(size);
    const next = has ? value.sizes.filter((s) => s !== size) : [...value.sizes, size];
    onChange({ ...value, sizes: next.length > 0 ? next : [size] });
  };

  const matchesPreset = (sizes: number[]) =>
    sizes.length === value.sizes.length && sizes.every((s) => value.sizes.includes(s));

  return (
    <div className="space-y-8">
      {/* Output format */}
      <div className="space-y-3">
        <SectionTitle>Convert to</SectionTitle>
        <Select
          value={value.format}
          onValueChange={(format) =>
            onChange({ ...value, format: format as ConvertSettings["format"] })
          }
        >
          <SelectTrigger className="bg-muted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONVERT_FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
          {isIco
            ? "Output is a single .ico file. The image is centered, cropped square and resized with high-quality filtering."
            : "Output keeps the original dimensions and quality of your image."}
        </p>
      </div>

      {isIco && (
        <>
          {/* Quick presets */}
          <div className="space-y-3">
            <SectionTitle>Quick presets</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange({ ...value, sizes: [...p.sizes].sort((a, b) => a - b) })}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left font-display text-[13px] font-semibold transition-colors",
                    matchesPreset(p.sizes)
                      ? "border-primary bg-muted text-primary"
                      : "border-outline-variant/30 text-foreground hover:border-primary/50",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sizes */}
          <div className="space-y-3">
            <SectionTitle>Icon sizes to include</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {ICO_SIZES.map((size) => {
                const selected = value.sizes.includes(size);
                return (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSize(size)}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-lg border font-mono text-sm font-semibold transition-colors",
                      selected
                        ? "border-primary bg-primary-container/15 text-primary"
                        : "border-outline-variant/30 text-foreground hover:border-primary/50",
                    )}
                  >
                    {size}px
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
