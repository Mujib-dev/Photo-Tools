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
import { ENHANCE_FORMATS, UPSCALE_OPTIONS, AI_UPSCALE_OPTIONS, type EnhanceSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  value: EnhanceSettings;
  onChange: (settings: EnhanceSettings) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
      {children}
    </h3>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  formatValue,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-display text-[13px] font-semibold text-on-surface-variant">
          {label}
        </label>
        <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-primary">
          {formatValue(value)}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={(v) => onChange(v[0])}
        aria-label={label}
      />
      <div className="flex justify-between font-mono text-[10px] text-on-surface-variant">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 transition-colors",
        checked
          ? "border-primary bg-primary-container/10 text-primary"
          : "border-outline-variant/30 text-foreground",
      )}
    >
      <span className="font-display text-[13px] font-semibold">{children}</span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-outline-variant/40",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function EnhanceSettingsForm({ value, onChange }: Props) {
  const set = <K extends keyof EnhanceSettings>(key: K, v: EnhanceSettings[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-8">
      {/* Auto enhance */}
      <div className="space-y-3">
        <SectionTitle>Enhancement</SectionTitle>
        <Toggle
          checked={value.auto}
          onChange={(v) => set("auto", v)}
        >
          Auto-enhance (one click)
        </Toggle>
        {value.auto && (
          <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
            Applies a balanced recipe: sharpness, contrast, saturation,
            brightness and light denoise. Toggle off for full manual control.
          </p>
        )}
      </div>

      {/* Selective area */}
      <div className="space-y-3">
        <SectionTitle>Selective Enhance</SectionTitle>
        {value.region ? (
          <div className="flex items-center justify-between rounded-lg border border-primary bg-primary-container/10 px-3 py-2.5">
            <span className="font-display text-[13px] font-semibold text-primary">
              Enhancing a selected area
            </span>
            <button
              type="button"
              onClick={() => set("region", null)}
              className="font-display text-[12px] font-semibold text-on-surface-variant transition-colors hover:text-destructive"
            >
              Clear
            </button>
          </div>
        ) : (
          <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
            Optional: drag a box on the preview to enhance only that area. Leave empty to enhance
            the whole photo.
          </p>
        )}
      </div>

      {/* Manual sliders */}
      {!value.auto && (
        <>
          <div className="space-y-5">
            <SectionTitle>Manual adjustments</SectionTitle>
            <SliderRow
              label="Sharpness"
              value={value.sharpness}
              min={0}
              max={2}
              step={0.01}
              formatValue={(v) => v.toFixed(2)}
              disabled={value.auto}
              onChange={(v) => set("sharpness", v)}
            />
            <SliderRow
              label="Contrast"
              value={value.contrast}
              min={0}
              max={2}
              step={0.01}
              formatValue={(v) => v.toFixed(2)}
              disabled={value.auto}
              onChange={(v) => set("contrast", v)}
            />
            <SliderRow
              label="Saturation"
              value={value.saturation}
              min={0}
              max={2}
              step={0.01}
              formatValue={(v) => v.toFixed(2)}
              disabled={value.auto}
              onChange={(v) => set("saturation", v)}
            />
            <SliderRow
              label="Brightness"
              value={value.brightness}
              min={0}
              max={2}
              step={0.01}
              formatValue={(v) => v.toFixed(2)}
              disabled={value.auto}
              onChange={(v) => set("brightness", v)}
            />
            <SliderRow
              label="Denoise"
              value={value.denoise}
              min={0}
              max={2}
              step={1}
              formatValue={(v) => (v === 0 ? "Off" : v === 1 ? "Light" : "Strong")}
              disabled={value.auto}
              onChange={(v) => set("denoise", v as EnhanceSettings["denoise"])}
            />
          </div>

          {/* Upscale */}
          <div className="space-y-3">
            <SectionTitle>Upscale</SectionTitle>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {UPSCALE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("scale", s)}
                  className={cn(
                    "flex h-11 items-center justify-center rounded-lg border font-mono text-sm font-semibold transition-colors",
                    value.scale === s
                      ? "border-primary bg-primary-container/15 text-primary"
                      : "border-outline-variant/30 text-foreground hover:border-primary/50",
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>
            <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
              {value.scale === 1
                ? "No upscaling — the image keeps its original size."
                : `Output is enlarged ${value.scale}× with high-quality resampling.`}
            </p>
          </div>
        </>
      )}

      {/* AI upscale */}
      <div className="space-y-3">
        <SectionTitle>AI Upscale (Real-ESRGAN)</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {AI_UPSCALE_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => set("aiUpscale", s.value)}
              className={cn(
                "flex h-11 items-center justify-center rounded-lg border font-mono text-sm font-semibold transition-colors",
                (value.aiUpscale ?? 0) === s.value
                  ? "border-primary bg-primary-container/15 text-primary"
                  : "border-outline-variant/30 text-foreground hover:border-primary/50",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
          {(value.aiUpscale ?? 0) === 0
            ? "Off — classic enhancement only."
            : `Neural network enlarges the photo ${value.aiUpscale}x with restored detail. Slower; the AI model downloads once on first use.`}
        </p>
      </div>

      {/* Output format */}
      <div className="space-y-3">
        <SectionTitle>Output settings</SectionTitle>
        <div>
          <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
            Format
          </label>
          <Select
            value={value.format}
            onValueChange={(format) => set("format", format as EnhanceSettings["format"])}
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
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
          Output keeps the original dimensions unless upscaling is enabled.
        </p>
      </div>
    </div>
  );
}
