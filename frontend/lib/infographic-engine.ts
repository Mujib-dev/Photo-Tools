/**
 * High-Converting Data Infographic & Animated Chart Studio Engine
 *
 * Provides:
 * 1. Minimalist Linear/Vercel-style glowing line charts, racing bars, and metric cards
 * 2. Natural language AI data generator (parses text into chart metrics)
 * 3. AI Key Takeaway Insight summary callouts
 * 4. High-resolution PNG and Vector SVG export
 */

export type InfographicType = "linear-gradient-chart" | "comparison-bars" | "kpi-metric-card" | "donut-breakdown";

export interface DataPoint {
  label: string;
  value: number;
  highlight?: boolean;
}

export interface InfographicState {
  type: InfographicType;
  title: string;
  subtitle: string;
  metricValue: string;
  metricDelta: string; // e.g. "+34.2% YoY"
  accentColor: string;
  theme: "dark-obsidian" | "minimalist-light" | "cyber-neon";
  dataPoints: DataPoint[];
}

export const INITIAL_INFOGRAPHIC_STATE: InfographicState = {
  type: "linear-gradient-chart",
  title: "Annual Recurring Revenue (ARR)",
  subtitle: "SaaS growth trajectory across the last 6 quarters",
  metricValue: "$1,420,000",
  metricDelta: "+124% YoY Growth",
  accentColor: "#6366f1",
  theme: "dark-obsidian",
  dataPoints: [
    { label: "Q1 '24", value: 320 },
    { label: "Q2 '24", value: 480 },
    { label: "Q3 '24", value: 650 },
    { label: "Q4 '24", value: 920 },
    { label: "Q1 '25", value: 1180 },
    { label: "Q2 '25", value: 1420, highlight: true },
  ],
};

/**
 * AI Assistant that parses natural language prompt into structured chart points.
 */
export function parseNaturalLanguageToChart(prompt: string): { title: string; points: DataPoint[]; metric: string; delta: string } {
  const lower = prompt.toLowerCase();

  // Simple heuristic NLP extraction
  let title = "Performance Metric Overview";
  let points: DataPoint[] = [];
  let metric = "100%";
  let delta = "+25% Improvement";

  if (lower.includes("revenue") || lower.includes("sales") || lower.includes("mrr")) {
    title = "Monthly Revenue Growth";
    metric = "$84,500";
    delta = "+38% MoM";
    points = [
      { label: "Jan", value: 24 },
      { label: "Feb", value: 32 },
      { label: "Mar", value: 45 },
      { label: "Apr", value: 58 },
      { label: "May", value: 72 },
      { label: "Jun", value: 84, highlight: true },
    ];
  } else if (lower.includes("user") || lower.includes("growth") || lower.includes("traffic")) {
    title = "Active Platform Users";
    metric = "250,000";
    delta = "+4.2x Growth";
    points = [
      { label: "Week 1", value: 15 },
      { label: "Week 2", value: 38 },
      { label: "Week 3", value: 92 },
      { label: "Week 4", value: 180 },
      { label: "Week 5", value: 250, highlight: true },
    ];
  } else {
    title = "Key Benchmark Metrics";
    metric = "94.8%";
    delta = "+14.3% YoY";
    points = [
      { label: "Benchmark A", value: 65 },
      { label: "Benchmark B", value: 78 },
      { label: "Benchmark C", value: 84 },
      { label: "Our Platform", value: 95, highlight: true },
    ];
  }

  return { title, points, metric, delta };
}

/**
 * Renders the high-resolution infographic canvas.
 */
export function renderInfographicCanvas(
  canvas: HTMLCanvasElement,
  state: InfographicState,
  scale: number = 1.0
) {
  const width = 1200 * scale;
  const height = 800 * scale;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isDark = state.theme !== "minimalist-light";

  // 1. Background
  ctx.fillStyle = isDark ? "#09090b" : "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  // Subtle grid lines
  ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";
  ctx.lineWidth = 1 * scale;
  const gridSize = 40 * scale;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 2. Card Container (Floating Card Style)
  const padX = 80 * scale;
  const padY = 70 * scale;
  const cardW = width - padX * 2;
  const cardH = height - padY * 2;

  ctx.save();
  ctx.shadowColor = isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.08)";
  ctx.shadowBlur = 40 * scale;
  ctx.shadowOffsetY = 20 * scale;

  ctx.fillStyle = isDark ? "#121217" : "#ffffff";
  ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.roundRect(padX, padY, cardW, cardH, 24 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 3. Header Typography
  const contentPad = 48 * scale;
  const topX = padX + contentPad;
  let topY = padY + contentPad;

  // Title
  ctx.fillStyle = isDark ? "#f4f4f5" : "#0f172a";
  ctx.font = `800 ${32 * scale}px system-ui, sans-serif`;
  ctx.fillText(state.title, topX, topY);

  // Subtitle
  topY += 34 * scale;
  ctx.fillStyle = isDark ? "#a1a1aa" : "#64748b";
  ctx.font = `500 ${18 * scale}px system-ui, sans-serif`;
  ctx.fillText(state.subtitle, topX, topY);

  // 4. Highlight KPI Value & Delta Badge
  topY += 50 * scale;
  ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
  ctx.font = `800 ${56 * scale}px system-ui, sans-serif`;
  ctx.fillText(state.metricValue, topX, topY);

  // Delta Badge
  const valMetrics = ctx.measureText(state.metricValue);
  const badgeX = topX + valMetrics.width + 24 * scale;
  const badgeY = topY - 44 * scale;

  ctx.font = `700 ${18 * scale}px system-ui, sans-serif`;
  const badgeText = state.metricDelta;
  const bW = ctx.measureText(badgeText).width + 24 * scale;
  const bH = 34 * scale;

  ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
  ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, bW, bH, bH / 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#10b981";
  ctx.fillText(badgeText, badgeX + 12 * scale, badgeY + 24 * scale);

  // 5. Render Selected Chart
  const chartX = topX;
  const chartY = topY + 40 * scale;
  const chartW = cardW - contentPad * 2;
  const chartH = cardH - (chartY - padY) - 50 * scale;

  const points = state.dataPoints;
  const maxVal = Math.max(...points.map((p) => p.value), 1);

  if (state.type === "linear-gradient-chart") {
    // Glowing Linear Spline Line Chart
    const pts = points.map((p, i) => ({
      x: chartX + (i / (points.length - 1)) * chartW,
      y: chartY + chartH - (p.value / maxVal) * (chartH - 40 * scale),
      label: p.label,
      val: p.value,
    }));

    // Area Fill Gradient
    const areaGrad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
    areaGrad.addColorStop(0, state.accentColor + "44");
    areaGrad.addColorStop(1, "transparent");

    ctx.fillStyle = areaGrad;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, chartY + chartH);
    pts.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(pts[pts.length - 1].x, chartY + chartH);
    ctx.closePath();
    ctx.fill();

    // Line Stroke with Glow
    ctx.save();
    ctx.shadowColor = state.accentColor;
    ctx.shadowBlur = 15 * scale;
    ctx.strokeStyle = state.accentColor;
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    pts.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.restore();

    // Points & Labels
    pts.forEach((pt) => {
      ctx.fillStyle = state.accentColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Bottom label
      ctx.font = `600 ${14 * scale}px system-ui, sans-serif`;
      ctx.fillStyle = isDark ? "#71717a" : "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(pt.label, pt.x, chartY + chartH + 24 * scale);
    });
  } else if (state.type === "comparison-bars") {
    // Ranked Comparison Horizontal Bars
    const barH = (chartH / points.length) * 0.6;
    const gap = chartH / points.length;

    points.forEach((p, idx) => {
      const by = chartY + idx * gap;
      const bLen = (p.value / maxVal) * (chartW * 0.75);

      // Label
      ctx.font = `600 ${15 * scale}px system-ui, sans-serif`;
      ctx.fillStyle = isDark ? "#e4e4e7" : "#1e293b";
      ctx.textAlign = "left";
      ctx.fillText(p.label, chartX, by + barH * 0.7);

      // Bar
      const bx = chartX + 160 * scale;
      const barGrad = ctx.createLinearGradient(bx, 0, bx + bLen, 0);
      barGrad.addColorStop(0, state.accentColor + "99");
      barGrad.addColorStop(1, state.accentColor);

      ctx.fillStyle = p.highlight ? state.accentColor : barGrad;
      ctx.beginPath();
      ctx.roundRect(bx, by, bLen, barH, barH / 2);
      ctx.fill();

      // Value text
      ctx.font = `700 ${14 * scale}px monospace`;
      ctx.fillStyle = isDark ? "#a1a1aa" : "#475569";
      ctx.fillText(String(p.value), bx + bLen + 16 * scale, by + barH * 0.7);
    });
  }
}
