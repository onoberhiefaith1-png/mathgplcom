import type { GraphTablePoint } from "./table";

/** World-unit tolerance for a plotted point to count as matching a table value. Zoom must not change this. */
export const POINT_TOLERANCE = 0.1;

export type ConnectStyle = "none" | "line" | "curve" | "broken" | "scatter";

export type PointFeedback = {
  index: number;
  expected: GraphTablePoint;
  nearest: GraphTablePoint | null;
  distance: number | null;
  swappedDistance: number | null;
  status: "correct" | "missed" | "swapped";
};

export type GradeResult = {
  points: PointFeedback[];
  correctCount: number;
  total: number;
  connection: { required: boolean; passed: boolean; detail: string };
  swappedAxes: boolean;
  score: { earned: number; possible: number; label: string };
};

export type GradeInput = {
  table: GraphTablePoint[];
  plotted: GraphTablePoint[];
  connect: ConnectStyle;
  /** Kept so callers can pass the current view; it must not affect the result. */
  view?: { cx: number; cy: number; scale: number };
  tolerance?: number;
};

const dist = (a: GraphTablePoint, b: GraphTablePoint) => Math.hypot(a.x - b.x, a.y - b.y);

const nearestTo = (target: GraphTablePoint, plotted: GraphTablePoint[]) => {
  let best: { point: GraphTablePoint; distance: number } | null = null;
  for (const p of plotted) {
    const distance = dist(p, target);
    if (!best || distance < best.distance) best = { point: p, distance };
  }
  return best;
};

/** Distance from point p to the infinite line through a and b. */
const distanceToLine = (p: GraphTablePoint, a: GraphTablePoint, b: GraphTablePoint) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return dist(p, a);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
};

/**
 * Grade a student plot against a table of expected (x, y) points.
 * Comparisons are in world units only — `view` is ignored on purpose.
 */
export function checkGraph(input: GradeInput): GradeResult {
  const tolerance = input.tolerance ?? POINT_TOLERANCE;
  const table = input.table;
  const plotted = input.plotted;
  const points: PointFeedback[] = table.map((expected, index) => {
    const normal = nearestTo(expected, plotted);
    const swapped = nearestTo({ x: expected.y, y: expected.x }, plotted);
    const distance = normal ? normal.distance : null;
    const swappedDistance = swapped ? swapped.distance : null;
    const normalOk = distance != null && distance <= tolerance;
    const swappedOk = swappedDistance != null && swappedDistance <= tolerance;
    let status: PointFeedback["status"] = "missed";
    if (normalOk) status = "correct";
    else if (swappedOk) status = "swapped";
    return {
      index,
      expected,
      nearest: status === "swapped" ? swapped?.point ?? null : normal?.point ?? null,
      distance,
      swappedDistance,
      status,
    };
  });

  const correctCount = points.filter((p) => p.status === "correct").length;
  const swappedCount = points.filter((p) => p.status === "swapped").length;
  // Flag swapped axes when the swapped reading explains more of the table than the given orientation.
  const swappedAxes = swappedCount > 0 && swappedCount >= correctCount;

  const required = input.connect === "line" || input.connect === "curve" || input.connect === "broken";
  let connectionPassed = true;
  let detail = "No connection was required.";
  if (input.connect === "scatter" || input.connect === "none") {
    connectionPassed = true;
    detail = input.connect === "scatter" ? "Scatter: points only, no joining line." : "No joining style selected.";
  } else if (plotted.length < 2) {
    connectionPassed = false;
    detail = "A joining line or curve needs at least two plotted points.";
  } else if (input.connect === "line") {
    const a = plotted[0], b = plotted[plotted.length - 1];
    // A straight line should pass through every plotted point, and through every correctly plotted table point.
    const off = [
      ...plotted,
      ...points.filter((p) => p.status === "correct").map((p) => p.expected),
    ].filter((p) => distanceToLine(p, a, b) > tolerance);
    connectionPassed = off.length === 0;
    detail = connectionPassed
      ? "The straight line passes through the points."
      : "The straight line does not pass through all the points.";
  } else {
    // Curve and broken line are drawn through the plotted points, so they pass through those points by construction.
    connectionPassed = plotted.length >= 2;
    detail = connectionPassed
      ? `The ${input.connect} passes through the plotted points.`
      : "Not enough plotted points to join.";
  }

  const possible = table.length + (required ? 1 : 0);
  const earned = correctCount + (required && connectionPassed ? 1 : 0);
  const label = required
    ? `${correctCount} of ${table.length} points, connection ${connectionPassed ? "ok" : "not ok"} — ${earned}/${possible}`
    : `${correctCount} of ${table.length} points — ${earned}/${possible}`;

  return {
    points,
    correctCount,
    total: table.length,
    connection: { required, passed: connectionPassed, detail },
    swappedAxes,
    score: { earned, possible, label },
  };
}
