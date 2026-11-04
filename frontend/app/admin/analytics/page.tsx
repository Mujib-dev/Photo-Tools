"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BarChart3, RotateCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Panel,
  SectionHeader,
  StatCard,
} from "@/components/admin/admin-ui";
import { adminKeys, getAnalytics } from "@/lib/admin";
import { formatBytes } from "@/lib/format";
import type { AdminJobAnalytics } from "@/lib/types";

const WINDOWS = [7, 30, 90, 365];

const OPERATION_LABELS: Record<string, string> = {
  resize: "Resize",
  convert: "Convert",
  enhance: "Enhance",
  scan: "Scan",
  removebg: "Remove background",
  compress: "Compress",
  watermark: "Watermark",
  pdf: "PDF",
  video: "Video",
  fetch: "URL download",
  audio: "Audio",
};

const OPERATION_COLORS = ["#2563eb", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#ef4444"];

const STATE_COLORS = {
  completed: "#10b981",
  failed: "#ef4444",
  total: "#2563eb",
};

function operationLabel(operation: string): string {
  return OPERATION_LABELS[operation] ?? operation.charAt(0).toUpperCase() + operation.slice(1);
}

function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const minutes = seconds / 60;
  return `${minutes.toFixed(minutes < 10 ? 1 : 0)} min`;
}

function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function chartTooltipStyle() {
  return {
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    fontSize: 12,
  } as const;
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = React.useState(30);

  const analytics = useQuery({
    queryKey: adminKeys.analytics(days),
    queryFn: () => getAnalytics(days),
    placeholderData: keepPreviousData,
  });

  const data = analytics.data;

  const daily = React.useMemo(
    () =>
      (data?.byDay ?? []).map((entry) => ({
        ...entry,
        label: format(new Date(`${entry.date}T00:00:00Z`), "MMM d"),
      })),
    [data],
  );

  const operations = React.useMemo(
    () =>
      (data?.byOperation ?? []).map((entry, index) => ({
        ...entry,
        label: operationLabel(entry.operation),
        fill: OPERATION_COLORS[index % OPERATION_COLORS.length],
      })),
    [data],
  );

  const totalOperationJobs = React.useMemo(
    () => operations.reduce((sum, entry) => sum + entry.total, 0),
    [operations],
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Usage analytics"
        description="How the processing tools are being used over time."
        actions={
          <>
            <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
              <SelectTrigger className="h-9 w-[136px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOWS.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    Last {value} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => void analytics.refetch()}
              disabled={analytics.isFetching}
            >
              <RotateCw className={analytics.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Refresh
            </Button>
          </>
        }
      />

      {analytics.error && !data ? (
        <Panel>
          <ErrorState
            message={analytics.error instanceof Error ? analytics.error.message : "Could not load analytics."}
            onRetry={() => void analytics.refetch()}
          />
        </Panel>
      ) : analytics.isLoading && !data ? (
        <Panel className="p-5">
          <LoadingRows rows={5} cols={3} />
        </Panel>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={`Jobs · ${days}d`}
              value={data.totals.jobs}
              hint={`${data.totals.active} queued or processing`}
            />
            <StatCard
              label="Success rate"
              value={formatPercent(data.totals.successRate)}
              tone="success"
              hint={`${data.totals.completed} completed · ${data.totals.failed} failed`}
            />
            <StatCard
              label="Avg. processing"
              value={formatDuration(data.totals.avgProcessingMs)}
              tone="warning"
              hint="Creation to completion"
            />
            <StatCard
              label="Data out"
              value={formatBytes(data.totals.outputBytes)}
              tone="primary"
              hint={`${formatBytes(data.totals.inputBytes)} in`}
            />
          </div>

          {data.totals.jobs === 0 ? (
            <Panel className="p-5">
              <EmptyState
                title="No activity in this window"
                hint="Pick a longer range, or charts will fill in as files are processed."
              />
            </Panel>
          ) : (
            <>
              <Panel className="p-5">
                <SectionHeader
                  title="Jobs per day"
                  description={`Processing volume over the last ${days} days.`}
                />
                <div className="mt-4 h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={24}
                      />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                      <Tooltip contentStyle={chartTooltipStyle()} />
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="Total"
                        stroke={STATE_COLORS.total}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="completed"
                        name="Completed"
                        stroke={STATE_COLORS.completed}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="failed"
                        name="Failed"
                        stroke={STATE_COLORS.failed}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel className="p-5">
                  <SectionHeader title="Jobs by tool" description="Volume per processing operation." />
                  <div className="mt-4 h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={operations}
                        layout="vertical"
                        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={110}
                        />
                        <Tooltip contentStyle={chartTooltipStyle()} cursor={{ fill: "rgba(148,163,184,0.1)" }} />
                        <Bar dataKey="total" name="Jobs" radius={[0, 6, 6, 0]} maxBarSize={22}>
                          {operations.map((entry) => (
                            <Cell key={entry.operation} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel className="p-5">
                  <SectionHeader title="Top input formats" description="What users upload most often." />
                  <ul className="mt-4 space-y-3">
                    {data.byInputFormat.map((entry) => {
                      const share = data.totals.jobs > 0 ? entry.count / data.totals.jobs : 0;
                      return (
                        <li key={entry.format} className="space-y-1.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-mono text-xs font-semibold uppercase tracking-wider">
                              {entry.format}
                            </span>
                            <span className="text-xs text-on-surface-variant">
                              {entry.count} · {formatPercent(share)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-surface-container-high/60">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(share * 100, 2)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                    {data.byInputFormat.length === 0 && (
                      <li className="text-sm text-on-surface-variant">No uploads in this window.</li>
                    )}
                  </ul>
                </Panel>
              </div>

              <Panel className="p-5">
                <SectionHeader
                  title="Per-tool breakdown"
                  description="Completion and failure counts for each operation."
                />
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/20 text-left font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                        <th className="py-2 pr-3 font-medium">Tool</th>
                        <th className="py-2 pr-3 text-right font-medium">Jobs</th>
                        <th className="py-2 pr-3 text-right font-medium">Completed</th>
                        <th className="py-2 pr-3 text-right font-medium">Failed</th>
                        <th className="py-2 pr-3 text-right font-medium">Success</th>
                        <th className="py-2 text-right font-medium">Data in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operations.map((entry) => {
                        const finished = entry.completed + entry.failed;
                        return (
                          <tr key={entry.operation} className="border-b border-outline-variant/10 last:border-b-0">
                            <td className="py-2.5 pr-3">
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: entry.fill }}
                                />
                                {entry.label}
                              </span>
                            </td>
                            <td className="py-2.5 pr-3 text-right font-medium">{entry.total}</td>
                            <td className="py-2.5 pr-3 text-right text-emerald-600 dark:text-emerald-400">
                              {entry.completed}
                            </td>
                            <td className="py-2.5 pr-3 text-right text-destructive">{entry.failed}</td>
                            <td className="py-2.5 pr-3 text-right">
                              {finished > 0 ? formatPercent(entry.completed / finished) : "—"}
                            </td>
                            <td className="py-2.5 text-right text-on-surface-variant">
                              {formatBytes(entry.inputBytes)}
                            </td>
                          </tr>
                        );
                      })}
                      {operations.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-on-surface-variant">
                            No jobs in this window.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {totalOperationJobs > 0 && (
                      <tfoot>
                        <tr className="border-t border-outline-variant/20 font-medium">
                          <td className="py-2.5 pr-3">All tools</td>
                          <td className="py-2.5 pr-3 text-right">{totalOperationJobs}</td>
                          <td className="py-2.5 pr-3 text-right">{data.totals.completed}</td>
                          <td className="py-2.5 pr-3 text-right">{data.totals.failed}</td>
                          <td className="py-2.5 pr-3 text-right">{formatPercent(data.totals.successRate)}</td>
                          <td className="py-2.5 text-right text-on-surface-variant">
                            {formatBytes(data.totals.inputBytes)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </Panel>
            </>
          )}
        </>
      ) : (
        <Panel className="p-5">
          <EmptyState title="No analytics available" hint="Try refreshing the page." />
        </Panel>
      )}

      <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
        <BarChart3 className="h-3.5 w-3.5" />
        Metrics are computed on demand from the job store over the last {days} days.
      </p>
    </div>
  );
}
