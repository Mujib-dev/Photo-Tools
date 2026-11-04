"use client";

import * as React from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  DollarSign,
  Gift,
  MousePointerClick,
  QrCode,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAffiliateProfile,
  requestAffiliatePayout,
  updatePayoutSettings,
} from "@/lib/user-features";
import type { AffiliateProfile, PayoutRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ReferralsPage() {
  const [profile, setProfile] = React.useState<AffiliateProfile | null>(null);
  const [payouts, setPayouts] = React.useState<PayoutRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [payoutMethod, setPayoutMethod] = React.useState<"paypal" | "stripe" | "bank" | "crypto">("paypal");
  const [payoutDetails, setPayoutDetails] = React.useState("");
  const [isUpdatingSettings, setIsUpdatingSettings] = React.useState(false);
  const [isRequestingPayout, setIsRequestingPayout] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAffiliateProfile();
      setProfile(data.profile);
      setPayouts(data.payouts);
      setPayoutMethod(data.profile.payoutMethod || "paypal");
      setPayoutDetails(data.profile.payoutDetails || data.profile.userEmail);
    } catch {
      // Ignored if offline
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const referralUrl = profile ? `https://pictools.app/?ref=${profile.code}` : "https://pictools.app/?ref=PROMO";

  const copyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSavePayoutSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutDetails.trim()) return;
    setIsUpdatingSettings(true);
    try {
      const updated = await updatePayoutSettings({ method: payoutMethod, details: payoutDetails });
      setProfile(updated);
      alert("Payout destination updated successfully!");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update payout details.");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!confirm("Confirm requesting payout of your available commission balance?")) return;
    setIsRequestingPayout(true);
    try {
      const req = await requestAffiliatePayout();
      setPayouts((prev) => [req, ...prev]);
      if (profile) setProfile({ ...profile, pendingBalanceCents: 0 });
      alert("Payout request submitted! Our finance team will review and process your funds.");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Payout request failed.");
    } finally {
      setIsRequestingPayout(false);
    }
  };

  const pendingDollars = profile ? (profile.pendingBalanceCents / 100).toFixed(2) : "0.00";
  const totalEarnedDollars = profile ? (profile.totalEarnedCents / 100).toFixed(2) : "0.00";
  const paidOutDollars = profile ? (profile.paidOutCents / 100).toFixed(2) : "0.00";

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <Gift className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Affiliate Program & Referral Hub
              </h1>
              <p className="text-xs text-on-surface-variant">
                Earn 25% recurring lifetime commission on every Pro and Business upgrade referred through your personal link.
              </p>
            </div>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh Stats
        </Button>
      </div>

      {/* Share Link Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-primary/30 bg-primary/5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Your Personal Affiliate Referral Link (25% Lifetime Recurring)
          </span>
          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
            25% Commission Tier
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-low p-2">
          <input
            type="text"
            readOnly
            value={referralUrl}
            className="w-full bg-transparent font-mono text-xs font-semibold text-foreground px-2 outline-none"
          />
          <Button size="sm" onClick={copyLink} className="gap-1.5 text-xs h-8">
            <Copy className="h-3.5 w-3.5" />
            {copiedLink ? "Copied!" : "Copy Link"}
          </Button>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
        <div className="glass-panel p-5 rounded-2xl border border-outline-variant/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Link Clicks</span>
            <MousePointerClick className="h-4 w-4 text-primary" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {profile?.clicks ?? 0}
          </p>
          <p className="text-[11px] text-on-surface-variant">Total visitor redirects</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-outline-variant/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Free Signups</span>
            <UserPlus className="h-4 w-4 text-sky-500" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {profile?.signups ?? 0}
          </p>
          <p className="text-[11px] text-on-surface-variant">Referred registered accounts</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-outline-variant/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Paid Conversions</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {profile?.paidConversions ?? 0}
          </p>
          <p className="text-[11px] text-on-surface-variant">Active paid upgrades</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-outline-variant/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Available Balance</span>
            <Wallet className="h-4 w-4 text-amber-500" />
          </div>
          <p className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ${pendingDollars}
          </p>
          <p className="text-[11px] text-on-surface-variant">
            ${totalEarnedDollars} earned (${paidOutDollars} paid)
          </p>
        </div>
      </div>

      {/* Payout Settings & Request */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 mt-6">
        <div className="lg:col-span-6 glass-panel p-6 rounded-2xl border border-outline-variant/30 space-y-4">
          <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Payout Destination Setup
          </h3>

          <form onSubmit={handleSavePayoutSettings} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Payout Method</label>
              <select
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value as any)}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-xs text-foreground focus:border-primary/60 focus:outline-none"
              >
                <option value="paypal">PayPal (Instant email transfer)</option>
                <option value="stripe">Stripe Connect (Direct bank payout)</option>
                <option value="bank">Direct Bank Wire / ACH</option>
                <option value="crypto">Crypto USDT / USDC (TRC-20)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Destination Account Details</label>
              <input
                type="text"
                required
                value={payoutDetails}
                onChange={(e) => setPayoutDetails(e.target.value)}
                placeholder="PayPal email, bank account, or wallet address"
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-xs text-foreground focus:border-primary/60 focus:outline-none"
              />
            </div>

            <Button type="submit" size="sm" variant="outline" disabled={isUpdatingSettings} className="text-xs">
              {isUpdatingSettings ? "Saving..." : "Save Payout Settings"}
            </Button>
          </form>
        </div>

        {/* Request Payout Action Card */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-2xl border border-outline-variant/30 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-500" />
              Withdraw Commissions
            </h3>
            <p className="mt-2 text-xs text-on-surface-variant leading-relaxed">
              Minimum payout threshold is <span className="font-bold text-foreground">$20.00</span>. Payouts are reviewed and disbursed weekly to your configured destination.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span>Ready for withdrawal:</span>
              <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                ${pendingDollars}
              </span>
            </div>

            <Button
              size="sm"
              disabled={!profile || profile.pendingBalanceCents < 2000 || isRequestingPayout}
              onClick={handleRequestPayout}
              className="w-full gap-2 text-xs"
            >
              <Send className="h-3.5 w-3.5" />
              {isRequestingPayout ? "Requesting..." : "Request Commission Payout"}
            </Button>
          </div>
        </div>
      </div>

      {/* Payout History */}
      {payouts.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl border border-outline-variant/30 mt-6 space-y-3">
          <h3 className="font-display text-sm font-bold text-foreground">Payout History</h3>
          <div className="space-y-2">
            {payouts.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-mono font-bold text-foreground">
                    ${(p.amountCents / 100).toFixed(2)} via {p.method.toUpperCase()}
                  </span>
                  <p className="text-[11px] text-on-surface-variant font-mono truncate max-w-xs">{p.details}</p>
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border",
                      p.status === "paid" && "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
                      p.status === "pending" && "bg-amber-500/15 text-amber-600 border-amber-500/30",
                      p.status === "rejected" && "bg-destructive/15 text-destructive border-destructive/30",
                    )}
                  >
                    {p.status}
                  </span>
                  <p className="text-[10px] text-on-surface-variant mt-0.5 font-mono">
                    {new Date(p.requestedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
