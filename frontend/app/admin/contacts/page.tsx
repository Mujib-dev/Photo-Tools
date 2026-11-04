"use client";

import * as React from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, CheckCircle2, Mail, Phone, Reply, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ConfirmButton,
  EmptyState,
  ErrorState,
  LoadingRows,
  Panel,
  SectionHeader,
  formatDateTime,
  timeAgo,
} from "@/components/admin/admin-ui";
import { adminKeys, deleteContact, listContacts, updateContactStatus } from "@/lib/admin";
import type { AdminContactEntry } from "@/lib/types";

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export default function AdminContactsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = React.useState<"all" | "unread" | "read">("all");

  const contactsQuery = useQuery({
    queryKey: adminKeys.contacts,
    queryFn: () => listContacts(),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; status: "unread" | "read" }) =>
      updateContactStatus(vars.id, vars.status),
    onSuccess: (_data, vars) => {
      queryClient.setQueryData<AdminContactEntry[]>(adminKeys.contacts, (prev) =>
        (prev ?? []).map((c) => (c.id === vars.id ? { ...c, status: vars.status } : c)),
      );
      toast.success(`Message marked as ${vars.status}.`);
    },
    onError: (err) => toast.error(messageOf(err, "Could not update status.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (vars: { id: string }) => deleteContact(vars.id),
    onSuccess: (_data, vars) => {
      queryClient.setQueryData<AdminContactEntry[]>(adminKeys.contacts, (prev) =>
        (prev ?? []).filter((entry) => entry.id !== vars.id),
      );
      toast.success("Contact submission deleted.");
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
    },
    onError: (err) => toast.error(messageOf(err, "Could not delete the submission.")),
  });

  const rawContacts = contactsQuery.data ?? [];
  const contacts = React.useMemo(() => {
    if (filter === "all") return rawContacts;
    return rawContacts.filter((c) => (c.status ?? "unread") === filter);
  }, [rawContacts, filter]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Contact inbox"
        description={
          rawContacts
            ? `${rawContacts.length} submission${rawContacts.length === 1 ? "" : "s"} · newest first`
            : "Messages submitted through the public contact form."
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-outline-variant/30 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-lg px-2.5 py-1 ${
                  filter === "all" ? "bg-primary text-primary-foreground font-semibold" : "text-on-surface-variant hover:text-foreground"
                }`}
              >
                All ({rawContacts.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`rounded-lg px-2.5 py-1 ${
                  filter === "unread" ? "bg-primary text-primary-foreground font-semibold" : "text-on-surface-variant hover:text-foreground"
                }`}
              >
                Unread ({rawContacts.filter((c) => (c.status ?? "unread") === "unread").length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("read")}
                className={`rounded-lg px-2.5 py-1 ${
                  filter === "read" ? "bg-primary text-primary-foreground font-semibold" : "text-on-surface-variant hover:text-foreground"
                }`}
              >
                Read ({rawContacts.filter((c) => c.status === "read").length})
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => void contactsQuery.refetch()}
              disabled={contactsQuery.isFetching}
            >
              <RotateCw className={contactsQuery.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Refresh
            </Button>
          </div>
        }
      />

      {contactsQuery.error && !rawContacts ? (
        <Panel>
          <ErrorState
            message={messageOf(contactsQuery.error, "Could not load contact submissions.")}
            onRetry={() => void contactsQuery.refetch()}
          />
        </Panel>
      ) : contactsQuery.isLoading && rawContacts.length === 0 ? (
        <Panel>
          <LoadingRows rows={5} cols={3} />
        </Panel>
      ) : contacts.length === 0 ? (
        <Panel>
          <EmptyState
            title={filter === "all" ? "Inbox is empty" : `No ${filter} messages`}
            hint="Messages sent from the contact page will show up here."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {contacts.map((entry) => {
            const isUnread = (entry.status ?? "unread") === "unread";
            return (
              <Panel
                key={entry.id}
                className={`flex flex-col p-5 transition-colors ${
                  isUnread ? "border-primary/40 bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-[15px] font-semibold leading-snug">
                        {entry.subject || "(no subject)"}
                      </h3>
                      {isUnread && (
                        <span className="rounded-full bg-primary/20 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-on-surface-variant" title={formatDateTime(entry.at)}>
                      {timeAgo(entry.at)} · {formatDateTime(entry.at)}
                    </p>
                  </div>
                  <ConfirmButton
                    label="Delete"
                    confirmLabel="Delete?"
                    onConfirm={() => deleteMutation.mutateAsync({ id: entry.id })}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-on-surface-variant">
                  <span className="font-medium text-foreground">{entry.name}</span>
                  <a
                    href={`mailto:${entry.email}?subject=${encodeURIComponent(`Re: ${entry.subject}`)}`}
                    className="inline-flex items-center gap-1.5 hover:text-primary"
                  >
                    <AtSign className="h-3.5 w-3.5" />
                    {entry.email}
                  </a>
                  {entry.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {entry.phone}
                    </span>
                  )}
                </div>

                <p className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-outline-variant/15 bg-surface-container-high/30 px-3.5 py-3 text-sm text-foreground/90">
                  {entry.message}
                </p>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-outline-variant/15 pt-3">
                  <Button asChild variant="outline" size="sm" className="rounded-lg text-xs">
                    <a href={`mailto:${entry.email}?subject=${encodeURIComponent(`Re: ${entry.subject}`)}`}>
                      <Reply className="h-3.5 w-3.5" />
                      Reply via Email
                    </a>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-lg text-xs"
                    onClick={() =>
                      statusMutation.mutate({
                        id: entry.id,
                        status: isUnread ? "read" : "unread",
                      })
                    }
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isUnread ? "Mark as Read" : "Mark as Unread"}
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
