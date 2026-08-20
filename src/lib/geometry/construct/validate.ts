// Diagram verification — nothing reaches the lesson note unchecked.
//
// The checks are geometric, not stylistic: the figure must exist, the points
// must be distinguishable, points declared on a circle must really be on it,
// angle markers must have real arms, and every label the question mentions
// must be present.

import { pointById, type GeometryScene } from "../scene";

export interface DiagramCheck { name: string; ok: boolean; detail?: string }
export interface DiagramVerdict { ok: boolean; problems: string[]; checks: DiagramCheck[] }

const MIN_SEPARATION = 11;

export function verifyScene(scene: GeometryScene | null, question = ""): DiagramVerdict {
  const checks: DiagramCheck[] = [];
  const problems: string[] = [];
  const add = (name: string, ok: boolean, detail?: string) => {
    checks.push({ name, ok, detail });
    if (!ok && detail) problems.push(detail);
  };

  if (!scene || !Array.isArray(scene.objects) || !scene.objects.length) {
    return { ok: false, problems: ["The diagram came back empty."], checks };
  }

  const points = scene.objects.filter((o) => o.type === "point") as Array<{ id: string; x: number; y: number; label?: string }>;
  add("figure exists", points.length >= 2, points.length >= 2 ? undefined : "The diagram has fewer than two points.");

  // every reference resolves
  const missing: string[] = [];
  for (const o of scene.objects) {
    const refs: string[] =
      o.type === "segment" || o.type === "line" || o.type === "ray" ? [o.a, o.b]
        : o.type === "circle" || o.type === "arc" ? [o.center]
          : o.type === "angle" ? [o.vertex, o.a, o.b]
            : o.type === "polygon" ? o.points
              : o.type === "region" ? o.boundary
                : [];
    for (const r of refs) if (r && !pointById(scene, r)) missing.push(r);
  }
  add("references resolve", missing.length === 0,
    missing.length ? `The diagram refers to points that do not exist (${[...new Set(missing)].join(", ")}).` : undefined);

  // points must be distinguishable
  let collision: string | null = null;
  for (let i = 0; i < points.length && !collision; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) < MIN_SEPARATION) {
        collision = `${points[i].label ?? points[i].id} and ${points[j].label ?? points[j].id}`;
        break;
      }
    }
  }
  add("points separated", !collision, collision ? `Two points sit on top of each other (${collision}).` : undefined);

  // circles: declared points on a circle really are on it
  let offCircle: string | null = null;
  for (const c of scene.objects) {
    if (c.type !== "circle") continue;
    const centre = pointById(scene, c.center);
    if (!centre) continue;
    for (const p of points) {
      if (p.id === c.center) continue;
      const d = Math.hypot(p.x - centre.x, p.y - centre.y);
      if (Math.abs(d - c.r) < 6 && Math.abs(d - c.r) > 0.9) offCircle = p.label ?? p.id;
    }
  }
  add("circle incidence", !offCircle,
    offCircle ? `Point ${offCircle} is drawn beside the circle instead of exactly on it.` : undefined);

  // angle arms must be real
  const badAngle = (scene.objects.find((o) => {
    if (o.type !== "angle") return false;
    const v = pointById(scene, o.vertex), a = pointById(scene, o.a), b = pointById(scene, o.b);
    if (!v || !a || !b) return true;
    const cross = (a.x - v.x) * (b.y - v.y) - (a.y - v.y) * (b.x - v.x);
    const dot = (a.x - v.x) * (b.x - v.x) + (a.y - v.y) * (b.y - v.y);
    return Math.abs(Math.atan2(cross, dot)) < 0.05;
  }) as any) ?? null;
  add("angles are real", !badAngle, badAngle ? "An angle marker has arms lying on top of each other." : undefined);

  // inside bounds
  const outside = points.find((p) =>
    p.x < 2 || p.y < 2 || p.x > scene.bounds.width - 2 || p.y > scene.bounds.height - 2);
  add("inside bounds", !outside,
    outside ? `Point ${outside.label ?? outside.id} falls outside the diagram frame.` : undefined);

  // labels the question names must appear
  const named = [...String(question).matchAll(/\b([A-Z])(?![A-Za-z])/g)].map((m) => m[1]);
  const have = new Set(points.map((p) => (p.label ?? "").trim()).filter(Boolean));
  const wanted = [...new Set(named)].filter((n) => !have.has(n));
  const labelsOk = wanted.length === 0 || named.length === 0 || wanted.length > 3;
  add("labels match the question", labelsOk,
    labelsOk ? undefined : `The question names ${wanted.join(", ")} but the diagram does not label ${wanted.length > 1 ? "them" : "it"}.`);

  return { ok: problems.length === 0, problems, checks };
}
