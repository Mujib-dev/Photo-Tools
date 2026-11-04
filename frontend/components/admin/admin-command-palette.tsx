"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BarChart3,
  DollarSign,
  Gift,
  HardDrive,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  RotateCw,
  ScrollText,
  Search,
  Settings,
  Sparkles,
  Stethoscope,
  Ticket,
  Trash2,
  UserPlus,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { runSweep, runTempCleanup } from "@/lib/admin";
import { useAuth } from "@/components/auth-provider";
import type { AdminPermission } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Actions" | "System";
  icon: React.ComponentType<{ className?: string }>;
  permission?: AdminPermission;
  shortcut?: string;
  run: () => void | Promise<void>;
}

export function AdminCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const items: CommandItem[] = React.useMemo(
    () => [
      {
        id: "nav-overview",
        title: "Go to System Overview",
        category: "Navigation",
        icon: LayoutDashboard,
        run: () => router.push("/admin"),
      },
      {
        id: "nav-users",
        permission: "users",
        title: "Go to User Accounts",
        category: "Navigation",
        icon: Users,
        run: () => router.push("/admin/users"),
      },
      {
        id: "nav-jobs",
        permission: "jobs",
        title: "Go to Processing Jobs",
        category: "Navigation",
        icon: Activity,
        run: () => router.push("/admin/jobs"),
      },
      {
        id: "nav-analytics",
        permission: "analytics",
        title: "Go to Usage Analytics",
        category: "Navigation",
        icon: BarChart3,
        run: () => router.push("/admin/analytics"),
      },
      {
        id: "nav-revenue",
        permission: "revenue",
        title: "Go to Revenue & Stripe MRR Dashboard",
        category: "Navigation",
        icon: DollarSign,
        run: () => router.push("/admin/revenue"),
      },
      {
        id: "nav-support",
        permission: "support",
        title: "Go to Customer Support Desk",
        category: "Navigation",
        icon: LifeBuoy,
        run: () => router.push("/admin/support"),
      },
      {
        id: "nav-affiliates",
        permission: "affiliates",
        title: "Go to Affiliate Commission Manager",
        category: "Navigation",
        icon: Gift,
        run: () => router.push("/admin/affiliates"),
      },
      {
        id: "nav-promos",
        permission: "promos",
        title: "Go to Promo Codes",
        category: "Navigation",
        icon: Ticket,
        run: () => router.push("/admin/promos"),
      },
      {
        id: "nav-contacts",
        permission: "contacts",
        title: "Go to Contact Messages Inbox",
        category: "Navigation",
        icon: Mail,
        run: () => router.push("/admin/contacts"),
      },
      {
        id: "nav-audit",
        permission: "audit",
        title: "Go to Security Audit Trail",
        category: "Navigation",
        icon: ScrollText,
        run: () => router.push("/admin/audit"),
      },
      {
        id: "nav-settings",
        permission: "settings",
        title: "Go to System Settings & Config",
        category: "Navigation",
        icon: Settings,
        run: () => router.push("/admin/settings"),
      },
      {
        id: "action-new-user",
        permission: "users",
        title: "Create New User Account",
        category: "Actions",
        icon: UserPlus,
        run: () => router.push("/admin/users?new=true"),
      },
      {
        id: "action-new-promo",
        permission: "promos",
        title: "Create New Promotional Code",
        category: "Actions",
        icon: Ticket,
        run: () => router.push("/admin/promos?new=true"),
      },
      {
        id: "action-sweep",
        permission: "settings",
        title: "Run Database Sweep (Prune Expired Jobs & Sessions)",
        category: "System",
        icon: Wrench,
        run: async () => {
          toast.promise(runSweep(), {
            loading: "Running maintenance sweep…",
            success: (res) => `Maintenance sweep complete. Pruned ${res.prunedJobs} expired jobs.`,
            error: "Maintenance sweep failed.",
          });
        },
      },
      {
        id: "action-cleanup",
        permission: "settings",
        title: "Clear Stale Temporary Files (Free Disk Storage)",
        category: "System",
        icon: HardDrive,
        run: async () => {
          toast.promise(runTempCleanup(), {
            loading: "Cleaning stale temp files…",
            success: (res) =>
              `Cleaned ${res.removedCount} items. Freed ${Math.round((res.freedBytes / 1024 / 1024) * 10) / 10} MB.`,
            error: "Temp cleanup failed.",
          });
        },
      },
    ],
    [router],
  );

  const visibleItems = React.useMemo(() => {
    const isSuperAdmin = user?.role === "superadmin";
    const permissions = new Set(user?.permissions ?? []);
    return items.filter(
      (item) => !item.permission || isSuperAdmin || permissions.has(item.permission),
    );
  }, [items, user]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleItems;
    return visibleItems.filter(
      (item) => item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q),
    );
  }, [visibleItems, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-20 backdrop-blur-sm animate-in fade-in-0 duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-xl overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface/95 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center border-b border-outline-variant/15 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-on-surface-variant" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search sections… (ESC to close)"
            className="w-full bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-on-surface-variant"
          />
          <kbd className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant sm:inline-block">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-on-surface-variant">
              No matching admin commands found.
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      void item.run();
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left text-xs transition-colors hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary focus:outline-none"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                          {item.category}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-on-surface-variant opacity-60" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-outline-variant/15 bg-surface-container-low/50 px-4 py-2 text-[11px] text-on-surface-variant">
          <span>Tip: Press <kbd className="rounded bg-muted px-1">Ctrl</kbd> + <kbd className="rounded bg-muted px-1">K</kbd> anywhere in admin</span>
          <span>Admin Suite</span>
        </div>
      </div>
    </div>
  );
}
