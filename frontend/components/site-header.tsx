"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  HardDrive,
  Home,
  LogIn,
  LogOut,
  Mail,
  Menu,
  UserPlus,
  X,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/auth-provider";
import { TOOLS, TOOL_GROUPS } from "@/lib/tools";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function isToolActive(pathname: string): boolean {
  return TOOLS.some((tool) => isActive(pathname, tool.href));
}

function initialsOf(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

export function SiteHeader() {
  const pathname = usePathname();
  const { status, user, logout } = useAuth();
  const [toolsOpen, setToolsOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [activeGroup, setActiveGroup] = React.useState(TOOL_GROUPS[0].label);
  const toolsRef = React.useRef<HTMLDivElement | null>(null);
  const toolsButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleLogout = React.useCallback(async () => {
    setToolsOpen(false);
    setMobileOpen(false);
    await logout();
  }, [logout]);

  React.useEffect(() => {
    setToolsOpen(false);
    setMobileOpen(false);
  }, [pathname]);

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

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:font-display focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 w-full border-b border-outline-variant/20 bg-surface-container-lowest/85 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/pictools-logo.png"
              alt="PicTools logo"
              className="h-8 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <span className="font-display text-[22px] font-bold leading-none tracking-tight text-foreground">
              PicTools
            </span>
            <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-outline-variant/30 bg-muted px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant xl:inline-flex">
              <HardDrive className="h-3 w-3 text-primary" />
              Runs locally
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            <Link
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-2 font-display text-[13px] font-semibold tracking-[0.01em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                pathname === "/"
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-foreground",
              )}
            >
              <Home className="h-3.5 w-3.5" />
              Home
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
                  "flex items-center gap-1.5 rounded-full px-3.5 py-2 font-display text-[13px] font-semibold tracking-[0.01em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  toolsActive
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-foreground",
                )}
              >
                Tools
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform duration-200", toolsOpen && "rotate-180")}
                />
              </button>

              {toolsOpen && (
              <div
                id="tools-menu"
                className="absolute left-1/2 top-full z-50 mt-2 flex w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 origin-top overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-2xl"
              >
                <div className="flex w-[224px] shrink-0 flex-col gap-0.5 border-r border-outline-variant/20 bg-surface-container-high/30 p-2">
                  {TOOL_GROUPS.map((group) => {
                    const GroupIcon = group.icon;
                    const groupActive = group.label === activeGroup;
                    return (
                      <button
                        key={group.label}
                        type="button"
                        onMouseEnter={() => setActiveGroup(group.label)}
                        onFocus={() => setActiveGroup(group.label)}
                        onClick={() => setActiveGroup(group.label)}
                        className={cn(
                          "flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          groupActive
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-surface-container-high/60",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                            groupActive ? "bg-primary/15" : "bg-muted text-on-surface-variant",
                          )}
                        >
                          <GroupIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-display text-[13px] font-semibold leading-tight">
                            {group.label}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-tight text-on-surface-variant">
                            {group.desc}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="min-w-0 flex-1 p-2">
                  <div className="flex items-center justify-between px-2 pb-1.5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                      {activeGroupData.label}
                    </p>
                    <span className="font-mono text-[10px] text-on-surface-variant/70">
                      {activeGroupData.items.length} tools
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {activeGroupData.items.map((tool) => {
                      const active = isActive(pathname, tool.href);
                      const Icon = tool.icon;
                      return (
                        <Link
                          key={tool.href}
                          href={tool.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-surface-container-high/60",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                              active ? "bg-primary/15" : "bg-muted text-on-surface-variant",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-display text-[13px] font-semibold leading-tight">
                              {tool.label}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-tight text-on-surface-variant">
                              {tool.desc}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
              )}
            </div>

            <Link
              href="/contact"
              aria-current={isActive(pathname, "/contact") ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-2 font-display text-[13px] font-semibold tracking-[0.01em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive(pathname, "/contact")
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-foreground",
              )}
            >
              <Mail className="h-3.5 w-3.5" />
              Contact
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />

            {authed ? (
              <div className="hidden items-center gap-2 lg:flex">
                <span
                  className="flex items-center gap-2 rounded-full border border-outline-variant/30 py-1 pl-1 pr-3"
                  title={user.email}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 font-mono text-[10px] font-bold text-primary">
                    {initialsOf(user.email)}
                  </span>
                  <span className="max-w-[140px] truncate font-mono text-xs text-on-surface-variant">
                    {user.email}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  aria-label="Log out"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/40 text-on-surface-variant transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 rounded-full px-4 py-2 font-display text-[13px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-display text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_rgba(37,99,235,0.28)] transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/40 text-foreground transition-colors hover:bg-surface-container-high/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div
          id="mobile-menu"
          hidden={!mobileOpen}
          className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-outline-variant/20 bg-surface-container-lowest px-4 pb-6 pt-4 lg:hidden"
        >
          <nav aria-label="Mobile" className="space-y-5">
            <Link
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 font-display text-[15px] font-semibold",
                pathname === "/" ? "bg-primary/10 text-primary" : "text-foreground",
              )}
            >
              <Home className="h-4 w-4" />
              Home
            </Link>

            {TOOL_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((tool) => {
                    const active = isActive(pathname, tool.href);
                    const Icon = tool.icon;
                    return (
                      <li key={tool.href}>
                        <Link
                          href={tool.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                            active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface-container-high/60",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                              active ? "bg-primary/15" : "bg-muted text-on-surface-variant",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-display text-[15px] font-semibold leading-tight">
                              {tool.label}
                            </span>
                            <span className="block text-xs leading-tight text-on-surface-variant">
                              {tool.desc}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            <Link
              href="/contact"
              aria-current={isActive(pathname, "/contact") ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 font-display text-[15px] font-semibold",
                isActive(pathname, "/contact") ? "bg-primary/10 text-primary" : "text-foreground",
              )}
            >
              <Mail className="h-4 w-4" />
              Contact
            </Link>

            <div className="h-px bg-outline-variant/20" />

            {authed ? (
              <div className="flex items-center justify-between gap-3 px-3 py-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary">
                    {initialsOf(user.email)}
                  </span>
                  <span className="truncate font-mono text-xs text-on-surface-variant">{user.email}</span>
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
                  className="flex items-center justify-center gap-1.5 rounded-full border border-outline-variant/40 px-4 py-2.5 font-display text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-container-high/60"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 font-display text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_rgba(37,99,235,0.28)]"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Sign up
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
