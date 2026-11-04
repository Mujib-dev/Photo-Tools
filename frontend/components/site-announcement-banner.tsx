"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Info, Megaphone, Sparkles, X } from "lucide-react";
import type { SiteAnnouncement } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SiteAnnouncementBanner() {
  const [announcement, setAnnouncement] = React.useState<SiteAnnouncement | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    let unmounted = false;
    async function fetchAnnouncement() {
      try {
        const res = await fetch("/api/backend/announcement");
        if (!res.ok) return;
        const data = (await res.json()) as { announcement: SiteAnnouncement };
        if (unmounted) return;
        if (data.announcement?.active && data.announcement.message.trim()) {
          const dismissKey = `dismissed_announcement_${data.announcement.updatedAt}`;
          if (sessionStorage.getItem(dismissKey) === "1") {
            setDismissed(true);
          }
          setAnnouncement(data.announcement);
        } else {
          setAnnouncement(null);
        }
      } catch {
        // Silently ignore if offline
      }
    }
    void fetchAnnouncement();
    return () => {
      unmounted = true;
    };
  }, []);

  const handleDismiss = () => {
    if (announcement) {
      sessionStorage.setItem(`dismissed_announcement_${announcement.updatedAt}`, "1");
    }
    setDismissed(true);
  };

  if (!announcement || !announcement.active || dismissed || !announcement.message) {
    return null;
  }

  const tone = announcement.tone ?? "info";

  return (
    <aside
      aria-label="Site announcement"
      className={cn(
        "relative z-50 flex items-center justify-between gap-3 px-4 py-2 text-xs font-medium transition-colors",
        tone === "sale" &&
          "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-sm",
        tone === "warning" &&
          "bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-sm",
        tone === "info" &&
          "bg-gradient-to-r from-primary via-indigo-600 to-primary text-white shadow-sm",
      )}
    >
      <div className="mx-auto flex flex-wrap items-center justify-center gap-2 text-center">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
          {tone === "sale" ? (
            <Sparkles className="h-3 w-3" />
          ) : tone === "warning" ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <Megaphone className="h-3 w-3" />
          )}
        </span>
        <span className="leading-snug">{announcement.message}</span>
        {announcement.link && (
          <Link
            href={announcement.link}
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-white/80"
          >
            Learn more &rarr;
          </Link>
        )}
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss announcement"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </aside>
  );
}
