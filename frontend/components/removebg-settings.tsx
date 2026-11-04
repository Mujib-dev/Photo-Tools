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

const STUDIO_BACKDROPS = [
  { id: "white", label: "Studio White", color: "#ffffff", rgb: null, bgMode: "white" as const },
  { id: "black", label: "Obsidian Black", color: "#09090b", rgb: null, bgMode: "black" as const },
  { id: "marble", label: "Marble Desk", color: "#f8fafc", rgb: "248,250,252", bgMode: "custom" as const },
  { id: "slate", label: "Studio Wall", color: "#e2e8f0", rgb: "226,232,240", bgMode: "custom" as const },
  { id: "warm", label: "Warm Sunset", color: "#fef3c7", rgb: "254,243,199", bgMode: "custom" as const },
  { id: "sky", label: "Cyan Studio", color: "#e0f2fe", rgb: "224,242,254", bgMode: "custom" as const },
  { id: "emerald", label: "Botanical Sage", color: "#dcfce7", rgb: "220,252,231", bgMode: "custom" as const },
  { id: "rose", label: "Editorial Rose", color: "#ffe4e6", rgb: "255,228,230", bgMode: "custom" as const },
];

export function RemoveBgSettingsForm({ value, onChange }: Props) {
  const set = <K extends keyof RemoveBgSettings>(key: K, v: RemoveBgSettings[K]) =>
    onChange({ ...value, [key]: v });

  const isCustom = value.background === "custom";

  return (
    <div className="space-y-8">
      {/* Studio Backdrop Presets */}
      <div className="space-y-3">
        <SectionTitle>AI Studio Backdrops</SectionTitle>
        <p className="text-xs text-on-surface-variant">
          Place your cut-out subject directly into curated professional studio lighting environments:
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STUDIO_BACKDROPS.map((drop) => {
            const isSelected =
              (drop.bgMode === "white" && value.background === "white") ||
              (drop.bgMode === "black" && value.background === "black") ||
              (drop.bgMode === "custom" && value.background === "custom" && value.customColor === drop.rgb);

            return (
              <button
                key={drop.id}
                type="button"
                onClick={() => {
                  if (drop.bgMode === "white" || drop.bgMode === "black") {
                    onChange({ ...value, background: drop.bgMode });
                  } else {
                    onChange({ ...value, background: "custom", customColor: drop.rgb || undefined });
                  }
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-2 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-outline-variant/30 hover:border-primary/50 bg-surface-container-lowest",
                )}
              >
                <div
                  className="h-5 w-5 shrink-0 rounded-full border border-border shadow-inner"
                  style={{ backgroundColor: drop.color }}
                />
                <span className="text-xs font-semibold truncate">{drop.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle>Background type</SectionTitle>
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
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^[\d,\s]*$/.test(val)) {
                    set("customColor", val);
                  }
                }}
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

      {/* AI Model & Edge Matting */}
      <div className="space-y-3">
        <SectionTitle>AI Model & Edge Refinement</SectionTitle>
        <div>
          <label className="mb-2 block font-display text-[13px] font-semibold text-on-surface-variant">
            Neural Architecture
          </label>
          <Select
            value={value.model || "u2net"}
            onValueChange={(model) => set("model", model as RemoveBgSettings["model"])}
          >
            <SelectTrigger className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="u2net">U2Net (General Objects, Products & Animals)</SelectItem>
              <SelectItem value="u2net_human_seg">U2Net Human (Portraits & People)</SelectItem>
              <SelectItem value="isnet-general-use">ISNet (Ultra HD Saliency)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={Boolean(value.alphaMatting)}
          onClick={() => set("alphaMatting", !value.alphaMatting)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 transition-colors",
            value.alphaMatting
              ? "border-primary bg-primary-container/10 text-primary"
              : "border-outline-variant/30 text-foreground",
          )}
        >
          <div className="text-left">
            <span className="font-display text-[13px] font-semibold block">AI Alpha Matting (Hair & Fur)</span>
            <span className="text-[11px] text-muted-foreground block">Smooths complex strands and soft translucent edges</span>
          </div>
          <span
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              value.alphaMatting ? "bg-primary" : "bg-outline-variant/40",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                value.alphaMatting ? "left-[18px]" : "left-0.5",
              )}
            />
          </span>
        </button>
      </div>

      <div className="space-y-3">
        <SectionTitle>AI engine</SectionTitle>
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-on-surface-variant">
          Neural network segmentation models isolate the foreground subject and synthesize clean transparency. Running locally on this PC with 100% privacy.
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
