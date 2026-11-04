"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, CheckCircle2, HardDrive, Loader2, Lock, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { TOOLS } from "@/lib/tools";

/**
 * Routes that strictly require a registered account:
 * - Heavy GPU / AI model generation (video rotoscoping, face swap, 3D parallax, interior staging, voice AI)
 * - Cloud asset manager & multi-user workspaces (/files, /teams, /webhooks, /batch)
 *
 * Standard local utilities (resize, convert, compress, crop, adjust, PDF, QR, watermark, exif)
 * run freely for guests without a blocking login wall.
 */
const STRICT_AUTH_ROUTES = new Set([
  "/video-bg-remover",
  "/parallax-animator",
  "/floorplan-stager",
  "/uncrop",
  "/relight",
  "/ai-model-studio",
  "/outfit-studio",
  "/text-to-speech",
  "/speech-to-text",
  "/voice-changer",
  "/voice-enhancer",
  "/stem-separator",
  "/viral-clips",
  "/colorize",
  "/restore",
  "/eraser",
  "/headshot",
  "/batch",
  "/files",
  "/teams",
  "/webhooks",
  "/folder-watcher",
  "/profile",
]);

interface AuthGateProps {
  children: React.ReactNode;
  /** Force auth gate even on standard tools if true */
  requireAuth?: boolean;
}

export function AuthGate({ children, requireAuth = false }: AuthGateProps) {
  const { status } = useAuth();
  const pathname = usePathname();

  if (status === "loading") {
    return (
      <div
        suppressHydrationWarning
        className="mx-auto flex max-w-[1280px] flex-col items-center justify-center px-6 py-32"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-on-surface-variant">Checking your session…</p>
      </div>
    );
  }

  const isStrict = requireAuth || STRICT_AUTH_ROUTES.has(pathname);

  // If visitor is a guest and this is a strictly gated route (Heavy AI, Cloud Files, Teams)
  if (status === "guest" && isStrict) {
    const next = encodeURIComponent(pathname);
    const currentTool = TOOLS.find((t) => t.href === pathname);
    const toolTitle = currentTool?.label ? currentTool.label : "this tool";
    const ToolIcon = currentTool?.icon ?? Lock;

    return (
      <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-[1280px] items-center justify-center px-4 py-8 sm:px-6 md:py-12">
        <div className="glass-panel mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-outline-variant/30 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
          {/* Header */}
          <div className="border-b border-outline-variant/20 bg-primary-container/10 px-5 pb-4 pt-5 text-center sm:px-8">
            <span className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm">
              <ToolIcon className="h-5 w-5" />
            </span>
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary font-semibold">
              Free Account Required
            </p>
            <h2 className="mt-1 font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Sign in to use {toolTitle}
            </h2>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-on-surface-variant">
              Create a free account to unlock high-speed AI processing. Your files never leave this computer.
            </p>
          </div>

          {/* Actions & Value Props */}
          <div className="p-5 sm:p-7">
            {/* Primary Action Buttons */}
            <div className="space-y-2">
              <Button asChild className="w-full rounded-xl py-3 h-11 font-semibold text-sm shadow-sm" size="default">
                <Link href={`/signup?next=${next}`}>
                  Create Free Account
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="w-full rounded-xl py-2.5 h-10 font-semibold text-xs border-outline-variant/40 hover:bg-surface-container-high/50"
              >
                <Link href={`/login?next=${next}`}>
                  Already have an account? Log in
                </Link>
              </Button>
            </div>

            {/* Quick Benefits List */}
            <div className="mt-4 rounded-xl border border-outline-variant/20 bg-surface-container-high/30 p-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-foreground mb-2">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  What you unlock:
                </span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  55+ Free Tools
                </span>
              </div>
              
              <ul className="grid grid-cols-2 gap-1.5 text-[11px] text-on-surface-variant">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span>50 Free starter credits</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span>100% Privacy &amp; local run</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span>No credit card needed</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span>Smart Cloud Files &amp; ZIP</span>
                </li>
              </ul>
            </div>

            {/* Local Processing Guarantee */}
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center font-mono text-[11px] text-on-surface-variant">
              <HardDrive className="h-3.5 w-3.5 shrink-0 text-primary" />
              Processed locally on your device
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If visitor is a guest on a standard free utility tool, let them use it instantly!
  if (status === "guest") {
    return (
      <>
        <div className="mx-auto max-w-[1280px] px-4 pt-3 pb-1">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <HardDrive className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Guest mode: free local processing.</span>
            </span>
            <Link
              href={`/signup?next=${encodeURIComponent(pathname)}`}
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <span className="hidden sm:inline">Sign up to save files &amp; get 50 free credits</span>
              <span className="sm:hidden">Get 50 free credits</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
            </Link>
          </div>
        </div>
        {children}
      </>
    );
  }

  return <>{children}</>;
}
