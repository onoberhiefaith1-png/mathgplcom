/**
 * The six billable resource categories. Nothing else belongs in the Cost Unit
 * — Security, SEO, connectors and agent analytics are deliberately excluded.
 */
export const COST_CATEGORIES = [
  "database",
  "network",
  "storage",
  "compute",
  "realtime",
  "ai",
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<CostCategory, string> = {
  database: "Database",
  network: "Network",
  storage: "Storage",
  compute: "Compute",
  realtime: "Realtime",
  ai: "AI",
};

export const CATEGORY_COLOR: Record<CostCategory, string> = {
  database: "#60a5fa",
  network: "#34d399",
  storage: "#f59e0b",
  compute: "#a78bfa",
  realtime: "#f472b6",
  ai: "#fbbf24",
};

/** Metric ids that map 1:1 onto rows of the admin price book. */
export const METRICS = {
  aiInputTokens: "ai.input_tokens",
  aiOutputTokens: "ai.output_tokens",
  aiImages: "ai.images",
  aiAudioMinutes: "ai.audio_minutes",
  computeInvocations: "compute.invocations",
  computeGbSeconds: "compute.gb_seconds",
  storageGbMonth: "storage.gb_month",
  networkEgressGb: "network.egress_gb",
  realtimeMinutes: "realtime.minutes",
  realtimeMessages: "realtime.messages",
  databaseRows: "database.rows_written",
  databaseGbMonth: "database.gb_month",
} as const;

export type MetricId = (typeof METRICS)[keyof typeof METRICS];

export const METRIC_CATEGORY: Record<MetricId, CostCategory> = {
  "ai.input_tokens": "ai",
  "ai.output_tokens": "ai",
  "ai.images": "ai",
  "ai.audio_minutes": "ai",
  "compute.invocations": "compute",
  "compute.gb_seconds": "compute",
  "storage.gb_month": "storage",
  "network.egress_gb": "network",
  "realtime.minutes": "realtime",
  "realtime.messages": "realtime",
  "database.rows_written": "database",
  "database.gb_month": "database",
};

export const RANGES = [
  { key: "24h", label: "Last 24 hours", days: 1 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "custom", label: "Custom period", days: 0 },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

export const money = (value: number, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value ?? 0);

/**
 * Credits are the platform's accounting unit; money is only ever the secondary
 * equivalent. Small values keep enough precision to stay honest (0.0018).
 */
export const credits = (value: number, withUnit = true) => {
  const v = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(v);
  const digits = abs === 0 ? 2 : abs < 0.01 ? 4 : 2;
  const text = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
  return withUnit ? `${text} credits` : text;
};

