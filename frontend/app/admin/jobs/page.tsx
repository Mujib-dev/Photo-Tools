"use client";

import * as React from "react";
import { toast } from "sonner";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Pause, Play, RotateCw, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ConfirmButton,
  EmptyState,
  ErrorState,
  JobStateBadge,
  LoadingRows,
  Panel,
  SectionHeader,
  formatDateTime,
  timeAgo,
} from "@/components/admin/admin-ui";
import { adminKeys, deleteJob, listJobs, retryJob } from "@/lib/admin";
import type { AdminJobRecord, JobState } from "@/lib/types";
import { formatBytes } from "@/lib/format";

type JobFilter = JobState | "all";

const STATES: JobFilter[] = ["all", "queued", "processing", "completed", "failed"];

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export default function AdminJobsPage() {
  const queryClient = useQueryClient();
  const [state, setState] = React.useState<JobFilter>("all");
  const [auto, setAuto] = React.useState(true);

  const jobsQuery = useQuery({
    queryKey: adminKeys.jobs(state),
    queryFn: () => listJobs(100, state === "all" ? undefined : state),
    refetchInterval: auto ? 5000 : false,
    placeholderData: keepPreviousData,
  });

  const [inspectJob, setInspectJob] = React.useState<AdminJobRecord | null>(null);

  const retryMutation = useMutation({
    mutationFn: (vars: { id: string }) => retryJob(vars.id),
    onSuccess: (data) => {
      toast.success(`Job ${data.job.id.slice(0, 8)} re-queued for processing.`);
      void queryClient.invalidateQueries({ queryKey: adminKeys.jobsRoot });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
    },
    onError: (err) => toast.error(messageOf(err, "Could not retry job.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (vars: { id: string }) => deleteJob(vars.id),
    onSuccess: (_data, vars) => {
      queryClient.setQueryData<AdminJobRecord[]>(adminKeys.jobs(state), (prev) =>
        (prev ?? []).filter((job) => job.id !== vars.id),
      );
      toast.success("Job and its temporary files were deleted.");
      void queryClient.invalidateQueries({ queryKey: adminKeys.jobsRoot });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
    },
    onError: (err) => toast.error(messageOf(err, "Could not delete the job.")),
  });

  const jobs = jobsQuery.data;
  const activeCount =
    jobs?.filter((job) => job.state === "queued" || job.state === "processing").length ?? 0;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Jobs"
        description={
          jobs
            ? `${jobs.length} job${jobs.length === 1 ? "" : "s"} shown · ${activeCount} active`
            : "Monitor processing jobs across every tool."
        }
        actions={
          <>
            <Select value={state} onValueChange={(value) => setState(value as JobFilter)}>
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === "all" ? "All states" : value.charAt(0).toUpperCase() + value.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              aria-pressed={auto}
              onClick={() => setAuto((value) => !value)}
            >
              {auto ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              Auto-refresh {auto ? "on" : "off"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => void jobsQuery.refetch()}
              disabled={jobsQuery.isFetching}
            >
              <RotateCw className={jobsQuery.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Refresh
            </Button>
          </>
        }
      />

      <Panel className="overflow-hidden">
        {jobsQuery.error && !jobs ? (
          <ErrorState
            message={messageOf(jobsQuery.error, "Could not load jobs.")}
            onRetry={() => void jobsQuery.refetch()}
          />
        ) : jobsQuery.isLoading && !jobs ? (
          <LoadingRows rows={8} cols={5} />
        ) : !jobs || jobs.length === 0 ? (
          <EmptyState
            title={state === "all" ? "No jobs yet" : `No ${state} jobs`}
            hint="Processing jobs appear here as soon as someone uses a tool."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-outline-variant/20 text-left font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Input</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Output</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-outline-variant/10 last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="font-display text-[13px] font-semibold capitalize">{job.operation}</p>
                      <p className="font-mono text-[10px] text-on-surface-variant">{job.id.slice(0, 8)}</p>
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="truncate text-foreground" title={job.inputFilename}>
                        {job.inputFilename}
                      </p>
                      <p className="font-mono text-[10px] text-on-surface-variant">
                        {formatBytes(job.inputSize)} · {job.inputFormat.toUpperCase()}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <JobStateBadge state={job.state} />
                      <p
                        className="mt-1 max-w-[240px] truncate text-[11px] text-on-surface-variant"
                        title={job.error ?? job.stage}
                      >
                        {job.error ?? job.stage}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {job.outputFilename ? (
                        <>
                          <p className="max-w-[200px] truncate text-foreground" title={job.outputFilename}>
                            {job.outputFilename}
                          </p>
                          <p className="font-mono text-[10px] text-on-surface-variant">
                            {job.outputSize != null ? formatBytes(job.outputSize) : "—"}
                            {job.outputFormat ? ` · ${job.outputFormat.toUpperCase()}` : ""}
                          </p>
                        </>
                      ) : (
                        <span className="text-xs text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{formatDateTime(job.createdAt)}</p>
                      <p className="text-xs text-on-surface-variant">
                        {timeAgo(job.createdAt)}
                        {job.processedAt ? ` · done ${timeAgo(job.processedAt)}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-lg px-2 text-xs"
                          onClick={() => setInspectJob(job)}
                          title="Inspect job telemetry & logs"
                        >
                          <Info className="h-3.5 w-3.5" />
                          Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-lg px-2 text-xs"
                          onClick={() => retryMutation.mutate({ id: job.id })}
                          disabled={job.state === "processing" || retryMutation.isPending}
                          title="1-Click Retry this job"
                        >
                          <RotateCw
                            className={
                              retryMutation.isPending && retryMutation.variables?.id === job.id
                                ? "h-3.5 w-3.5 animate-spin"
                                : "h-3.5 w-3.5"
                            }
                          />
                          Retry
                        </Button>
                        <ConfirmButton
                          label="Delete"
                          confirmLabel="Delete?"
                          className="h-7 text-xs"
                          onConfirm={() => deleteMutation.mutateAsync({ id: job.id })}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Expandable Job Inspector Modal */}
      {inspectJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150">
          <div className="glass-panel w-full max-w-lg overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface/95 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <JobStateBadge state={inspectJob.state} />
                <h3 className="font-display text-[16px] font-bold capitalize">
                  {inspectJob.operation} Job
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setInspectJob(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-2.5 font-mono text-xs">
              <div className="rounded-xl border border-outline-variant/15 bg-surface-container-high/20 p-3">
                <p className="text-[10px] uppercase text-on-surface-variant">Job ID</p>
                <p className="mt-0.5 select-all font-bold text-foreground">{inspectJob.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-outline-variant/15 bg-surface-container-high/20 p-2.5">
                  <p className="text-[10px] uppercase text-on-surface-variant">Input File</p>
                  <p className="mt-0.5 truncate text-foreground">{inspectJob.inputFilename}</p>
                  <p className="text-[10px] text-on-surface-variant">
                    {formatBytes(inspectJob.inputSize)} · {inspectJob.inputFormat}
                  </p>
                </div>
                <div className="rounded-xl border border-outline-variant/15 bg-surface-container-high/20 p-2.5">
                  <p className="text-[10px] uppercase text-on-surface-variant">Output Result</p>
                  <p className="mt-0.5 truncate text-foreground">
                    {inspectJob.outputFilename ?? "Not yet generated"}
                  </p>
                  {inspectJob.outputSize && (
                    <p className="text-[10px] text-on-surface-variant">
                      {formatBytes(inspectJob.outputSize)}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-outline-variant/15 bg-surface-container-high/20 p-2.5">
                <p className="text-[10px] uppercase text-on-surface-variant">Stage / Status</p>
                <p className="mt-0.5 text-foreground">{inspectJob.stage}</p>
              </div>

              {inspectJob.error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                  <p className="text-[10px] font-bold uppercase">Error Diagnostics</p>
                  <p className="mt-1 font-sans text-xs leading-relaxed">{inspectJob.error}</p>
                </div>
              )}

              <div className="flex justify-between text-[11px] text-on-surface-variant pt-2">
                <span>Created: {formatDateTime(inspectJob.createdAt)}</span>
                {inspectJob.processedAt && (
                  <span>Finished: {formatDateTime(inspectJob.processedAt)}</span>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-outline-variant/15 pt-4">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setInspectJob(null)}
              >
                Close
              </Button>
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  retryMutation.mutate({ id: inspectJob.id });
                  setInspectJob(null);
                }}
              >
                <RotateCw className="h-3.5 w-3.5" />
                Retry Job Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
