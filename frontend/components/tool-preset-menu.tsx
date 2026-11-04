"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { BookmarkPlus, Check, Loader2, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { createPreset, deletePreset, listPresets, type PresetRecord } from "@/lib/presets";
import { TOOLS } from "@/lib/tools";
import { cn } from "@/lib/utils";

interface SavedField {
  key: string;
  type: string;
  value?: string;
  checked?: boolean;
}

interface ToolPresetSettings {
  version: number;
  fields: SavedField[];
}

interface ToolPreset {
  id: string;
  name: string;
  settings: ToolPresetSettings;
  createdAt: number;
}

const LOCAL_LIMIT = 20;

function fieldBaseKey(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const type =
    el instanceof HTMLInputElement ? (el.type || "text").toLowerCase() : tag === "select" ? "select" : "textarea";
  const name =
    el.getAttribute("name") ||
    el.id ||
    el.getAttribute("aria-label") ||
    el.getAttribute("placeholder") ||
    "";
  const radioValue = type === "radio" && el instanceof HTMLInputElement ? `:${el.value}` : "";
  return `${tag}:${type}:${name}${radioValue}`;
}

function isSaveableField(el: Element): boolean {
  if (el.closest("[data-preset-ignore]")) return false;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || "text").toLowerCase();
    if (["file", "password", "hidden", "submit", "button", "reset", "image", "search"].includes(type)) {
      return false;
    }
  }
  return true;
}

function snapshotFields(): Array<{ key: string; el: Element }> {
  const container = document.querySelector("#main-content");
  if (!container) return [];

  const seen = new Map<string, number>();
  return Array.from(container.querySelectorAll("input, select, textarea"))
    .filter(isSaveableField)
    .map((el) => {
      const base = fieldBaseKey(el);
      const occurrence = seen.get(base) ?? 0;
      seen.set(base, occurrence + 1);
      return { key: occurrence === 0 ? base : `${base}#${occurrence}`, el };
    });
}

function captureSettings(): ToolPresetSettings {
  const fields: SavedField[] = snapshotFields().map(({ key, el }) => {
    if (el instanceof HTMLInputElement) {
      const type = (el.type || "text").toLowerCase();
      if (type === "checkbox" || type === "radio") {
        return { key, type, checked: el.checked };
      }
      return { key, type, value: el.value };
    }
    if (el instanceof HTMLSelectElement) {
      return { key, type: "select", value: el.value };
    }
    return { key, type: "textarea", value: (el as HTMLTextAreaElement).value };
  });
  return { version: 1, fields };
}

function setNativeValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function applySettings(settings: ToolPresetSettings) {
  const available = new Map(snapshotFields().map(({ key, el }) => [key, el]));

  for (const saved of settings.fields) {
    const el = available.get(saved.key);
    if (!el) continue;

    if (el instanceof HTMLInputElement) {
      const type = (el.type || "text").toLowerCase();
      if (type === "checkbox" || type === "radio") {
        if (!el.disabled && el.checked !== Boolean(saved.checked)) el.click();
      } else if (saved.value !== undefined) {
        setNativeValue(el, saved.value);
      }
      continue;
    }

    if (saved.value !== undefined && (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
      setNativeValue(el, saved.value);
    }
  }
}

function applyWithRetries(settings: ToolPresetSettings) {
  applySettings(settings);
  requestAnimationFrame(() => {
    applySettings(settings);
    requestAnimationFrame(() => applySettings(settings));
  });
  window.setTimeout(() => applySettings(settings), 150);
}

function isToolPresetSettings(value: unknown): value is ToolPresetSettings {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { fields?: unknown }).fields)
  );
}

function localKey(operation: string): string {
  return `pictools_tool_presets:${operation}`;
}

function readLocalPresets(operation: string): ToolPreset[] {
  try {
    const raw = localStorage.getItem(localKey(operation));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ToolPreset =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as ToolPreset).id === "string" &&
          typeof (item as ToolPreset).name === "string" &&
          isToolPresetSettings((item as ToolPreset).settings),
      )
      .slice(0, LOCAL_LIMIT);
  } catch {
    return [];
  }
}

function writeLocalPresets(operation: string, presets: ToolPreset[]) {
  try {
    localStorage.setItem(localKey(operation), JSON.stringify(presets.slice(0, LOCAL_LIMIT)));
  } catch {
    // Storage unavailable; presets simply won't persist.
  }
}

export function ToolPresetMenu() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [presets, setPresets] = React.useState<ToolPreset[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [armedDelete, setArmedDelete] = React.useState<string | null>(null);

  const tool = React.useMemo(
    () =>
      TOOLS.find(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
      ) ?? null,
    [pathname],
  );

  const operation = pathname.split("/").filter(Boolean)[0] ?? "";
  const validOperation = /^[a-z][a-z0-9-]{0,39}$/.test(operation);

  const refresh = React.useCallback(async () => {
    if (!validOperation) return;
    setLoading(true);
    setError(null);
    try {
      if (user) {
        const records = await listPresets(operation);
        setPresets(
          records
            .filter((record) => isToolPresetSettings(record.settings))
            .map((record: PresetRecord) => ({
              id: record.id,
              name: record.name,
              settings: record.settings as unknown as ToolPresetSettings,
              createdAt: record.createdAt,
            })),
        );
      } else {
        setPresets(readLocalPresets(operation));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this tool's presets.");
    } finally {
      setLoading(false);
    }
  }, [operation, user, validOperation]);

  React.useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!tool) return null;

  const openMenu = () => {
    setOpen(true);
    setName("");
    setArmedDelete(null);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const settings = captureSettings();
    if (settings.fields.length === 0) {
      toast.error("This tool has no saveable controls yet.");
      return;
    }

    setBusy(true);
    try {
      if (user && validOperation) {
        await createPreset({ operation, name: trimmed, settings: settings as unknown as Record<string, unknown> });
      } else {
        const existing = readLocalPresets(operation);
        const match = existing.find((preset) => preset.name.toLowerCase() === trimmed.toLowerCase());
        const now = Date.now();
        const next: ToolPreset = {
          id: match?.id ?? `local-${now}`,
          name: trimmed,
          settings,
          createdAt: match?.createdAt ?? now,
        };
        writeLocalPresets(operation, [next, ...existing.filter((preset) => preset.id !== next.id)]);
      }
      setName("");
      setArmedDelete(null);
      await refresh();
      toast.success(`Saved preset "${trimmed}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the preset.");
    } finally {
      setBusy(false);
    }
  };

  const apply = (preset: ToolPreset) => {
    applyWithRetries(preset.settings);
    toast.success(`Applied "${preset.name}".`);
    setOpen(false);
  };

  const remove = async (preset: ToolPreset) => {
    if (armedDelete !== preset.id) {
      setArmedDelete(preset.id);
      return;
    }

    setBusy(true);
    try {
      if (user && validOperation) {
        await deletePreset(preset.id);
      } else {
        writeLocalPresets(
          operation,
          readLocalPresets(operation).filter((item) => item.id !== preset.id),
        );
      }
      setArmedDelete(null);
      await refresh();
      toast.success(`Deleted "${preset.name}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the preset.");
    } finally {
      setBusy(false);
    }
  };

  const fieldCount = open ? snapshotFields().length : 0;

  const modal = open ? (
    <div className="fixed inset-0 z-[100010] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close save menu"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Save tool settings"
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-outline-variant/40 bg-card shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 px-5 py-4">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
              <BookmarkPlus className="h-3.5 w-3.5" />
              Save as
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-foreground">
              {tool.label} presets
            </h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Captures the current controls as a reusable setup.{" "}
              {fieldCount > 0 ? `${fieldCount} controls detected.` : "No controls detected yet."}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close save menu">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 border-b border-outline-variant/20 bg-surface-container-high/30 px-5 py-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
            }}
            maxLength={40}
            placeholder="Preset name"
            aria-label="Preset name"
            className="h-9 min-w-0 flex-1 rounded-lg border border-outline-variant/50 bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="sm" onClick={() => void save()} disabled={busy || !name.trim() || fieldCount === 0} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-on-surface-variant">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading presets…
            </div>
          ) : error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </p>
          ) : presets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant/50 p-6 text-center">
              <p className="font-display text-sm font-semibold text-foreground">No saved presets yet</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Name the current setup above and save it to reuse later.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-2"
                >
                  <button
                    type="button"
                    onClick={() => apply(preset)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-primary/5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-display text-sm font-semibold text-foreground">
                        {preset.name}
                      </span>
                      <span className="block font-mono text-[9px] uppercase tracking-wide text-on-surface-variant">
                        {preset.settings.fields.length} controls
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(preset)}
                    disabled={busy}
                    className={cn(
                      "flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors",
                      armedDelete === preset.id
                        ? "bg-destructive text-white"
                        : "text-on-surface-variant hover:bg-destructive/10 hover:text-destructive",
                    )}
                    aria-label={armedDelete === preset.id ? `Confirm deleting ${preset.name}` : `Delete ${preset.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {armedDelete === preset.id ? "Confirm" : ""}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-outline-variant/20 bg-surface-container-high/30 px-5 py-3">
          <p className="text-[11px] text-on-surface-variant">
            {user
              ? "Presets are synced to your account."
              : "Presets are saved on this device. Sign in to sync them to your account."}
          </p>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Save as preset"
        title="Save this tool's settings as a preset"
        onClick={openMenu}
      >
        <BookmarkPlus className="h-5 w-5" />
      </Button>
      {modal ? createPortal(modal, document.body) : null}
    </>
  );
}
