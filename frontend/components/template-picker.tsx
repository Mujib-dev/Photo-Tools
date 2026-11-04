"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Check, Palette, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TOOLS, TOOL_GROUPS } from "@/lib/tools";
import {
  CUSTOM_ACCENT_STORAGE_KEY,
  CUSTOM_PRIMARY_STORAGE_KEY,
  CUSTOM_TEMPLATE_ID,
  DEFAULT_CUSTOM_COLORS,
  VISUAL_TEMPLATES,
  VISUAL_TEMPLATE_STORAGE_KEY,
  applyVisualTemplate,
  getVisualTemplate,
  type CustomVisualColors,
} from "@/lib/visual-templates";
import { cn } from "@/lib/utils";

function isDarkMode(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

function storedColor(key: string, fallback: string): string {
  try {
    const value = localStorage.getItem(key);
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function TemplatePicker() {
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [activeId, setActiveId] = React.useState("studio");
  const [customPrimary, setCustomPrimary] = React.useState(DEFAULT_CUSTOM_COLORS.primary);
  const [customAccent, setCustomAccent] = React.useState(DEFAULT_CUSTOM_COLORS.accent);
  const activeRef = React.useRef("studio");
  const customRef = React.useRef<CustomVisualColors>({ ...DEFAULT_CUSTOM_COLORS });

  const current = React.useMemo(() => {
    const tool = TOOLS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
    if (!tool) return { tool: null, group: null };
    const group = TOOL_GROUPS.find((item) =>
      item.items.some((entry) => entry.href === tool.href),
    );
    return { tool, group: group ?? null };
  }, [pathname]);

  React.useEffect(() => {
    setMounted(true);

    let saved = "studio";
    try {
      saved = localStorage.getItem(VISUAL_TEMPLATE_STORAGE_KEY) ?? "studio";
    } catch {
      // Storage unavailable; keep the default.
    }

    const customColors: CustomVisualColors = {
      primary: storedColor(CUSTOM_PRIMARY_STORAGE_KEY, DEFAULT_CUSTOM_COLORS.primary),
      accent: storedColor(CUSTOM_ACCENT_STORAGE_KEY, DEFAULT_CUSTOM_COLORS.accent),
    };
    customRef.current = customColors;
    setCustomPrimary(customColors.primary);
    setCustomAccent(customColors.accent);

    const next = getVisualTemplate(saved).id;
    activeRef.current = next;
    setActiveId(next);
    applyVisualTemplate(next, isDarkMode(), customColors);

    const observer = new MutationObserver(() => {
      applyVisualTemplate(activeRef.current, isDarkMode(), customRef.current);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const choose = (id: string) => {
    const template = getVisualTemplate(id);
    activeRef.current = template.id;
    setActiveId(template.id);
    applyVisualTemplate(template.id, isDarkMode(), customRef.current);

    try {
      if (template.id === "studio") localStorage.removeItem(VISUAL_TEMPLATE_STORAGE_KEY);
      else localStorage.setItem(VISUAL_TEMPLATE_STORAGE_KEY, template.id);
    } catch {
      // Storage unavailable; the template still applies for this session.
    }

    toast.success(`Template applied: ${template.name}`);
  };

  const updateCustom = (key: "primary" | "accent", value: string) => {
    const next = { ...customRef.current, [key]: value };
    customRef.current = next;
    if (key === "primary") setCustomPrimary(value);
    else setCustomAccent(value);

    try {
      localStorage.setItem(
        key === "primary" ? CUSTOM_PRIMARY_STORAGE_KEY : CUSTOM_ACCENT_STORAGE_KEY,
        value,
      );
    } catch {
      // Storage unavailable; the color still applies for this session.
    }

    if (activeRef.current === CUSTOM_TEMPLATE_ID) {
      applyVisualTemplate(CUSTOM_TEMPLATE_ID, isDarkMode(), next);
    }
  };

  const resetCustom = () => {
    const next = { ...DEFAULT_CUSTOM_COLORS };
    customRef.current = next;
    setCustomPrimary(next.primary);
    setCustomAccent(next.accent);
    try {
      localStorage.removeItem(CUSTOM_PRIMARY_STORAGE_KEY);
      localStorage.removeItem(CUSTOM_ACCENT_STORAGE_KEY);
    } catch {
      // Storage unavailable.
    }
    if (activeRef.current === CUSTOM_TEMPLATE_ID) {
      applyVisualTemplate(CUSTOM_TEMPLATE_ID, isDarkMode(), next);
    }
  };

  const groupLabel = current.group?.label ?? null;
  const recommended = React.useCallback(
    (bestFor: string[]) =>
      Boolean(groupLabel && bestFor.some((entry) => entry === groupLabel || entry === "All tools")),
    [groupLabel],
  );

  const ordered = React.useMemo(() => {
    if (!groupLabel) return VISUAL_TEMPLATES;
    return [...VISUAL_TEMPLATES].sort((a, b) => {
      const aRecommended = recommended(a.bestFor) ? 0 : 1;
      const bRecommended = recommended(b.bestFor) ? 0 : 1;
      return aRecommended - bRecommended;
    });
  }, [groupLabel, recommended]);

  const modal = open ? (
    <div className="fixed inset-0 z-[100010] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close templates"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Visual templates"
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-outline-variant/40 bg-card shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 px-5 py-4">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Workspace templates
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-foreground">
              Restyle every tool
            </h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Modern visual presets apply across the whole suite — colors, surfaces, radius and
              typography. {current.tool ? `Current tool: ${current.tool.label}.` : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Close templates"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div
            className={cn(
              "mb-4 rounded-2xl border p-4 transition-all",
              activeId === CUSTOM_TEMPLATE_ID
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-outline-variant/40 bg-surface-container-lowest",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 font-display text-sm font-bold text-foreground">
                  <Palette className="h-4 w-4 text-primary" />
                  Custom color
                </p>
                <p className="mt-0.5 text-[11px] text-on-surface-variant">
                  Pick your own primary and accent colors for every tool.
                </p>
              </div>
              {activeId === CUSTOM_TEMPLATE_ID && (
                <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                  Active
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Primary
                </span>
                <span className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-background px-2 py-1">
                  <input
                    type="color"
                    value={customPrimary}
                    onChange={(event) => updateCustom("primary", event.target.value)}
                    aria-label="Custom primary color"
                    className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="font-mono text-[11px] text-foreground">{customPrimary}</span>
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Accent
                </span>
                <span className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-background px-2 py-1">
                  <input
                    type="color"
                    value={customAccent}
                    onChange={(event) => updateCustom("accent", event.target.value)}
                    aria-label="Custom accent color"
                    className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="font-mono text-[11px] text-foreground">{customAccent}</span>
                </span>
              </label>

              <Button size="sm" onClick={() => choose(CUSTOM_TEMPLATE_ID)} className="gap-1.5">
                <Check className="h-3.5 w-3.5" />
                {activeId === CUSTOM_TEMPLATE_ID ? "Reapply custom" : "Apply custom"}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetCustom} className="text-xs">
                Reset colors
              </Button>
            </div>

            <div
              className="mt-3 h-2.5 w-full rounded-full border border-black/10"
              style={{ background: `linear-gradient(90deg, ${customPrimary}, ${customAccent})` }}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((template) => {
              const active = template.id === activeId;
              const isRecommended = recommended(template.bestFor) && template.id !== "studio";
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => choose(template.id)}
                  className={cn(
                    "group overflow-hidden rounded-2xl border text-left transition-all",
                    active
                      ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                      : "border-outline-variant/40 bg-surface-container-lowest hover:border-primary/40 hover:shadow-lg",
                  )}
                >
                  <div
                    className="relative h-20 w-full"
                    style={{ background: template.preview }}
                  >
                    <div className="absolute inset-x-3 bottom-2 flex items-center gap-1.5">
                      {template.swatches.map((swatch) => (
                        <span
                          key={swatch}
                          className="h-4 w-4 rounded-full border border-white/40 shadow-sm"
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </div>
                    {active && (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-black shadow">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {isRecommended && !active && (
                      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur">
                        Recommended
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-sm font-bold text-foreground">
                        {template.name}
                      </p>
                      {active && (
                        <span className="font-mono text-[9px] font-bold uppercase tracking-wide text-primary">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-primary/90">{template.tagline}</p>
                    <p className="text-[11px] leading-relaxed text-on-surface-variant">
                      {template.description}
                    </p>
                    <p className="pt-1 font-mono text-[9px] uppercase tracking-wide text-on-surface-variant/70">
                      Best for: {template.bestFor.join(" · ")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 bg-surface-container-high/30 px-5 py-3">
          <p className="text-[11px] text-on-surface-variant">
            Templates are saved on this device and follow light/dark mode.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => choose("studio")}
            disabled={activeId === "studio"}
            className="gap-1.5 text-xs"
          >
            <Palette className="h-3.5 w-3.5" />
            Reset to default
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Visual templates"
        title="Visual templates"
        onClick={() => setOpen(true)}
        className={cn(mounted && activeId !== "studio" && "text-primary")}
      >
        <Palette className="h-5 w-5" />
      </Button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
