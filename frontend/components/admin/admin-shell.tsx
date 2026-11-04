"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CircleUserRound,
  DollarSign,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";

import { AdminNotifications } from "@/components/admin/admin-notifications";
import { AdminCommandPalette } from "@/components/admin/admin-command-palette";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminPermission } from "@/lib/types";
import { Command, Search } from "lucide-react";

const NAV: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  permission?: AdminPermission;
}> = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, permission: "analytics" },
  { href: "/admin/revenue", label: "Revenue & MRR", icon: DollarSign, permission: "revenue" },
  { href: "/admin/users", label: "Users", icon: Users, permission: "users" },
  { href: "/admin/jobs", label: "Jobs", icon: Activity, permission: "jobs" },
  { href: "/admin/support", label: "Support Desk", icon: LifeBuoy, permission: "support" },
  { href: "/admin/affiliates", label: "Affiliates", icon: Gift, permission: "affiliates" },
  { href: "/admin/contacts", label: "Contacts", icon: Mail, permission: "contacts" },
  { href: "/admin/promos", label: "Promo codes", icon: Ticket, permission: "promos" },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText, permission: "audit" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings" },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [commandOpen, setCommandOpen] = React.useState(false);

  const isSuperAdmin = user?.role === "superadmin";
  const permissions = React.useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);
  const canAccess = (permission?: AdminPermission) =>
    !permission || isSuperAdmin || permissions.has(permission);
  const visibleNav = NAV.filter((item) => canAccess(item.permission));
  const currentNav = NAV.find((item) => isActive(pathname, item.href, item.exact));
  const currentAllowed = !currentNav || canAccess(currentNav.permission);

  return (
    <div className="flex min-h-screen flex-col w-full">
      {/* Sticky admin bar — full width, beautifully padded and fixed at top */}
      <header className="sticky top-0 z-40 w-full border-b border-outline-variant/20 bg-background/95 backdrop-blur-xl shadow-xs">
        <div className="mx-auto w-full max-w-[1280px] px-4 py-3 sm:px-6 sm:py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-primary/15">
                <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-primary font-bold">
                    LynkZone Enterprise
                  </p>
                  <span className="hidden sm:inline-flex rounded-full bg-primary/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-primary border border-primary/20">
                    {isSuperAdmin ? "Super admin" : "Admin"}
                  </span>
                </div>
                <h1 className="truncate font-display text-base sm:text-[20px] font-bold tracking-tight">
                  PicTools Control Center{user?.email ? ` · ${user.email}` : ""}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="hidden h-9 items-center gap-2 rounded-xl text-xs sm:flex"
                onClick={() => setCommandOpen(true)}
              >
                <Search className="h-3.5 w-3.5 text-on-surface-variant" />
                <span>Search commands</span>
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant">
                  Ctrl+K
                </kbd>
              </Button>
              <AdminNotifications />
              <ThemeToggle />
              <Button asChild variant="ghost" size="icon" className="rounded-full">
                <Link href="/profile" aria-label="Profile settings" title="Profile settings">
                  <CircleUserRound className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link href="/">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  View site
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg"
                onClick={() => void logout()}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <AdminCommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

      <div className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-4 sm:px-6 sm:py-6 pb-8 md:pb-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <aside className="md:sticky md:top-20 md:w-56 md:shrink-0">
          <nav
            aria-label="Admin sections"
            className="glass-panel flex gap-1 overflow-x-auto rounded-2xl p-1.5 md:flex-col md:overflow-visible"
          >
            {visibleNav.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 font-display text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          {currentAllowed ? (
            children
          ) : (
            <div className="glass-panel rounded-2xl px-6 py-12 text-center">
              <span className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15">
                <ShieldAlert className="h-5 w-5 text-destructive" />
              </span>
              <h2 className="font-display text-xl font-semibold tracking-tight">No access</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-on-surface-variant">
                Your administrator account does not have permission to open{" "}
                {currentNav?.label ?? "this section"}. Ask the super administrator to grant you
                access.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}
