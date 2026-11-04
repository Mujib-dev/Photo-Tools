"use client";

import * as React from "react";
import { BookmarkPlus, Check, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createPreset, deletePreset, listPresets, type PresetRecord } from "@/lib/presets";
import { cn } from "@/lib/utils";

/**
 * Save / apply / delete named presets of the current tool's settings.
 * Rendering is intentionally compact so it drops into the settings sidebar.
 */
export function PresetBar({
  operation,
  settings,
  onApply,
  className,
}: {
  operation: string;
  settings: unknown;
  onApply: (settings: unknown) => void;
  className?: string;
}) {
  const [presets, setPresets] = React.useState<PresetRecord[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [mode, setMode] = React.useState<"view" | "save">("view");
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [armedDelete, setArmedDelete] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const settingsObject =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : null;

  const refresh = React.useCallback(async () => {
    setLoadError(null);
    try {
      setPresets(await listPresets(operation));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load presets.");
    }
  }, [operation]);

  React.useEffect(() => {
    void refresh();
    setSelectedId("");
    setMode("view");
    setArmedDelete(false);
  }, [refresh]);

  const selected = presets.find((p) => p.id === selectedId) ?? null;

  const apply = (id: string) => {
    setSelectedId(id);
    setArmedDelete(false);
    const preset = presets.find((p) => p.id === id);
    if (preset) {
      onApply(preset.settings);
      toast.success(`Applied "${preset.name}".`);
    }
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!settingsObject) {
      toast.error("This tool has no settings to save yet.");
      return;
    }
    setBusy(true);
    try {
      const preset = await createPreset({ operation, name: trimmed, settings: settingsObject });
      setName("");
      setMode("view");
      await refresh();
      setSelectedId(preset.id);
      toast.success(`Saved "${preset.name}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the preset.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!armedDelete) {
      setArmedDelete(true);
      return;
    }
    setBusy(true);
    try {
      await deletePreset(selected.id);
      setArmedDelete(false);
      setSelectedId("");
      await refresh();
      toast.success(`Deleted "${selected.name}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the preset.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("rounded-xl border border-outline-variant/30 bg-surface-container-high/40 p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
          <BookmarkPlus className="h-3.5 w-3.5" />
          Presets
        </span>
        {mode === "view" && (
          <button
            type="button"
            onClick={() => {
              setMode("save");
              setArmedDelete(false);
            }}
            disabled={!settingsObject}
            title={settingsObject ? "Save current settings" : "No settings to save yet"}
            className="flex items-center gap-1 rounded-lg px-2 py-1 font-display text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-3.5 w-3.5" />
            Save as
          </button>
        )}
      </div>

      {mode === "save" ? (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") setMode("view");
            }}
            maxLength={40}
            placeholder="Preset name"
            aria-label="Preset name"
            className="min-w-0 flex-1 rounded-lg border border-outline-variant/40 bg-surface px-2.5 py-1.5 text-xs text-foreground placeholder:text-on-surface-variant/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button size="sm" variant="ghost" onClick={() => void save()} disabled={busy || !name.trim()} className="h-7 px-2 text-primary">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("view")} disabled={busy} className="h-7 px-2">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1.5">
          <select
            value={selectedId}
            onChange={(e) => (e.target.value ? apply(e.target.value) : setSelectedId(""))}
            aria-label="Saved presets"
            className="min-w-0 flex-1 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">
              {loadError ? "Presets unavailable" : presets.length ? "Choose a preset…" : "No presets yet"}
            </option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void remove()}
            disabled={!selected || busy}
            title={armedDelete ? "Click again to confirm" : "Delete selected preset"}
            className={cn(
              "h-7 px-2",
              armedDelete ? "text-destructive" : "text-on-surface-variant",
            )}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}

      {loadError && <p className="mt-1.5 text-[11px] text-destructive">{loadError}</p>}
      {!loadError && presets.length === 0 && mode === "view" && (
        <p className="mt-1.5 text-[11px] leading-4 text-on-surface-variant/70">
          Save your settings to reuse them later.
        </p>
      )}
      {armedDelete && (
        <p className="mt-1.5 text-[11px] text-destructive">Click the trash icon again to confirm.</p>
      )}
    </div>
  );
}
