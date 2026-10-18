import Link from "next/link";
import { BookOpen, FileText, HardDrive, MessageCircle, ShieldCheck, type LucideIcon } from "lucide-react";

import { TOOLS } from "@/lib/tools";
import { cn } from "@/lib/utils";

type FooterLink = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const COMPANY_LINKS: FooterLink[] = [
  { label: "Contact Support", href: "/contact", icon: MessageCircle },
  { label: "API Documentation", href: "/docs", icon: BookOpen },
  { label: "Privacy Policy", href: "/privacy", icon: ShieldCheck },
  { label: "Terms of Service", href: "/terms", icon: FileText },
];

const HEADING_CLASS = "font-mono text-[10px] uppercase tracking-widest text-on-surface-variant";

const LINK_CLASS =
  "group flex items-center gap-2 rounded-sm text-sm text-on-surface-variant transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const ICON_CLASS = "h-3.5 w-3.5 shrink-0 text-on-surface-variant/60 transition-colors duration-200 group-hover:text-primary";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-outline-variant/20 bg-surface-container-lowest">
      <div className="container grid gap-8 py-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1.7fr_1fr]">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pictools-logo.png" alt="PicTools logo" className="h-8 w-auto object-contain" />
            <span className="font-display text-[22px] font-bold leading-none tracking-tight text-foreground">
              PicTools
            </span>
          </Link>
          <p className="mt-2.5 font-body text-primary">Simple tools for better images.</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-muted px-3 py-1 font-mono text-[11px] text-on-surface-variant">
            <HardDrive className="h-3.5 w-3.5 shrink-0 text-primary" />
            Runs locally on your computer
          </p>
        </div>

        <nav aria-label="Footer tools">
          <p className={HEADING_CLASS}>Tools</p>
          <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:gap-x-6">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <li key={tool.href}>
                  <Link href={tool.href} className={LINK_CLASS}>
                    <Icon className={ICON_CLASS} />
                    {tool.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <nav aria-label="Company">
          <p className={HEADING_CLASS}>Company</p>
          <ul className="mt-2.5 space-y-1.5">
            {COMPANY_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <li key={link.href + link.label}>
                  <Link href={link.href} className={LINK_CLASS}>
                    <Icon className={ICON_CLASS} />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="border-t border-outline-variant/20">
        <div className="container flex flex-col items-center justify-between gap-2 py-4 sm:flex-row">
          <p className="text-center text-xs text-on-surface-variant sm:text-left">
            © {year} PicTools. Optical Precision for High-Performance Image Processing.
          </p>
          <p className="text-center text-xs text-on-surface-variant sm:text-right">
            Developed by <span className="font-semibold text-primary">LynkZone</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
