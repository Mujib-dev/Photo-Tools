/**
 * Quick Chart & Infographic Studio Engine
 *
 * Provides:
 * 1. Data parsing from CSV or JSON
 * 2. Preloaded business, analytics, and social dataset templates
 * 3. Color palette schemes
 */

export type ChartType = "bar" | "line" | "area" | "donut";

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartTheme {
  id: string;
  name: string;
  colors: string[];
}

export const CHART_THEMES: Record<string, ChartTheme> = {
  emerald: {
    id: "emerald",
    name: "Emerald Growth",
    colors: ["#10b981", "#34d399", "#6ee7b7", "#059669"],
  },
  indigo: {
    id: "indigo",
    name: "Tech Indigo",
    colors: ["#6366f1", "#818cf8", "#a5b4fc", "#4f46e5"],
  },
  sunset: {
    id: "sunset",
    name: "Sunset Vibrant",
    colors: ["#f97316", "#fb923c", "#fdba74", "#ea580c"],
  },
  cyber: {
    id: "cyber",
    name: "Cyber Violet & Cyan",
    colors: ["#8b5cf6", "#06b6d4", "#ec4899", "#3b82f6"],
  },
  monochrome: {
    id: "monochrome",
    name: "Minimalist Slate",
    colors: ["#f8fafc", "#94a3b8", "#64748b", "#334155"],
  },
  crimson: {
    id: "crimson",
    name: "Crimson Velocity",
    colors: ["#f43f5e", "#fb7185", "#fda4af", "#e11d48"],
  },
  gold: {
    id: "gold",
    name: "Premium Gold",
    colors: ["#eab308", "#facc15", "#fde047", "#ca8a04"],
  },
};

export interface ChartTemplate {
  id: string;
  name: string;
  badge: string;
  chartType: ChartType;
  title: string;
  subtitle: string;
  themeId: string;
  dataPoints: ChartDataPoint[];
}

export const CHART_TEMPLATES: ChartTemplate[] = [
  {
    id: "revenue",
    name: "Quarterly ARR Revenue",
    badge: "Financial",
    chartType: "bar",
    title: "Quarterly ARR Revenue Growth",
    subtitle: "All figures in USD ($)",
    themeId: "emerald",
    dataPoints: [
      { label: "Q1", value: 45000 },
      { label: "Q2", value: 68000 },
      { label: "Q3", value: 92000 },
      { label: "Q4", value: 145000 },
    ],
  },
  {
    id: "traffic",
    name: "Organic Web Visitors",
    badge: "Traffic",
    chartType: "area",
    title: "Monthly Organic Unique Visitors",
    subtitle: "Google Search Console & Direct",
    themeId: "indigo",
    dataPoints: [
      { label: "Jan", value: 12000 },
      { label: "Feb", value: 18500 },
      { label: "Mar", value: 29000 },
      { label: "Apr", value: 42000 },
      { label: "May", value: 68000 },
      { label: "Jun", value: 94000 },
    ],
  },
  {
    id: "channels",
    name: "Customer Acquisition",
    badge: "Marketing",
    chartType: "donut",
    title: "Customer Acquisition Channels",
    subtitle: "Percentage of Total Paying Signups (%)",
    themeId: "cyber",
    dataPoints: [
      { label: "Organic Search", value: 38 },
      { label: "YouTube Content", value: 26 },
      { label: "Word of Mouth", value: 22 },
      { label: "Paid Ads", value: 14 },
    ],
  },
  {
    id: "benchmark",
    name: "AI Latency Benchmark",
    badge: "Tech",
    chartType: "bar",
    title: "Model Inference Latency (ms)",
    subtitle: "Lower is better • P95 latency in milliseconds",
    themeId: "crimson",
    dataPoints: [
      { label: "Flash Lite", value: 120 },
      { label: "Claude 3.5", value: 280 },
      { label: "GPT-4o", value: 340 },
      { label: "Llama 3 70B", value: 410 },
    ],
  },
  {
    id: "fundraise",
    name: "Capital Runway Allocation",
    badge: "Startup",
    chartType: "donut",
    title: "18-Month Capital Runway Allocation",
    subtitle: "Seed round budget breakdown (%)",
    themeId: "gold",
    dataPoints: [
      { label: "Core Engineering", value: 55 },
      { label: "Cloud GPU Infrastructure", value: 25 },
      { label: "Marketing & Growth", value: 12 },
      { label: "Operations & Legal", value: 8 },
    ],
  },
  {
    id: "retention",
    name: "Cohort Retention Curve",
    badge: "Product",
    chartType: "line",
    title: "Day 30 User Retention Curve (%)",
    subtitle: "Benchmark against industry average",
    themeId: "monochrome",
    dataPoints: [
      { label: "Day 1", value: 84 },
      { label: "Day 7", value: 62 },
      { label: "Day 14", value: 51 },
      { label: "Day 21", value: 46 },
      { label: "Day 30", value: 43 },
    ],
  },
];

export const SAMPLE_CHART_DATA: Record<string, ChartDataPoint[]> = {
  revenue: [
    { label: "Q1", value: 45000 },
    { label: "Q2", value: 68000 },
    { label: "Q3", value: 92000 },
    { label: "Q4", value: 145000 },
  ],
  traffic: [
    { label: "Jan", value: 12000 },
    { label: "Feb", value: 18500 },
    { label: "Mar", value: 29000 },
    { label: "Apr", value: 42000 },
    { label: "May", value: 68000 },
  ],
  channels: [
    { label: "Direct", value: 40 },
    { label: "Organic Search", value: 30 },
    { label: "Social Media", value: 20 },
    { label: "Referral", value: 10 },
  ],
};

/**
 * Parses raw text or CSV (e.g. "Label, Value") into ChartDataPoint[]
 */
export function parseChartCsv(csvText: string): ChartDataPoint[] {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  const data: ChartDataPoint[] = [];

  for (const line of lines) {
    const parts = line.split(/[,\t]/).map((p) => p.trim());
    if (parts.length >= 2) {
      const val = parseFloat(parts[1].replace(/[^0-9.-]/g, ""));
      if (!isNaN(val)) {
        data.push({ label: parts[0], value: val });
      }
    }
  }

  return data;
}
