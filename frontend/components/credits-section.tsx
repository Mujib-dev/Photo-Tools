"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowUpRight, CalendarClock, Check, Coins, Copy, CreditCard, Gift, Loader2, RefreshCw, Tag, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { fetchCredits, type CreditsState, type CreditsSubscription } from "@/lib/credits";
import { isTransientError } from "@/lib/auth";
import { createPortalSession, getBillingConfig, verifyCheckout } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { PromoRedeem } from "@/components/promo-redeem";
import { cn } from "@/lib/utils";

const OPERATION_LABELS: Record<string, string> = {
  resize: "Resize",
  convert: "Convert",
  compress: "Compress",
  enhance: "AI enhance",
  removebg: "Background removal",
  watermark: "Watermark",
  scan: "Scan",
  ocr: "OCR",
  audio: "Audio",
  tts: "Text to speech",
  stt: "Speech to text",
  video: "Video",
  pdf: "PDF",
  fetch: "URL download",
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Human status line for an active (or ending) subscription. */
function subscriptionNote(
  sub: CreditsSubscription,
): { text: string; tone: "neutral" | "warn" | "danger" } {
  if (sub.status === "past_due") {
    return { text: "Payment failed — update your card", tone: "danger" };
  }
  if (sub.cancelAtPeriodEnd) {
    return {
      text: sub.renewsAt != null ? `Cancels on ${formatDate(sub.renewsAt)}` : "Cancels at period end",
      tone: "warn",
    };
  }
  if (sub.status === "active" || sub.status === "trialing") {
    return {
      text: sub.renewsAt != null ? `Renews ${formatDate(sub.renewsAt)}` : "Subscription active",
      tone: "neutral",
    };
  }
  return { text: `Subscription ${sub.status ?? "unknown"}`, tone: "warn" };
}

/**
 * Profile section: credit balance, plan, 7-day usage and the referral link.
 */
export function CreditsSection() {
  const router = useRouter();
  const [state, setState] = React.useState<CreditsState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [checkoutEnabled, setCheckoutEnabled] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [managing, setManaging] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    // The processing service can be briefly unreachable while it restarts, so
    // transient failures are retried before the error is surfaced.
    const delays = [600, 1_500];
    for (let attempt = 0; ; attempt += 1) {
      try {
        setState(await fetchCredits());
        setLoading(false);
        return;
      } catch (err) {
        if (attempt < delays.length && isTransientError(err)) {
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
          continue;
        }
        setLoadError(err instanceof Error ? err.message : "Could not load credits.");
        setLoading(false);
        return;
      }
    }
  }, []);

  React.useEffect(() => {
    void load();
    void getBillingConfig()
      .then((cfg) => setCheckoutEnabled(cfg.checkoutEnabled))
      .catch(() => undefined);

    // Return trip from Stripe Checkout (?billing=verify&session_id=… or
    // ?billing=cancel). The query params are consumed once and stripped.
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    if (billing === "verify") {
      const sessionId = params.get("session_id");
      window.history.replaceState({}, "", window.location.pathname);
      if (sessionId) {
        setVerifying(true);
        verifyCheckout(sessionId)
          .then(async () => {
            toast.success("Subscription active — enjoy your new credits.");
            await load();
          })
          .catch((err) => {
            toast.error(err instanceof Error ? err.message : "Could not verify that payment.");
          })
          .finally(() => setVerifying(false));
      }
    } else if (billing === "cancel") {
      window.history.replaceState({}, "", window.location.pathname);
      toast.info("Checkout cancelled — you were not charged.");
    }
  }, [load]);

  /** Opens the subscription payment page for a paid tier. */
  const upgrade = (planKey: "pro" | "business") => {
    router.push(`/subscribe/${planKey}`);
  };

  const manage = async () => {
    setManaging(true);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open the billing portal.");
      setManaging(false);
    }
  };

  const copyLink = async () => {
    if (!state) return;
    try {
      await navigator.clipboard.writeText(state.referral.link);
      // Marks the "invite a friend" onboarding step as done on this device.
      localStorage.setItem("pt_onb_invite_copied", "1");
      setCopied(true);
      toast.success("Invite link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link manually.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-on-surface-variant">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading credits…
      </div>
    );
  }

  if (loadError || !state) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
        <span className="flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {loadError ?? "Could not load credits."}
        </span>
        <Button variant="ghost" size="sm" onClick={() => void load()} className="text-destructive">
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  const { balance, plan, plans, nextGrantAt, subscription, referral, usage } = state;
  const note = subscription ? subscriptionNote(subscription) : null;
  return (
    <div className="space-y-6">
      {verifying && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-container/10 px-3 py-2.5 text-sm text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verifying your payment with Stripe…
        </div>
      )}

      {/* Balance + plan */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-high/50 p-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Balance</p>
          <p className="mt-1 flex items-baseline gap-2">
            <Coins className="h-5 w-5 self-center text-primary" />
            <span className="font-display text-3xl font-semibold tracking-[-0.02em]">
              {balance.toLocaleString()}
            </span>
            <span className="text-sm text-on-surface-variant">credits</span>
          </p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-primary">
            {plan.label}
          </span>
          {nextGrantAt != null && (
            <p className="mt-2 flex items-center justify-end gap-1.5 text-xs text-on-surface-variant">
              <CalendarClock className="h-3.5 w-3.5" />
              +{plan.monthlyCredits.toLocaleString()} on {formatDate(nextGrantAt)}
            </p>
          )}
          {state.planExpiresAt != null && (
            <p className="mt-1 flex items-center justify-end gap-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
              <Tag className="h-3 w-3" />
              Promo tier ends {formatDate(state.planExpiresAt)}
            </p>
          )}
        </div>
      </div>

      {/* Plans overview. With Stripe configured, paid tiers get a Subscribe
          button (hosted checkout, prorated swaps while subscribed); otherwise
          plans are admin-assigned. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {plans.map((p) => {
          const current = p.key === plan.key;
          return (
            <div
              key={p.key}
              className={cn(
                "flex flex-col rounded-xl border p-4",
                current ? "border-primary/50 bg-primary-container/10" : "border-outline-variant/40",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold">{p.label}</span>
                <span className="font-mono text-xs text-on-surface-variant">
                  {p.priceUsd === 0 ? "Free" : `$${p.priceUsd}/mo`}
                </span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-primary">
                {p.monthlyCredits.toLocaleString()} credits/mo
              </p>
              <p className="mt-1.5 text-xs leading-4 text-on-surface-variant">{p.description}</p>
              {current ? (
                <div className="mt-auto pt-2">
                  {note && (
                    <p
                      className={cn(
                        "font-mono text-[10px] uppercase tracking-widest",
                        note.tone === "danger" && "text-destructive",
                        note.tone === "warn" && "text-amber-600 dark:text-amber-400",
                        note.tone === "neutral" && "text-primary",
                      )}
                    >
                      {note.text}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Current plan
                  </p>
                  {subscription && checkoutEnabled && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full gap-1.5 rounded-lg"
                      disabled={managing}
                      onClick={() => void manage()}
                    >
                      {managing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CreditCard className="h-3.5 w-3.5" />
                      )}
                      Manage subscription
                    </Button>
                  )}
                </div>
              ) : (
                checkoutEnabled &&
                p.priceUsd > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3 w-full gap-1.5 rounded-lg"
                    onClick={() => upgrade(p.key as "pro" | "business")}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Subscribe · ${p.priceUsd}/mo
                  </Button>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* 7-day usage */}
      <div>
        <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
          <Activity className="h-3.5 w-3.5" />
          Last {usage.windowDays} days
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Jobs", value: usage.jobs },
            { label: "Completed", value: usage.completed },
            { label: "Credits used", value: usage.creditsUsed },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-outline-variant/40 bg-surface-container-high/40 px-3 py-3 text-center"
            >
              <p className="font-display text-xl font-semibold">{stat.value.toLocaleString()}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
        {usage.byOperation.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {usage.byOperation.slice(0, 6).map((op) => (
              <span
                key={op.operation}
                className="rounded-full border border-outline-variant/40 px-2.5 py-1 font-mono text-[11px] text-on-surface-variant"
              >
                {OPERATION_LABELS[op.operation] ?? op.operation} · {op.jobs}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Promo code */}
      <PromoRedeem onRedeemed={load} />

      {/* Referral */}
      <div className="rounded-2xl border border-primary/30 bg-primary-container/10 p-5">        <p className="flex items-center gap-2 font-display text-sm font-semibold">
          <Gift className="h-4 w-4 text-primary" />
          Invite friends — {referral.bonus} credits each
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">
          {referral.referred
            ? "You joined with an invite — your bonus credits are already included in your balance."
            : "You both get bonus credits when a friend signs up with your link."}{" "}
          {referral.count > 0 && (
            <strong className="text-primary">
              {referral.count} friend{referral.count === 1 ? "" : "s"} joined so far.
            </strong>
          )}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={referral.link}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Your invite link"
            className="min-w-0 flex-1 truncate rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 font-mono text-xs text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="button" size="sm" onClick={() => void copyLink()} className="shrink-0 rounded-xl">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </div>
  );
}
