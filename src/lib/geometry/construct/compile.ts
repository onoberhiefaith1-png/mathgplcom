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

  const hide = new Set((program.hide ?? []).map(String));
  const pointObjects: GeoPoint[] = [...pts.entries()].map(([id, v]) => {
    const p = fit(v.p);
    const away = sub(p, centroid);
    const d = len(away) || 1;
    return {
      id, type: "point", x: p.x, y: p.y,
      ...(hide.has(id) ? {} : { label: v.label ?? id }),
      labelOffset: { dx: Math.round((away.x / d) * 14), dy: Math.round((away.y / d) * 14) },
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
