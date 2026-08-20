// The construction compiler.
//
// It turns a ConstructionProgram into an editable GeometryScene with EXACT
// coordinates: triangles come out of the sine/cosine rule, points on a circle
// sit exactly on the circle, extended points are exactly collinear. Nothing is
// guessed, so the finished diagram looks like a textbook figure and every
// object stays individually editable afterwards.

import type {
  GeoAngle, GeoArc, GeoCircle, GeoLabel, GeoObject, GeoPoint, GeoRegion, GeoSegment, GeometryScene,
} from "../scene";
import type { ConstructionProblem, ConstructionProgram, ConstructionStep } from "./types";

interface Vec { x: number; y: number }

const D2R = Math.PI / 180;
const TARGET = { width: 420, height: 300, pad: 34 };

const sub = (p: Vec, q: Vec): Vec => ({ x: p.x - q.x, y: p.y - q.y });
const add = (p: Vec, q: Vec): Vec => ({ x: p.x + q.x, y: p.y + q.y });
const mul = (p: Vec, k: number): Vec => ({ x: p.x * k, y: p.y * k });
const len = (p: Vec) => Math.hypot(p.x, p.y);
const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export interface CompileResult {
  scene: GeometryScene | null;
  problems: ConstructionProblem[];
}

export function compileConstruction(program: ConstructionProgram): CompileResult {
  const problems: ConstructionProblem[] = [];
  const pts = new Map<string, { p: Vec; label?: string; hidden?: boolean }>();
  const circles = new Map<string, { center: string; r: number }>();
  const draws: GeoObject[] = [];
  /** Helper points the engine created itself — never lettered. */
  const hidden = new Set<string>();
  /** Coordinate frame set by an "axes" step, used by "plot". */
  let axes: { xMin: number; xMax: number; yMin: number; yMax: number; unit: number } | null = null;


  const need = (i: number, id: unknown): Vec | null => {
    const key = String(id ?? "");
    const found = pts.get(key);
    if (!found) {
      problems.push({ step: i, message: `point "${key}" is used before it is constructed` });
      return null;
    }
    return found.p;
  };
  const put = (id: unknown, p: Vec, label?: string) => {
    const key = String(id ?? "");
    if (!key) return;
    pts.set(key, { p, label: label ?? (/^[A-Z]'?\d?$/.test(key) ? key : undefined) });
  };

  const steps = Array.isArray(program?.steps) ? program.steps : [];
  steps.forEach((raw, i) => {
    const s = raw as ConstructionStep;
    switch (s?.op) {
      case "point":
        put(s.id, { x: num(s.x, 0), y: num(s.y, 0) }, s.label);
        break;

      case "triangle": {
        const [A, B, C] = s.ids ?? [];
        let a = 0, b = 0, c = 0; // BC, CA, AB
        if (s.angles && s.angles.length === 3) {
          const [ga, gb, gc] = s.angles.map((d) => num(d, 0));
          if (Math.abs(ga + gb + gc - 180) > 0.6) {
            problems.push({ step: i, message: `triangle angles ${ga}, ${gb}, ${gc} do not sum to 180°` });
            break;
          }
          const k = 220;
          a = k * Math.sin(ga * D2R); b = k * Math.sin(gb * D2R); c = k * Math.sin(gc * D2R);
        } else if (s.sides && s.sides.length === 3) {
          [a, b, c] = s.sides.map((v) => num(v, 0));
          if (a + b <= c || b + c <= a || a + c <= b) {
            problems.push({ step: i, message: `sides ${a}, ${b}, ${c} cannot close a triangle` });
            break;
          }
        } else {
          problems.push({ step: i, message: "a triangle needs either its three angles or its three sides" });
          break;
        }
        const cosA = (b * b + c * c - a * a) / (2 * b * c);
        const angA = Math.acos(Math.max(-1, Math.min(1, cosA)));
        put(A, { x: 0, y: 0 });
        put(B, { x: c, y: 0 });
        put(C, { x: b * Math.cos(angA), y: -b * Math.sin(angA) });
        break;
      }

      case "rightTriangle": {
        const [A, B, C] = s.ids ?? [];
        const [p, q] = s.legs ?? [200, 140];
        put(B, { x: 0, y: 0 });
        put(A, { x: num(p, 200), y: 0 });
        put(C, { x: 0, y: -num(q, 140) });
        break;
      }

      case "regular": {
        const ids = Array.isArray(s.ids) ? s.ids : [];
        const n = ids.length;
        if (n < 3) { problems.push({ step: i, message: "a regular polygon needs at least three vertices" }); break; }
        const R = num(s.radius, 120);
        ids.forEach((id, k) => {
          const t = 90 + (360 / n) * k;
          put(id, { x: R * Math.cos(t * D2R), y: -R * Math.sin(t * D2R) });
        });
        break;
      }

      case "quad": {
        const [A, B, C, D] = s.ids ?? [];
        const w = num(s.width, 220), h = num(s.height, 140), k = num(s.skew, 0);
        put(A, { x: 0, y: 0 }); put(B, { x: w, y: 0 });
        put(C, { x: w + k, y: -h }); put(D, { x: k, y: -h });
        break;
      }

      case "circle": {
        const c = need(i, s.center);
        if (!c) break;
        const r = num(s.r, 110);
        if (r <= 0) { problems.push({ step: i, message: "a circle needs a positive radius" }); break; }
        circles.set(String(s.id), { center: String(s.center), r });
        draws.push({
          id: String(s.id), type: "circle", center: String(s.center), r,
          ...(s.label ? { label: s.label } : {}), ...(s.dashed ? { dashed: true } : {}),
        } as GeoCircle);
        break;
      }

      case "onCircle": {
        const circ = circles.get(String(s.circle));
        if (!circ) { problems.push({ step: i, message: `circle "${s.circle}" does not exist yet` }); break; }
        const c = need(i, circ.center);
        if (!c) break;
        const t = num(s.angle, 0) * D2R;
        put(s.id, { x: c.x + circ.r * Math.cos(t), y: c.y - circ.r * Math.sin(t) }, s.label);
        break;
      }

      case "onSegment": {
        const a = need(i, s.a), b = need(i, s.b);
        if (!a || !b) break;
        const t = Math.max(0, Math.min(1, num(s.t, 0.5)));
        put(s.id, add(a, mul(sub(b, a), t)), s.label);
        break;
      }

      case "midpoint": {
        const a = need(i, s.a), b = need(i, s.b);
        if (!a || !b) break;
        put(s.id, mul(add(a, b), 0.5), s.label);
        break;
      }

      case "extend": {
        const a = need(i, s.a), b = need(i, s.b);
        if (!a || !b) break;
        put(s.id, add(b, mul(sub(b, a), Math.max(0.05, num(s.by, 0.45)))), s.label);
        break;
      }

      case "foot": {
        const p = need(i, s.p), a = need(i, s.a), b = need(i, s.b);
        if (!p || !a || !b) break;
        const ab = sub(b, a);
        const l2 = ab.x * ab.x + ab.y * ab.y;
        if (l2 === 0) { problems.push({ step: i, message: "the line for the perpendicular has zero length" }); break; }
        const t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2;
        put(s.id, add(a, mul(ab, t)), s.label);
        break;
      }

      case "intersect": {
        const a = need(i, s.a), b = need(i, s.b), c = need(i, s.c), d = need(i, s.d);
        if (!a || !b || !c || !d) break;
        const r = sub(b, a), t = sub(d, c);
        const den = r.x * t.y - r.y * t.x;
        if (Math.abs(den) < 1e-9) { problems.push({ step: i, message: "those two lines are parallel, so they never meet" }); break; }
        const u = ((c.x - a.x) * t.y - (c.y - a.y) * t.x) / den;
        put(s.id, add(a, mul(r, u)), s.label);
        break;
      }

      case "segment": {
        if (!need(i, s.a) || !need(i, s.b)) break;
        draws.push({
          id: String(s.id ?? `seg-${i}`), type: "segment", a: String(s.a), b: String(s.b),
          ...(s.label ? { label: s.label } : {}),
          ...(s.distance ? { distance: s.distance } : {}),
          ...(s.dashed ? { dashed: true } : {}),
          ...(s.marks ? { marks: s.marks } : {}),
          ...(s.arrow ? { arrow: s.arrow } : {}),
        } as GeoSegment);
        break;
      }

      case "path": {
        const ids = (Array.isArray(s.points) ? s.points : []).map(String);
        if (ids.length < 2) { problems.push({ step: i, message: "a path needs at least two points" }); break; }
        if (ids.some((id) => !need(i, id))) break;
        const pairs = ids.slice(1).map((b, k) => [ids[k], b] as const);
        if (s.close !== false && ids.length > 2) pairs.push([ids[ids.length - 1], ids[0]]);
        pairs.forEach(([a, b], k) => draws.push({
          id: `seg-${i}-${k}`, type: "segment", a, b, ...(s.dashed ? { dashed: true } : {}),
        } as GeoSegment));
        break;
      }

      case "angle": {
        if (!need(i, s.vertex) || !need(i, s.a) || !need(i, s.b)) break;
        draws.push({
          id: `ang-${i}`, type: "angle", vertex: String(s.vertex), a: String(s.a), b: String(s.b),
          ...(s.value ? { value: s.value } : {}),
          marker: s.marker ?? "arc",
        } as GeoAngle);
        break;
      }

      case "arc": {
        const circ = circles.get(String(s.circle));
        if (!circ) { problems.push({ step: i, message: `circle "${s.circle}" does not exist yet` }); break; }
        const c = need(i, circ.center), from = need(i, s.from), to = need(i, s.to);
        if (!c || !from || !to) break;
        const ang = (p: Vec) => (Math.atan2(-(p.y - c.y), p.x - c.x) / D2R + 360) % 360;
        draws.push({
          id: String(s.id ?? `arc-${i}`), type: "arc", center: circ.center, r: circ.r,
          from: ang(from), to: ang(to), ...(s.dashed ? { dashed: true } : {}),
        } as GeoArc);
        break;
      }

      case "shade": {
        const ids = (Array.isArray(s.points) ? s.points : []).map(String);
        if (ids.length < 3 || ids.some((id) => !need(i, id))) {
          problems.push({ step: i, message: "a shaded region needs at least three constructed points" });
          break;
        }
        draws.push({
          id: `reg-${i}`, type: "region", boundary: ids,
          fill: s.fill ?? "#38bdf8", opacity: num(s.opacity, 0.22),
          ...(s.area ? { area: s.area } : {}),
        } as GeoRegion);
        break;
      }

      case "text": {
        const anchor = s.near ? pts.get(String(s.near))?.p : undefined;
        draws.push({
          id: `txt-${i}`, type: "label",
          x: (anchor?.x ?? 0) + num(s.dx, 0), y: (anchor?.y ?? 0) + num(s.dy, -18),
          text: String(s.text ?? ""), fontSize: num(s.fontSize, 14), color: "#0f172a",
        } as GeoLabel);
        break;
      }

      /* ── verified relationships ─────────────────────────────────── */

      case "parallel": {
        const t = need(i, s.through), a = need(i, s.a), b = need(i, s.b);
        if (!t || !a || !b) break;
        const d = sub(b, a);
        if (len(d) === 0) { problems.push({ step: i, message: "the reference line has zero length" }); break; }
        put(s.id, add(t, mul(d, Math.max(0.05, num(s.by, 1)))), s.label);
        break;
      }

      case "perpendicular": {
        const t = need(i, s.through), a = need(i, s.a), b = need(i, s.b);
        if (!t || !a || !b) break;
        const d = sub(b, a);
        const l = len(d);
        if (l === 0) { problems.push({ step: i, message: "the reference line has zero length" }); break; }
        const n2 = { x: -d.y / l, y: d.x / l };
        put(s.id, add(t, mul(n2, l * Math.max(0.05, num(s.by, 0.6)))), s.label);
        break;
      }

      case "tangentAt": {
        const circ = circles.get(String(s.circle));
        if (!circ) { problems.push({ step: i, message: `circle "${s.circle}" does not exist yet` }); break; }
        const c = need(i, circ.center), at = need(i, s.at);
        if (!c || !at) break;
        const r = sub(at, c);
        const l = len(r);
        if (l === 0) { problems.push({ step: i, message: "the point of tangency sits on the centre" }); break; }
        const tan = { x: -r.y / l, y: r.x / l };
        put(s.id, add(at, mul(tan, circ.r * Math.max(0.2, num(s.by, 0.9)))), s.label);
        break;
      }

      case "vector": {
        if (!need(i, s.a) || !need(i, s.b)) break;
        draws.push({
          id: `vec-${i}`, type: "segment", a: String(s.a), b: String(s.b), arrow: "end",
          ...(s.label ? { label: s.label } : {}), ...(s.dashed ? { dashed: true } : {}),
        } as GeoSegment);
        break;
      }

      case "sector": {
        const circ = circles.get(String(s.circle));
        if (!circ) { problems.push({ step: i, message: `circle "${s.circle}" does not exist yet` }); break; }
        const c = need(i, circ.center), from = need(i, s.from), to = need(i, s.to);
        if (!c || !from || !to) break;
        const ang = (p: Vec) => (Math.atan2(-(p.y - c.y), p.x - c.x) / D2R + 360) % 360;
        draws.push({
          id: `sec-arc-${i}`, type: "arc", center: circ.center, r: circ.r,
          from: ang(from), to: ang(to),
        } as GeoArc);
        draws.push({ id: `sec-r1-${i}`, type: "segment", a: circ.center, b: String(s.from) } as GeoSegment);
        draws.push({ id: `sec-r2-${i}`, type: "segment", a: circ.center, b: String(s.to) } as GeoSegment);
        draws.push({
          id: `sec-${i}`, type: "region", boundary: [circ.center, String(s.from), String(s.to)],
          fill: s.fill ?? "#38bdf8", opacity: num(s.opacity, 0.2),
          ...(s.area ? { area: s.area } : {}),
        } as GeoRegion);
        break;
      }

      /* ── number line & coordinate axes ──────────────────────────── */

      case "numberLine": {
        const from = num(s.from, 0), to = num(s.to, 10);
        if (to <= from) { problems.push({ step: i, message: "a number line needs `to` greater than `from`" }); break; }
        const step = Math.max(1e-6, num(s.step, (to - from) / 10));
        const unit = 320 / (to - from);
        const X = (v: number) => (v - from) * unit;
        const startId = `nl${i}-start`, endId = `nl${i}-end`;
        pts.set(startId, { p: { x: X(from) - 24, y: 0 } });
        pts.set(endId, { p: { x: X(to) + 24, y: 0 } });
        draws.push({ id: `nl${i}`, type: "segment", a: startId, b: endId, arrow: "both" } as GeoSegment);
        for (let v = from, k = 0; v <= to + 1e-6; v += step, k++) {
          const tickTop = `nl${i}-t${k}a`, tickBot = `nl${i}-t${k}b`;
          pts.set(tickTop, { p: { x: X(v), y: -6 } });
          pts.set(tickBot, { p: { x: X(v), y: 6 } });
          draws.push({ id: `nl${i}-tick${k}`, type: "segment", a: tickTop, b: tickBot } as GeoSegment);
          draws.push({
            id: `nl${i}-lab${k}`, type: "label",
            x: X(v), y: 24, text: String(Math.round(v * 1000) / 1000), fontSize: 13, color: "#0f172a",
          } as GeoLabel);
        }
        hidden.add(startId); hidden.add(endId);
        for (const key of [...pts.keys()]) if (key.startsWith(`nl${i}-t`)) hidden.add(key);
        for (const m of Array.isArray(s.marks) ? s.marks : []) {
          const v = num(m?.value, from);
          put(m?.id ?? `nl${i}-m${v}`, { x: X(v), y: 0 }, m?.label);
        }
        break;
      }

      case "axes": {
        const xMin = num(s.xMin, -5), xMax = num(s.xMax, 5);
        const yMin = num(s.yMin, -5), yMax = num(s.yMax, 5);
        const step = Math.max(1e-6, num(s.step, 1));
        const unit = Math.min(320 / Math.max(1e-6, xMax - xMin), 240 / Math.max(1e-6, yMax - yMin));
        axes = { xMin, xMax, yMin, yMax, unit };
        const P = (x: number, y: number): Vec => ({ x: x * unit, y: -y * unit });
        const originId = String(s.origin ?? "O");
        put(originId, P(0, 0), originId);
        const ids = {
          xa: `ax${i}-x0`, xb: `ax${i}-x1`, ya: `ax${i}-y0`, yb: `ax${i}-y1`,
        };
        pts.set(ids.xa, { p: P(xMin, 0) }); pts.set(ids.xb, { p: P(xMax, 0) });
        pts.set(ids.ya, { p: P(0, yMin) }); pts.set(ids.yb, { p: P(0, yMax) });
        [ids.xa, ids.xb, ids.ya, ids.yb].forEach((k) => hidden.add(k));
        draws.push({ id: `ax${i}-x`, type: "segment", a: ids.xa, b: ids.xb, arrow: "both" } as GeoSegment);
        draws.push({ id: `ax${i}-y`, type: "segment", a: ids.ya, b: ids.yb, arrow: "both" } as GeoSegment);
        for (let v = Math.ceil(xMin / step) * step; v <= xMax + 1e-6; v += step) {
          if (Math.abs(v) < 1e-9) continue;
          const p = P(v, 0);
          draws.push({ id: `ax${i}-xl${v}`, type: "label", x: p.x, y: p.y + 18, text: String(Math.round(v * 1000) / 1000), fontSize: 12, color: "#0f172a" } as GeoLabel);
        }
        for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-6; v += step) {
          if (Math.abs(v) < 1e-9) continue;
          const p = P(0, v);
          draws.push({ id: `ax${i}-yl${v}`, type: "label", x: p.x - 18, y: p.y, text: String(Math.round(v * 1000) / 1000), fontSize: 12, color: "#0f172a" } as GeoLabel);
        }
        draws.push({ id: `ax${i}-xname`, type: "label", x: P(xMax, 0).x + 16, y: P(xMax, 0).y - 4, text: "x", fontSize: 14, color: "#0f172a" } as GeoLabel);
        draws.push({ id: `ax${i}-yname`, type: "label", x: P(0, yMax).x + 12, y: P(0, yMax).y - 12, text: "y", fontSize: 14, color: "#0f172a" } as GeoLabel);
        break;
      }

      case "plot": {
        if (!axes) { problems.push({ step: i, message: "a plotted point needs an \"axes\" step first" }); break; }
        put(s.id, { x: num(s.x, 0) * axes.unit, y: -num(s.y, 0) * axes.unit }, s.label);
        break;
      }


      default:
        problems.push({ step: i, message: `unknown construction step "${String((s as any)?.op)}"` });
    }
  });

  if (!pts.size) {
    problems.push({ step: -1, message: "the construction produced no points at all" });
    return { scene: null, problems };
  }

  /* ── fit the figure into the diagram bounds ─────────────────────── */
  const all = [...pts.values()].map((v) => v.p);
  for (const [, c] of circles) {
    const cp = pts.get(c.center)?.p;
    if (cp) all.push({ x: cp.x - c.r, y: cp.y - c.r }, { x: cp.x + c.r, y: cp.y + c.r });
  }
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y)), maxY = Math.max(...all.map((p) => p.y));
  const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
  const scale = Math.min((TARGET.width - 2 * TARGET.pad) / w, (TARGET.height - 2 * TARGET.pad) / h);
  const offX = TARGET.pad - minX * scale + (TARGET.width - 2 * TARGET.pad - w * scale) / 2;
  const offY = TARGET.pad - minY * scale + (TARGET.height - 2 * TARGET.pad - h * scale) / 2;
  const fit = (p: Vec): Vec => ({
    x: Math.round((p.x * scale + offX) * 100) / 100,
    y: Math.round((p.y * scale + offY) * 100) / 100,
  });

  const centroid = pts.size
    ? mul([...pts.values()].reduce((acc, v) => add(acc, fit(v.p)), { x: 0, y: 0 }), 1 / pts.size)
    : { x: 0, y: 0 };

  const hide = new Set([...(program.hide ?? []).map(String), ...hidden]);
  const fitted = new Map<string, Vec>([...pts.entries()].map(([id, v]) => [id, fit(v.p)]));

  /** Unit directions of the drawn edges meeting a point (fitted space). */
  const incident = (id: string): Vec[] => {
    const p = fitted.get(id);
    if (!p) return [];
    const out: Vec[] = [];
    for (const o of draws) {
      if (o.type !== "segment") continue;
      const other = o.a === id ? o.b : o.b === id ? o.a : null;
      if (!other) continue;
      const q = fitted.get(other);
      if (!q) continue;
      const d = sub(q, p);
      const l = len(d) || 1;
      out.push(mul(d, 1 / l));
    }
    return out;
  };

  /**
   * Textbook label placement: the letter goes into the widest gap around its
   * point — clear of every edge meeting it and clear of nearby points. For a
   * collinear figure (A — P — B) that puts each letter off the line instead of
   * on it, which is exactly what the centroid rule used to get wrong.
   */
  const labelDirection = (id: string): Vec => {
    const p = fitted.get(id)!;
    const edges = incident(id);
    const neighbours = [...fitted.entries()]
      .filter(([k]) => k !== id)
      .map(([, q]) => {
        const d = sub(q, p);
        const l = len(d) || 1;
        return { u: mul(d, 1 / l), l };
      });
    const away = sub(p, centroid);
    const outward = len(away) > 1 ? mul(away, 1 / len(away)) : { x: 0, y: 1 };

    let best = outward;
    let bestScore = -Infinity;
    for (let k = 0; k < 24; k++) {
      const t = (k / 24) * Math.PI * 2;
      const u = { x: Math.cos(t), y: Math.sin(t) };
      let score = 0;
      // never along an edge
      for (const e of edges) score += 1.6 * (1 - Math.abs(e.x * u.x + e.y * u.y));
      // never towards a close neighbour
      for (const n of neighbours) {
        const align = n.u.x * u.x + n.u.y * u.y;
        if (align > 0) score -= align * align * (70 / Math.max(35, n.l));
      }
      score += 0.6 * (outward.x * u.x + outward.y * u.y);
      score += 0.25 * u.y; // gentle textbook preference for below the figure
      if (score > bestScore) { bestScore = score; best = u; }
    }
    return best;
  };

  const pointObjects: GeoPoint[] = [...pts.entries()].map(([id, v]) => {
    const p = fitted.get(id)!;
    const u = labelDirection(id);
    return {
      id, type: "point", x: p.x, y: p.y,
      ...(hide.has(id) ? {} : { label: v.label ?? id }),
      labelOffset: { dx: Math.round(u.x * 16), dy: Math.round(u.y * 16) },
      labelFontSize: 15,
      color: "#0f172a",
    };
  });


  // circles/arcs carry a radius in the old space — scale it too
  const scaled = draws.map((o) =>
    o.type === "circle" || o.type === "arc"
      ? { ...o, r: Math.round(o.r * scale * 100) / 100 }
      : o.type === "label"
        ? { ...o, ...fit({ x: o.x, y: o.y }) }
        : o);

  const scene: GeometryScene = {
    bounds: { width: TARGET.width, height: TARGET.height },
    objects: [...scaled, ...pointObjects],
    meta: { caption: program.figure ? String(program.figure) : undefined, constructed: true },
  };

  return { scene, problems };
}
