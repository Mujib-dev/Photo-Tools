import type { MetadataRoute } from "next";

import { TOOLS } from "@/lib/tools";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pictools.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const toolEntries: MetadataRoute.Sitemap = TOOLS.map((tool) => ({
    url: `${BASE_URL}${tool.href}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: tool.href === "/resize" ? 1 : 0.8,
  }));

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/docs`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  return [...staticEntries, ...toolEntries];
}
