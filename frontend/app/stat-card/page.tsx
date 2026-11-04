import type { Metadata } from "next";
import { StatCardTool } from "./stat-card-tool";

export const metadata: Metadata = {
  title: "Social Quote & Stat Card Maker — PicTools",
  description:
    "Turn quotes, metrics, testimonials, and insights into high-engagement social media cards formatted for LinkedIn, Twitter, and Instagram 100% in-browser.",
};

export default function StatCardPage() {
  return <StatCardTool />;
}
