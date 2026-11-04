"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, RotateCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Panel,
  SectionHeader,
  formatDateTime,
  timeAgo,
} from "@/components/admin/admin-ui";
import { adminKeys, listAudit } from "@/lib/admin";
import type { AdminAuditEntry } from "@/lib/types";

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export default function AdminAuditPage() {
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);

  const auditQuery = useQuery({
    queryKey: adminKeys.audit,
    queryFn: () => listAudit(),
  });

  const entries = auditQuery.data;

  const filtered = React.useMemo(() => {
    if (!entries) return null;
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) =>
      [entry.actorEmail, entry.action, entry.target, entry.detail, entry.ip]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle)),
    );
  }, [entries, deferredQuery]);

  const exportCsv = React.useCallback(() => {
    if (!filtered || filtered.length === 0) return;
    const headers = ["Timestamp", "ISO Date", "Actor Email", "Action", "Target", "Detail", "IP Address"];
    const rows = filtered.map((e) => [
      e.at,
      new Date(e.at).toISOString(),
      `"${(e.actorEmail || "").replace(/"/g, '""')}"`,
      `"${(e.action || "").replace(/"/g, '""')}"`,
      `"${(e.target || "").replace(/"/g, '""')}"`,
      `"${(e.detail || "").replace(/"/g, '""')}"`,
      `"${(e.ip || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Audit log"
        description="Every administrative action is recorded here. Entries are kept in memory (last 1,000)."
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter entries…"
                className="h-9 w-48 pl-8 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={exportCsv}
              disabled={!filtered || filtered.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => void auditQuery.refetch()}
              disabled={auditQuery.isFetching}
            >
              <RotateCw className={auditQuery.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Refresh
            </Button>
          </>
        }
      />

      <Panel className="overflow-hidden">
        {auditQuery.error && !entries ? (
          <ErrorState
            message={messageOf(auditQuery.error, "Could not load the audit log.")}
            onRetry={() => void auditQuery.refetch()}
          />
        ) : auditQuery.isLoading && !entries ? (
          <LoadingRows rows={8} cols={5} />
        ) : !filtered || filtered.length === 0 ? (
          <EmptyState
            title={query ? "No matching entries" : "No audit entries yet"}
            hint={query ? "Try a different search term." : "Admin actions will appear here as they happen."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-outline-variant/20 text-left font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Detail</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry: AdminAuditEntry) => (
                  <tr key={entry.id} className="border-b border-outline-variant/10 align-top last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="text-foreground">{formatDateTime(entry.at)}</p>
                      <p className="text-xs text-on-surface-variant">{timeAgo(entry.at)}</p>
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <p className="truncate text-foreground" title={entry.actorEmail}>
                        {entry.actorEmail}
                      </p>
                      <p className="font-mono text-[10px] text-on-surface-variant">
                        {entry.actorId.slice(0, 8)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                        {entry.action}
                      </span>
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <span
                        className="block truncate font-mono text-xs text-on-surface-variant"
                        title={entry.target ?? ""}
                      >
                        {entry.target ?? "—"}
                      </span>
                    </td>
                    <td className="max-w-[280px] px-4 py-3">
                      <span
                        className="block truncate text-xs text-on-surface-variant"
                        title={entry.detail ?? ""}
                      >
                        {entry.detail ?? "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-on-surface-variant">
                      {entry.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
