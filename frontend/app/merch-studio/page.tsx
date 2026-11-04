import type { Metadata } from "next";
import { MerchStudioTool } from "./merch-studio-tool";

export const metadata: Metadata = {
  title: "Print-on-Demand & Merch Mockup Studio — PicTools",
  description:
    "Generate realistic apparel mockups (T-shirts, hoodies, totes, mugs, caps) with fabric fold displacement, custom textile colors, and AI E-Commerce listing generator for Etsy & Shopify.",
};

export default function MerchStudioPage() {
  return <MerchStudioTool />;
}
