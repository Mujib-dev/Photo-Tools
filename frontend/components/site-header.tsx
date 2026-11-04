"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  CircleUserRound,
  Crown,
  FolderOpen,
  Gift,
  HardDrive,
  Home,
  LogIn,
  LogOut,
  Mail,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Webhook,
  X,
  Zap,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { TemplatePicker } from "@/components/template-picker";
import { ToolPresetMenu } from "@/components/tool-preset-menu";
import { CreditsPill } from "@/components/credits-pill";
import { SiteAnnouncementBanner } from "@/components/site-announcement-banner";
import { useAuth } from "@/components/auth-provider";
import { TOOLS, TOOL_GROUPS } from "@/lib/tools";
import type { AuthUser } from "@/lib/types";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function isToolActive(pathname: string): boolean {
  return TOOLS.some((tool) => isActive(pathname, tool.href));
}

function initialsOf(user: Pick<AuthUser, "fullName" | "email">): string {
  const name = user.fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
    if (first) return `${first}${last}`.toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

function ProfileMenu({
  user,
  pathname,
  onLogout,
}: {
  user: AuthUser;
  pathname: string;
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const openMenu = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  }, []);

  const closeSoon = React.useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }, []);

  const closeNow = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(false);
  }, []);

  React.useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  React.useEffect(() => {
    closeNow();
  }, [pathname, closeNow]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNow();
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
  }, [open, closeNow]);

  const handleLogout = () => {
    closeNow();
    void onLogout();
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={closeSoon}
      onFocus={openMenu}
      onBlur={closeSoon}
    >
      <button
        type="button"
        onClick={openMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-outline-variant/40 bg-primary/15 font-mono text-[10px] font-bold text-primary transition-colors hover:border-primary/50 hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {user.avatar ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={user.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsOf(user)
        )}
      </button>

      <div
        role="menu"
        aria-label="Account"
        className={cn(
          "absolute right-0 top-full z-50 w-64 pt-2 transition-all duration-150",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-1 opacity-0 pointer-events-none",
        )}
      >
        <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-card shadow-[0_18px_48px_rgba(0,0,0,0.16)]">
          <div className="border-b border-outline-variant/20 px-4 py-3">
            {user.fullName && (
              <p className="truncate font-display text-sm font-semibold text-foreground">
                {user.fullName}
              </p>
            )}
            <p
              className={cn(
                "truncate font-mono text-xs",
                user.fullName ? "text-on-surface-variant" : "text-foreground",
              )}
            >
              {user.email}
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
              {user.role === "superadmin"
                ? "Super administrator"
                : user.role === "admin"
                  ? "Administrator"
                  : "Member"}
            </p>
          </div>
          <div className="p-1.5">
            <Link
              href="/files"
              role="menuitem"
              onClick={closeNow}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 font-display text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-container-high/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FolderOpen className="h-4 w-4 text-on-surface-variant" />
              My Files
            </Link>
            <Link
              href="/teams"
              role="menuitem"
              onClick={closeNow}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 font-display text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-container-high/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Users className="h-4 w-4 text-on-surface-variant" />
              Team Workspace
            </Link>
            <Link
              href="/folder-watcher"
              role="menuitem"
              onClick={closeNow}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 font-display text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-container-high/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Zap className="h-4 w-4 text-on-surface-variant" />
              Folder Watcher
            </Link>
            <Link
              href="/webhooks"
              role="menuitem"
              onClick={closeNow}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 font-display text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-container-high/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Webhook className="h-4 w-4 text-on-surface-variant" />
              Webhooks
            </Link>
            <Link
              href="/referrals"
              role="menuitem"
              onClick={closeNow}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 font-display text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-container-high/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Gift className="h-4 w-4 text-on-surface-variant" />
              Affiliate (25%)
            </Link>
            <Link
              href="/profile"
              role="menuitem"
              onClick={closeNow}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 font-display text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-container-high/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Settings className="h-4 w-4 text-on-surface-variant" />
              Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 font-display text-[13px] font-semibold text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4 text-on-surface-variant" />
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { status, user, logout } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  const [toolsOpen, setToolsOpen] = React.useState(false);
  const [desktopSearch, setDesktopSearch] = React.useState("");
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [mobileSearch, setMobileSearch] = React.useState("");
  const headerRef = React.useRef<HTMLElement | null>(null);
  const [headerBottom, setHeaderBottom] = React.useState(64);
  const [openMobileGroups, setOpenMobileGroups] = React.useState<Record<string, boolean>>(() => ({
    [TOOL_GROUPS[0].label]: true,
  }));
  const [activeGroup, setActiveGroup] = React.useState(TOOL_GROUPS[0].label);
  const toolsRef = React.useRef<HTMLDivElement | null>(null);
  const toolsButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const updateHeaderPos = () => {
      if (headerRef.current) {
        const rect = headerRef.current.getBoundingClientRect();
        setHeaderBottom(Math.round(rect.bottom) || 64);
      }
    };
    updateHeaderPos();
    window.addEventListener("resize", updateHeaderPos);
    window.addEventListener("scroll", updateHeaderPos);
    return () => {
      window.removeEventListener("resize", updateHeaderPos);
      window.removeEventListener("scroll", updateHeaderPos);
    };
  }, [mobileOpen]);

  const openTools = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setToolsOpen(true);
  }, []);

  const closeTools = React.useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setToolsOpen(false), 120);
  }, []);

  React.useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const authed = status === "authed" && user;
  const toolsActive = isToolActive(pathname);
  const activeGroupData = TOOL_GROUPS.find((group) => group.label === activeGroup) ?? TOOL_GROUPS[0];

  const displayedTools = React.useMemo(() => {
    const q = desktopSearch.trim().toLowerCase();
    if (!q) return activeGroupData.items;
    return TOOLS.filter(
      (tool) =>
        tool.label.toLowerCase().includes(q) ||
        tool.desc.toLowerCase().includes(q),
    );
  }, [desktopSearch, activeGroupData]);

  const handleLogout = React.useCallback(async () => {
    setToolsOpen(false);
    setMobileOpen(false);
    setDesktopSearch("");
    await logout();
  }, [logout]);

  React.useEffect(() => {
    setToolsOpen(false);
    setMobileOpen(false);
    setDesktopSearch("");
  }, [pathname]);

  React.useEffect(() => {
    if (!toolsOpen) {
      setDesktopSearch("");
    }
  }, [toolsOpen]);

  React.useEffect(() => {
    if (!toolsOpen) return;
    const match = TOOL_GROUPS.find((group) =>
      group.items.some((tool) => isActive(pathname, tool.href)),
    );
    if (match) setActiveGroup(match.label);
  }, [toolsOpen, pathname]);

  React.useEffect(() => {
    if (!toolsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setToolsOpen(false);
        toolsButtonRef.current?.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      if (!toolsRef.current?.contains(event.target as Node)) setToolsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [toolsOpen]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  // The admin console has its own shell: keep public navigation (home, tools,
  // contact, docs and the footer) out of it.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return null;
  }

  return (
    <>
      <SiteAnnouncementBanner />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:font-display focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header
        ref={headerRef}
        style={mobileOpen ? { zIndex: 100000, backgroundColor: "hsl(var(--background))" } : undefined}
        className={cn(
          "sticky top-0 w-full border-b border-outline-variant/20 transition-all duration-150",
          mobileOpen
            ? "z-[100000] bg-background shadow-md"
            : "z-50 bg-surface-container-lowest/85 backdrop-blur-xl",
        )}
      >
        <div className="container flex h-16 items-center justify-between gap-2 xl:gap-3" suppressHydrationWarning>
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/pictools-logo.png"
              alt="PicTools logo"
              className="h-8 w-auto shrink-0 object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <div className="flex items-center gap-1.5">
              <span className="font-display text-[19px] sm:text-[22px] font-bold leading-none tracking-tight text-foreground whitespace-nowrap">
                PicTools
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-tight text-primary border border-primary/20 shrink-0">
                by LynkZone
              </span>
            </div>
            <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-outline-variant/30 bg-muted px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant 2xl:inline-flex">
              <HardDrive className="h-3 w-3 text-primary" />
              Runs locally
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-0.5 xl:gap-1 lg:flex">
            <Link
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 xl:px-3.5 py-1.5 xl:py-2 font-display text-[13px] font-semibold tracking-[0.01em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap",
                pathname === "/"
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-foreground",
              )}
            >
              <Home className="h-3.5 w-3.5 shrink-0" />
              <span>Home</span>
            </Link>

            <Link
              href="/ai-generator"
              aria-current={pathname === "/ai-generator" ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 xl:px-3.5 py-1.5 xl:py-2 font-display text-[13px] font-semibold tracking-[0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap",
                pathname === "/ai-generator"
                  ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold shadow-sm"
                  : "text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 font-medium",
              )}
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-500 animate-pulse shrink-0" />
              <span>AI Studio</span>
              <span className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider leading-none">
                New
              </span>
            </Link>

            <div
              ref={toolsRef}
              className="relative"
              onMouseEnter={openTools}
              onMouseLeave={closeTools}
            >
              <button
                ref={toolsButtonRef}
                type="button"
                onClick={() => setToolsOpen((open) => !open)}
                aria-expanded={toolsOpen}
                aria-haspopup="true"
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 xl:px-3.5 py-1.5 xl:py-2 font-display text-[13px] font-semibold tracking-[0.01em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap",
                  toolsActive
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-foreground",
                )}
              >
                <span>Tools</span>
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform duration-200 shrink-0", toolsOpen && "rotate-180")}
                />
              </button>

              {toolsOpen && (
              <div
                id="tools-menu"
                className="absolute left-1/2 top-full z-50 mt-2 flex w-[min(700px,calc(100vw-2rem))] max-h-[min(460px,calc(100vh-5.5rem))] -translate-x-1/2 origin-top overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-2xl"
              >
                {/* Left Categories Sidebar */}
                <div className="flex w-[190px] shrink-0 flex-col gap-0.5 border-r border-outline-variant/20 bg-surface-container-high/30 p-1.5 overflow-y-auto scrollbar-thin">
                  {TOOL_GROUPS.map((group) => {
                    const GroupIcon = group.icon;
                    const groupActive = group.label === activeGroup && !desktopSearch;
                    return (
                      <button
                        key={group.label}
                        type="button"
                        onMouseEnter={() => {
                          setActiveGroup(group.label);
                          if (desktopSearch) setDesktopSearch("");
                        }}
                        onFocus={() => {
                          setActiveGroup(group.label);
                          if (desktopSearch) setDesktopSearch("");
                        }}
                        onClick={() => {
                          setActiveGroup(group.label);
                          if (desktopSearch) setDesktopSearch("");
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          groupActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-surface-container-high/60",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                            groupActive ? "bg-primary/15" : "bg-muted text-on-surface-variant",
                          )}
                        >
                          <GroupIcon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-display text-[12px] font-semibold leading-tight">
                          {group.label}
                        </span>
                        <span className="font-mono text-[10px] text-on-surface-variant/60">
                          {group.items.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Tool Grid Pane */}
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="flex items-center justify-between gap-2 border-b border-outline-variant/15 bg-surface-container-lowest/70 px-3 py-1.5 shrink-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant truncate">
                        {desktopSearch.trim() ? `Search Results (${displayedTools.length})` : activeGroupData.label}
                      </span>
                      {!desktopSearch.trim() && (
                        <span className="font-mono text-[10px] text-on-surface-variant/60">
                          ({activeGroupData.items.length})
                        </span>
                      )}
                    </div>

                    <div className="relative w-40 shrink-0">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant/60" />
                      <input
                        type="text"
                        value={desktopSearch}
                        onChange={(e) => setDesktopSearch(e.target.value)}
                        placeholder="Filter tools..."
                        className="w-full rounded-md border border-outline-variant/30 bg-surface-container-high/40 py-1 pl-7 pr-6 text-[11px] text-foreground placeholder:text-on-surface-variant/50 focus:border-primary focus:bg-surface-container-lowest focus:outline-none"
                      />
                      {desktopSearch && (
                        <button
                          type="button"
                          onClick={() => setDesktopSearch("")}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-on-surface-variant hover:text-foreground"
                          aria-label="Clear filter"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                    {displayedTools.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-on-surface-variant">
                        <p>No tools found matching &quot;{desktopSearch}&quot;</p>
                        <button
                          type="button"
                          onClick={() => setDesktopSearch("")}
                          className="mt-2 text-xs text-primary hover:underline"
                        >
                          Clear filter
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1">
                        {displayedTools.map((tool) => {
                          const active = isActive(pathname, tool.href);
                          const Icon = tool.icon;
                          return (
                            <Link
                              key={tool.href}
                              href={tool.href}
                              onClick={() => {
                                setToolsOpen(false);
                                setDesktopSearch("");
                              }}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                active
                                  ? "bg-primary/10 text-primary"
                                  : "text-foreground hover:bg-surface-container-high/60",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
                                  active ? "bg-primary/15" : "bg-muted text-on-surface-variant group-hover:bg-surface-container-high",
                                )}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-display text-[12px] font-semibold leading-tight truncate">
                                  {tool.label}
                                </span>
                                <span className="block text-[10px] leading-tight text-on-surface-variant/80 truncate">
                                  {tool.desc}
                                </span>
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}
            </div>

            <Link
              href="/pricing"
              aria-current={isActive(pathname, "/pricing") ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 xl:px-3.5 py-1.5 xl:py-2 font-display text-[13px] font-semibold tracking-[0.01em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap",
                isActive(pathname, "/pricing")
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-bold",
              )}
            >
              <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>Pricing</span>
            </Link>

            <Link
              href="/contact"
              aria-current={isActive(pathname, "/contact") ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 xl:px-3.5 py-1.5 xl:py-2 font-display text-[13px] font-semibold tracking-[0.01em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap",
                isActive(pathname, "/contact")
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-foreground",
              )}
            >
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span>Contact</span>
            </Link>

            {authed && (
              <Link
                href="/files"
                aria-current={isActive(pathname, "/files") ? "page" : undefined}
                className={cn(
                  "hidden xl:flex items-center gap-1.5 rounded-full px-2.5 xl:px-3.5 py-1.5 xl:py-2 font-display text-[13px] font-semibold tracking-[0.01em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap",
                  isActive(pathname, "/files")
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-foreground",
                )}
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                <span>My Files</span>
              </Link>
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-2">
            <CreditsPill className="hidden md:flex" />
            <div className="hidden xl:flex items-center gap-1">
              <ToolPresetMenu />
              <TemplatePicker />
            </div>
            <ThemeToggle />

            {authed ? (
              <div className="hidden lg:flex">
                <ProfileMenu user={user} pathname={pathname} onLogout={handleLogout} />
              </div>
            ) : (
              <div className="hidden items-center gap-1.5 lg:flex">
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 xl:px-4 xl:py-2 font-display text-xs xl:text-[13px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 xl:px-4 xl:py-2 font-display text-xs xl:text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_rgba(37,99,235,0.28)] transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Sign up
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              style={mobileOpen ? { zIndex: 100001 } : undefined}
              className="relative z-[100001] flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/40 text-foreground transition-colors hover:bg-surface-container-high/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {mounted &&
        mobileOpen &&
        createPortal(
          <>
            {/* Backdrop overlay */}
            <div
              style={{
                position: "fixed",
                top: `${headerBottom}px`,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99998,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
              }}
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Mobile Navigation Drawer strictly elevated in portal above all tools UI */}
            <div
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation Menu"
              style={{
                position: "fixed",
                top: `${headerBottom}px`,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99999,
                backgroundColor: "hsl(var(--background))",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
              }}
              className="border-t border-outline-variant/20 bg-background px-4 pb-28 pt-4 shadow-2xl lg:hidden"
            >
              <nav aria-label="Mobile" className="space-y-5 pb-16">
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  aria-current={pathname === "/" ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 font-display text-[15px] font-semibold",
                    pathname === "/" ? "bg-primary/10 text-primary" : "text-foreground",
                  )}
                >
                  <Home className="h-4 w-4" />
                  Home
                </Link>

                <Link
                  href="/ai-generator"
                  onClick={() => setMobileOpen(false)}
                  aria-current={pathname === "/ai-generator" ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3 py-2.5 font-display text-[15px] font-semibold",
                    pathname === "/ai-generator"
                      ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold"
                      : "text-purple-600 dark:text-purple-400 hover:bg-purple-500/10",
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <Sparkles className="h-4 w-4 text-purple-500 animate-pulse" />
                    AI Studio (Image & Video)
                  </span>
                  <span className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    New
                  </span>
                </Link>

            {/* Mobile Tool Customization (Presets & Templates) */}
            <div className="flex items-center justify-between gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-2.5 sm:hidden">
              <span className="font-mono text-[11px] font-semibold text-on-surface-variant">
                Customization & Presets
              </span>
              <div className="flex items-center gap-1.5">
                <ToolPresetMenu />
                <TemplatePicker />
              </div>
            </div>

            {/* Mobile Tool Quick Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant/60" />
              <input
                type="text"
                value={mobileSearch}
                onChange={(e) => setMobileSearch(e.target.value)}
                placeholder="Search 60+ tools..."
                className="h-9 w-full rounded-xl border border-outline-variant/30 bg-surface-container-high/40 pl-8 pr-3 text-xs text-foreground placeholder:text-on-surface-variant/50 focus:border-primary/60 focus:outline-none"
              />
            </div>

            {/* If user is searching on mobile, display flat matched tools */}
            {mobileSearch.trim() ? (
              <div className="space-y-1">
                {TOOLS.filter(
                  (t) =>
                    t.title.toLowerCase().includes(mobileSearch.toLowerCase()) ||
                    t.label.toLowerCase().includes(mobileSearch.toLowerCase()) ||
                    t.desc.toLowerCase().includes(mobileSearch.toLowerCase()),
                ).map((tool) => {
                  const Icon = tool.icon;
                  const active = isActive(pathname, tool.href);
                  return (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface-container-high/60",
                      )}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-on-surface-variant">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-display text-[14px] font-semibold leading-tight">
                          {tool.label}
                        </span>
                        <span className="block text-[11px] leading-tight text-on-surface-variant truncate">
                          {tool.desc}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              TOOL_GROUPS.map((group) => {
                const hasActiveTool = group.items.some((tool) => isActive(pathname, tool.href));
                const isExplicitlyToggled = group.label in openMobileGroups;
                const displayOpen = isExplicitlyToggled ? openMobileGroups[group.label] : hasActiveTool;

                return (
                  <div
                    key={group.label}
                    className="rounded-xl border border-outline-variant/20 bg-surface-container-low/40 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMobileGroups((prev) => ({
                          ...prev,
                          [group.label]: !displayOpen,
                        }))
                      }
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high/60"
                    >
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                        {group.label}
                        <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {group.items.length}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-on-surface-variant transition-transform duration-200",
                          displayOpen && "rotate-180",
                        )}
                      />
                    </button>

                    {displayOpen && (
                      <ul className="space-y-0.5 p-1 border-t border-outline-variant/15">
                        {group.items.map((tool) => {
                          const active = isActive(pathname, tool.href);
                          const Icon = tool.icon;
                          return (
                            <li key={tool.href}>
                              <Link
                                href={tool.href}
                                onClick={() => setMobileOpen(false)}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                  "flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
                                  active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface-container-high/60",
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                                    active ? "bg-primary/15" : "bg-muted text-on-surface-variant",
                                  )}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block font-display text-[14px] font-semibold leading-tight">
                                    {tool.label}
                                  </span>
                                  <span className="block text-[11px] leading-tight text-on-surface-variant truncate">
                                    {tool.desc}
                                  </span>
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })
            )}

            <Link
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              aria-current={isActive(pathname, "/pricing") ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 font-display text-[15px] font-bold text-amber-600 dark:text-amber-400",
                isActive(pathname, "/pricing") ? "bg-amber-500/15" : "",
              )}
            >
              <Crown className="h-4 w-4 text-amber-500" />
              Pricing & Plans
            </Link>

            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              aria-current={isActive(pathname, "/contact") ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 font-display text-[15px] font-semibold",
                isActive(pathname, "/contact") ? "bg-primary/10 text-primary" : "text-foreground",
              )}
            >
              <Mail className="h-4 w-4" />
              Contact
            </Link>

            {authed && (
              <Link
                href="/files"
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(pathname, "/files") ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 font-display text-[15px] font-semibold",
                  isActive(pathname, "/files")
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-surface-container-high/60",
                )}
              >
                <FolderOpen className="h-4 w-4" />
                My Files
              </Link>
            )}

            {authed && (
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(pathname, "/profile") ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 font-display text-[15px] font-semibold",
                  isActive(pathname, "/profile")
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-surface-container-high/60",
                )}
              >
                <CircleUserRound className="h-4 w-4" />
                Profile
              </Link>
            )}

            <div className="h-px bg-outline-variant/20" />

            {authed && <CreditsPill className="mx-3 self-start" />}

            {authed ? (
              <div className="flex items-center justify-between gap-3 px-3 py-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary">
                    {user.avatar ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={user.avatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initialsOf(user)
                    )}
                  </span>
                  <span className="min-w-0">
                    {user.fullName && (
                      <span className="block truncate font-display text-[13px] font-semibold leading-tight text-foreground">
                        {user.fullName}
                      </span>
                    )}
                    <span className="block truncate font-mono text-xs leading-tight text-on-surface-variant">
                      {user.email}
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-outline-variant/40 px-3.5 py-2 font-display text-[13px] font-semibold text-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-full border border-outline-variant/40 px-4 py-2.5 font-display text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-container-high/60"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Log in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 font-display text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_rgba(37,99,235,0.28)]"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Sign up
                </Link>
              </div>
            )}
          </nav>
        </div>
      </>,
      document.body,
    )}
    </>
  );
}
