"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Key,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Webhook,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createUserWebhook,
  deleteUserWebhook,
  listUserWebhooks,
  testUserWebhook,
  toggleUserWebhook,
} from "@/lib/user-features";
import type { WebhookDeliveryLog, WebhookEndpoint } from "@/lib/types";
import { cn } from "@/lib/utils";

const AVAILABLE_EVENTS = [
  { id: "job.completed", label: "Job Completed", desc: "Fired when any processing task completes successfully" },
  { id: "job.failed", label: "Job Failed", desc: "Fired if an operation hits an error or timeout" },
  { id: "credits.low", label: "Credits Low", desc: "Fired when account credit balance drops below threshold" },
];

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = React.useState<WebhookEndpoint[]>([]);
  const [logs, setLogs] = React.useState<WebhookDeliveryLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // New endpoint modal state
  const [showModal, setShowModal] = React.useState(false);
  const [newUrl, setNewUrl] = React.useState("");
  const [selectedEvents, setSelectedEvents] = React.useState<string[]>(["job.completed", "job.failed"]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [testResult, setTestResult] = React.useState<WebhookDeliveryLog | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUserWebhooks();
      setEndpoints(data.webhooks);
      setLogs(data.logs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load webhooks.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setIsSubmitting(true);
    try {
      const ep = await createUserWebhook({ url: newUrl, events: selectedEvents });
      setEndpoints((prev) => [ep, ...prev]);
      setShowModal(false);
      setNewUrl("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create webhook.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook destination?")) return;
    try {
      await deleteUserWebhook(id);
      setEndpoints((prev) => prev.filter((e) => e.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete webhook.");
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      const updated = await toggleUserWebhook(id, active);
      setEndpoints((prev) => prev.map((e) => (e.id === id ? updated : e)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update webhook.");
    }
  };

  const handleTest = async (ep: WebhookEndpoint) => {
    setTestingId(ep.id);
    setTestResult(null);
    try {
      const { log } = await testUserWebhook(ep.id);
      setTestResult(log);
      setLogs((prev) => [log, ...prev]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Test ping failed.");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <Webhook className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Developer Webhooks & Integrations
              </h1>
              <p className="text-xs text-on-surface-variant">
                Trigger real-time HTTP payloads to your servers, Zapier, Make.com, or Slack when media finishes processing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add Webhook Endpoint
          </Button>
        </div>
      </div>

      {/* Main Endpoints List */}
      <div className="space-y-6">
        <div className="glass-panel p-5 rounded-2xl border border-outline-variant/30 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-foreground">
              Configured Endpoints ({endpoints.length})
            </h3>
          </div>

          {loading && endpoints.length === 0 ? (
            <div className="py-8 text-center text-xs text-on-surface-variant">Loading webhooks...</div>
          ) : endpoints.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Globe className="h-10 w-10 text-on-surface-variant mx-auto opacity-50" />
              <h4 className="font-display text-sm font-semibold text-foreground">No webhook endpoints registered</h4>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                Add a destination URL to receive instant JSON notifications whenever jobs finish or fail.
              </p>
              <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Register First Endpoint
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {endpoints.map((ep) => (
                <div
                  key={ep.id}
                  className="rounded-xl border border-outline-variant/25 bg-surface-container-low p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", ep.active ? "bg-emerald-500" : "bg-muted-foreground")} />
                      <p className="font-mono text-xs font-bold text-foreground truncate max-w-md">
                        {ep.url}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {ep.events.map((ev) => (
                        <span key={ev} className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-primary">
                          {ev}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-on-surface-variant">
                      <Key className="h-3 w-3" />
                      <span>{ep.secret.slice(0, 10)}••••••••••••</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(ep.secret);
                          alert("Webhook secret copied to clipboard!");
                        }}
                        className="text-primary hover:underline text-[10px]"
                      >
                        Copy Secret
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={testingId === ep.id}
                      onClick={() => handleTest(ep)}
                      className="gap-1.5 text-xs h-8"
                    >
                      <Send className="h-3 w-3" />
                      {testingId === ep.id ? "Pinging..." : "Test Ping"}
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleToggle(ep.id, !ep.active)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors",
                        ep.active
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-surface-container text-on-surface-variant border-outline-variant/40",
                      )}
                    >
                      {ep.active ? "Active" : "Disabled"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(ep.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-destructive/10 text-on-surface-variant hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Test Result Inspector (if just tested) */}
        {testResult && (
          <div className="glass-panel p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-xs font-bold text-foreground flex items-center gap-1.5">
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                Test Ping Response: HTTP {testResult.status} ({testResult.durationMs}ms)
              </h4>
              <button type="button" onClick={() => setTestResult(null)} className="text-xs text-on-surface-variant hover:text-foreground">
                Dismiss
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-black/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
              {testResult.responsePreview || "No response body returned from server."}
            </pre>
          </div>
        )}

        {/* Delivery Logs */}
        <div className="glass-panel p-5 rounded-2xl border border-outline-variant/30 space-y-4">
          <h3 className="font-display text-sm font-bold text-foreground">
            Recent Delivery Logs
          </h3>
          {logs.length === 0 ? (
            <p className="text-xs text-on-surface-variant py-4 text-center">No webhook deliveries recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    {log.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                    <span className="font-mono font-bold text-foreground">{log.event}</span>
                    <span className="text-on-surface-variant truncate max-w-xs">{log.responsePreview || "OK"}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-on-surface-variant shrink-0">
                    <span className={cn("font-bold", log.status >= 200 && log.status < 300 ? "text-emerald-500" : "text-destructive")}>
                      HTTP {log.status}
                    </span>
                    <span>{log.durationMs}ms</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Webhook Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-display text-base font-bold text-foreground">
              Add New Webhook Destination
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Destination Payload URL</label>
              <input
                type="url"
                required
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://api.yourdomain.com/webhooks/pictools"
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-xs text-foreground focus:border-primary/60 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground block">Events to Subscribe</label>
              <div className="space-y-1.5">
                {AVAILABLE_EVENTS.map((ev) => (
                  <label key={ev.id} className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(ev.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedEvents((prev) => [...prev, ev.id]);
                        else setSelectedEvents((prev) => prev.filter((i) => i !== ev.id));
                      }}
                      className="mt-0.5 rounded text-primary accent-primary"
                    />
                    <div>
                      <span className="font-semibold block">{ev.label}</span>
                      <span className="text-[11px] text-on-surface-variant block">{ev.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Webhook"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
