/** Smart Table graph: column pairs, teacher marks, and scoring. No DB schema. */

import { checkGraph, POINT_TOLERANCE } from "@/lib/graphActivity/grade";
import type { ConnectStyle as GradeConnect, GradeResult } from "@/lib/graphActivity/grade";

export type TableGraphConnect = "none" | "line" | "segment" | "curve" | "broken" | "scatter";

export type GraphScore = {
  /** Cap on the total award. */
  maxPoints: number;
  /** Marks for each table data row (same index as `cells[row]`). */
  rowMarks: number[];
};

export type GraphPlot = {
  xCol: number;
  yCol: number;
  points: Array<{ x: number; y: number }>;
  connect: TableGraphConnect;
};

export type XYPoint = { x: number; y: number; row: number };

const numOr = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Parse a table cell into a finite number (unicode minus, commas, =prefix, $…$). */
export function parseTableNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  if (s.startsWith("=")) s = s.slice(1).trim();
  s = s.replace(/[−–—]/g, "-").replace(/,/g, "").replace(/\$/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Keep teacher marks with the table JSON. Missing marks default to 1 per row;
 * a missing max defaults to the sum of the row marks.
 */
export function normalizeGraphScore(raw: unknown, rows: number): GraphScore {
  const n = Math.max(0, Math.floor(Number.isFinite(Number(rows)) ? Number(rows) : 0));
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawMarks = Array.isArray(src.rowMarks) ? src.rowMarks : [];
  const rowMarks = Array.from({ length: n }, (_, i) => {
    const v = numOr(rawMarks[i], 1);
    return v < 0 ? 0 : v;
  });
  const defaultMax = rowMarks.reduce((a, b) => a + b, 0);
  const maxRaw = numOr(src.maxPoints, defaultMax);
  return { maxPoints: maxRaw < 0 ? 0 : maxRaw, rowMarks };
}

export function normalizeGraphPlot(raw: unknown, cols: number): GraphPlot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const xCol = Math.floor(numOr(r.xCol, NaN));
  const yCol = Math.floor(numOr(r.yCol, NaN));
  if (!Number.isFinite(xCol) || !Number.isFinite(yCol)) return undefined;
  if (xCol < 0 || yCol < 0 || xCol >= cols || yCol >= cols) return undefined;
  const points: Array<{ x: number; y: number }> = [];
  if (Array.isArray(r.points)) {
    for (const p of r.points) {
      if (!p || typeof p !== "object") continue;
      const x = parseTableNumber((p as { x?: unknown }).x);
      const y = parseTableNumber((p as { y?: unknown }).y);
      if (x != null && y != null) points.push({ x, y });
    }
  }
  const connect = normalizeConnect(r.connect);
  return { xCol, yCol, points, connect };
}

export function normalizeConnect(v: unknown): TableGraphConnect {
  return v === "none" || v === "line" || v === "segment" || v === "curve" || v === "broken" || v === "scatter"
    ? v
    : "none";
}

/** Pull (x, y) pairs from two columns. Rows missing either value are skipped. */
export function extractXY(
  cells: string[][],
  xCol: number,
  yCol: number,
  parse: (raw: unknown) => number | null = parseTableNumber,
): XYPoint[] {
  const out: XYPoint[] = [];
  if (!Array.isArray(cells)) return out;
  for (let row = 0; row < cells.length; row++) {
    const r = cells[row] ?? [];
    const x = parse(r[xCol]);
    const y = parse(r[yCol]);
    if (x != null && y != null) out.push({ x, y, row });
  }
  return out;
}

export type TableGraphScoreResult = {
  grade: GradeResult;
  earned: number;
  maxPoints: number;
  uncapped: number;
  perPoint: Array<{ row: number; mark: number; correct: boolean; awarded: number }>;
  label: string;
};

/**
 * Score plotted points against the table. Each correct point (world-unit
 * tolerance 0.1) earns its teacher-set mark. The total is capped at maxPoints.
 * Swapped-axis plots are not marked correct.
 */
export function scoreTableGraph(input: {
  expected: Array<{ x: number; y: number; row?: number }>;
  plotted: Array<{ x: number; y: number }>;
  score: GraphScore;
  connect?: GradeConnect;
}): TableGraphScoreResult {
  const table = input.expected.map((p) => ({ x: p.x, y: p.y }));
  const grade = checkGraph({
    table,
    plotted: input.plotted,
    connect: input.connect ?? "scatter",
    tolerance: POINT_TOLERANCE,
  });
  const perPoint = grade.points.map((p, i) => {
    const row = input.expected[i]?.row ?? i;
    const mark = numOr(input.score.rowMarks[row], 1);
    const correct = p.status === "correct";
    return { row, mark, correct, awarded: correct ? mark : 0 };
  });
  const uncapped = perPoint.reduce((a, p) => a + p.awarded, 0);
  const maxPoints = input.score.maxPoints < 0 ? 0 : input.score.maxPoints;
  const earned = Math.min(maxPoints, uncapped);
  return {
    grade,
    earned,
    maxPoints,
    uncapped,
    perPoint,
    label: `${earned} / ${maxPoints}`,
  };
}
