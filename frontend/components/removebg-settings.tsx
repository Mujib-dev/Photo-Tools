"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  REMOVEBG_BACKGROUNDS,
  REMOVEBG_FORMATS,
  type RemoveBgSettings,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function rgbToHex(rgb: string): string {
  const parts = rgb.split(",").map((n) => parseInt(n.trim(), 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return "#ffffff";
  }
  return "#" + parts.map((n) => n.toString(16).padStart(2, "0")).join("");
}

interface Props {
  value: RemoveBgSettings;
  onChange: (settings: RemoveBgSettings) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
      {children}
    </h3>
  );
}

export function RemoveBgSettingsForm({ value, onChange }: Props) {
  const set = <K extends keyof RemoveBgSettings>(key: K, v: RemoveBgSettings[K]) =>
    onChange({ ...value, [key]: v });

  const isCustom = value.background === "custom";

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <SectionTitle>New background</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {REMOVEBG_BACKGROUNDS.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => set("background", b.value)}
              className={cn(
                "flex h-11 items-center justify-center rounded-lg border font-mono text-sm font-semibold transition-colors",
                value.background === b.value
                  ? "border-primary bg-primary-container/15 text-primary"
                  : "border-outline-variant/30 text-foreground hover:border-primary/50",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
          {REMOVEBG_BACKGROUNDS.find((b) => b.value === value.background)?.desc}
        </p>

        {isCustom && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary-container/5 p-3">
            <label className="mb-1.5 block font-display text-[13px] font-semibold text-on-surface-variant">
              Custom background color
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={value.customColor ? rgbToHex(value.customColor) : "#ffffff"}
                onChange={(e) => {
                  const hex = e.target.value;
                  // Convert hex to r,g,b
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  set("customColor", `${r},${g},${b}`);
                }}
                className="h-10 w-10 rounded-md border border-outline-variant/30 cursor-pointer"
                title="Pick a background color"
              />
              <Input
                type="text"
                value={value.customColor || ""}
                placeholder="r,g,b  (e.g. 255,0,0)"
                onChange={(e) => set("customColor", e.target.value)}
                className="flex-1 h-10 rounded-md border border-outline-variant/30 bg-background px-3 text-sm font-mono"
                aria-label="Custom color as r,g,b (0-255)"
              />
            </div>
            <p className="text-xs text-on-surface-variant">
              Enter RGB values 0–255 (e.g. 255,0,0 for red) or use the color picker.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <SectionTitle>AI engine</SectionTitle>
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
          A U2Net neural network finds the subject and cuts it out. It runs on
          this server&apos;s CPU — no data leaves your machine. The model
          downloads once on first use.
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
            onValueChange={(format) => set("format", format as RemoveBgSettings["format"])}
          >
            <SelectTrigger className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMOVEBG_FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {value.format === "jpg" && value.background === "transparent" && (
          <p className="rounded-lg border border-primary/30 bg-primary-container/10 px-3 py-2 font-mono text-xs text-on-surface-variant">
            JPEG cannot store transparency — the cut-out will be placed on white.
          </p>
        )}
      </div>
    </div>
  );
}
