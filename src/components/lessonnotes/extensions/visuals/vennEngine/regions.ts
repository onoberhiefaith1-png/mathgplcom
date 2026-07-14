// Region hit-test for the Venn engine.
// Given a point and the solved layout, return the region key — the sorted
// list of set ids whose disc contains the point (e.g. "A", "AB", "ABC").

import type { VennSet } from "./types";

export function regionKeyAt(x: number, y: number, sets: VennSet[]): string {
  const ids: string[] = [];
  for (const s of sets) {
    if (!s.visible) continue;
    const dx = x - s.cx;
    const dy = y - s.cy;
    if (dx * dx + dy * dy <= s.radius * s.radius) ids.push(s.id);
  }
  return ids.sort().join("");
}

/** Rough geometric centroid of a region (for placing overlay text). */
export function regionCentroid(key: string, sets: VennSet[]): { x: number; y: number } | null {
  const inside = new Set(key.split(""));
  const outside = new Set(sets.filter((s) => !inside.has(s.id)).map((s) => s.id));

  // Sample a bounding box around all sets and pick the mean point that
  // matches the region key.
  const xs = sets.map((s) => [s.cx - s.radius, s.cx + s.radius]).flat();
  const ys = sets.map((s) => [s.cy - s.radius, s.cy + s.radius]).flat();
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  let sx = 0, sy = 0, n = 0;
  const step = 3;
  for (let x = minX; x <= maxX; x += step) {
    for (let y = minY; y <= maxY; y += step) {
      let ok = true;
      for (const s of sets) {
        const inCircle = (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.radius * s.radius;
        if (inside.has(s.id) && !inCircle) { ok = false; break; }
        if (outside.has(s.id) && inCircle) { ok = false; break; }
      }
      if (ok) { sx += x; sy += y; n++; }
    }
  }
  if (!n) return null;
  return { x: sx / n, y: sy / n };
}
