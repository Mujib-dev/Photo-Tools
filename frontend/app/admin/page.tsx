"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertCircle, ArrowRight, HardDrive, RotateCw, ShieldCheck, Trash2, Wrench } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Button } from "@/components/ui/button";
import {
  DetailRow,
  EmptyState,
  ErrorState,
  LoadingRows,
  Panel,
  SectionHeader,
  StatCard,
  formatUptime,
} from "@/components/admin/admin-ui";
import { adminKeys, getOverview, runSweep, runTempCleanup } from "@/lib/admin";
import type { JobState } from "@/lib/types";

const JOB_COLORS: Record<JobState, string> = {
  queued: "#94a3b8",
  processing: "#2563eb",
  completed: "#10b981",
  failed: "#ef4444",
};

const JOB_ORDER: JobState[] = ["queued", "processing", "completed", "failed"];

const QUICK_LINKS = [
  { href: "/admin/revenue", label: "Revenue & MRR", desc: "Monitor Stripe subscriptions, revenue and MRR" },
  { href: "/admin/promos", label: "Promo codes", desc: "Create, distribute and track promotional credit codes" },
  { href: "/admin/users", label: "Manage users", desc: "Create accounts, set roles, adjust credits, reset passwords" },
  { href: "/admin/jobs", label: "Monitor jobs", desc: "Watch live processing queue and clean up failures" },
  { href: "/admin/analytics", label: "Usage analytics", desc: "Inspect tool usage trends, throughput and volume" },
  { href: "/admin/support", label: "Support desk", desc: "View, prioritize and reply to customer support tickets" },
  { href: "/admin/affiliates", label: "Affiliates & payouts", desc: "Track affiliate referrals and approve commission payouts" },
  { href: "/admin/contacts", label: "Contact inbox", desc: "Read, filter and reply to contact form submissions" },
  { href: "/admin/audit", label: "Audit trail", desc: "Review every administrative action and security log" },
  { href: "/admin/settings", label: "System settings", desc: "Inspect environment configuration, diagnostics & banners" },
];

export default function AdminOverviewPage() {
  const queryClient = useQueryClient();

  const overview = useQuery({
    queryKey: adminKeys.overview,
    queryFn: getOverview,
  });

  const sweep = useMutation({
    mutationFn: runSweep,
    onSuccess: ({ prunedJobs }) => {
      toast.success(
        prunedJobs > 0
          ? `Maintenance complete — pruned ${prunedJobs} job${prunedJobs === 1 ? "" : "s"}.`
          : "Maintenance complete — nothing needed pruning.",
      );
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Maintenance run failed.");
    },
  });

  const tempCleanup = useMutation({
    mutationFn: runTempCleanup,
    onSuccess: ({ removedCount, freedBytes }) => {
      toast.success(
        removedCount > 0
          ? `Cleaned ${removedCount} stale temporary items. Freed ${Math.round((freedBytes / 1024 / 1024) * 10) / 10} MB.`
          : "Temporary storage clean — no stale files found.",
      );
      void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Temp storage cleanup failed.");
    },
  });

  const data = overview.data;
  const sys = data?.system;

  const chartData = React.useMemo(
    () =>
      data
        ? JOB_ORDER.map((state) => ({
            name: state.charAt(0).toUpperCase() + state.slice(1),
            value: data.jobs[state],
            fill: JOB_COLORS[state],
          }))
        : [],
    [data],
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="System overview"
        description="A live snapshot of users, processing jobs and the running server."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => void overview.refetch()}
              disabled={overview.isFetching}
            >
              <RotateCw className={overview.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Refresh
            </Button>
            <Button
              size="sm"
              className="rounded-lg"
              onClick={() => sweep.mutate()}
              disabled={sweep.isPending}
            >
              {sweep.isPending ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
              Run maintenance
            </Button>
          </>
        }
      />

      {overview.error && !data ? (
        <Panel>
          <ErrorState
            message={overview.error instanceof Error ? overview.error.message : "Could not load the overview."}
            onRetry={() => void overview.refetch()}
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <StatCard label="Users" value={data ? data.users.total : "—"} hint="Registered accounts" />
            <StatCard
              label="Admins"
              value={data ? data.users.admins : "—"}
              tone="primary"
              hint="With console access"
            />
            <StatCard label="Jobs total" value={data ? data.jobs.total : "—"} hint="All-time processing jobs" />
            <StatCard
              label="Completed"
              value={data ? data.jobs.completed : "—"}
              tone="success"
              hint="Finished successfully"
            />
            <StatCard label="Failed" value={data ? data.jobs.failed : "—"} tone="danger" hint="Errored jobs" />
            <StatCard
              label="Active"
              value={data ? data.jobs.queued + data.jobs.processing : "—"}
              tone="warning"
              hint="Queued or processing"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="p-5">
              <SectionHeader title="Job distribution" description="All-time processing outcomes." />
              {overview.isLoading && !data ? (
                <LoadingRows rows={4} cols={2} />
              ) : data && data.jobs.total === 0 ? (
                <EmptyState title="No jobs yet" hint="Charts appear after the first processed file." />
              ) : data ? (
                <div className="mt-2 h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {chartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,0.25)",
                          fontSize: 12,
                        }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
              <Button asChild variant="outline" size="sm" className="mt-3 rounded-lg">
                <Link href="/admin/jobs">
                  <Activity className="h-3.5 w-3.5" />
                  Open job monitor
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </Panel>

            <Panel className="p-5">
              <SectionHeader title="Server" description="Runtime and storage backends." />
              {overview.isLoading && !sys ? (
                <LoadingRows rows={4} cols={2} />
              ) : sys ? (
                <dl className="mt-4">
                  <DetailRow label="Environment" value={sys.nodeEnv} />
                  <DetailRow label="Platform" value={`${sys.platform} · Node ${sys.node}`} />
                  <DetailRow label="CPUs" value={sys.cpus} />
                  <DetailRow label="Server uptime" value={formatUptime(sys.uptimeSec)} />
                  <DetailRow label="Process uptime" value={formatUptime(sys.processUptimeSec)} />
                  <DetailRow label="Memory" value={`${sys.memory.rssMb} MB RSS · ${sys.memory.heapUsedMb} MB heap`} />
                  <DetailRow label="Job store" value={sys.store} />
                  <DetailRow label="Queue" value={sys.queue} />
                  <DetailRow label="Auth store" value={sys.authStore} />
                  <DetailRow label="Max concurrent" value={sys.maxConcurrentJobs} />
                  <DetailRow label="Auth" value={sys.authEnabled ? "Enabled" : "Disabled"} />
                </dl>
              ) : null}
            </Panel>
          </div>

          {/* Storage & Real-time Telemetry Gauge */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <HardDrive className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-display text-[15px] font-semibold">Disk & Storage Telemetry</h3>
                    <p className="text-xs text-on-surface-variant">Live drive space on the media processing host.</p>
                  </div>
                </div>
                {sys?.disk && (
                  <span
                    className={
                      sys.disk.percentUsed > 85
                        ? "rounded-full bg-destructive/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-destructive"
                        : "rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    {sys.disk.percentUsed}% USED
                  </span>
                )}
              </div>

              {sys?.disk ? (
                <div className="mt-4 space-y-3">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={
                        sys.disk.percentUsed > 85
                          ? "h-full bg-destructive transition-all duration-500"
                          : "h-full bg-primary transition-all duration-500"
                      }
                      style={{ width: `${Math.min(100, Math.max(5, sys.disk.percentUsed))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-on-surface-variant">
                    <span>Used: {(sys.disk.usedMb / 1024).toFixed(1)} GB</span>
                    <span>Free: {(sys.disk.freeMb / 1024).toFixed(1)} GB</span>
                    <span>Total: {(sys.disk.totalMb / 1024).toFixed(1)} GB</span>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs text-on-surface-variant">Disk telemetry loading…</p>
              )}
            </Panel>

            <Panel className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Trash2 className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-display text-[15px] font-semibold">Staged Temp Processing Files</h3>
                    <p className="text-xs text-on-surface-variant">Temporary directories for active & finished jobs.</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs"
                  onClick={() => tempCleanup.mutate()}
                  disabled={tempCleanup.isPending}
                >
                  {tempCleanup.isPending ? (
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  )}
                  Clear Stale Files
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-high/20 p-3">
                  <p className="font-mono text-[10px] uppercase text-on-surface-variant">Temp Disk Usage</p>
                  <p className="mt-1 font-display text-[20px] font-bold text-foreground">
                    {sys?.temp ? `${sys.temp.totalMb} MB` : "—"}
                  </p>
                </div>
                <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-high/20 p-3">
                  <p className="font-mono text-[10px] uppercase text-on-surface-variant">Active Files / Dirs</p>
                  <p className="mt-1 font-display text-[20px] font-bold text-foreground">
                    {sys?.temp ? sys.temp.fileCount : "—"}
                  </p>
                </div>
              </div>
            </Panel>
          </div>

          <Panel className="p-5">
            <SectionHeader title="Quick actions" description="Jump straight to a section of the console." />
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-start justify-between gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-high/30 px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="min-w-0">
                    <span className="block font-display text-[14px] font-semibold">{link.label}</span>
                    <span className="mt-0.5 block text-xs text-on-surface-variant">{link.desc}</span>
                  </span>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
