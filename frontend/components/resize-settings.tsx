"use client";

import * as React from "react";
import { Ruler, Scissors } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RESIZE_PRESETS, type ResizeSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  value: ResizeSettings;
  onChange: (settings: ResizeSettings) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
      {children}
    </h3>
  );
}

export function ResizeSettingsForm({ value, onChange }: Props) {
  const activePreset = RESIZE_PRESETS.find(
    (p) =>
      p.mode === value.mode &&
      Math.abs(p.width - value.width) < 0.001 &&
      Math.abs(p.height - value.height) < 0.001 &&
      p.dpi === value.dpi,
  );

  const selectPreset = (id: string) => {
    const preset = RESIZE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    onChange({
      mode: preset.mode,
      width: preset.width,
      height: preset.height,
      dpi: preset.dpi,
      format: value.format,
    });
  };

  const outputPx =
    value.mode === "cm"
      ? {
          width: Math.round((value.width / 2.54) * value.dpi),
          height: Math.round((value.height / 2.54) * value.dpi),
        }
      : { width: Math.round(value.width), height: Math.round(value.height) };

  return (
    <div className="space-y-8">
      {/* Dimensions */}
      <div className="space-y-4">
        <SectionTitle>Dimensions</SectionTitle>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["cm", "px"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ ...value, mode, dpi: mode === "cm" ? 300 : 72 })}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md py-2 font-display text-[13px] font-semibold transition-colors",
                value.mode === mode
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-foreground",
              )}
            >
              {mode === "cm" ? <Ruler className="h-3.5 w-3.5" /> : <Scissors className="h-3.5 w-3.5" />}
              {mode === "cm" ? "Centimeters" : "Pixels"}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 rounded-lg bg-muted p-3 transition-all focus-within:ring-2 focus-within:ring-primary/40">
            <label className="mb-1 block text-[10px] font-display font-semibold text-on-surface-variant">
              Width
            </label>
            <div className="flex items-center">
              <Input
                type="number"
                min={1}
                max={value.mode === "cm" ? 500 : 4000}
                step={value.mode === "cm" ? 0.05 : 1}
                value={
                  Number.isInteger(value.width) ? value.width : value.width.toFixed(2)
                }
                onChange={(e) => {
                  const v = e.target.value;
                  // Only accept valid numbers (digits, optional decimal point)
                  if (/^\d*\.?\d*$/.test(v)) {
                    onChange({ ...value, width: Number.parseFloat(v) || 0 });
                  }
                }}
                onBlur={(e) => {
                  const v = Number.parseFloat(e.target.value);
                  if (!Number.isNaN(v) && v > 0) {
                    onChange({ ...value, width: v });
                  }
                }}
                className="h-9 w-[70px] rounded-md border border-outline-variant/30 bg-background px-2 font-mono text-xs shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                inputMode="numeric"
                aria-label={`Width in ${value.mode}`}
              />
              <span className="pl-2 font-mono text-xs text-on-surface-variant text-center w-12 shrink-0">
                {value.mode}
              </span>
            </div>
          </div>
          <div className="flex-1 rounded-lg bg-muted p-3 transition-all focus-within:ring-2 focus-within:ring-primary/40">
            <label className="mb-1 block text-[10px] font-display font-semibold text-on-surface-variant">
              Height
            </label>
            <div className="flex items-center">
              <Input
                type="number"
                min={1}
                max={value.mode === "cm" ? 500 : 4000}
                step={value.mode === "cm" ? 0.05 : 1}
                value={
                  Number.isInteger(value.height) ? value.height : value.height.toFixed(2)
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d*\.?\d*$/.test(v)) {
                    onChange({ ...value, height: Number.parseFloat(v) || 0 });
                  }
                }}
                onBlur={(e) => {
                  const v = Number.parseFloat(e.target.value);
                  if (!Number.isNaN(v) && v > 0) {
                    onChange({ ...value, height: v });
                  }
                }}
                className="h-9 w-[70px] rounded-md border border-outline-variant/30 bg-background px-2 font-mono text-xs shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                inputMode="numeric"
                aria-label={`Height in ${value.mode}`}
              />
              <span className="pl-2 font-mono text-xs text-on-surface-variant text-center w-12 shrink-0">
                {value.mode}
              </span>
            </div>
          </div>
        </div>
        {value.mode === "cm" && (
          <div className="flex items-center gap-2">
            <label className="w-12 font-display text-[13px] font-semibold text-on-surface-variant">
              DPI
            </label>
            <div className="flex flex-1 items-center rounded-lg bg-muted p-3 transition-all focus-within:ring-2 focus-within:ring-primary/40">
              <Input
                type="number"
                min={72}
                max={1200}
                step={72}
                value={value.dpi}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d*$/.test(v)) {
                    onChange({ ...value, dpi: Number.parseInt(v) || 300 });
                  }
                }}
                onBlur={(e) => {
                  const v = Number.parseInt(e.target.value);
                  if (!Number.isNaN(v) && v >= 72) {
                    onChange({ ...value, dpi: v });
                  }
                }}
                className="h-9 w-[60px] rounded-md border border-outline-variant/30 bg-background px-2 font-mono text-xs shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                inputMode="numeric"
                aria-label="DPI"
              />
              <span className="pl-2 font-mono text-xs text-on-surface-variant text-center w-16 shrink-0">DPI</span>
            </div>
          </div>
        )}
      </div>

      {/* Presets */}
      <div className="space-y-3">
        <SectionTitle>Presets</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {RESIZE_PRESETS.map((p) => {
            const active = activePreset?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPreset(p.id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left font-display text-[13px] font-semibold transition-colors",
                  active
                    ? "border-primary bg-muted text-primary"
                    : "border-outline-variant/30 text-foreground hover:border-primary/50",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Output settings */}
      <div className="space-y-3">
        <SectionTitle>Output Settings</SectionTitle>
        <div>
          <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
            Format
          </label>
          <Select
            value={value.format}
            onValueChange={(format) =>
              onChange({ ...value, format: format as ResizeSettings["format"] })
            }
          >
            <SelectTrigger className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jpg">JPEG</SelectItem>
              <SelectItem value="png">PNG</SelectItem>
              <SelectItem value="bmp">BMP</SelectItem>
              <SelectItem value="tiff">TIFF</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
          Output size:{" "}
          <span className="font-semibold text-primary">
            {outputPx.width} × {outputPx.height} px
          </span>
        </p>
      </div>
    </div>
  );
}
