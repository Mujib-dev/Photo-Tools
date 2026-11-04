import type { Metadata } from "next";
import { EcommerceBatchTool } from "./ecommerce-batch-tool";

export const metadata: Metadata = {
  title: "Bulk E-Commerce Catalog Processor — PicTools",
  description:
    "Format dozens of product photos in 1 click for Amazon, Shopify, and Etsy: pure white background compliance, 85% fill rule, soft floor shadows, and 1-click ZIP export.",
};

export default function EcommerceBatchPage() {
  return <EcommerceBatchTool />;
}
