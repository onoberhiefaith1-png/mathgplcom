/** Smart Table graph: column labels, teacher marks, and on-line scoring. No DB schema. */

import { latexToFriendly } from "@/lib/notebook/mathFriendly";

export const POINT_TOLERANCE = 0.1;
/** Reserved table-entries key used to persist a student plot on the board (not a cell). */
export const GRAPH_PLOT_ENTRY_KEY = "__graphPlot";

export type TableGraphConnect = "none" | "line" | "segment" | "curve" | "broken" | "scatter";

export type GraphScore = {
  /** Teacher turned “Add graph” on for this table. */
  enabled: boolean;
  /** Cap on the number of distinct correct coordinates that score. */
  maxCoordinates: number;
  /** Marks awarded for each distinct correct coordinate. */
  marksPerCoordinate: number;
  /** Legacy: cap on the total award. Kept so older table JSON still round-trips. */
  maxPoints?: number;
  /** Legacy: per-row marks. Kept for older saved tables. */
  rowMarks?: number[];
};

export type GraphAxes = { xCol: number; yCol: number };

/** Current table-graph ink on the light theme. Legacy plots without a stored colour use this. */
export const DEFAULT_PLOT_COLOR = "#1F2937";

/** High-contrast palette for student lines (about 8). First entry is the current default ink. */
export const PLOT_COLORS = [
  DEFAULT_PLOT_COLOR,
  "#DC2626",
  "#2563EB",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#DB2777",
  "#0E7490",
] as const;

export type GraphSeries = {
  points: Array<{ x: number; y: number }>;
  connect: TableGraphConnect;
  color: string;
};

export type GraphPlot = {
  xCol: number;
  yCol: number;
  points: Array<{ x: number; y: number }>;
  connect: TableGraphConnect;
  /** Stroke for this line / point series. Omitted on older saves; treated as DEFAULT_PLOT_COLOR. */
  color?: string;
  /** Separate plotted lines. Omitted on older saves; treated as one series from points/connect/color. */
  series?: GraphSeries[];
  earned?: number;
  maxPoints?: number;
  correctCount?: number;
  label?: string;
};

export type PlotDraft = {
  series: GraphSeries[];
  /** When true, the next point starts a new series and must not join the previous line. */
  startNew: boolean;
};

const readPoints = (raw: unknown): Array<{ x: number; y: number }> => {
  const points: Array<{ x: number; y: number }> = [];
  if (!Array.isArray(raw)) return points;
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const x = parseTableNumber((p as { x?: unknown }).x);
    const y = parseTableNumber((p as { y?: unknown }).y);
    if (x != null && y != null) points.push({ x, y });
  }
  return points;
};

export function normalizeGraphSeries(raw: unknown, fallbackColor: string = DEFAULT_PLOT_COLOR): GraphSeries | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const points = readPoints(r.points);
  if (!points.length) return undefined;
  return {
    points,
    connect: normalizeConnect(r.connect),
    color: normalizePlotColor(r.color, fallbackColor),
  };
}

/** Legacy plots become one series. Stored series stay separate and are never merged. */
export function plotSeriesOf(plot: Pick<GraphPlot, "points" | "connect" | "color" | "series">): GraphSeries[] {
  if (plot.series && plot.series.length) {
    return plot.series
      .map((s) => normalizeGraphSeries(s, plot.color))
      .filter((s): s is GraphSeries => !!s);
  }
  if (!plot.points.length) return [];
  return [{
    points: plot.points,
    connect: normalizeConnect(plot.connect),
    color: normalizePlotColor(plot.color),
  }];
}

export function flattenPlotPoints(series: GraphSeries[]): Array<{ x: number; y: number }> {
  return series.flatMap((s) => s.points);
}

/** Points stay in the order they were placed — same as the current single-line behaviour (not sorted by x). */
export function appendPlotPoint(
  draft: PlotDraft,
  point: { x: number; y: number },
  connect: TableGraphConnect,
  color: string,
): PlotDraft {
  const series = draft.series.map((s) => ({ ...s, points: [...s.points] }));
  if (draft.startNew || series.length === 0) {
    series.push({ points: [point], connect: normalizeConnect(connect), color: normalizePlotColor(color) });
    return { series, startNew: false };
  }
  series[series.length - 1].points.push(point);
  return { series, startNew: false };
}

/** Turning plotting off commits the current line; the next point must start a new series. */
export function commitPlotSeries(draft: PlotDraft): PlotDraft {
  return { series: draft.series.filter((s) => s.points.length > 0), startNew: true };
}

export function undoLastPlotPoint(series: GraphSeries[]): GraphSeries[] {
  if (!series.length) return series;
  const next = series.map((s) => ({ ...s, points: [...s.points] }));
  next[next.length - 1].points.pop();
  if (!next[next.length - 1].points.length) next.pop();
  return next;
}

export function nearestSeriesIndex(
  px: number,
  py: number,
  series: Array<{ pix: Array<{ x: number; y: number }>; connect: TableGraphConnect }>,
  threshold = 10,
): number {
  let best = -1, bestD = threshold;
  series.forEach((s, i) => {
    const d = screenDistToSeries(px, py, s.pix, s.connect);
    if (d <= bestD) { bestD = d; best = i; }
  });
  return best;
}

export function scorePlotSeries(input: {
  expected: Array<{ x: number; y: number; row?: number }>;
  series: GraphSeries[];
  score: GraphScore | unknown;
  tolerance?: number;
}): TableGraphScoreResult {
  return scoreTableGraph({
    expected: input.expected,
    plotted: flattenPlotPoints(input.series),
    score: input.score,
    tolerance: input.tolerance,
  });
}

/** Accept #RGB / #RRGGBB (optional hash). Anything else falls back to the current default ink. */
export function normalizePlotColor(raw: unknown, fallback: string = DEFAULT_PLOT_COLOR): string {
  const fb = /^#([0-9a-f]{6})$/i.test(fallback) ? fallback.toUpperCase() : DEFAULT_PLOT_COLOR;
  if (typeof raw !== "string") return fb;
  let s = raw.trim();
  if (!s) return fb;
  if (s[0] !== "#") s = `#${s}`;
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return fb;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return `#${hex.toUpperCase()}`;
}

/** Default charcoal follows the theme ink (so dark mode stays readable). Other palette colours stay as picked. */
export function plotStroke(color: string | undefined, themeInk: string): string {
  const c = normalizePlotColor(color);
  return c === DEFAULT_PLOT_COLOR ? themeInk : c;
}

const distToSeg = (
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number => {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-12) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/** Screen-pixel distance to a plotted series (points, and the stroked path when connected). */
export function screenDistToSeries(
  px: number,
  py: number,
  pix: Array<{ x: number; y: number }>,
  connect: TableGraphConnect,
): number {
  let best = Infinity;
  for (const p of pix) best = Math.min(best, Math.hypot(p.x - px, p.y - py));
  if (pix.length < 2 || connect === "none" || connect === "scatter") return best;
  if (connect === "line") {
    return Math.min(best, distToSeg(px, py, pix[0].x, pix[0].y, pix[pix.length - 1].x, pix[pix.length - 1].y));
  }
  for (let i = 1; i < pix.length; i++) {
    best = Math.min(best, distToSeg(px, py, pix[i - 1].x, pix[i - 1].y, pix[i].x, pix[i].y));
  }
  return best;
}

export type XYPoint = { x: number; y: number; row: number };

const numOr = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const positiveOr = (v: unknown, fallback: number): number => {
  const n = numOr(v, fallback);
  return n > 0 ? n : fallback;
};

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

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ",
  eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ",
  nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
  phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Alpha: "Α", Beta: "Β", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ",
  Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

/**
 * Readable axis/column label from a table heading. Math/LaTeX is converted
 * to plain text so native and custom dropdowns show e.g. "x − μ", not empty
 * or raw "\\mu". Empty headings fall back to "Column N".
 */
export function columnHeadingLabel(raw: unknown, index: number): string {
  const fallback = `Column ${index + 1}`;
  let s = "";
  if (typeof raw === "number" && Number.isFinite(raw)) s = String(raw);
  else if (typeof raw === "string") s = raw;
  else if (raw != null) s = String(raw);
  s = s.trim();
  if (!s || s === "[object Object]") return fallback;
  // If a math tree or wrapper JSON slipped through, try to pull a latex/text field.
  if ((s.startsWith("{") || s.startsWith("[")) && s.length < 4000) {
    try {
      const obj = JSON.parse(s) as unknown;
      const pulled = pullText(obj);
      if (pulled) s = pulled;
    } catch { /* keep raw */ }
  }
  let friendly = "";
  try { friendly = latexToFriendly(s); } catch { friendly = s; }
  friendly = friendly.replace(/\\([A-Za-z]+)\b/g, (_, name: string) => GREEK[name] ?? "");
  friendly = friendly
    .replace(/\\/g, "")
    .replace(/[{}$]/g, "")
    .replace(/[-−–—]/g, "−")
    .replace(/\^2\b/g, "²")
    .replace(/\^3\b/g, "³")
    .replace(/\s+/g, " ")
    .trim();
  return friendly || fallback;
}

const pullText = (v: unknown): string => {
  if (typeof v === "string" && v.trim()) return v;
  if (Array.isArray(v)) {
    for (const item of v) {
      const t = pullText(item);
      if (t) return t;
    }
    return "";
  }
  if (v && typeof v === "object") {
    const r = v as Record<string, unknown>;
    for (const k of ["latex", "text", "value", "label", "src", "content"]) {
      const t = pullText(r[k]);
      if (t) return t;
    }
  }
  return "";
};

export function totalMarks(score: GraphScore): number {
  return Math.max(0, score.maxCoordinates) * Math.max(0, score.marksPerCoordinate);
}

/**
 * Normalize teacher graph marks. New documents use maxCoordinates +
 * marksPerCoordinate. Older tables stored maxPoints + rowMarks; those still
 * load, with marks-per-coordinate taken from the first row mark (or 1) and
 * max coordinates inferred from the old cap.
 */
export function normalizeGraphScore(raw: unknown, _rows?: number): GraphScore {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const hasNew = src.maxCoordinates != null || src.marksPerCoordinate != null;
  const hasLegacy = src.maxPoints != null || Array.isArray(src.rowMarks);
  const enabled = typeof src.enabled === "boolean" ? src.enabled : hasNew || hasLegacy;

  let marksPerCoordinate = numOr(src.marksPerCoordinate, NaN);
  let maxCoordinates = numOr(src.maxCoordinates, NaN);

  const rawMarks = Array.isArray(src.rowMarks)
    ? (src.rowMarks as unknown[]).map((v) => numOr(v, 1)).filter((v) => v >= 0)
    : [];

  if (!Number.isFinite(marksPerCoordinate) || marksPerCoordinate < 0) {
    marksPerCoordinate = rawMarks.length ? Math.max(0, rawMarks[0]) : 1;
  }
  if (!Number.isFinite(maxCoordinates) || maxCoordinates <= 0) {
    const legacyMax = numOr(src.maxPoints, NaN);
    if (Number.isFinite(legacyMax) && legacyMax >= 0 && marksPerCoordinate > 0) {
      maxCoordinates = Math.max(1, Math.round(legacyMax / marksPerCoordinate));
    } else if (rawMarks.length) {
      maxCoordinates = rawMarks.length;
    } else {
      maxCoordinates = 5;
    }
  }

  const maxPoints = totalMarks({
    enabled, maxCoordinates, marksPerCoordinate,
  });
  return {
    enabled,
    maxCoordinates,
    marksPerCoordinate,
    maxPoints,
    rowMarks: rawMarks.length ? rawMarks : undefined,
  };
}

export function normalizeGraphAxes(raw: unknown, cols: number): GraphAxes | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const xCol = Math.floor(numOr(r.xCol, NaN));
  const yCol = Math.floor(numOr(r.yCol, NaN));
  if (!Number.isFinite(xCol) || !Number.isFinite(yCol)) return undefined;
  if (xCol < 0 || yCol < 0 || xCol >= cols || yCol >= cols || xCol === yCol) return undefined;
  return { xCol, yCol };
}

export function normalizeGraphPlot(raw: unknown, cols: number): GraphPlot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const xCol = Math.floor(numOr(r.xCol, NaN));
  const yCol = Math.floor(numOr(r.yCol, NaN));
  if (!Number.isFinite(xCol) || !Number.isFinite(yCol)) return undefined;
  if (xCol < 0 || yCol < 0 || xCol >= cols || yCol >= cols) return undefined;
  const color = normalizePlotColor(r.color);
  const parsed: GraphSeries[] = [];
  if (Array.isArray(r.series)) {
    for (const item of r.series) {
      const s = normalizeGraphSeries(item, color);
      if (s) parsed.push(s);
    }
  }
  const legacyPoints = readPoints(r.points);
  const connect = normalizeConnect(r.connect);
  const series = parsed.length
    ? parsed
    : (legacyPoints.length ? [{ points: legacyPoints, connect, color }] : []);
  // Top-level points stay the flattened list so older readers still see every click.
  const points = flattenPlotPoints(series);
  const earned = numOr(r.earned, NaN);
  const maxPoints = numOr(r.maxPoints, NaN);
  const correctCount = numOr(r.correctCount, NaN);
  const label = typeof r.label === "string" ? r.label : undefined;
  return {
    xCol, yCol, points,
    connect: series[0]?.connect ?? connect,
    color: series[0]?.color ?? color,
    series,
    earned: Number.isFinite(earned) ? earned : undefined,
    maxPoints: Number.isFinite(maxPoints) ? maxPoints : undefined,
    correctCount: Number.isFinite(correctCount) ? correctCount : undefined,
    label,
  };
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

const hypot = (x: number, y: number) => Math.hypot(x, y);

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  hypot(a.x - b.x, a.y - b.y);

/** Distance from p to the infinite line through a and b. */
export function distanceToLine(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = hypot(dx, dy);
  if (len < 1e-12) return dist(p, a);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

/** Distance from p to the segment a–b. */
export function distanceToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-24) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance from p to the ray starting at origin and passing through through. */
export function distanceToRay(
  p: { x: number; y: number },
  origin: { x: number; y: number },
  through: { x: number; y: number },
): number {
  const dx = through.x - origin.x, dy = through.y - origin.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-24) return dist(p, origin);
  const t = ((p.x - origin.x) * dx + (p.y - origin.y) * dy) / len2;
  if (t <= 0) return dist(p, origin);
  return hypot(p.x - (origin.x + t * dx), p.y - (origin.y + t * dy));
}

/** True when every point lies on one straight line (tight geometric test). */
export function pointsAreLinear(
  points: Array<{ x: number; y: number }>,
  eps = 1e-6,
): boolean {
  if (points.length <= 2) return true;
  let a = points[0], b: { x: number; y: number } | null = null;
  for (let i = 1; i < points.length; i++) {
    if (dist(points[i], a) > eps) { b = points[i]; break; }
  }
  if (!b) return true;
  for (const p of points) {
    if (distanceToLine(p, a, b) > eps) return false;
  }
  return true;
}

/**
 * Distance from a plotted point to the answer graph: an infinite straight
 * line when the table data is linear, otherwise the piecewise-linear path
 * through the points (sorted on the wider axis) with the end segments
 * extended as infinite rays.
 */
export function distanceToAnswerGraph(
  p: { x: number; y: number },
  expected: Array<{ x: number; y: number }>,
): number {
  if (!expected.length) return Number.POSITIVE_INFINITY;
  if (expected.length === 1) return dist(p, expected[0]);
  if (pointsAreLinear(expected)) {
    let a = expected[0], b = expected[1];
    for (let i = 1; i < expected.length; i++) {
      if (dist(expected[0], expected[i]) > 1e-12) { b = expected[i]; break; }
    }
    return distanceToLine(p, a, b);
  }
  const xs = expected.map((q) => q.x), ys = expected.map((q) => q.y);
  const byX = (Math.max(...xs) - Math.min(...xs)) >= (Math.max(...ys) - Math.min(...ys));
  const sorted = [...expected].sort((a, b) => (byX ? a.x - b.x : a.y - b.y) || (byX ? a.y - b.y : a.x - b.x));
  // Dedup coincident neighbours so rays have a direction.
  const pts = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (dist(sorted[i], pts[pts.length - 1]) > 1e-12) pts.push(sorted[i]);
  }
  if (pts.length === 1) return dist(p, pts[0]);
  let best = distanceToRay(p, pts[0], { x: pts[0].x - (pts[1].x - pts[0].x), y: pts[0].y - (pts[1].y - pts[0].y) });
  for (let i = 0; i < pts.length - 1; i++) {
    best = Math.min(best, distanceToSegment(p, pts[i], pts[i + 1]));
  }
  const last = pts[pts.length - 1], prev = pts[pts.length - 2];
  best = Math.min(best, distanceToRay(p, last, { x: last.x + (last.x - prev.x), y: last.y + (last.y - prev.y) }));
  return best;
}

export function isOnAnswerGraph(
  p: { x: number; y: number },
  expected: Array<{ x: number; y: number }>,
  tolerance = POINT_TOLERANCE,
): boolean {
  return distanceToAnswerGraph(p, expected) <= tolerance;
}

export type TableGraphScoreResult = {
  earned: number;
  maxPoints: number;
  correctCount: number;
  uncapped: number;
  perPoint: Array<{ x: number; y: number; correct: boolean; duplicate: boolean; awarded: number; distance: number }>;
  label: string;
};

/**
 * Score plotted coordinates against the infinite answer graph through the
 * selected table columns. Each distinct correct click earns marksPerCoordinate,
 * capped at maxCoordinates (max score = maxCoordinates × marksPerCoordinate).
 * Near-duplicate clicks do not score twice. Extra correct clicks past the cap
 * are noted as correct but award 0.
 */
export function scoreTableGraph(input: {
  expected: Array<{ x: number; y: number; row?: number }>;
  plotted: Array<{ x: number; y: number }>;
  score: GraphScore | unknown;
  tolerance?: number;
}): TableGraphScoreResult {
  const score = normalizeGraphScore(input.score);
  const tolerance = input.tolerance ?? POINT_TOLERANCE;
  const expected = input.expected.map((p) => ({ x: p.x, y: p.y }));
  const maxPoints = score.enabled ? totalMarks(score) : 0;
  let correctCount = 0;
  const counted: Array<{ x: number; y: number }> = [];
  const perPoint = input.plotted.map((p) => {
    const distance = distanceToAnswerGraph(p, expected);
    const onLine = Number.isFinite(distance) && distance <= tolerance;
    const duplicate = onLine && counted.some((c) => dist(c, p) <= tolerance);
    const correct = onLine && !duplicate;
    let awarded = 0;
    if (correct) {
      if (score.enabled && correctCount < score.maxCoordinates) awarded = score.marksPerCoordinate;
      correctCount += 1;
      counted.push(p);
    }
    return { x: p.x, y: p.y, correct, duplicate, awarded, distance };
  });
  const uncapped = score.enabled ? correctCount * score.marksPerCoordinate : 0;
  const scored = score.enabled ? Math.min(correctCount, score.maxCoordinates) : 0;
  const earned = score.enabled ? scored * score.marksPerCoordinate : 0;
  return {
    earned,
    maxPoints,
    correctCount: scored,
    uncapped,
    perPoint,
    label: `${earned} / ${maxPoints}`,
  };
}

export { positiveOr };
