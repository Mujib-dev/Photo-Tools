"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, CircleUserRound, Mail, ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateTime, timeAgo } from "@/components/admin/admin-ui";
import { adminKeys, getActivity } from "@/lib/admin";
import type { AdminActivityItem, AdminActivityKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEEN_KEY = "pictools:admin-activity-seen";
const REFRESH_MS = 30_000;

const KIND_META: Record<AdminActivityKind, { label: string; icon: typeof Bell; className: string }> = {
  user: { label: "Registration", icon: CircleUserRound, className: "bg-primary/15 text-primary" },
  contact: {
    label: "Contact",
    icon: Mail,
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  audit: { label: "Action", icon: ScrollText, className: "bg-muted text-on-surface-variant" },
};

function readSeen(): number {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const value = raw ? Number.parseInt(raw, 10) : 0;
    if (!Number.isFinite(value) || value < 0) return 0;
    // A marker in the future means a skewed or dirty value — ignore it so the
    // badge keeps counting instead of silently hiding every notification.
    if (value > Date.now() + 60_000) return 0;
    return value;
  } catch {
    return 0;
  }
}

function hasSeenMarker(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) != null;
  } catch {
    return false;
  }
}

function writeSeen(value: number): void {
  try {
    window.localStorage.setItem(SEEN_KEY, String(value));
  } catch {
    // storage unavailable (private mode); the badge simply re-counts next load
  }
}

export function AdminNotifications() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [seenAt, setSeenAt] = React.useState(0);
  const [seenReady, setSeenReady] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setSeenAt(readSeen());
    setSeenReady(true);
  }, []);

  const activity = useQuery({
    queryKey: adminKeys.activity,
    queryFn: () => getActivity(50),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  const items = activity.data ?? [];
  const unread = seenReady ? items.filter((item) => item.at > seenAt).length : 0;
  const baselinedRef = React.useRef(false);

  const markSeen = React.useCallback((list: AdminActivityItem[]) => {
    // Track the newest event we have shown, not the local clock, so a client
    // running ahead of the server can never mark future events as already read.
    const newest = list.reduce((max, item) => Math.max(max, item.at), 0);
    if (newest <= 0) return;
    setSeenAt(newest);
    writeSeen(newest);
  }, []);

  // First-ever visit: baseline the marker at the current newest event, so the
  // historical feed doesn't show up as a permanent "9+" badge. Only events
  // that happen from now on count as unread.
  React.useEffect(() => {
    if (baselinedRef.current || !seenReady) return;
    if (hasSeenMarker()) {
      baselinedRef.current = true;
      return;
    }
    const list = activity.data;
    if (!list) return;
    baselinedRef.current = true;
    markSeen(list);
  }, [seenReady, activity.data, markSeen]);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const toggle = () => setOpen((value) => !value);

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative rounded-full"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 font-mono text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2.5 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl ring-1 ring-black/10 dark:ring-white/10 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-display text-[14px] font-bold text-foreground">Notifications</span>
              {unread > 0 && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                  {unread} new
                </span>
              )}
            </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => markSeen(items)}
                className="text-xs font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          {activity.isLoading && items.length === 0 ? (
            <div className="space-y-2 p-3 bg-popover">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-xl bg-muted/50" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center bg-popover">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </span>
              <p className="font-display text-[14px] font-semibold text-foreground">No activity yet</p>
              <p className="text-xs text-muted-foreground">
                New registrations, contact messages and admin actions show up here.
              </p>
            </div>
          ) : (
            <ul className="max-h-[min(420px,calc(100vh-14rem))] overflow-y-auto p-2 space-y-1 bg-popover">
              {items.map((item) => {
                const meta = KIND_META[item.kind];
                const Icon = meta.icon;
                const isUnread = seenReady && item.at > seenAt;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl p-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border",
                        isUnread
                          ? "bg-primary/[0.08] border-primary/25 hover:bg-primary/[0.14]"
                          : "bg-background/80 border-border/40 hover:bg-muted/70 hover:border-border/80",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm",
                          meta.className,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-1.5">
                          <span className="truncate font-display text-[13px] font-semibold text-foreground">
                            {item.title}
                          </span>
                          <span className="shrink-0 rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                            {meta.label}
                          </span>
                        </span>
                        {item.detail && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground font-mono">
                            {item.detail}
                          </span>
                        )}
                        <span className="mt-1 flex items-center gap-2">
                          <span
                            className="font-mono text-[10px] text-muted-foreground"
                            title={formatDateTime(item.at)}
                          >
                            {timeAgo(item.at)}
                          </span>
                          {isUnread && (
                            <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase text-primary">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                              New
                            </span>
                          )}
                        </span>
                      </span>
                      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/40" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer */}
          <div className="border-t border-border/60 bg-muted/30 px-4 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Recent Activity</span>
            <Link
              href="/admin/audit"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <span>Full audit log</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
