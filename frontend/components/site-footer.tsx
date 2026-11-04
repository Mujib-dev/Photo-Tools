"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  HardDrive,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { TOOLS } from "@/lib/tools";

const FEATURED_TOOLS = [
  { label: "Product Studio & Commercial Ads", href: "/product-studio", badge: "New" },
  { label: "AI Creative Studio (Text to Image & Video)", href: "/ai-generator", badge: "Pro" },
  { label: "AI Headshot Studio", href: "/headshot", badge: "Pro" },
  { label: "AI Vocal Remover", href: "/stem-separator", badge: "New" },
  { label: "AI Resume & ATS Optimizer", href: "/resume-optimizer", badge: "New" },
  { label: "Legal Contract Analyzer", href: "/legal-analyzer", badge: "New" },
  { label: "AI Receipt & Invoice Parser", href: "/receipt-parser" },
  { label: "PDF Security & Permissions", href: "/pdf-security" },
  { label: "Photo Resizer & Converter", href: "/resize" },
  { label: "AI Background Remover", href: "/remove-bg" },
];

const RESOURCE_LINKS = [
  { label: "Pricing & Plans", href: "/pricing" },
  { label: "API Documentation", href: "/docs" },
  { label: "Contact Support", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

export function SiteFooter() {
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const year = new Date().getFullYear();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return null;
  }

  if (!mounted) {
    return null;
  }

  return (
    <footer className="border-t border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant">
      <div className="container py-8 sm:py-10" suppressHydrationWarning>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand & Mission Column */}
          <div className="md:col-span-2 space-y-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/pictools-logo.png" alt="PicTools logo" className="h-8 w-auto object-contain" />
              <div className="flex items-center gap-1.5">
                <span className="font-display text-[22px] font-bold leading-none tracking-tight text-foreground">
                  PicTools
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-tight text-primary border border-primary/20">
                  by LynkZone
                </span>
              </div>
            </Link>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              High-performance, privacy-first offline toolkit for photos, documents, and creative ads. Engineered with enterprise security by LynkZone. Zero cloud data leaks—your files stay on your device.
            </p>
            <div className="pt-1 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-muted/60 px-2.5 py-1 font-mono text-[11px] text-on-surface-variant">
                <HardDrive className="h-3 w-3 text-primary shrink-0" />
                Runs 100% locally on your computer
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                Verified LynkZone Product
              </span>
            </div>
          </div>

          {/* Featured Tools Column */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-widest text-foreground font-semibold">
                Popular Tools
              </p>
              <Link
                href="/#tools"
                className="group inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <span>View all {TOOLS.length} tools</span>
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {FEATURED_TOOLS.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-md py-1 text-on-surface-variant hover:text-foreground transition-colors"
                >
                  <span className="min-w-0 truncate" title={tool.label}>
                    {tool.label}
                  </span>
                  {tool.badge && (
                    <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-mono font-bold text-primary">
                      {tool.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources & Legal Column */}
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-foreground font-semibold">
              Company & Legal
            </p>
            <ul className="space-y-2 text-xs">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-on-surface-variant hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Attribution */}
        <div className="mt-8 border-t border-outline-variant/15 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p className="text-center sm:text-left">
            © {year} LynkZone. All rights reserved. PicTools™ Commercial & Creative Suite.
          </p>
          <p className="text-center sm:text-right">
            Official Software Architecture by <span className="font-semibold text-foreground">LynkZone</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
