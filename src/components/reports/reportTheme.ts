// Report display settings — presentation only, persisted per browser.
// These never touch the underlying report data.

import { useCallback, useEffect, useState } from "react";

export type ReportBackground = "white" | "dark";
export type ReportFilter = "both" | "assignment" | "adventure";

export interface ReportSettings {
  background: ReportBackground;
  gridLines: boolean;
  animations: boolean;
  barLabels: boolean;
}

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  background: "white",
  gridLines: true,
  animations: true,
  barLabels: true,
};

const KEY = "mathgpl.report.settings.v1";

const read = (): ReportSettings => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_REPORT_SETTINGS;
    return { ...DEFAULT_REPORT_SETTINGS, ...(JSON.parse(raw) as Partial<ReportSettings>) };
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

  return { settings, update };
}

/** Wrapper class for the report surface — scopes the report palette. */
export const reportSurfaceClass = (s: ReportSettings) =>
  `report-surface${s.background === "dark" ? " report-dark" : ""}`;
