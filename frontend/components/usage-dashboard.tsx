"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Activity,
  CalendarClock,
  Coins,
  RotateCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  EmptyState,
  ErrorState,
  JobStateBadge,
  LoadingRows,
  Panel,
  SectionHeader,
  StatCard,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  USAGE_CATEGORY_COLORS,
  USAGE_WINDOWS,
  fetchUsage,
  operationLabel,
  usageKeys,
  type UsageDayStat,
} from "@/lib/usage";

/** Long windows are bucketed into weeks so the daily chart stays readable. */
const WEEK_BUCKET_THRESHOLD = 90;

/** Tools shown in the "credits by tool" chart. */
const MAX_TOOL_BARS = 8;

function chartTooltipStyle() {
  return {
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    fontSize: 12,
  } as const;
}

function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function formatCredits(value: number): string {
  return value.toLocaleString();
}

/** Chart-ready daily series, bucketed by week for long windows. */
interface DayPoint {
  label: string;
  credits: number;
  jobs: number;
}

function dayLabel(date: string): string {
  return format(new Date(`${date}T00:00:00Z`), "MMM d");
}

function toDayPoints(days: UsageDayStat[], windowDays: number): DayPoint[] {
  if (windowDays <= WEEK_BUCKET_THRESHOLD) {
    return days.map((entry) => ({
      label: dayLabel(entry.date),
      credits: entry.credits,
      jobs: entry.jobs,
    }));
  }

  const buckets: DayPoint[] = [];
  let current: DayPoint | null = null;
  for (const entry of days) {
    if (!current) {
      current = { label: dayLabel(entry.date), credits: 0, jobs: 0 };
      buckets.push(current);
    }
    current.credits += entry.credits;
    current.jobs += entry.jobs;
  }
  return buckets;
}

function formatTimestamp(ms: number): string {
  return format(new Date(ms), "MMM dd, yyyy · HH:mm");
}

/**
 * Profile section: the account's credit consumption over time, broken down by
 * tool and day, with the job-by-job history behind the numbers.
 */
export function UsageDashboard() {
  const [days, setDays] = React.useState<number>(30);

  const query = useQuery({
    queryKey: usageKeys.usage(days),
    queryFn: () => fetchUsage(days),
    placeholderData: keepPreviousData,
  });

  const data = query.data;

  const daily = React.useMemo(
    () => (data ? toDayPoints(data.byDay, data.windowDays) : []),
    [data],
  );

  const tools = React.useMemo(
    () =>
      (data?.byOperation ?? [])
        .filter((entry) => entry.credits > 0 || entry.jobs > 0)
        .slice(0, MAX_TOOL_BARS)
        .map((entry) => ({
          ...entry,
          label: operationLabel(entry.operation),
          fill: USAGE_CATEGORY_COLORS[entry.category] ?? "#2563eb",
        })),
    [data],
  );

  const categories = React.useMemo(
    () => (data?.byCategory ?? []).filter((entry) => entry.jobs > 0),
    [data],
  );

  if (query.error && !data) {
    return (
      <Panel>
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Could not load your usage."}
          onRetry={() => void query.refetch()}
        />
      </Panel>
    );
  }

  if (query.isLoading && !data) {
    return (
      <Panel className="p-5">
        <LoadingRows rows={6} cols={4} />
      </Panel>
    );
  }

  if (!data) return null;

  const { totals, credits, month } = data;
  const monthDelta = month.creditsUsed - month.previous.creditsUsed;
  const allowanceUsed =
    credits.monthlyAllowance > 0 ? totals.creditsCharged / credits.monthlyAllowance : 0;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
          <SelectTrigger className="h-9 w-[148px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USAGE_WINDOWS.map((value) => (
              <SelectItem key={value} value={String(value)}>
                Last {value} days
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RotateCw className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Headline: this month's consumption */}
      <div className="rounded-2xl border border-primary/30 bg-primary-container/10 p-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
          {month.label}
        </p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-3xl font-bold tracking-[-0.02em] text-foreground">
            You&apos;ve used {formatCredits(month.creditsUsed)} credits
          </span>
          <span className="text-sm text-on-surface-variant">
            across {month.jobs.toLocaleString()} job{month.jobs === 1 ? "" : "s"} this month
          </span>
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-on-surface-variant">
          {monthDelta > 0 ? (
            <TrendingUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          ) : monthDelta < 0 ? (
            <TrendingDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : null}
          {monthDelta === 0
            ? `Same as ${month.previous.label}.`
            : `${monthDelta > 0 ? "+" : ""}${monthDelta.toLocaleString()} credits vs ${month.previous.label}.`}
        </p>
      </div>

      {/* Key figures */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={`Credits · ${data.windowDays}d`}
          value={formatCredits(totals.creditsUsed)}
          tone="primary"
          hint={`${formatCredits(totals.creditsCharged)} charged · ${formatCredits(totals.creditsRefunded)} refunded`}
        />
        <StatCard
          label="Credits left"
          value={formatCredits(credits.remaining)}
          hint={
            credits.nextGrantAt != null
              ? `+${formatCredits(data.plan.monthlyCredits)} on ${format(new Date(credits.nextGrantAt), "MMM d")}`
              : undefined
          }
        />
        <StatCard
          label="Jobs"
          value={totals.jobs.toLocaleString()}
          hint={`${totals.completed} completed · ${totals.failed} failed`}
        />
        <StatCard
          label="Success rate"
          value={totals.jobs > 0 ? formatPercent(totals.successRate) : "—"}
          tone="success"
          hint={`${totals.avgCreditsPerJob} credits per completed job`}
        />
      </div>

      {/* Plan allowance */}
      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-high/40 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-2 font-display text-sm font-semibold">
            <Coins className="h-4 w-4 text-primary" />
            {data.plan.label} plan
          </p>
          <p className="font-mono text-xs text-on-surface-variant">
            {formatCredits(totals.creditsCharged)} of {formatCredits(credits.monthlyAllowance)} credits
            this month
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container-high/60">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.min(Math.max(allowanceUsed * 100, 1), 100)}%` }}
          />
        </div>
        {credits.nextGrantAt != null && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-on-surface-variant">
            <CalendarClock className="h-3.5 w-3.5" />
            Your allowance refreshes on {format(new Date(credits.nextGrantAt), "MMMM d, yyyy")}.
          </p>
        )}
      </div>

      {totals.jobs === 0 ? (
        <Panel className="p-5">
          <EmptyState
            title="No usage in this window"
            hint="Process a file and your credit consumption will appear here."
          />
        </Panel>
      ) : (
        <>
          {/* Credits per day */}
          <Panel className="p-5">
            <SectionHeader
              title="Credits per day"
              description={
                data.windowDays > WEEK_BUCKET_THRESHOLD
                  ? `Weekly totals over the last ${data.windowDays} days.`
                  : `Credits spent each day over the last ${data.windowDays} days.`
              }
            />
            <div className="mt-4 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={36}
                  />
                  <Tooltip contentStyle={chartTooltipStyle()} />
                  <Bar dataKey="credits" name="Credits" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  <Line
                    type="monotone"
                    dataKey="jobs"
                    name="Jobs"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Credits by tool */}
            <Panel className="p-5">
              <SectionHeader title="Credits by tool" description="Where your credits went." />
              <div className="mt-4 h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={tools}
                    layout="vertical"
                    margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle()}
                      cursor={{ fill: "rgba(148,163,184,0.1)" }}
                    />
                    <Bar dataKey="credits" name="Credits" radius={[0, 6, 6, 0]} maxBarSize={22}>
                      {tools.map((entry) => (
                        <Cell key={entry.operation} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            {/* Category breakdown */}
            <Panel className="p-5">
              <SectionHeader title="By category" description="Credit consumption per tool family." />
              <ul className="mt-4 space-y-3">
                {categories.map((entry) => {
                  const share = totals.creditsUsed > 0 ? entry.credits / totals.creditsUsed : 0;
                  return (
                    <li key={entry.category} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium">{entry.label}</span>
                        <span className="text-xs text-on-surface-variant">
                          {formatCredits(entry.credits)} credits · {entry.jobs} job
                          {entry.jobs === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-container-high/60">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${Math.max(share * 100, 1)}%`,
                            backgroundColor: USAGE_CATEGORY_COLORS[entry.category],
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
                {categories.length === 0 && (
                  <li className="text-sm text-on-surface-variant">No usage in this window.</li>
                )}
              </ul>
            </Panel>
          </div>

          {/* Job history */}
          <Panel className="p-5">
            <SectionHeader
              title="Recent activity"
              description="Every job in this window and what it cost."
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-left font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Tool</th>
                    <th className="py-2 pr-3 font-medium">File</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 text-right font-medium">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentJobs.map((job) => (
                    <tr key={job.id} className="border-b border-outline-variant/10 last:border-b-0">
                      <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-xs text-on-surface-variant">
                        {formatTimestamp(job.createdAt)}
                      </td>
                      <td className="py-2.5 pr-3 font-medium">{operationLabel(job.operation)}</td>
                      <td className="max-w-[220px] truncate py-2.5 pr-3 text-xs text-on-surface-variant">
                        {job.inputFilename}
                        <span className="ml-1.5 font-mono">
                          {formatBytes(job.inputSize)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <JobStateBadge state={job.state} />
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right">
                        {job.refunded ? (
                          <span className="font-mono text-xs text-on-surface-variant">
                            refunded
                          </span>
                        ) : (
                          <span className="font-mono text-xs font-semibold">
                            {formatCredits(job.creditsCharged)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.recentJobs.length === 0 && (
                <p className="py-6 text-center text-sm text-on-surface-variant">
                  No jobs in this window.
                </p>
              )}
            </div>
          </Panel>
        </>
      )}

      <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
        <Activity className="h-3.5 w-3.5" />
        Failed jobs are refunded in full, so they never consume credits.
      </p>
    </div>
  );
}
