/** Table data for a Graph Activity: x/y pairs in world units. */

export type GraphTablePoint = { x: number; y: number };

/** Example from the Graph Activity design picture: y = 2x + 3, x = −2…2. */
export const DEFAULT_GRAPH_TABLE: GraphTablePoint[] = [
  { x: -2, y: -1 },
  { x: -1, y: 1 },
  { x: 0, y: 3 },
  { x: 1, y: 5 },
  { x: 2, y: 7 },
];

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const asPoint = (raw: unknown): GraphTablePoint | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const x = num(r.x ?? r.X);
  const y = num(r.y ?? r.Y);
  if (x == null || y == null) return null;
  return { x, y };
};

/**
 * Pull an x/y table out of Live Report (or any) context when one is present.
 * Accepts `{ graphTable }`, `{ points }`, or an array of `{ x, y }` / `[x, y]`.
 * Returns null when nothing suitable is found so the caller can use the default.
 */
export function extractGraphTable(source: unknown): GraphTablePoint[] | null {
  if (!source) return null;
  if (Array.isArray(source)) {
    const points: GraphTablePoint[] = [];
    for (const item of source) {
      if (Array.isArray(item) && item.length >= 2) {
        const x = num(item[0]), y = num(item[1]);
        if (x != null && y != null) points.push({ x, y });
      } else {
        const p = asPoint(item);
        if (p) points.push(p);
      }
    }
    return points.length ? points : null;
  }
  if (typeof source === "object") {
    const r = source as Record<string, unknown>;
    for (const key of ["graphTable", "table", "points", "rows"]) {
      if (r[key] != null) {
        const found = extractGraphTable(r[key]);
        if (found) return found;
      }
    }
  }
  return null;
}

/** World-unit window that frames a table with comfortable cells (default table ≈ x −6..6, y −5..9). */
export function frameForTable(points: GraphTablePoint[]): { xmin: number; xmax: number; ymin: number; ymax: number } {
  if (!points.length) return { xmin: -6, xmax: 6, ymin: -5, ymax: 9 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  let xmin = Math.min(...xs) - 2, xmax = Math.max(...xs) + 2;
  let ymin = Math.min(...ys) - 2, ymax = Math.max(...ys) + 2;
  if (xmax - xmin < 12) {
    const mid = (xmin + xmax) / 2;
    xmin = mid - 6;
    xmax = mid + 6;
  }
  if (ymax - ymin < 14) {
    const mid = (ymin + ymax) / 2;
    ymin = mid - 7;
    ymax = mid + 7;
  }
  return { xmin, xmax, ymin, ymax };
}
