"use client";

import * as React from "react";
import Link from "next/link";
import { Coins } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { fetchCreditsCached, type CreditsState } from "@/lib/credits";
import { cn } from "@/lib/utils";

/**
 * Header pill showing the signed-in account's credit balance. Light-weight:
 * fetched once on sign-in, cached in memory, and gently refreshed.
 */
export function CreditsPill({ className }: { className?: string }) {
  const { status } = useAuth();
  const [state, setState] = React.useState<CreditsState | null>(null);

  React.useEffect(() => {
    if (status !== "authed") {
      setState(null);
      return;
    }
    let alive = true;
    let lastFetched = 0;
    const load = (force = false) => {
      const now = Date.now();
      if (!force && now - lastFetched < 15_000) return;
      lastFetched = now;
      fetchCreditsCached()
        .then((s) => {
          if (alive) setState(s);
        })
        .catch(() => undefined);
    };
    load(true);
    const timer = setInterval(() => load(true), 60_000);
    const onFocus = () => load(false);
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [status]);

  if (status !== "authed") return null;

  const low = state != null && state.balance <= 5;

  return (
    <Link
      href="/profile#credits"
      title="Credits & plans"
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-2 font-mono text-[12px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        low
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-outline-variant/40 bg-surface-container-high/60 text-foreground hover:border-primary/40 hover:text-primary",
        className,
      )}
    >
      <Coins className="h-3.5 w-3.5" />
      {state ? state.balance.toLocaleString() : "···"}
    </Link>
  );
}
