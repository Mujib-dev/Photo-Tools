"use client";

import * as React from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Check, Copy, KeyRound, Loader2, Plus, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/apiKeys";
import type { ApiKeyRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { hasQueryInjection, sanitizeInput } from "@/lib/validation";

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never expires", days: null },
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
  { value: "365", label: "365 days", days: 365 },
];

const inputClass =
  "h-11 rounded-xl border-outline-variant/50 bg-surface-container-high/50 px-4 text-sm focus-visible:ring-primary-container/40";

function metaOf(value: number | null): string | null {
  if (value == null) return null;
  const distance = formatDistanceToNowStrict(new Date(value), { addSuffix: true });
  return `${format(new Date(value), "MMM dd, yyyy")} · ${distance}`;
}

export function ApiKeysSection() {
  const [keys, setKeys] = React.useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [expiry, setExpiry] = React.useState<string>("never");
  const [secret, setSecret] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [armedId, setArmedId] = React.useState<string | null>(null);
  const armTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      setKeys(await listApiKeys());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load your API keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    },
    [],
  );

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = sanitizeInput(name);
    if (cleanName && hasQueryInjection(cleanName)) {
      toast.error("API key name contains prohibited query characters or injection sequences.");
      return;
    }
    setCreating(true);
    try {
      const days = EXPIRY_OPTIONS.find((option) => option.value === expiry)?.days ?? null;
      const created = await createApiKey(cleanName, days);
      setKeys((current) => [created.key, ...current]);
      setSecret(created.token);
      setCopied(false);
      setName("");
      toast.success("API key created. Copy it now — it will not be shown again.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the key.");
    } finally {
      setCreating(false);
    }
  };

  const onCopy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success("API key copied to the clipboard.");
    } catch {
      toast.error("Could not copy. Select the key and copy it manually.");
    }
  };

  const onRevoke = async (id: string) => {
    if (armedId !== id) {
      setArmedId(id);
      if (armTimer.current) clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmedId(null), 3000);
      return;
    }
    if (armTimer.current) clearTimeout(armTimer.current);
    setArmedId(null);
    setBusyId(id);
    try {
      await revokeApiKey(id);
      setKeys((current) => current.filter((key) => key.id !== id));
      setSecret((current) => (current ? current : null));
      toast.success("API key revoked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke the key.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <p className="rounded-xl border border-outline-variant/20 bg-surface-container-high/40 px-4 py-3 text-xs text-on-surface-variant">
        API keys let scripts and other software call PicTools on your behalf. Send one as{" "}
        <span className="font-mono text-foreground">Authorization: Bearer &lt;key&gt;</span>. The full
        key is shown once at creation — store it somewhere safe.
      </p>

      {secret && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold">Your new API key</p>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Copy it now. For your security it is never shown again.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSecret(null)}
              className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-outline-variant/30 bg-background/70 px-3 py-2.5 font-mono text-xs">
              {secret}
            </code>
            <Button type="button" size="sm" className="h-auto shrink-0 rounded-lg gap-1.5 px-3 py-2.5" onClick={() => void onCopy()}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-48">
          <span className="mb-1.5 block font-display text-[13px] font-semibold tracking-[0.02em]">
            Name
          </span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            preventQueryInjection
            placeholder="e.g. CI pipeline"
            maxLength={60}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-on-surface-variant">
            Optional — helps you recognise the key later.
          </span>
        </label>
        <label className="basis-40">
          <span className="mb-1.5 block font-display text-[13px] font-semibold tracking-[0.02em]">
            Expiry
          </span>
          <Select value={expiry} onValueChange={setExpiry}>
            <SelectTrigger className={cn("h-11 w-full rounded-xl text-sm", inputClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <Button type="submit" disabled={creating} className="h-11 shrink-0 rounded-xl">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create key
        </Button>
      </form>

      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high/30">
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1].map((row) => (
              <div key={row} className="h-9 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => void load()}>
              <RotateCw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        ) : keys.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
              <KeyRound className="h-4 w-4 text-on-surface-variant" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold">No API keys yet</p>
              <p className="text-xs text-on-surface-variant">
                Create one above to start calling the API from your own tools.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant/15">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                <div className="min-w-0 flex-1 basis-52">
                  <p className="truncate font-display text-sm font-semibold">
                    {key.name}
                    <span className="ml-2 font-mono text-[11px] font-normal text-on-surface-variant">
                      {key.prefix}…
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    Created {metaOf(key.createdAt) ?? "—"}
                    {key.lastUsedAt != null ? ` · Last used ${metaOf(key.lastUsedAt)}` : " · Never used"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider",
                      key.expiresAt != null && key.expiresAt <= Date.now()
                        ? "bg-destructive/15 text-destructive"
                        : key.expiresAt != null
                          ? "bg-muted text-on-surface-variant"
                          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {key.expiresAt == null
                      ? "No expiry"
                      : key.expiresAt <= Date.now()
                        ? "Expired"
                        : `Expires ${format(new Date(key.expiresAt), "MMM dd, yyyy")}`}
                  </span>
                  <Button
                    type="button"
                    variant={armedId === key.id ? "destructive" : "ghost"}
                    size="sm"
                    className="h-8 rounded-lg gap-1.5 px-2.5"
                    disabled={busyId === key.id}
                    onClick={() => void onRevoke(key.id)}
                  >
                    {busyId === key.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {armedId === key.id ? "Confirm?" : "Revoke"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
