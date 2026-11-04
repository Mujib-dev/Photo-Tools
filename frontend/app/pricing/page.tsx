import type { Metadata } from "next";
import { PricingPage } from "./pricing-page";

export const metadata: Metadata = {
  title: "Pricing & Plans — AI Photo Tools Pro",
  description:
    "Simple, transparent pricing for creators, e-commerce stores, and real estate professionals. Upgrade to Pro for high-resolution exports and commercial staging.",
};

export default function PricingRoute() {
  return <PricingPage />;
}
