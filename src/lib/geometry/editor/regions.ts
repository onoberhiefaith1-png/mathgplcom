// Detect closed cycles among the currently-selected segments so the
// inspector can offer a "Region / Fill" section without manual action.

import type { GeometryScene, GeoId, GeoSegment } from "../scene";

export interface DetectedRegion {
  boundary: GeoId[]; // ordered point ids
  segmentIds: GeoId[];
}

/**
 * Given a subset of segment ids, return an ordered point-id boundary
 * if the selected segments form exactly one simple closed cycle.
 * Returns null otherwise.
 */
export function cycleFromSegments(scene: GeometryScene, segmentIds: GeoId[]): DetectedRegion | null {
  if (segmentIds.length < 3) return null;
  const segs = segmentIds
    .map((id) => scene.objects.find((o) => o.id === id))
    .filter((o): o is GeoSegment => !!o && o.type === "segment");
  if (segs.length !== segmentIds.length) return null;

  // Build adjacency: pointId -> list of {segId, otherPointId}
  const adj = new Map<GeoId, { segId: GeoId; other: GeoId }[]>();
  for (const s of segs) {
    if (!adj.has(s.a)) adj.set(s.a, []);
    if (!adj.has(s.b)) adj.set(s.b, []);
    adj.get(s.a)!.push({ segId: s.id, other: s.b });
    adj.get(s.b)!.push({ segId: s.id, other: s.a });
  }
  // Every vertex must have degree exactly 2 for a simple cycle.
  for (const [, list] of adj) {
    if (list.length !== 2) return null;
  }
  // Walk from any start point around the cycle.
  const start = segs[0].a;
  const boundary: GeoId[] = [start];
  const usedSegs = new Set<GeoId>();
  let prev = start;
  let currentSeg = segs[0].id;
  let next = segs[0].b;
  usedSegs.add(currentSeg);
  boundary.push(next);
  while (next !== start) {
    const neigh = adj.get(next)!.find((n) => n.segId !== currentSeg);
    if (!neigh) return null;
    currentSeg = neigh.segId;
    if (usedSegs.has(currentSeg)) return null;
    usedSegs.add(currentSeg);
    prev = next;
    next = neigh.other;
    if (next !== start) boundary.push(next);
    if (boundary.length > segs.length + 1) return null;
  }
  if (usedSegs.size !== segs.length) return null;
  return { boundary, segmentIds: Array.from(usedSegs) };
}
