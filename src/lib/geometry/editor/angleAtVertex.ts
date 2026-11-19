import { pointById, type GeoSegment, type GeometryScene } from "../scene";

const JOIN_DISTANCE = 6;

/** Find the two arms at a clicked corner, including older near-coincident endpoints. */
export function angleAtVertex(scene: GeometryScene, hitId: string, x: number, y: number) {
  const hit = scene.objects.find((object) => object.id === hitId);
  if (!hit || (hit.type !== "point" && hit.type !== "segment")) return null;
  const segments = scene.objects.filter((object): object is GeoSegment => object.type === "segment");
  const point = hit.type === "point" ? hit : undefined;
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= JOIN_DISTANCE;
  const incident = (segment: GeoSegment, vertex: { id: string; x: number; y: number }) => {
    if (segment.a === vertex.id || segment.b === vertex.id) return vertex.id;
    return [segment.a, segment.b].find((id) => {
      const p = pointById(scene, id);
      return p && near(p, vertex);
    });
  };

  const picked = hit.type === "segment" ? hit : segments.find((segment) => incident(segment, hit));
  if (!picked) return null;
  const vertex = point ?? [pointById(scene, picked.a), pointById(scene, picked.b)]
    .sort((a, b) => (a ? Math.hypot(a.x - x, a.y - y) : Infinity) -
      (b ? Math.hypot(b.x - x, b.y - y) : Infinity))[0];
  if (!vertex) return null;
  const chosenEndpoint = incident(picked, vertex);
  if (!chosenEndpoint) return null;
  const armA = picked.a === chosenEndpoint ? picked.b : picked.a;
  const first = pointById(scene, armA);
  if (!first || first.id === vertex.id) return null;
  const direction = (point: { x: number; y: number }) =>
    Math.atan2(point.y - vertex.y, point.x - vertex.x);
  const start = direction(first);
  let best: { id: string; turn: number } | undefined;
  for (const other of segments) {
    if (other.id === picked.id) continue;
    const endpoint = incident(other, vertex);
    if (!endpoint) continue;
    const arm = pointById(scene, other.a === endpoint ? other.b : other.a);
    if (!arm || arm.id === armA || arm.id === vertex.id) continue;
    const delta = direction(arm) - start;
    const turn = Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
    if (turn < 1e-6 || (best && turn >= best.turn)) continue;
    best = { id: arm.id, turn };
  }
  return best ? { vertex: vertex.id, armA, armB: best.id } : null;
}
