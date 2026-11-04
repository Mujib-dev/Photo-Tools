import type { Metadata } from "next";

import { UsageDashboard } from "@/components/usage-dashboard";

export const metadata: Metadata = {
  title: "Usage",
  description: "Track your credit usage, spending by tool and monthly trends.",
};

export default function UsageRoute() {
  return (
    <div className="bg-hero-grid relative min-h-[calc(100vh-10rem)]">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-container/20 blur-[120px]" />
      <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Usage dashboard
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            See how many credits you've used, which tools consumed them, and monthly trends.
          </p>
        </div>
        <UsageDashboard />
      </div>
    </div>
  );
}
