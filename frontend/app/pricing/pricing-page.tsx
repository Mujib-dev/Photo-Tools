"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Coins,
  CreditCard,
  Crown,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPlanCatalog, type PlanCatalogEntry } from "@/lib/billing";
import { PLAN_PRESENTATION, type PaidPlanKey } from "@/lib/plans";
import { useAuth } from "@/components/auth-provider";
import { PromoRedeem } from "@/components/promo-redeem";

function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = React.useState<"monthly" | "annual">("monthly");
  const [plans, setPlans] = React.useState<PlanCatalogEntry[] | null>(null);
  const [annualEnabled, setAnnualEnabled] = React.useState(false);

  // Prices come from the backend catalogue so the pricing page, the payment
  // page and the profile always show the same numbers.
  React.useEffect(() => {
    let cancelled = false;
    getPlanCatalog()
      .then((data) => {
        if (cancelled) return;
        setPlans(data.plans);
        setAnnualEnabled(data.annualEnabled);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const planOf = (key: string): PlanCatalogEntry | null =>
    plans?.find((p) => p.key === key) ?? null;

  /** Clicking a tier opens the subscription payment page. */
  const startSubscription = (planKey: PaidPlanKey) => {
    const target = `/subscribe/${planKey}?cycle=${billingCycle}`;
    if (!user) {
      toast.info("Please sign in or create an account to upgrade.");
      router.push(`/login?next=${encodeURIComponent(target)}`);
      return;
    }
    router.push(target);
  };

  /** One-time credit packs are bought from the credits panel on the profile. */
  const handleCreditPackCheckout = (packName: string, amount: string) => {
    if (!user) {
      toast.info("Please sign in to purchase credits.");
      router.push(
        `/login?next=${encodeURIComponent(`/profile#credits`)}`,
      );
      return;
    }
    toast.success(`Redirecting to secure checkout for ${packName} (${amount})...`);
    router.push("/profile#credits");
  };

  const pro = planOf("pro");
  const business = planOf("business");
  const free = planOf("free");

  /** Prices show a dash until the catalogue arrives so nobody sees "$0.00". */
  const priceText = (amount: number | null | undefined): string =>
    amount === null || amount === undefined ? "—" : money(amount);

  const proMonthly = pro ? pro.priceUsd : null;
  const proAnnual = pro ? pro.priceUsdAnnual : null;
  const proAnnualTotal = pro ? pro.annualTotalUsd : null;
  const businessMonthly = business ? business.priceUsd : null;
  const businessAnnual = business ? business.priceUsdAnnual : null;
  const businessAnnualTotal = business ? business.annualTotalUsd : null;

  return (
    <div className="container max-w-6xl mx-auto py-8 sm:py-12 px-4 space-y-10 sm:space-y-16">
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <Badge variant="outline" className="px-3 py-1 border-amber-500/30 text-amber-600 dark:text-amber-400 gap-1.5 text-xs">
          <Crown className="w-3.5 h-3.5" /> High-Resolution Commercial Power
        </Badge>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
          Simple, Transparent Plans That Scale With You
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg">
          Unlock commercial e-commerce product staging, AI super-resolution, unlimited SVG vectorization, and batch workflows.
        </p>

        {/* Monthly vs Annual Toggle */}
        <div
          role="group"
          aria-label="Billing cycle"
          className="pt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3"
        >
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            aria-pressed={billingCycle === "monthly"}
            className={`text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-full transition-all ${
              billingCycle === "monthly" ? "bg-card border shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => annualEnabled && setBillingCycle("annual")}
            disabled={!annualEnabled}
            aria-pressed={billingCycle === "annual"}
            className={`text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-full flex items-center gap-2 transition-all disabled:opacity-50 ${
              billingCycle === "annual" ? "bg-card border shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Annual Billing
            <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
              Save 30%
            </span>
          </button>
        </div>
      </div>

      {/* Subscription Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {/* Free Plan */}
        <div className="p-6 sm:p-8 rounded-3xl border bg-card/60 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-xl font-bold">Free Starter</h3>
              <p className="text-xs text-muted-foreground">For personal and casual photo editing.</p>
            </div>
            <div className="text-4xl font-extrabold">$0</div>
            <p className="text-xs text-muted-foreground">Free forever · No credit card required</p>

            <div className="pt-4 space-y-3 border-t text-sm">
              {[
                `${free?.monthlyCredits.toLocaleString() ?? "—"} Monthly AI credits included`,
                "Full access to all 25+ base tools",
                "Standard web-resolution exports",
                "Browser-local lossless processing",
                "Community support",
              ].map((feat, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <Link href="/signup">
            <Button variant="outline" className="w-full">
              Get Started Free
            </Button>
          </Link>
        </div>

        {/* Pro Plan (Most Popular) */}
        <div className="p-6 sm:p-8 rounded-3xl border-2 border-amber-500 bg-gradient-to-b from-amber-500/10 via-card to-card relative flex flex-col justify-between space-y-6 shadow-xl shadow-amber-500/5">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="bg-amber-600 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
              Most Popular
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">{PLAN_PRESENTATION.pro.title}</h3>
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-xs text-muted-foreground">{PLAN_PRESENTATION.pro.tagline}</p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-extrabold">
                {priceText(billingCycle === "annual" ? proAnnual : proMonthly)}
              </span>
              <span className="text-xs text-muted-foreground">/ month</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {billingCycle === "annual"
                ? `Billed annually (${priceText(proAnnualTotal)}/year)`
                : "Billed monthly, cancel anytime"}
            </p>

            <div className="pt-4 space-y-3 border-t text-sm">
              {[
                `${pro?.monthlyCredits.toLocaleString() ?? "—"} Monthly AI Credits (rollover supported)`,
                ...PLAN_PRESENTATION.pro.features,
              ].map((feat, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs font-medium">
                  <Check className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={() => startSubscription("pro")}
            className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-500/20"
          >
            <Crown className="w-4 h-4" />
            Upgrade to Pro
          </Button>
        </div>

        {/* Business & Agency Plan */}
        <div className="p-6 sm:p-8 rounded-3xl border bg-card/60 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-xl font-bold">{PLAN_PRESENTATION.business.title}</h3>
              <p className="text-xs text-muted-foreground">{PLAN_PRESENTATION.business.tagline}</p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-extrabold">
                {priceText(billingCycle === "annual" ? businessAnnual : businessMonthly)}
              </span>
              <span className="text-xs text-muted-foreground">/ month</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {billingCycle === "annual"
                ? `Billed annually (${priceText(businessAnnualTotal)}/year)`
                : "Billed monthly, cancel anytime"}
            </p>

            <div className="pt-4 space-y-3 border-t text-sm">
              {[
                `${business?.monthlyCredits.toLocaleString() ?? "—"} Monthly AI Credits`,
                ...PLAN_PRESENTATION.business.features,
              ].map((feat, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs font-medium">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => startSubscription("business")}
            className="w-full gap-2 border-border"
          >
            Get Business Plan
          </Button>
        </div>
      </div>

      {/* Have a Promo Code Section */}
      <div className="max-w-2xl mx-auto w-full">
        <PromoRedeem
          onRedeemed={() => {
            router.refresh();
          }}
        />
      </div>

      {/* Non-Subscription Pay-As-You-Go Section */}
      <div className="p-5 sm:p-8 rounded-3xl border bg-muted/20 space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <Badge variant="secondary" className="text-xs gap-1">
            <Coins className="w-3.5 h-3.5 text-amber-500" /> Pay-As-You-Go
          </Badge>
          <h2 className="text-2xl font-bold">Don&apos;t Want a Subscription?</h2>
          <p className="text-xs text-muted-foreground">
            Buy one-time credit packs or grab a 24-hour instant day pass. Credits never expire.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 24-Hour Day Pass */}
          <div className="p-5 rounded-2xl border bg-card flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Instant Access</span>
              <h4 className="font-bold text-base">24-Hour Day Pass</h4>
              <p className="text-xs text-muted-foreground">Perfect for one-off passport photos or vintage scans.</p>
              <div className="text-2xl font-extrabold pt-1">$2.99</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCreditPackCheckout("24-Hour Day Pass", "$2.99")}
              className="w-full text-xs"
            >
              Get Day Pass
            </Button>
          </div>

          {/* Starter Pack */}
          <div className="p-5 rounded-2xl border bg-card flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Top-Up</span>
              <h4 className="font-bold text-base">50 AI Credits</h4>
              <p className="text-xs text-muted-foreground">Great for a small set of product shots or restores.</p>
              <div className="text-2xl font-extrabold pt-1">$6.99</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCreditPackCheckout("50 Credits", "$6.99")}
              className="w-full text-xs"
            >
              Buy 50 Credits
            </Button>
          </div>

          {/* Power Pack */}
          <div className="p-5 rounded-2xl border-2 border-amber-500/60 bg-amber-500/5 flex flex-col justify-between space-y-4 relative">
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Best Value</span>
              <h4 className="font-bold text-base">250 AI Credits</h4>
              <p className="text-xs text-muted-foreground">Stage 250 products or upscale full family albums.</p>
              <div className="text-2xl font-extrabold pt-1">$19.99</div>
            </div>
            <Button
              size="sm"
              onClick={() => handleCreditPackCheckout("250 Credits", "$19.99")}
              className="w-full text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              Buy 250 Credits
            </Button>
          </div>

          {/* Studio Volume */}
          <div className="p-5 rounded-2xl border bg-card flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Studio Volume</span>
              <h4 className="font-bold text-base">1,000 AI Credits</h4>
              <p className="text-xs text-muted-foreground">High-volume batch catalog processing.</p>
              <div className="text-2xl font-extrabold pt-1">$49.99</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCreditPackCheckout("1,000 Credits", "$49.99")}
              className="w-full text-xs"
            >
              Buy 1,000 Credits
            </Button>
          </div>
        </div>
      </div>

      {/* Trust & Guarantee Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center border-y py-8">
        <div className="flex flex-col items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-500" />
          <h4 className="font-semibold text-sm">256-Bit SSL Encrypted</h4>
          <p className="text-xs text-muted-foreground">All payments are processed securely via Stripe, JazzCash, EasyPaisa & Bank Transfer.</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <CreditCard className="w-6 h-6 text-amber-500" />
          <h4 className="font-semibold text-sm">Cancel Anytime</h4>
          <p className="text-xs text-muted-foreground">No lock-ins. Cancel your subscription in 1 click.</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Lock className="w-6 h-6 text-blue-500" />
          <h4 className="font-semibold text-sm">Commercial License Included</h4>
          <p className="text-xs text-muted-foreground">All generated outputs are 100% royalty-free for commercial use.</p>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="space-y-8 max-w-3xl mx-auto">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold">Frequently Asked Questions</h3>
          <p className="text-xs text-muted-foreground">Everything you need to know about plans and billing.</p>
        </div>

        <div className="space-y-4">
          <div className="p-5 rounded-2xl border bg-card space-y-1.5">
            <h5 className="font-semibold text-sm">What counts as an AI credit?</h5>
            <p className="text-xs text-muted-foreground">
              Standard tools (Crop, Resize, Compress, Format Convert) are 100% free and unlimited. AI features (Super-Resolution Upscale, Product Studio staging, Sky replacement, and Scratch restoration) use 1 to 2 credits per photo.
            </p>
          </div>

          <div className="p-5 rounded-2xl border bg-card space-y-1.5">
            <h5 className="font-semibold text-sm">Do my purchased credits expire?</h5>
            <p className="text-xs text-muted-foreground">
              Credits from one-time top-up packs never expire. Monthly subscription credits roll over as long as your subscription is active.
            </p>
          </div>

          <div className="p-5 rounded-2xl border bg-card space-y-1.5">
            <h5 className="font-semibold text-sm">Can I use the images for commercial e-commerce stores?</h5>
            <p className="text-xs text-muted-foreground">
              Yes! All exports from Pro and Business plans include a perpetual commercial license for Amazon, Shopify, Etsy, print merchandise, and client deliverables.
            </p>
          </div>

          <div className="p-5 rounded-2xl border bg-card space-y-1.5">
            <h5 className="font-semibold text-sm">Can I integrate this with my own apps or e-commerce store via API?</h5>
            <p className="text-xs text-muted-foreground">
              Yes, our Business plan provides personal API keys so you can automate background removal, product staging, or OCR from your own backend or Zapier workflows.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
