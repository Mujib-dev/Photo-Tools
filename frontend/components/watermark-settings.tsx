"use client";

import * as React from "react";
import { UploadCloud, Image as ImageIcon, Type, X } from "lucide-react";

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
  logoFile?: File | null;
  onLogoChange?: (file: File | null) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-display text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
      {children}
    </h3>
  );
}

export function WatermarkSettingsForm({ value, onChange, logoFile, onLogoChange }: Props) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const isImageMode = value.watermarkType === "image";

  React.useEffect(() => {
    if (!logoFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const set = <K extends keyof WatermarkSettings>(key: K, v: WatermarkSettings[K]) =>
    onChange({ ...value, [key]: v });

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onLogoChange?.(f);
  };

  return (
    <div className="space-y-8">
      {/* Mode switcher */}
      <div className="space-y-3">
        <SectionTitle>Watermark Type</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => set("watermarkType", "text")}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-lg border font-mono text-xs font-semibold transition-colors",
              !isImageMode
                ? "border-primary bg-primary-container/15 text-primary"
                : "border-outline-variant/30 text-foreground hover:border-primary/50",
            )}
          >
            <Type className="h-4 w-4" />
            Text
          </button>
          <button
            type="button"
            onClick={() => set("watermarkType", "image")}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-lg border font-mono text-xs font-semibold transition-colors",
              isImageMode
                ? "border-primary bg-primary-container/15 text-primary"
                : "border-outline-variant/30 text-foreground hover:border-primary/50",
            )}
          >
            <ImageIcon className="h-4 w-4" />
            Logo / Image
          </button>
        </div>
      </div>

      {/* Text Settings */}
      {!isImageMode ? (
        <div className="space-y-5">
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
              Up to 60 characters. Rendered directly into the image pixels.
            </p>
          </div>

          <div className="space-y-3">
            <SectionTitle>Text Color</SectionTitle>
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
        </div>
      ) : (
        /* Image / Logo Upload */
        <div className="space-y-3">
          <SectionTitle>Logo Image (PNG / JPG / WEBP)</SectionTitle>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/bmp"
            className="hidden"
            onChange={handleLogoSelect}
          />
          {previewUrl && logoFile ? (
            <div className="relative flex items-center gap-3 rounded-lg border border-primary/40 bg-muted/40 p-3">
              <img
                src={previewUrl}
                alt="Logo watermark"
                className="h-14 w-14 rounded border bg-black/10 object-contain p-1"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-semibold">{logoFile.name}</p>
                <p className="text-[11px] text-on-surface-variant">
                  {(logoFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onLogoChange?.(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="rounded-full p-1.5 text-on-surface-variant hover:bg-muted hover:text-foreground"
                aria-label="Remove logo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant/60 bg-muted/20 p-6 text-center transition hover:border-primary hover:bg-muted/40"
            >
              <UploadCloud className="mb-2 h-7 w-7 text-primary" />
              <p className="font-mono text-xs font-semibold text-foreground">
                Upload Logo / Watermark
              </p>
              <p className="mt-1 text-[11px] text-on-surface-variant">
                PNG with transparency recommended
              </p>
            </div>
          )}
        </div>
      )}

      {/* Placement */}
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

      {/* Appearance */}
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
            max={50}
            step={1}
            value={[value.size]}
            onValueChange={(v) => set("size", v[0])}
            aria-label="Watermark size"
          />
        </div>
      </div>

      {/* Output Format */}
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
