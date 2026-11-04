"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  HelpCircle,
  LifeBuoy,
  MessageSquare,
  RefreshCw,
  Send,
  User,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { listAdminTickets, replyAdminTicket, updateAdminTicket } from "@/lib/admin";
import type { SupportTicket } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_BADGES: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  in_progress: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  resolved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};

const PRIORITY_BADGES: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-outline-variant/30",
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeStatus, setActiveStatus] = React.useState<string>("all");
  const [selectedTicket, setSelectedTicket] = React.useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdminTickets();
      setTickets(data);
      if (selectedTicket) {
        const refreshed = data.find((t) => t.id === selectedTicket.id);
        if (refreshed) setSelectedTicket(refreshed);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, [selectedTicket]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filteredTickets = React.useMemo(() => {
    if (activeStatus === "all") return tickets;
    return tickets.filter((t) => t.status === activeStatus);
  }, [tickets, activeStatus]);

  const handleReply = async (newStatus?: "open" | "in_progress" | "resolved") => {
    if (!selectedTicket || !replyMessage.trim()) return;
    setIsSending(true);
    try {
      const updated = await replyAdminTicket(selectedTicket.id, replyMessage, newStatus);
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setReplyMessage("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to send reply.");
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (id: string, status: "open" | "in_progress" | "resolved") => {
    try {
      const updated = await updateAdminTicket(id, { status });
      setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
      if (selectedTicket?.id === id) setSelectedTicket(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LifeBuoy className="h-4 w-4" />
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Customer Support & Bug Reporter Desk
            </h1>
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">
            Manage user issue reports, job debugging tickets, and respond directly to customer inquiries.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh Inbox
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant/20 pb-3">
        {["all", "open", "in_progress", "resolved"].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setActiveStatus(st)}
            className={cn(
              "rounded-full px-3.5 py-1 text-xs font-semibold capitalize transition-colors",
              activeStatus === st
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-surface-container hover:bg-surface-container-high text-foreground",
            )}
          >
            {st.replace("_", " ")} ({st === "all" ? tickets.length : tickets.filter((t) => t.status === st).length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Ticket List */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
          {filteredTickets.length === 0 ? (
            <div className="glass-panel p-8 text-center rounded-2xl border border-outline-variant/30 text-xs text-on-surface-variant">
              No tickets found in this tab.
            </div>
          ) : (
            filteredTickets.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTicket(t)}
                className={cn(
                  "cursor-pointer rounded-2xl p-4 border transition-all text-left space-y-2",
                  selectedTicket?.id === t.id
                    ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/30"
                    : "border-outline-variant/25 bg-surface-container-low hover:bg-surface-container-high/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-primary">{t.id}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-[9px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border", PRIORITY_BADGES[t.priority])}>
                      {t.priority}
                    </span>
                    <span className={cn("text-[9px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border", STATUS_BADGES[t.status])}>
                      {t.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                <h4 className="font-display text-xs font-bold text-foreground line-clamp-1">{t.subject}</h4>
                <p className="text-[11px] text-on-surface-variant line-clamp-2">{t.message}</p>

                <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant/80 pt-1 border-t border-outline-variant/15">
                  <span className="truncate max-w-[150px]">{t.userEmail}</span>
                  <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Ticket Conversation Thread */}
        <div className="lg:col-span-7">
          {selectedTicket ? (
            <div className="glass-panel p-6 rounded-2xl border border-outline-variant/30 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/20 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">{selectedTicket.id}</span>
                    <span className={cn("text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border", STATUS_BADGES[selectedTicket.status])}>
                      {selectedTicket.status.replace("_", " ")}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-foreground mt-1">
                    {selectedTicket.subject}
                  </h3>
                  <p className="text-xs font-mono text-on-surface-variant">From: {selectedTicket.userEmail}</p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value as any)}
                    className="rounded-xl border border-outline-variant/30 bg-surface-container px-2.5 py-1 text-xs font-semibold text-foreground focus:outline-none"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              {/* Job Metadata Attachment */}
              {selectedTicket.jobId && (
                <div className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs font-mono flex items-center justify-between">
                  <span className="text-on-surface-variant">Attached Job Reference:</span>
                  <span className="text-primary font-bold">{selectedTicket.jobId}</span>
                </div>
              )}

              {/* Message Thread */}
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {/* Initial user message */}
                <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <User className="h-3 w-3 text-primary" />
                      {selectedTicket.userEmail}
                    </span>
                    <span>{new Date(selectedTicket.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{selectedTicket.message}</p>
                </div>

                {/* Responses */}
                {selectedTicket.responses.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      "rounded-xl p-3.5 space-y-1 text-xs leading-relaxed",
                      r.author === "admin"
                        ? "border border-primary/30 bg-primary/10 ml-6"
                        : "border border-outline-variant/20 bg-surface-container-low mr-6",
                    )}
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        {r.author === "admin" ? <Zap className="h-3 w-3 text-primary" /> : <User className="h-3 w-3" />}
                        {r.author === "admin" ? "Staff Response" : r.authorEmail}
                      </span>
                      <span>{new Date(r.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap">{r.message}</p>
                  </div>
                ))}
              </div>

              {/* Reply Box */}
              <div className="border-t border-outline-variant/20 pt-4 space-y-3">
                <textarea
                  rows={3}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type official reply to customer..."
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 text-xs text-foreground placeholder:text-on-surface-variant/50 focus:border-primary/60 focus:outline-none"
                />

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSending || !replyMessage.trim()}
                    onClick={() => handleReply("in_progress")}
                    className="text-xs"
                  >
                    Reply & Set In Progress
                  </Button>
                  <Button
                    size="sm"
                    disabled={isSending || !replyMessage.trim()}
                    onClick={() => handleReply("resolved")}
                    className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Reply & Resolve Ticket
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-16 text-center rounded-2xl border border-outline-variant/30 flex flex-col items-center justify-center space-y-2">
              <MessageSquare className="h-10 w-10 text-on-surface-variant opacity-40 mb-2" />
              <h3 className="font-display text-sm font-semibold text-foreground">Select a ticket to inspect</h3>
              <p className="text-xs text-on-surface-variant">View customer inquiries, attached jobs, and send replies.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
