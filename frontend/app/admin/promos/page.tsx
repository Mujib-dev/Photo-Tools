"use client";

import * as React from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Percent, RotateCw, Ticket, TriangleAlert, Zap } from "lucide-react";

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
import {
  adminKeys,
  createPromo,
  deletePromo,
  listPromoRedemptions,
  listPromos,
  updatePromo,
  type AdminPromoRecord,
  type AdminPromoRedemption,
} from "@/lib/admin";
import type { PromoKind } from "@/lib/promo";
import type { UserPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

const KIND_META: Record<PromoKind, { label: string; icon: typeof Ticket; hint: string }> = {
  credits: { label: "Credits", icon: Coins, hint: "Adds credits to the account balance." },
  plan: { label: "Plan", icon: Zap, hint: "Upgrades the plan and grants its monthly allowance." },
  discount: { label: "Discount", icon: Percent, hint: "Percent off the Stripe checkout invoice." },
};

function kindLabel(kind: PromoKind): string {
  return KIND_META[kind]?.label ?? kind;
}

function grantSummary(promo: AdminPromoRecord): string {
  switch (promo.kind) {
    case "credits":
      return `${promo.credits.toLocaleString()} credits`;
    case "plan":
      return `${promo.planDays} days of ${promo.plan ?? "Pro"}`;
    case "discount":
      return `${promo.percentOff}% off`;
    default:
      return "—";
  }
}

/** Builds the ISO date string `<input type="date">` expects. */
function toDateInput(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateInput(value: string): number | null {
  if (!value) return null;
  const ts = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(ts) ? ts : null;
}

interface DraftState {
  code: string;
  description: string;
  kind: PromoKind;
  credits: string;
  plan: UserPlan;
  planDays: string;
  percentOff: string;
  maxRedemptions: string;
  maxPerUser: string;
  expiresAt: string;
}

const EMPTY_DRAFT: DraftState = {
  code: "",
  description: "",
  kind: "credits",
  credits: "500",
  plan: "pro",
  planDays: "30",
  percentOff: "20",
  maxRedemptions: "",
  maxPerUser: "1",
  expiresAt: "",
};

function draftFrom(promo: AdminPromoRecord): DraftState {
  return {
    code: promo.code,
    description: promo.description,
    kind: promo.kind,
    credits: String(promo.credits || 500),
    plan: promo.plan ?? "pro",
    planDays: String(promo.planDays || 30),
    percentOff: String(promo.percentOff || 20),
    maxRedemptions: promo.maxRedemptions == null ? "" : String(promo.maxRedemptions),
    maxPerUser: String(promo.maxPerUser),
    expiresAt: toDateInput(promo.expiresAt),
  };
}

export default function AdminPromosPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState<DraftState>(EMPTY_DRAFT);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [redemptionsFor, setRedemptionsFor] = React.useState<string | null>(null);

  const promosQuery = useQuery({
    queryKey: adminKeys.promos,
    queryFn: () => listPromos(),
  });

  const redemptionsQuery = useQuery({
    queryKey: [...adminKeys.promos, "redemptions", redemptionsFor],
    queryFn: () => listPromoRedemptions(redemptionsFor as string),
    enabled: redemptionsFor != null,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: draft.code.trim().toUpperCase(),
        description: draft.description.trim(),
        kind: draft.kind,
        credits: draft.kind === "credits" ? Number(draft.credits) : 0,
        plan: draft.kind === "plan" ? draft.plan : null,
        planDays: draft.kind === "plan" ? Number(draft.planDays) : 30,
        percentOff: draft.kind === "discount" ? Number(draft.percentOff) : 0,
        maxRedemptions: draft.maxRedemptions === "" ? null : Number(draft.maxRedemptions),
        maxPerUser: Number(draft.maxPerUser || 1),
        expiresAt: fromDateInput(draft.expiresAt),
      };
      if (editingId) {
        await updatePromo(editingId, payload);
        return "updated";
      }
      await createPromo(payload);
      return "created";
    },
    onSuccess: (result) => {
      toast.success(result === "created" ? "Promo code created." : "Promo code updated.");
      setDraft(EMPTY_DRAFT);
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: adminKeys.promos });
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
    },
    onError: (err) => toast.error(messageOf(err, "Could not save the promo code.")),
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      updatePromo(vars.id, { active: vars.active }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.promos });
    },
    onError: (err) => toast.error(messageOf(err, "Could not update the promo code.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (vars: { id: string }) => deletePromo(vars.id),
    onSuccess: () => {
      toast.success("Promo code deleted.");
      setRedemptionsFor(null);
      void queryClient.invalidateQueries({ queryKey: adminKeys.promos });
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
    },
    onError: (err) => toast.error(messageOf(err, "Could not delete the promo code.")),
  });

  const promos = promosQuery.data;
  const editing = editingId ? (promos ?? []).find((p) => p.id === editingId) : undefined;

  const startEdit = (promo: AdminPromoRecord) => {
    setEditingId(promo.id);
    setDraft(draftFrom(promo));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const field = (key: keyof DraftState) => ({
    value: draft[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const inputClass =
    "w-full rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const labelClass = "mb-1 block font-mono text-[10px] uppercase tracking-widest text-on-surface-variant";

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Promo codes"
        description="Credit grants, plan upgrades and checkout discounts. Codes are matched case-insensitively."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => void promosQuery.refetch()}
            disabled={promosQuery.isFetching}
          >
            <RotateCw className={promosQuery.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </Button>
        }
      />

      {/* Create / edit form */}
      <Panel className="p-5">
        <h2 className="font-display text-[15px] font-semibold">
          {editing ? `Edit ${editing.code}` : "Create a promo code"}
        </h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div>
            <label className={labelClass} htmlFor="promo-code">
              Code
            </label>
            <input
              id="promo-code"
              {...field("code")}
              required
              maxLength={32}
              placeholder="LAUNCH500"
              className={`${inputClass} font-mono uppercase`}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="promo-kind">
              Type
            </label>
            <select id="promo-kind" {...field("kind")} className={inputClass}>
              <option value="credits">Credits</option>
              <option value="plan">Plan upgrade</option>
              <option value="discount">Checkout discount</option>
            </select>
            <p className="mt-1 text-xs text-on-surface-variant">
              {KIND_META[draft.kind].hint}
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="promo-desc">
              Description
            </label>
            <input
              id="promo-desc"
              {...field("description")}
              maxLength={200}
              placeholder="Launch campaign"
              className={inputClass}
            />
          </div>

          {draft.kind === "credits" && (
            <div>
              <label className={labelClass} htmlFor="promo-credits">
                Credits
              </label>
              <input
                id="promo-credits"
                {...field("credits")}
                type="number"
                min={1}
                step={1}
                className={inputClass}
              />
            </div>
          )}

          {draft.kind === "plan" && (
            <>
              <div>
                <label className={labelClass} htmlFor="promo-plan">
                  Plan
                </label>
                <select id="promo-plan" {...field("plan")} className={inputClass}>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="promo-plan-days">
                  Days
                </label>
                <input
                  id="promo-plan-days"
                  {...field("planDays")}
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  className={inputClass}
                />
              </div>
            </>
          )}

          {draft.kind === "discount" && (
            <div>
              <label className={labelClass} htmlFor="promo-percent">
                Percent off
              </label>
              <input
                id="promo-percent"
                {...field("percentOff")}
                type="number"
                min={1}
                max={100}
                step={1}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="promo-max">
              Total redemptions
            </label>
            <input
              id="promo-max"
              {...field("maxRedemptions")}
              type="number"
              min={1}
              step={1}
              placeholder="Unlimited"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="promo-per-user">
              Per account
            </label>
            <input
              id="promo-per-user"
              {...field("maxPerUser")}
              type="number"
              min={1}
              max={100}
              step={1}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="promo-expires">
              Expires
            </label>
            <input
              id="promo-expires"
              {...field("expiresAt")}
              type="date"
              className={inputClass}
            />
          </div>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit" size="sm" className="rounded-lg" disabled={saveMutation.isPending}>
              {editing ? "Save changes" : "Create code"}
            </Button>
            {editing && (
              <Button type="button" size="sm" variant="ghost" className="rounded-lg" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Panel>

      {/* List */}
      {promosQuery.error && !promos ? (
        <Panel>
          <ErrorState
            message={messageOf(promosQuery.error, "Could not load promo codes.")}
            onRetry={() => void promosQuery.refetch()}
          />
        </Panel>
      ) : promosQuery.isLoading && !promos ? (
        <Panel>
          <LoadingRows rows={4} cols={5} />
        </Panel>
      ) : !promos || promos.length === 0 ? (
        <Panel>
          <EmptyState title="No promo codes" hint="Create one above to hand out credits or discounts." />
        </Panel>
      ) : (
        <div className="space-y-3">
          {promos.map((promo) => {
            const Icon = KIND_META[promo.kind]?.icon ?? Ticket;
            const expired = promo.expiresAt != null && promo.expiresAt < Date.now();
            const usedUp = promo.maxRedemptions != null && promo.redeemedCount >= promo.maxRedemptions;
            const inactive = !promo.active || expired || usedUp;
            return (
              <Panel key={promo.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold tracking-wide">{promo.code}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                        <Icon className="h-3 w-3" />
                        {kindLabel(promo.kind)}
                      </span>
                      {inactive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-destructive">
                          <TriangleAlert className="h-3 w-3" />
                          {expired ? "Expired" : usedUp ? "Used up" : "Paused"}
                        </span>
                      )}
                    </div>
                    {promo.description && (
                      <p className="mt-1 text-xs text-on-surface-variant">{promo.description}</p>
                    )}
                    <p className="mt-1.5 font-mono text-[11px] text-on-surface-variant">
                      {grantSummary(promo)} · {promo.redeemedCount} redeemed · max{" "}
                      {promo.maxPerUser}/account
                      {promo.expiresAt ? ` · expires ${formatDateTime(promo.expiresAt)}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => startEdit(promo)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() =>
                        toggleMutation.mutate({ id: promo.id, active: !promo.active })
                      }
                      disabled={toggleMutation.isPending}
                    >
                      {promo.active ? "Pause" : "Activate"}
                    </Button>
                    <ConfirmButton
                      label="Delete"
                      confirmLabel="Delete?"
                      onConfirm={() => deleteMutation.mutateAsync({ id: promo.id })}
                    />
                  </div>
                </div>

                {redemptionsFor === promo.id && (
                  <div className="mt-3 border-t border-outline-variant/30 pt-3">
                    {redemptionsQuery.isLoading ? (
                      <LoadingRows rows={3} cols={3} />
                    ) : (redemptionsQuery.data ?? []).length === 0 ? (
                      <p className="text-xs text-on-surface-variant">No redemptions yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {(redemptionsQuery.data ?? []).map((r: AdminPromoRedemption) => (
                          <li
                            key={r.id}
                            className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-on-surface-variant"
                          >
                            <span className="truncate">{r.userId}</span>
                            <span>
                              {r.creditsGranted > 0 ? `+${r.creditsGranted} credits` : "—"} ·{" "}
                              {timeAgo(r.createdAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setRedemptionsFor(redemptionsFor === promo.id ? null : promo.id)}
                  className={cn(
                    "mt-2 font-mono text-[10px] uppercase tracking-widest",
                    redemptionsFor === promo.id ? "text-primary" : "text-on-surface-variant hover:text-primary",
                  )}
                >
                  {redemptionsFor === promo.id ? "Hide redemptions" : "Show redemptions"}
                </button>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
