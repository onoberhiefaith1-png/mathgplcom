// Report display settings — presentation only, persisted per browser.
// These never touch the underlying report data.

import { useCallback, useEffect, useState } from "react";

export type ReportBackground = "white" | "dark";
export type ReportFilter = "both" | "assignment" | "adventure" | "game";
export type TrendGrouping = "week" | "month" | "year";

/** Trend Report colours — these affect the trend chart only. */
export interface TrendColors {
  activity: string;
  inactive: string;
  fill: string;
  grid: string;
}

export interface ReportSettings {
  background: ReportBackground;
  gridLines: boolean;
  animations: boolean;
  barLabels: boolean;
  showTrend: boolean;
  trendGrouping: TrendGrouping;
  trend: TrendColors;
}

export const DEFAULT_TREND_COLORS: TrendColors = {
  activity: "#2563eb", // blue
  inactive: "#dc2626", // red
  fill: "#60a5fa", // light blue
  grid: "#d4d9e2", // light grey
};

/** Curated, professional swatches offered in Report Settings. */
export const TREND_SWATCHES: Record<keyof TrendColors, string[]> = {
  activity: ["#2563eb", "#0ea5e9", "#0d9488", "#7c3aed", "#111827", "#059669"],
  inactive: ["#dc2626", "#f97316", "#a855f7", "#64748b", "#b91c1c", "#eab308"],
  fill: ["#60a5fa", "#38bdf8", "#5eead4", "#c4b5fd", "#94a3b8", "#6ee7b7"],
  grid: ["#d4d9e2", "#e5e7eb", "#cbd5e1", "#94a3b8", "#f1f5f9", "#a5b4fc"],
};

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  background: "white",
  gridLines: true,
  animations: true,
  barLabels: true,
  showTrend: true,
  trendGrouping: "week",
  trend: DEFAULT_TREND_COLORS,
};


const KEY = "mathgpl.report.settings.v1";

const read = (): ReportSettings => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_REPORT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ReportSettings>;
    return {
      ...DEFAULT_REPORT_SETTINGS,
      ...parsed,
      trend: { ...DEFAULT_TREND_COLORS, ...(parsed.trend ?? {}) },
    };
  } catch {
    return DEFAULT_REPORT_SETTINGS;
  }
};

export function useReportSettings() {
  const [settings, setSettings] = useState<ReportSettings>(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable — settings stay in memory */
    }
  }, [settings]);

  const update = useCallback(<K extends keyof ReportSettings>(key: K, value: ReportSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);

  const updateTrendColor = useCallback((key: keyof TrendColors, value: string) => {
    setSettings((s) => ({ ...s, trend: { ...s.trend, [key]: value } }));
  }, []);

  return { settings, update, updateTrendColor };
}


/** Wrapper class for the report surface — scopes the report palette. */
export const reportSurfaceClass = (s: ReportSettings) =>
  `report-surface${s.background === "dark" ? " report-dark" : ""}`;
