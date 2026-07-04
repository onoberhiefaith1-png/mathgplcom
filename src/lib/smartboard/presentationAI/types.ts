// Presentation AI — shared types.
// The AI treats the Presenter Preview model (buildBeats + buildReservoirs)
// as the source of truth and reports mismatches as typed Issues.

export type IssueKind =
  | "note-missing"
  | "floating-missing"
  | "filler-missing"
  | "line-mismatch"
  | "sequence-mismatch"
  | "highlight-wrong"
  | "scroll-out-of-view"
  | "beat-cursor-drift"
  | "line-cursor-drift"
  | "section-missing"
  | "rendering-broken"
  | "structural";

export interface Issue {
  id: string;
  kind: IssueKind;
  section: string;      // beat caption or id
  beatId: string;
  lineIdx: number | null;
  /** Optional filler index within the line (for filler-missing). */
  fillerIdx?: number | null;
  summary: string;
  expected: string;
  actual: string;
  probableCause: string;
  suggestedFix: string;
  repairable: boolean;
  createdAt: number;
}

export type SpeedPreset = "fast" | "standard" | "slow" | "detailed";

export const SPEED_MS: Record<SpeedPreset, number> = {
  fast: 10_000,
  standard: 30_000,
  slow: 60_000,
  detailed: 120_000,
};

export const SPEED_LABEL: Record<SpeedPreset, string> = {
  fast: "Fast Review · 10s/line",
  standard: "Standard · 30s/line",
  slow: "Slow Teaching · 60s/line",
  detailed: "Detailed · 120s/line",
};

export type AIState =
  | "idle"
  | "presenting"
  | "paused"
  | "repairing"
  | "reporting";

export interface StepStat {
  beats: number;
  lines: number;
  floating: number;
  notes: number;
  repairs: number;
}

export interface FinalReport {
  status: "PASS" | "FAIL";
  stats: StepStat;
  unresolved: Issue[];
  startedAt: number;
  finishedAt: number;
}
