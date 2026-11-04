"use client";

import * as React from "react";
import { KeyRound, Lock, RotateCw, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestSudo } from "@/lib/admin";

interface AdminSudoDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AdminSudoDialog({
  open,
  title = "Administrator Verification Required",
  description = "This action modifies privileged system settings. Please re-enter your administrator password to confirm your identity (valid for 15 minutes).",
  onSuccess,
  onCancel,
}: AdminSudoDialogProps) {
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (open) {
      setPassword("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error("Please enter your administrator password.");
      return;
    }
    setBusy(true);
    try {
      await requestSudo(password.trim());
      toast.success("Identity confirmed. Sudo authorization active for 15 minutes.");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Incorrect administrator password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div
        role="dialog"
        aria-modal="true"
        className="glass-panel w-full max-w-md overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface/95 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-destructive">
                Security Sudo Mode
              </p>
              <h3 className="font-display text-[17px] font-bold tracking-tight text-foreground">
                {title}
              </h3>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onCancel}
            disabled={busy}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          {description}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sudo-password" className="text-xs font-semibold">
              Administrator Password
            </Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant" />
              <Input
                id="sudo-password"
                ref={inputRef}
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 pl-9 text-sm"
                disabled={busy}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={busy}
            >
              {busy ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              Confirm Identity
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
