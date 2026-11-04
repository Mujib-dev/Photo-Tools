"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Mail,
  Megaphone,
  RotateCw,
  Scissors,
  ShieldCheck,
  Stethoscope,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DetailRow,
  ErrorState,
  LoadingRows,
  Panel,
  SectionHeader,
} from "@/components/admin/admin-ui";
import { AdminSudoDialog } from "@/components/admin/admin-sudo-dialog";
import {
  adminKeys,
  getAnnouncement,
  getConfig,
  runDigests,
  runDiagnostics,
  runSweep,
  runTempCleanup,
  updateAnnouncement,
} from "@/lib/admin";
import type { DiagnosticResult, SiteAnnouncement } from "@/lib/types";
import { cn } from "@/lib/utils";

function Bool({ value }: { value: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
        value
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-on-surface-variant",
      )}
    >
      {value ? "on" : "off"}
    </span>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Panel className="p-5">
      <SectionHeader title={title} description={description} />
      <dl className="mt-3">{children}</dl>
    </Panel>
  );
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [sudoOpen, setSudoOpen] = React.useState(false);
  const pendingActionRef = React.useRef<(() => void) | null>(null);

  const configQuery = useQuery({ queryKey: adminKeys.config, queryFn: getConfig });
  const config = configQuery.data;

  // Announcement state
  const announcementQuery = useQuery({
    queryKey: adminKeys.announcement,
    queryFn: getAnnouncement,
  });

  const [annActive, setAnnActive] = React.useState(false);
  const [annMessage, setAnnMessage] = React.useState("");
  const [annLink, setAnnLink] = React.useState("");
  const [annTone, setAnnTone] = React.useState<"info" | "warning" | "sale">("info");

  React.useEffect(() => {
    if (announcementQuery.data) {
      setAnnActive(announcementQuery.data.active);
      setAnnMessage(announcementQuery.data.message || "");
      setAnnLink(announcementQuery.data.link || "");
      setAnnTone(announcementQuery.data.tone || "info");
    }
  }, [announcementQuery.data]);

  const announcementMutation = useMutation({
    mutationFn: (patch: Partial<SiteAnnouncement>) => updateAnnouncement(patch),
    onSuccess: (updated) => {
      toast.success(
        updated.active
          ? "Site broadcast announcement published."
          : "Site broadcast announcement disabled.",
      );
      void queryClient.invalidateQueries({ queryKey: adminKeys.announcement });
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes("Password confirmation required")) {
        setSudoOpen(true);
        return;
      }
      toast.error(messageOf(err, "Could not update broadcast banner."));
    },
  });

  // Diagnostics state
  const [diagResults, setDiagResults] = React.useState<DiagnosticResult[] | null>(null);
  const diagnosticsMutation = useMutation({
    mutationFn: runDiagnostics,
    onSuccess: (data) => {
      setDiagResults(data.results);
      toast.success("System diagnostics suite completed.");
    },
    onError: (err) => toast.error(messageOf(err, "Diagnostics execution failed.")),
  });

  const digestMutation = useMutation({
    mutationFn: () => runDigests(),
    onSuccess: (result) => {
      toast.success(
        `Digests: ${result.sent} sent, ${result.due} due, ${result.skipped} skipped.`,
      );
    },
    onError: (err) => toast.error(messageOf(err, "Could not run the digests.")),
  });

  const sweepMutation = useMutation({
    mutationFn: () => runSweep(),
    onSuccess: (result) => {
      toast.success(`Swept ${result.prunedJobs} expired job(s).`);
    },
    onError: (err) => toast.error(messageOf(err, "Could not run the sweep.")),
  });

  const tempCleanupMutation = useMutation({
    mutationFn: () => runTempCleanup(),
    onSuccess: (res) => {
      toast.success(
        `Temporary storage clean: removed ${res.removedCount} items (${Math.round((res.freedBytes / 1024 / 1024) * 10) / 10} MB freed).`,
      );
    },
    onError: (err) => toast.error(messageOf(err, "Could not clean temporary storage.")),
  });

  const handleSudoSuccess = () => {
    setSudoOpen(false);
    if (pendingActionRef.current) {
      pendingActionRef.current();
      pendingActionRef.current = null;
    }
  };

  const saveAnnouncementWithSudo = () => {
    const action = () => {
      announcementMutation.mutate({
        active: annActive,
        message: annMessage.trim(),
        link: annLink.trim() || null,
        tone: annTone,
      });
    };
    pendingActionRef.current = action;
    action();
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Configuration & Controls"
        description="Broadcast alerts, execute deep system diagnostics, and review running runtime configuration."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => void configQuery.refetch()}
            disabled={configQuery.isFetching}
          >
            <RotateCw className={configQuery.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </Button>
        }
      />

      {/* Broadcast Announcement Banner Manager */}
      <Panel className="p-5 border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Megaphone className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-[16px] font-bold">Public Announcement Broadcast Banner</h3>
              <p className="text-xs text-on-surface-variant">
                Display a site-wide notification bar at the very top of all customer-facing pages.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={annActive}
                onChange={(e) => setAnnActive(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              Banner Active
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px_140px_auto]">
          <div className="space-y-1">
            <Label className="text-xs">Banner Message Text</Label>
            <Input
              type="text"
              placeholder="e.g. Scheduled database maintenance tonight at 02:00 UTC."
              value={annMessage}
              onChange={(e) => setAnnMessage(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Target Link URL (optional)</Label>
            <Input
              type="text"
              placeholder="/pricing or https://..."
              value={annLink}
              onChange={(e) => setAnnLink(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Visual Tone</Label>
            <Select
              value={annTone}
              onValueChange={(val) => setAnnTone(val as "info" | "warning" | "sale")}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info (Blue)</SelectItem>
                <SelectItem value="warning">Warning (Amber)</SelectItem>
                <SelectItem value="sale">Promotion / Sale (Emerald)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            className="sm:mt-5 h-9 rounded-xl text-xs"
            onClick={saveAnnouncementWithSudo}
            disabled={announcementMutation.isPending}
          >
            {announcementMutation.isPending ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : null}
            Save Banner
          </Button>
        </div>
      </Panel>

      {/* Diagnostics Health Suite */}
      <Panel className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Stethoscope className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-[16px] font-bold">System Diagnostics & Health Suite</h3>
              <p className="text-xs text-on-surface-variant">
                Actively probe database latency, temp disk I/O, native binaries, and email server connectivity.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-xs"
            onClick={() => diagnosticsMutation.mutate()}
            disabled={diagnosticsMutation.isPending}
          >
            {diagnosticsMutation.isPending ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Stethoscope className="h-3.5 w-3.5" />
            )}
            Run Diagnostics Now
          </Button>
        </div>

        {diagResults && (
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {diagResults.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-outline-variant/15 bg-surface-container-high/30 p-3.5"
              >
                <div className="flex items-start gap-2.5">
                  {r.status === "healthy" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : r.status === "warning" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div>
                    <p className="font-semibold text-xs text-foreground">{r.name}</p>
                    <p className="mt-0.5 text-[11px] text-on-surface-variant">{r.detail}</p>
                  </div>
                </div>
                {r.latencyMs > 0 && (
                  <span className="shrink-0 font-mono text-[10px] text-on-surface-variant">
                    {r.latencyMs} ms
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Maintenance Actions */}
      <Panel className="p-5">
        <SectionHeader
          title="Maintenance Triggers"
          description="Execute scheduled background sweeps, prune stale files, and send weekly usage digests on demand."
        />
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => digestMutation.mutate()}
            disabled={digestMutation.isPending}
          >
            {digestMutation.isPending ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mail className="h-3.5 w-3.5" />
            )}
            Run weekly digest
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => sweepMutation.mutate()}
            disabled={sweepMutation.isPending}
          >
            {sweepMutation.isPending ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Scissors className="h-3.5 w-3.5" />
            )}
            Sweep expired jobs
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl text-destructive hover:bg-destructive/10"
            onClick={() => {
              pendingActionRef.current = () => tempCleanupMutation.mutate();
              tempCleanupMutation.mutate();
            }}
            disabled={tempCleanupMutation.isPending}
          >
            {tempCleanupMutation.isPending ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Clean stale temp disk files
          </Button>
        </div>
      </Panel>

      {configQuery.error && !config ? (
        <Panel>
          <ErrorState
            message={messageOf(configQuery.error, "Could not load the configuration.")}
            onRetry={() => void configQuery.refetch()}
          />
        </Panel>
      ) : configQuery.isLoading && !config ? (
        <Panel>
          <LoadingRows rows={8} cols={2} />
        </Panel>
      ) : config ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="General" description="Environment and storage locations.">
            <DetailRow label="Environment" value={config.nodeEnv} />
            <DetailRow label="Port" value={config.port} />
            <DetailRow label="Auth enabled" value={<Bool value={config.authEnabled} />} />
            <DetailRow label="Auth store" value={config.authStore} />
            <DetailRow
              label="Temp directory"
              value={<span className="font-mono text-xs">{config.tempDirectory}</span>}
            />
            <DetailRow
              label="Allowed origins"
              value={<span className="font-mono text-xs">{config.allowedOrigins.join(", ") || "—"}</span>}
            />
          </Section>

          <Section title="Rate limits" description="Windows and attempt caps across endpoints.">
            <DetailRow
              label="General rate limit"
              value={`${config.rateLimit.max} req / ${config.rateLimit.windowSeconds}s`}
            />
            <DetailRow
              label="Auth rate limit"
              value={`${config.authRateLimit.maxAttempts} attempts / ${config.authRateLimit.windowSeconds}s`}
            />
          </Section>

          <Section title="Tokens & sessions" description="Lifespans of tokens and session credentials.">
            <DetailRow label="Access token TTL" value={`${config.tokens.accessTtlMinutes} minutes`} />
            <DetailRow label="Refresh token TTL" value={`${config.tokens.refreshTtlDays} days`} />
            <DetailRow label="Legacy session TTL" value={`${config.tokens.legacySessionTtlDays} days`} />
            <DetailRow
              label="Refresh reuse detection"
              value={<Bool value={config.tokens.refreshReuseRevokesFamily} />}
            />
          </Section>

          <Section title="Password policy" description="Strength constraints enforced at sign-up.">
            <DetailRow label="Minimum length" value={config.passwordPolicy.minLength} />
            <DetailRow label="Maximum length" value={config.passwordPolicy.maxLength} />
            <DetailRow label="Complexity required" value={<Bool value={config.passwordPolicy.requireComplexity} />} />
            <DetailRow label="Blocklist check" value={<Bool value={config.passwordPolicy.blocklist} />} />
          </Section>

          <Section title="Security & transport" description="HTTP headers and cross-site protections.">
            <DetailRow label="Security headers" value={<Bool value={config.security.headers} />} />
            <DetailRow label="Content-Security-Policy" value={<Bool value={config.security.contentSecurityPolicy} />} />
            <DetailRow label="HSTS max-age" value={`${config.security.hstsMaxAgeSeconds}s`} />
            <DetailRow label="HTTPS required" value={<Bool value={config.security.requireHttps} />} />
            <DetailRow label="CSRF protection" value={<Bool value={config.security.csrfProtection} />} />
            <DetailRow label="Strict origin mode" value={<Bool value={config.security.strict} />} />
            <DetailRow label="Trust proxy" value={<Bool value={config.security.trustProxy} />} />
          </Section>

          <Section title="Engines & integrations" description="External services and native executables.">
            <DetailRow label="Redis queue" value={<Bool value={config.integrations.redis} />} />
            <DetailRow label="PostgreSQL database" value={<Bool value={config.integrations.postgres} />} />
            <DetailRow label="SMTP email" value={<Bool value={config.integrations.smtp} />} />
            <DetailRow label="FFmpeg binaries" value={<Bool value={config.integrations.ffmpeg} />} />
            <DetailRow label="Shared API keys" value={config.integrations.apiKeys} />
          </Section>
        </div>
      ) : null}

      <AdminSudoDialog
        open={sudoOpen}
        onSuccess={handleSudoSuccess}
        onCancel={() => {
          setSudoOpen(false);
          pendingActionRef.current = null;
        }}
      />
    </div>
  );
}
