"use client";

import * as React from "react";
import {
  CheckCircle2,
  DollarSign,
  Gift,
  MousePointerClick,
  RefreshCw,
  Send,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSudoDialog } from "@/components/admin/admin-sudo-dialog";
import {
  hasActiveSudo,
  listAdminAffiliates,
  listAdminPayouts,
  processAdminPayout,
} from "@/lib/admin";
import type { AffiliateProfile, PayoutRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AdminAffiliatesPage() {
  const [affiliates, setAffiliates] = React.useState<AffiliateProfile[]>([]);
  const [payouts, setPayouts] = React.useState<PayoutRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sudoOpen, setSudoOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<{ id: string; status: "paid" | "rejected" } | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [affData, payData] = await Promise.all([listAdminAffiliates(), listAdminPayouts()]);
      setAffiliates(affData);
      setPayouts(payData);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleProcessPayout = async (id: string, status: "paid" | "rejected") => {
    if (!hasActiveSudo()) {
      setPendingAction({ id, status });
      setSudoOpen(true);
      return;
    }
    try {
      const updated = await processAdminPayout(id, status);
      setPayouts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      void load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to process payout.");
    }
  };

  const handleSudoSuccess = async () => {
    setSudoOpen(false);
    if (pendingAction) {
      const { id, status } = pendingAction;
      setPendingAction(null);
      await handleProcessPayout(id, status);
    }
  };

  const pendingPayouts = payouts.filter((p) => p.status === "pending");

  return (
    <div className="space-y-6">
      <AdminSudoDialog
        open={sudoOpen}
        onCancel={() => setSudoOpen(false)}
        onSuccess={handleSudoSuccess}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Gift className="h-4 w-4" />
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Affiliate & Referral Commission Manager
            </h1>
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">
            Track affiliate promoter performance, conversion rates, and approve pending revenue share payouts.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Pending Payout Requests */}
      <div className="glass-panel p-6 rounded-2xl border border-outline-variant/30 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4 text-amber-500" />
            Pending Commission Payout Requests ({pendingPayouts.length})
          </h3>
        </div>

        {pendingPayouts.length === 0 ? (
          <p className="text-xs text-on-surface-variant py-4 text-center">No pending payout requests at this time.</p>
        ) : (
          <div className="space-y-3">
            {pendingPayouts.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-foreground">
                      ${(p.amountCents / 100).toFixed(2)}
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-surface-container font-semibold">
                      via {p.method.toUpperCase()}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-foreground truncate">{p.userEmail}</p>
                  <p className="font-mono text-[11px] text-on-surface-variant truncate">Dest: {p.details}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleProcessPayout(p.id, "paid")}
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve Payout
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleProcessPayout(p.id, "rejected")}
                    className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Affiliates Directory */}
      <div className="glass-panel rounded-2xl border border-outline-variant/30 overflow-hidden">
        <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-foreground">All Registered Affiliates</h3>
          <span className="text-xs font-mono text-on-surface-variant">{affiliates.length} promoters</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-high/40 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Affiliate</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Clicks</th>
                <th className="px-4 py-3">Signups</th>
                <th className="px-4 py-3">Conversions</th>
                <th className="px-4 py-3">Total Earned</th>
                <th className="px-4 py-3">Pending Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15">
              {affiliates.map((aff) => (
                <tr key={aff.userId} className="hover:bg-surface-container-high/30 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-foreground">{aff.userEmail}</td>
                  <td className="px-4 py-3.5 font-mono font-bold text-primary">{aff.code}</td>
                  <td className="px-4 py-3.5 font-mono">{aff.clicks}</td>
                  <td className="px-4 py-3.5 font-mono">{aff.signups}</td>
                  <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {aff.paidConversions}
                  </td>
                  <td className="px-4 py-3.5 font-mono font-bold text-foreground">
                    ${(aff.totalEarnedCents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-amber-500 font-bold">
                    ${(aff.pendingBalanceCents / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
