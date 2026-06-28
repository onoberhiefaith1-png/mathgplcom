// Pick the smart part under a logical (x,y) coordinate. Returns the
// "smallest" matching part so a vertex wins over its containing triangle.

import type { SmartGraph, SmartPartBase } from "./parts";

const KIND_PRIORITY: Record<string, number> = {
  vertex: 0, centre: 0, pointOnCircle: 0, midpoint: 0,
  angle: 1,
  side: 2, radius: 2, diameter: 2, chord: 2, tangent: 2, segment: 2,
  arc: 2,
  circle: 3,
  triangle: 4,
  line: 5,
};

export function pickPart(graph: SmartGraph, x: number, y: number): SmartPartBase | null {
  let best: { part: SmartPartBase; d: number; pri: number } | null = null;
  for (const p of graph.parts) {
    const d = distance(p, x, y);
    if (d == null) continue;
    if (d > 12) continue;
    const pri = KIND_PRIORITY[p.kind] ?? 9;
    if (!best || pri < best.pri || (pri === best.pri && d < best.d)) {
      best = { part: p, d, pri };
    }
  }
  return best?.part ?? null;
}

function distance(p: SmartPartBase, x: number, y: number): number | null {
  const h = p.hit;
  switch (h.kind) {
    case "point":
      return Math.max(0, Math.hypot(h.x - x, h.y - y) - h.r);
    case "segment":
      return distPointToSegment(x, y, h.x1, h.y1, h.x2, h.y2);
    case "circle":
      return Math.abs(Math.hypot(x - h.cx, y - h.cy) - h.r);
    case "arc": {
      const d = Math.abs(Math.hypot(x - h.cx, y - h.cy) - h.r);
      const ang = (Math.atan2(-(y - h.cy), x - h.cx) * 180) / Math.PI;
      const a = norm(ang), f = norm(h.from), t = norm(h.to);
      const inSweep = f <= t ? a >= f && a <= t : a >= f || a <= t;
      return inSweep ? d : Infinity;
    }
  }
}

function norm(a: number): number {
  let x = a % 360;
  if (x < 0) x += 360;
  return x;
}

function distPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
