import type { Metadata } from "next";

import { SubscribePage } from "./subscribe-page";

export const metadata: Metadata = {
  title: "Secure Checkout — PicTools",
  description: "Review your plan and complete your subscription.",
};

export default async function SubscribeRoute({
  params,
  searchParams,
}: {
  params: Promise<{ plan: string }>;
  searchParams: Promise<{ cycle?: string | string[] }>;
}) {
  const { plan } = await params;
  const raw = await searchParams;
  const cycleParam = Array.isArray(raw.cycle) ? raw.cycle[0] : raw.cycle;
  const cycle = cycleParam === "annual" ? "annual" : "monthly";
  return <SubscribePage plan={plan} initialCycle={cycle} />;
}
