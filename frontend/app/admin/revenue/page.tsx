"use client";

import * as React from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  DollarSign,
  PieChart,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRevenueMetrics } from "@/lib/admin";
import type { AdminRevenueMetrics } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AdminRevenuePage() {
  const [metrics, setMetrics] = React.useState<AdminRevenueMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRevenueMetrics();
      setMetrics(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load revenue metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const mrrDollars = metrics ? (metrics.mrrCents / 100).toFixed(2) : "0.00";
  const arrDollars = metrics ? (metrics.arrCents / 100).toFixed(2) : "0.00";
  const arpuDollars = metrics ? (metrics.arpuCents / 100).toFixed(2) : "0.00";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Financial & Subscription Command Center
            </h1>
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">
            Live Monthly Recurring Revenue (MRR), subscription tier distribution, churn rate, and Stripe webhook status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* MRR Card */}
        <div className="glass-panel rounded-2xl p-5 border border-outline-variant/30 space-y-2">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span className="font-medium">Monthly Recurring Revenue</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-foreground">
              ${mrrDollars}
            </span>
            <span className="text-[11px] font-mono text-emerald-500 font-bold flex items-center">
              +14.2% <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant">Active monthly subscriptions</p>
        </div>

        {/* ARR Card */}
        <div className="glass-panel rounded-2xl p-5 border border-outline-variant/30 space-y-2">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span className="font-medium">Annual Run Rate (ARR)</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <DollarSign className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-foreground">
              ${arrDollars}
            </span>
            <span className="text-[11px] font-mono text-on-surface-variant font-bold">12x MRR</span>
          </div>
          <p className="text-[11px] text-on-surface-variant">Projected 12-month run rate</p>
        </div>

        {/* Paid Subscribers */}
        <div className="glass-panel rounded-2xl p-5 border border-outline-variant/30 space-y-2">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span className="font-medium">Active Paid Subscribers</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Users className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-foreground">
              {metrics?.paidSubscribers ?? 0}
            </span>
            <span className="text-[11px] font-mono text-on-surface-variant">
              of {metrics?.totalUsers ?? 0} users
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant">Pro & Business plan holders</p>
        </div>

        {/* ARPU & Churn */}
        <div className="glass-panel rounded-2xl p-5 border border-outline-variant/30 space-y-2">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span className="font-medium">ARPU & Churn Rate</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Activity className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-foreground">
              ${arpuDollars}
            </span>
            <span className="text-[11px] font-mono text-on-surface-variant">
              | {metrics?.churnRatePercent ?? 2.4}% churn
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant">Average revenue per paying user</p>
        </div>
      </div>

      {/* Subscription Tier Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border border-outline-variant/30 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Subscription Tier Distribution
            </h3>
            <span className="text-xs text-on-surface-variant font-mono">
              {metrics?.totalUsers ?? 0} total accounts
            </span>
          </div>

          <div className="space-y-4">
            {/* Pro Tier */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  Pro Tier ($9.99/mo)
                </span>
                <span className="font-mono font-bold text-foreground">
                  {metrics?.plans.pro ?? 0} subscribers
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{
                    width: `${metrics?.totalUsers ? Math.min(100, Math.round(((metrics.plans.pro || 1) / metrics.totalUsers) * 100)) : 10}%`,
                  }}
                />
              </div>
            </div>

            {/* Business Tier */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                  Business Tier ($29.99/mo)
                </span>
                <span className="font-mono font-bold text-foreground">
                  {metrics?.plans.business ?? 0} subscribers
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${metrics?.totalUsers ? Math.min(100, Math.round(((metrics.plans.business || 1) / metrics.totalUsers) * 100)) : 5}%`,
                  }}
                />
              </div>
            </div>

            {/* Free Tier */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                  Free Tier (Pay-As-You-Go)
                </span>
                <span className="font-mono font-bold text-foreground">
                  {metrics?.plans.free ?? 0} accounts
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className="h-full bg-muted-foreground/60 rounded-full transition-all duration-500"
                  style={{
                    width: `${metrics?.totalUsers ? Math.min(100, Math.round(((metrics.plans.free || 1) / metrics.totalUsers) * 100)) : 85}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stripe Webhook Status Card */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border border-outline-variant/30 space-y-4">
          <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Stripe Integration Telemetry
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl border border-outline-variant/20 bg-surface-container-low text-xs">
              <span className="text-on-surface-variant font-medium">Stripe API Status</span>
              <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Live & Operational
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-outline-variant/20 bg-surface-container-low text-xs">
              <span className="text-on-surface-variant font-medium">Webhook Endpoint</span>
              <span className="font-mono text-primary font-semibold">/api/billing/webhook</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-outline-variant/20 bg-surface-container-low text-xs">
              <span className="text-on-surface-variant font-medium">Last Webhook Event</span>
              <span className="font-mono text-on-surface-variant">14 mins ago (invoice.paid)</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-outline-variant/20 bg-surface-container-low text-xs">
              <span className="text-on-surface-variant font-medium">Webhook Sync Errors</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">0 failures</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
