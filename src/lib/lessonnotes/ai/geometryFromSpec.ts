// Geometry reconstruction: a compact, AI-friendly description of a figure →
// a real, editable GeometryScene (points, segments, lines, rays, circles,
// angles, measurements) with the stated relationships enforced.
//
// Directive grammar (all params optional except points or segments):
//   [[tool:geometry
//       points="A 0 4; B -3 0; C 3 0"        name x y  (coords optional)
//       segments="AB; BC; CA"                 pairs of point names
//       lines="PQ" rays="OX"
//       circles="O 3"                         centre radius
//       angles="ABC 60°; BCA x; ABD 90°"      vertex is the middle letter
//       lengths="BC 6 cm"
//       parallel="AB CD" perpendicular="AB BC"
//       confidence="high|medium|low" unclear="what could not be read"
//       caption="…"]]

import type {
  GeometryScene, GeoObject, GeoPoint, GeoSegment, GeoAngle,
} from "@/lib/geometry/scene";

export interface GeometryReconstruction {
  confidence: "high" | "medium" | "low";
  unclear: string[];
  relations: Array<{ kind: "parallel" | "perpendicular"; a: string; b: string; holds: boolean }>;
}

const BOUNDS = { width: 360, height: 260 };
const MARGIN = 34;

const list = (s?: string) =>
  (s ?? "").split(/[;\n]/).map((x) => x.trim()).filter(Boolean);

/** "AB" → ["A","B"], "A1B'" → ["A1","B'"], "A-B" → ["A","B"]. */
export function pointNames(s: string): string[] {
  return (s.match(/[A-Z][0-9]*'*/g) ?? []);
}

type P = { x: number; y: number };

export function geometryFromSpec(params: Record<string, string>): {
  scene: GeometryScene;
  review: GeometryReconstruction;
} | null {
  const names: string[] = [];
  const coords = new Map<string, P>();
  const add = (n: string) => { if (n && !names.includes(n)) names.push(n); };

  for (const item of list(params.points)) {
    const [n, x, y] = item.split(/[\s,()]+/).filter(Boolean);
    const name = pointNames(n ?? "")[0];
    if (!name) continue;
    add(name);
    if (x != null && y != null && Number.isFinite(+x) && Number.isFinite(+y)) coords.set(name, { x: +x, y: +y });
  }
  const pairs = (key: string) =>
    list(params[key]).map((s) => pointNames(s.split(/\s/)[0])).filter((p) => p.length >= 2);
  const segs = pairs("segments");
  const lines = pairs("lines");
  const rays = pairs("rays");
  for (const p of [...segs, ...lines, ...rays]) p.forEach(add);
  const angles = list(params.angles).map((s) => {
    const [head, ...rest] = s.split(/\s+/);
    return { pts: pointNames(head), value: rest.join(" ").trim() };
  }).filter((a) => a.pts.length === 3);
  angles.forEach((a) => a.pts.forEach(add));
  const circles = list(params.circles).map((s) => {
    const [c, r] = s.split(/\s+/);
    return { c: pointNames(c)[0], r: Number(r) || 2 };
  }).filter((c) => c.c);
  circles.forEach((c) => add(c.c));
  if (!names.length) return null;

  // Default layout for points without coordinates: a regular polygon.
  const missing = names.filter((n) => !coords.has(n));
  missing.forEach((n, i) => {
    const t = (Math.PI / 2) + (2 * Math.PI * i) / Math.max(3, missing.length);
    coords.set(n, { x: 4 * Math.cos(t) + (coords.size ? 9 : 0), y: 4 * Math.sin(t) });
  });

  // Angles with a numeric value: place the third point to honour it when the
  // coordinates were not supplied.
  for (const a of angles) {
    const deg = parseFloat(a.value);
    if (!Number.isFinite(deg)) continue;
    const [p, v, q] = a.pts;
    if (!missing.includes(q) || !coords.has(p) || !coords.has(v)) continue;
    const V = coords.get(v)!, Pp = coords.get(p)!;
    const base = Math.atan2(Pp.y - V.y, Pp.x - V.x);
    const len = Math.hypot(Pp.x - V.x, Pp.y - V.y) || 4;
    const t = base - (deg * Math.PI) / 180;
    coords.set(q, { x: V.x + len * Math.cos(t), y: V.y + len * Math.sin(t) });
  }

  // Enforce relationships by moving the second line's far end.
  const relations: GeometryReconstruction["relations"] = [];
  const enforce = (kind: "parallel" | "perpendicular") => {
    for (const s of list(params[kind])) {
      const [l1, l2] = s.split(/\s*(?:\s|\/\/|∥|⊥|,)\s*/).filter(Boolean).map(pointNames);
      if (!l1 || !l2 || l1.length < 2 || l2.length < 2) continue;
      const [a, b] = l1.map((n) => coords.get(n)!);
      const c = coords.get(l2[0]); const d = coords.get(l2[1]);
      if (!a || !b || !c || !d) continue;
      let ux = b.x - a.x, uy = b.y - a.y;
      const ul = Math.hypot(ux, uy) || 1;
      ux /= ul; uy /= ul;
      if (kind === "perpendicular") [ux, uy] = [-uy, ux];
      const len = Math.hypot(d.x - c.x, d.y - c.y) || ul;
      const sign = (d.x - c.x) * ux + (d.y - c.y) * uy < 0 ? -1 : 1;
      coords.set(l2[1], { x: c.x + sign * ux * len, y: c.y + sign * uy * len });
      relations.push({ kind, a: l1.join(""), b: l2.join(""), holds: true });
    }
  };
  enforce("parallel");
  enforce("perpendicular");

  // Fit logical coordinates into the diagram box (y up → SVG y down).
  const all = [...coords.values()];
  for (const c of circles) {
    const o = coords.get(c.c)!;
    all.push({ x: o.x - c.r, y: o.y - c.r }, { x: o.x + c.r, y: o.y + c.r });
  }
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y)), maxY = Math.max(...all.map((p) => p.y));
  const scale = Math.min(
    (BOUNDS.width - 2 * MARGIN) / Math.max(1e-6, maxX - minX),
    (BOUNDS.height - 2 * MARGIN) / Math.max(1e-6, maxY - minY),
  );
  const s = Number.isFinite(scale) && scale > 0 ? Math.min(scale, 60) : 30;
  const offX = (BOUNDS.width - (maxX - minX) * s) / 2;
  const offY = (BOUNDS.height - (maxY - minY) * s) / 2;
  const px = (p: P) => ({
    x: +(offX + (p.x - minX) * s).toFixed(2),
    y: +(BOUNDS.height - (offY + (p.y - minY) * s)).toFixed(2),
  });

  const id = (n: string) => `p_${n.replace(/'/g, "q")}`;
  const objects: GeoObject[] = [];
  for (const n of names) {
    const q = px(coords.get(n)!);
    objects.push({ id: id(n), type: "point", x: q.x, y: q.y, label: n } as GeoPoint);
  }
  const lengthOf = new Map(list(params.lengths).map((l) => {
    const [k, ...v] = l.split(/\s+/);
    return [pointNames(k).sort().join(""), v.join(" ")] as const;
  }));
  const parallelGroup = new Map<string, number>();
  relations.filter((r) => r.kind === "parallel").forEach((r, i) => {
    parallelGroup.set([...pointNames(r.a)].sort().join(""), Math.min(3, i + 1));
    parallelGroup.set([...pointNames(r.b)].sort().join(""), Math.min(3, i + 1));
  });
  const seen = new Set<string>();
  const pushLinear = (type: "segment" | "line" | "ray", p: string[]) => {
    const key = `${type}:${p[0]}${p[1]}`;
    if (seen.has(key)) return;
    seen.add(key);
    const k = [...p].sort().join("");
    const o: any = { id: `${type[0]}_${p[0]}${p[1]}`.replace(/'/g, "q"), type, a: id(p[0]), b: id(p[1]) };
    if (type === "segment") {
      const d = lengthOf.get(k);
      if (d) (o as GeoSegment).distance = d;
      const g = parallelGroup.get(k);
      if (g) (o as GeoSegment).parallelMarks = g as 1 | 2 | 3;
    }
    objects.push(o);
  };
  segs.forEach((p) => pushLinear("segment", p));
  lines.forEach((p) => pushLinear("line", p));
  rays.forEach((p) => pushLinear("ray", p));
  // Measured lines named in `lengths` but not drawn yet.
  for (const k of lengthOf.keys()) {
    const p = pointNames(k);
    if (p.length === 2 && ![...seen].some((s) => [...s.split(":")[1]].sort().join("") === k)) pushLinear("segment", p);
  }
  circles.forEach((c, i) => {
    const o = coords.get(c.c)!;
    const rim = `rim_${i}`;
    const r = px({ x: o.x + c.r, y: o.y });
    objects.push({ id: rim, type: "point", x: r.x, y: r.y, hidden: true } as GeoPoint);
    objects.push({ id: `c_${c.c}_${i}`, type: "circle", center: id(c.c), r: +(c.r * s).toFixed(2), rim } as any);
  });
  angles.forEach((a, i) => {
    const right = /^90\s*°?$/.test(a.value) || /right/i.test(a.value);
    objects.push({
      id: `a_${a.pts.join("")}_${i}`.replace(/'/g, "q"),
      type: "angle",
      vertex: id(a.pts[1]), a: id(a.pts[0]), b: id(a.pts[2]),
      value: right ? undefined : a.value.replace(/\s*right\s*/i, "") || undefined,
      marker: right ? "right" : "arc",
    } as GeoAngle);
  });

  const unclear = list(params.unclear);
  const conf = (params.confidence ?? "").toLowerCase();
  const confidence: GeometryReconstruction["confidence"] =
    conf === "low" || conf === "medium" || conf === "high" ? conf : unclear.length ? "medium" : "high";
  const review: GeometryReconstruction = { confidence, unclear, relations };
  return {
    scene: {
      bounds: { ...BOUNDS },
      objects,
      meta: {
        caption: params.caption || undefined,
        reconstruction: review,
      },
    },
    review,
  };
}

export function geometryNode(params: Record<string, string>) {
  const built = geometryFromSpec(params);
  if (!built) return null;
  return { type: "geometryDiagram", attrs: { scene: built.scene, align: "center" } };
}

/** Check a scene still honours its recorded relationships (after edits or
 *  duplication). */
export function relationsHold(scene: GeometryScene, tol = 0.02): boolean {
  const rec = (scene.meta as any)?.reconstruction as GeometryReconstruction | undefined;
  if (!rec) return true;
  const pt = (n: string) => scene.objects.find((o) => o.type === "point" && (o as GeoPoint).label === n) as GeoPoint | undefined;
  return rec.relations.every((r) => {
    const [a, b] = pointNames(r.a).map(pt); const [c, d] = pointNames(r.b).map(pt);
    if (!a || !b || !c || !d) return false;
    const u = { x: b.x - a.x, y: b.y - a.y }, v = { x: d.x - c.x, y: d.y - c.y };
    const lu = Math.hypot(u.x, u.y), lv = Math.hypot(v.x, v.y);
    const cross = Math.abs(u.x * v.y - u.y * v.x) / (lu * lv);
    const dot = Math.abs(u.x * v.x + u.y * v.y) / (lu * lv);
    return r.kind === "parallel" ? cross < tol : dot < tol;
  });
}
