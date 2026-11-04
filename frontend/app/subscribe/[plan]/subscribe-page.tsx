"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
  Tag,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";
import {
  createCheckout,
  createPortalSession,
  getPakistanPaymentMethods,
  getPlanCatalog,
  submitManualPayment,
  type BillingCycle,
  type PakistanPaymentCatalog,
  type PlanCatalogEntry,
} from "@/lib/billing";
import { fetchCredits } from "@/lib/credits";
import { isPaidPlan, PLAN_PRESENTATION } from "@/lib/plans";
import { describePromo, validatePromo, type PromoPreview } from "@/lib/promo";
import { cn } from "@/lib/utils";

interface Catalog {
  checkoutEnabled: boolean;
  annualEnabled: boolean;
  plans: PlanCatalogEntry[];
}

function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * The subscription payment page.
 *
 * Clicking a tier on the pricing page lands here: the order is summarised
 * in-app (plan, cycle, amount due today) and the actual card entry happens
 * on Stripe's hosted checkout, so no card data ever touches this app.
 */
export function SubscribePage({
  plan,
  initialCycle,
}: {
  plan: string;
  initialCycle: BillingCycle;
}) {
  const router = useRouter();
  const { user, status } = useAuth();
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);
  const [cycle, setCycle] = React.useState<BillingCycle>(initialCycle);
  const [currentPlan, setCurrentPlan] = React.useState<string | null>(null);
  const [paying, setPaying] = React.useState(false);
  const [managing, setManaging] = React.useState(false);
  const [promoCode, setPromoCode] = React.useState("");
  const [promoPreview, setPromoPreview] = React.useState<PromoPreview | null>(null);
  const [promoError, setPromoError] = React.useState<string | null>(null);
  const [checkingPromo, setCheckingPromo] = React.useState(false);

  // Pakistan & Alternative Payment Methods (JazzCash, EasyPaisa, Bank Transfer)
  const [paymentMethod, setPaymentMethod] = React.useState<"stripe" | "jazzcash" | "easypaisa" | "bank">("stripe");
  const [pakCatalog, setPakCatalog] = React.useState<PakistanPaymentCatalog | null>(null);
  const [senderAccount, setSenderAccount] = React.useState("");
  const [transactionId, setTransactionId] = React.useState("");
  const [submittingManual, setSubmittingManual] = React.useState(false);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getPlanCatalog()
      .then((data) => {
        if (!cancelled) {
          setCatalog(data);
          if (!data.checkoutEnabled) {
            setPaymentMethod("jazzcash");
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCatalogError(err instanceof Error ? err.message : "Could not load the plan catalogue.");
        }
      });

    getPakistanPaymentMethods()
      .then((data) => {
        if (!cancelled) setPakCatalog(data);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  // The signed-in account's current tier, so we can say "you're already on
  // this plan" instead of letting checkout reject it.
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchCredits()
      .then((state) => {
        if (!cancelled) setCurrentPlan(state.plan.key);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const selectCycle = (next: BillingCycle) => {
    setCycle(next);
    window.history.replaceState({}, "", `/subscribe/${plan}?cycle=${next}`);
  };

  const entry = catalog?.plans.find((p) => p.key === plan) ?? null;
  const perMonth = entry ? (cycle === "annual" ? entry.priceUsdAnnual : entry.priceUsd) : 0;
  const dueToday = entry ? (cycle === "annual" ? entry.annualTotalUsd : entry.priceUsd) : 0;
  const alreadyOnPlan = currentPlan === plan;
  // A discount code only counts once it has been checked and accepted.
  const discountActive =
    promoPreview?.valid === true && promoPreview.promo.kind === "discount";
  const discountAmount = discountActive
    ? Math.round(dueToday * (promoPreview.promo.percentOff / 100) * 100) / 100
    : 0;

  const pay = async () => {
    if (!isPaidPlan(plan)) return;
    setPaying(true);
    try {
      const code = promoPreview?.valid ? promoPreview.promo.code : "";
      const { url, swapped } = await createCheckout(plan, cycle, code || null);
      if (url) {
        window.location.href = url;
        return;
      }
      // Already subscribed: the tier was swapped in place (prorated).
      toast.success("Plan updated — the prorated difference lands on your next invoice.");
      router.push("/profile#credits");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start checkout.");
      setPaying(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const submitPakistanPayment = async () => {
    if (!isPaidPlan(plan)) return;
    if (!senderAccount.trim()) {
      toast.error("Please enter the sender mobile or bank account number.");
      return;
    }
    if (!transactionId.trim()) {
      toast.error("Please enter your Transaction ID (TRX ID).");
      return;
    }
    setSubmittingManual(true);
    try {
      await submitManualPayment({
        plan,
        cycle,
        method: paymentMethod as "jazzcash" | "easypaisa" | "bank",
        senderAccount: senderAccount.trim(),
        transactionId: transactionId.trim(),
      });
      toast.success(`Payment verified! Welcome to PicTools ${plan.toUpperCase()}!`);
      router.push("/profile#credits");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to verify transaction.");
    } finally {
      setSubmittingManual(false);
    }
  };

  /** Check a discount code so the summary can show what it takes off. */
  const checkPromo = async () => {
    const code = promoCode.trim();
    if (!code) {
      setPromoError("Enter a promo code.");
      setPromoPreview(null);
      return;
    }
    setCheckingPromo(true);
    setPromoError(null);
    try {
      const result = await validatePromo(code);
      setPromoPreview(result);
      if (!result.valid) {
        setPromoError(result.message ?? "That code can't be used.");
      } else if (result.promo.kind !== "discount") {
        setPromoError("That code grants credits or a tier — redeem it from your profile.");
      }
    } catch (err) {
      setPromoPreview(null);
      setPromoError(err instanceof Error ? err.message : "Could not check that code.");
    } finally {
      setCheckingPromo(false);
    }
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

  if (!isPaidPlan(plan)) {
    return (
      <Shell>
        <Notice
          icon={TriangleAlert}
          title="That plan doesn't exist"
          body="Pick Pro or Business to subscribe."
          action={
            <Button asChild variant="outline">
              <Link href="/pricing">Back to pricing</Link>
            </Button>
          }
        />
      </Shell>
    );
  }

  const presentation = PLAN_PRESENTATION[plan];
  const Icon = presentation.icon;
  const nextUrl = `/subscribe/${plan}?cycle=${cycle}`;
  const signInUrl = `/login?next=${encodeURIComponent(nextUrl)}`;

  if (status === "loading" || (!catalog && !catalogError)) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading checkout…
        </div>
      </Shell>
    );
  }

  if (catalogError || !catalog || !entry) {
    return (
      <Shell>
        <Notice
          icon={TriangleAlert}
          title="Checkout is unavailable"
          body={catalogError ?? "That plan is no longer offered."}
          action={
            <Button asChild variant="outline">
              <Link href="/pricing">Back to pricing</Link>
            </Button>
          }
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <Link
        href="/pricing"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to pricing
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        {/* Plan summary */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Badge variant="outline" className="gap-1.5 border-amber-500/30 text-xs text-amber-600 dark:text-amber-400">
              <Icon className="h-3.5 w-3.5" />
              Subscription checkout
            </Badge>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Complete your {presentation.title} subscription
            </h1>
            <p className="text-sm text-muted-foreground">{presentation.tagline}</p>
          </div>

          <div className="space-y-5 rounded-3xl border bg-card/60 p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-xl font-bold">{presentation.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {entry.monthlyCredits.toLocaleString()} AI credits every month
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-3xl font-extrabold">{money(perMonth)}</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </div>
            </div>

            {/* Billing cycle */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Billing cycle
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <CycleOption
                  active={cycle === "monthly"}
                  disabled={false}
                  title="Monthly"
                  detail={`${money(entry.priceUsd)} / month`}
                  onSelect={() => selectCycle("monthly")}
                />
                <CycleOption
                  active={cycle === "annual"}
                  disabled={!catalog.annualEnabled}
                  title="Annual"
                  detail={`${money(entry.priceUsdAnnual)} / month — ${money(entry.annualTotalUsd)} per year`}
                  onSelect={() => selectCycle("annual")}
                  badge={catalog.annualEnabled ? "Save 30%" : "Unavailable"}
                />
              </div>
              {!catalog.annualEnabled && (
                <p className="text-[11px] text-muted-foreground">
                  Annual billing is not enabled on this deployment yet.
                </p>
              )}
            </div>

            <div className="border-t pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                What&apos;s included
              </p>
              <ul className="space-y-2">
                {presentation.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Payment panel */}
        <Card className="glass-panel rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-primary" />
              Payment
            </CardTitle>
            <CardDescription>
              Card details are entered on Stripe&apos;s secure checkout — they never touch this app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!user ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sign in to subscribe so the plan is attached to your account.
                </p>
                <Button asChild className="w-full">
                  <Link href={signInUrl}>Sign in to continue</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/signup?next=${encodeURIComponent(nextUrl)}`}>
                    Create an account
                  </Link>
                </Button>
              </div>
            ) : alreadyOnPlan ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You&apos;re already on {presentation.title}. Manage the subscription to update your
                  card or cancel.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={managing}
                  onClick={() => void manage()}
                >
                  {managing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Manage subscription
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                    Choose Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {catalog.checkoutEnabled && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("stripe")}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-2.5 text-center transition-all",
                          paymentMethod === "stripe"
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                            : "border-border/60 bg-background/50 hover:bg-muted text-muted-foreground"
                        )}
                      >
                        <CreditCard className="h-4 w-4" />
                        <span className="text-xs">Credit Card</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("jazzcash")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-2.5 text-center transition-all",
                        paymentMethod === "jazzcash"
                          ? "border-red-500 bg-red-500/10 text-red-500 font-bold shadow-sm"
                          : "border-border/60 bg-background/50 hover:bg-muted text-muted-foreground"
                      )}
                    >
                      <Smartphone className="h-4 w-4" />
                      <span className="text-xs">JazzCash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("easypaisa")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-2.5 text-center transition-all",
                        paymentMethod === "easypaisa"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-500 font-bold shadow-sm"
                          : "border-border/60 bg-background/50 hover:bg-muted text-muted-foreground"
                      )}
                    >
                      <Smartphone className="h-4 w-4" />
                      <span className="text-xs">EasyPaisa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("bank")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-2.5 text-center transition-all",
                        paymentMethod === "bank"
                          ? "border-blue-500 bg-blue-500/10 text-blue-500 font-bold shadow-sm"
                          : "border-border/60 bg-background/50 hover:bg-muted text-muted-foreground"
                      )}
                    >
                      <Building2 className="h-4 w-4" />
                      <span className="text-xs">Bank / Raast</span>
                    </button>
                  </div>
                </div>

                <dl className="space-y-2 text-sm pt-2 border-t">
                  <Row label="Plan" value={presentation.title} />
                  <Row
                    label="Billing cycle"
                    value={cycle === "annual" ? "Annual" : "Monthly"}
                  />
                  <Row label="AI credits" value={`${entry.monthlyCredits.toLocaleString()} / month`} />
                  {paymentMethod === "stripe" ? (
                    <>
                      {discountActive && (
                        <Row
                          label={`Promo ${promoPreview?.promo.code}`}
                          value={`-${money(discountAmount)}`}
                        />
                      )}
                      <Row
                        label={cycle === "annual" ? "Due today (1 year)" : "Due today (1 month)"}
                        value={money(discountActive ? dueToday - discountAmount : dueToday)}
                        emphasis
                      />
                    </>
                  ) : (
                    <>
                      <Row
                        label="Amount (USD)"
                        value={money(dueToday)}
                      />
                      <Row
                        label="Amount in PKR"
                        value={`Rs. ${(
                          pakCatalog?.plans[plan === "business" ? "business" : "pro"]?.[cycle === "annual" ? "annualPkr" : "monthlyPkr"] ||
                          (cycle === "annual" ? (plan === "business" ? 70500 : 23500) : (plan === "business" ? 8400 : 2800))
                        ).toLocaleString()} PKR`}
                        emphasis
                      />
                    </>
                  )}
                </dl>

                {paymentMethod === "stripe" ? (
                  <>
                    {/* Promo code */}
                    <div className="space-y-2">
                      <label
                        htmlFor="promo-code"
                        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        <Tag className="h-3.5 w-3.5" />
                        Promo code
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="promo-code"
                          value={promoCode}
                          onChange={(e) => {
                            setPromoCode(e.target.value.toUpperCase());
                            setPromoPreview(null);
                            setPromoError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void checkPromo();
                            }
                          }}
                          placeholder="SAVE25"
                          maxLength={32}
                          className="min-w-0 flex-1 rounded-2xl border bg-background px-3 py-2 font-mono text-sm uppercase placeholder:normal-case placeholder:font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 rounded-2xl"
                          onClick={() => void checkPromo()}
                          disabled={checkingPromo || !promoCode.trim()}
                        >
                          {checkingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Apply
                        </Button>
                      </div>
                      {promoPreview?.valid && promoPreview.promo.kind === "discount" && (
                        <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          {describePromo(promoPreview.promo)} applied to this order.
                        </p>
                      )}
                      {promoError && (
                        <p className="flex items-center gap-1.5 text-xs text-destructive">
                          <TriangleAlert className="h-3.5 w-3.5" />
                          {promoError}
                        </p>
                      )}
                    </div>

                    <Button
                      type="button"
                      size="lg"
                      className="w-full gap-2"
                      disabled={paying}
                      onClick={() => void pay()}
                    >
                      {paying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      {paying
                        ? "Opening checkout…"
                        : `Pay ${money(discountActive ? dueToday - discountAmount : dueToday)}`}
                    </Button>
                  </>
                ) : (
                  /* Pakistan Payment Form (JazzCash / EasyPaisa / Bank Transfer) */
                  <div className="space-y-4 pt-1">
                    {(() => {
                      const selMethod = pakCatalog?.methods.find((m) => m.id === paymentMethod) || {
                        name: paymentMethod === "jazzcash" ? "JazzCash" : paymentMethod === "easypaisa" ? "EasyPaisa" : "Bank Transfer",
                        accountTitle: "PicTools Official / Mujib Ur Rahman",
                        accountNumber: paymentMethod === "jazzcash" ? "0300-1234567" : paymentMethod === "easypaisa" ? "0345-1234567" : "01010102938475",
                        tillId: paymentMethod === "jazzcash" ? "00192834" : undefined,
                        bankName: paymentMethod === "bank" ? "Meezan Bank Ltd" : undefined,
                        iban: paymentMethod === "bank" ? "PK82MEZN0001010102938475" : undefined,
                        instructions: "Send the exact PKR amount to the account above, then enter your Transaction ID (TRX ID).",
                      };
                      return (
                        <div className="rounded-2xl border border-border/80 bg-background/60 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-foreground flex items-center gap-2">
                              {paymentMethod === "bank" ? <Building2 className="h-4 w-4 text-blue-500" /> : <Smartphone className="h-4 w-4 text-primary" />}
                              {selMethod.name} Details
                            </span>
                            <Badge variant="outline" className="text-[11px] font-mono">
                              Official Account
                            </Badge>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            {selMethod.bankName && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bank:</span>
                                <span className="font-semibold text-foreground">{selMethod.bankName}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Account Title:</span>
                              <span className="font-semibold text-foreground">{selMethod.accountTitle}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Account Number:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-foreground">{selMethod.accountNumber}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(selMethod.accountNumber, "acc")}
                                  className="p-1 hover:text-primary transition"
                                  title="Copy account number"
                                >
                                  {copiedField === "acc" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </div>
                            {selMethod.iban && (
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">IBAN:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[11px] font-bold text-foreground">{selMethod.iban}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(selMethod.iban!, "iban")}
                                    className="p-1 hover:text-primary transition"
                                    title="Copy IBAN"
                                  >
                                    {copiedField === "iban" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                  </button>
                                </div>
                              </div>
                            )}
                            {selMethod.tillId && (
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Till ID:</span>
                                <span className="font-mono font-bold text-foreground">{selMethod.tillId}</span>
                              </div>
                            )}
                          </div>

                          <p className="text-[11px] text-muted-foreground border-t pt-2">
                            💡 {selMethod.instructions}
                          </p>
                        </div>
                      );
                    })()}

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Sender Phone / Account Number
                        </label>
                        <input
                          value={senderAccount}
                          onChange={(e) => setSenderAccount(e.target.value)}
                          placeholder="e.g. 0300-1234567"
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Transaction ID (TID / Ref #)
                        </label>
                        <input
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                          placeholder="e.g. 8558 or 3737 confirmation SMS ID"
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm font-mono uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>

                      <Button
                        type="button"
                        size="lg"
                        className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
                        disabled={submittingManual}
                        onClick={() => void submitPakistanPayment()}
                      >
                        {submittingManual ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        {submittingManual
                          ? "Verifying Payment…"
                          : `Verify & Activate ${plan.toUpperCase()}`}
                      </Button>
                    </div>
                  </div>
                )}

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  By continuing you agree to the{" "}
                  <Link href="/terms" className="underline underline-offset-2">
                    Terms of Service
                  </Link>
                  . Cancel anytime from your profile — the plan stays active until the end of the
                  billing period.
                </p>

                <div className="grid gap-2 border-t pt-4 text-[11px] text-muted-foreground sm:grid-cols-2">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    256-bit SSL encrypted
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-blue-500" />
                    Powered by Stripe
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-amber-500" />
                    Cancel anytime
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                    Card details stay with Stripe
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8 sm:py-12">{children}</div>
  );
}

function Notice({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border bg-card/60 p-6 text-center space-y-3 sm:p-8",
        className ?? "",
      )}
    >
      <Icon className="mx-auto h-6 w-6 text-amber-500" />
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}

function CycleOption({
  active,
  disabled,
  title,
  detail,
  badge,
  onSelect,
}: {
  active: boolean;
  disabled: boolean;
  title: string;
  detail: string;
  badge?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active ? "border-primary bg-primary/5" : "border-outline-variant/40 hover:bg-accent",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        {badge && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            {badge}
          </span>
        )}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
    </button>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right", emphasis ? "font-semibold" : "")}>{value}</dd>
    </div>
  );
}
