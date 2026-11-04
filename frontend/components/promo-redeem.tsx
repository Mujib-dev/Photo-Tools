"use client";

import * as React from "react";
import { Check, Gift, Loader2, Tag, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { describePromo, redeemPromo, validatePromo, type PromoPreview } from "@/lib/promo";
import { cn } from "@/lib/utils";

/**
 * Promo code redemption: type a code, see what it grants, redeem it.
 *
 * Discount codes are validated here but redeemed at checkout, so the button
 * says so instead of pretending to grant something.
 */
export function PromoRedeem({
  onRedeemed,
  className,
}: {
  /** Called after a successful redemption so the caller can refresh state. */
  onRedeemed?: () => void | Promise<void>;
  className?: string;
}) {
  const [code, setCode] = React.useState("");
  const [preview, setPreview] = React.useState<PromoPreview | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [redeeming, setRedeeming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const trimmed = code.trim();

  const check = async () => {
    if (!trimmed) {
      setError("Enter a promo code.");
      setPreview(null);
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const result = await validatePromo(trimmed);
      setPreview(result);
      if (!result.valid) setError(result.message ?? "That code can't be used.");
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Could not check that code.");
    } finally {
      setChecking(false);
    }
  };

  const redeem = async () => {
    if (!trimmed) return;
    setRedeeming(true);
    setError(null);
    try {
      const result = await redeemPromo(trimmed);
      toast.success(
        result.creditsGranted > 0
          ? `Added ${result.creditsGranted.toLocaleString()} credits to your balance.`
          : "Promo code applied.",
      );
      setCode("");
      setPreview(null);
      await onRedeemed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not redeem that code.");
    } finally {
      setRedeeming(false);
    }
  };

  const isDiscount = preview?.promo.kind === "discount";

  return (
    <div className={cn("rounded-2xl border border-outline-variant/40 bg-surface-container-high/40 p-5", className)}>
      <p className="flex items-center gap-2 font-display text-sm font-semibold">
        <Tag className="h-4 w-4 text-primary" />
        Have a promo code?
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setPreview(null);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void check();
            }
          }}
          placeholder="LAUNCH500"
          aria-label="Promo code"
          maxLength={32}
          className="min-w-0 flex-1 rounded-xl border border-outline-variant/40 bg-surface px-3 py-2 font-mono text-sm uppercase text-on-surface placeholder:normal-case placeholder:font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 rounded-xl"
          onClick={() => void check()}
          disabled={checking || !trimmed}
        >
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
          Check
        </Button>
        {preview?.valid && !isDiscount && (
          <Button
            type="button"
            size="sm"
            className="shrink-0 gap-1.5 rounded-xl"
            onClick={() => void redeem()}
            disabled={redeeming}
          >
            {redeeming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Redeem
          </Button>
        )}
      </div>

      {preview?.valid && (
        <p className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant">
          <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            <strong className="text-foreground">{preview.promo.code}</strong> —{" "}
            {describePromo(preview.promo)}
            {preview.promo.description ? ` · ${preview.promo.description}` : ""}
            {isDiscount && " — apply it on the pricing page when you subscribe."}
          </span>
        </p>
      )}

      {error && (
        <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
