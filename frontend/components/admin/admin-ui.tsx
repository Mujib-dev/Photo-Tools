"use client";

import * as React from "react";
import { AlertTriangle, Inbox, Loader2, RotateCw } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { JobState, UserPlan, UserRole } from "@/lib/types";

export function formatDateTime(ms: number): string {
  return format(new Date(ms), "MMM dd, yyyy · HH:mm");
}

export function timeAgo(ms: number): string {
  return formatDistanceToNowStrict(new Date(ms), { addSuffix: true });
}

export function formatUptime(sec: number): string {
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${sec % 60}s`;
}

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <section className={cn("glass-panel rounded-3xl", className)}>{children}</section>;
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-on-surface-variant">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "primary" | "success" | "danger" | "warning";
}) {
  const tones: Record<string, string> = {
    neutral: "text-foreground",
    primary: "text-primary",
    success: "text-emerald-600 dark:text-emerald-400",
    danger: "text-destructive",
    warning: "text-amber-600 dark:text-amber-400",
  };
  return (
    <Panel className="px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
      <p className={cn("mt-2 font-display text-[28px] font-bold leading-none tracking-tight", tones[tone])}>
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-on-surface-variant">{hint}</p>}
    </Panel>
  );
}

const JOB_STATE_META: Record<JobState, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-muted text-on-surface-variant" },
  processing: { label: "Processing", className: "bg-primary/15 text-primary" },
  completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive" },
};

export function JobStateBadge({ state, className }: { state: JobState; className?: string }) {
  const meta = JOB_STATE_META[state] ?? JOB_STATE_META.queued;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider",
        meta.className,
        className,
      )}
    >
      {state === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
      {meta.label}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider",
        role === "superadmin"
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          : role === "admin"
            ? "bg-primary/15 text-primary"
            : "bg-muted text-on-surface-variant",
      )}
    >
      {role === "superadmin" ? "Super admin" : role}
    </span>
  );
}

const PLAN_META: Record<UserPlan, { label: string; className: string }> = {
  free: { label: "Free", className: "bg-muted text-on-surface-variant" },
  pro: { label: "Pro", className: "bg-primary/15 text-primary" },
  business: { label: "Business", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};

export function PlanBadge({ plan, className }: { plan: UserPlan; className?: string }) {
  const meta = PLAN_META[plan] ?? PLAN_META.free;
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/15">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </span>
      <p className="max-w-sm text-sm text-on-surface-variant">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="rounded-xl" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  className,
}: {
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
        <Inbox className="h-5 w-5 text-on-surface-variant" />
      </span>
      <p className="font-display text-[15px] font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-on-surface-variant">{hint}</p>}
    </div>
  );
}

export function LoadingRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ConfirmButton({
  label,
  confirmLabel = "Confirm?",
  onConfirm,
  variant = "destructive",
  size = "sm",
  disabled,
  className,
  icon,
  title,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  variant?: "destructive" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default" | "icon";
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
  title?: string;
}) {
  const [armed, setArmed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleClick = async () => {
    if (busy || disabled) return;
    if (!armed) {
      setArmed(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      // the caller surfaces the error (usually a toast)
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={armed ? variant : variant === "destructive" ? "ghost" : variant}
      size={size}
      disabled={disabled || busy}
      onClick={() => void handleClick()}
      title={title ?? (armed ? confirmLabel : label)}
      aria-label={armed ? confirmLabel : label}
      className={cn(
        "rounded-lg",
        armed && variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        className,
      )}
    >
      {busy ? (
        <RotateCw className="h-3.5 w-3.5 animate-spin" />
      ) : armed ? (
        confirmLabel
      ) : (
        icon ?? label
      )}
    </Button>
  );
}

export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-outline-variant/15 py-2.5 last:border-b-0">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
