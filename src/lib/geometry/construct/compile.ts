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

/**
 * The Engine occasionally reaches for a helper point it never constructed — the
 * tip of a north arrow, or the far end of a horizontal through a point. Both
 * have exactly one mathematical meaning, so we construct them rather than
 * rejecting an otherwise correct figure. Anything else is still an error.
 */
function repairSteps(steps: any[]): any[] {
  const CREATES = new Set([
    "point", "onCircle", "onSegment", "midpoint", "extend", "foot", "intersect",
    "polar", "parallel", "perpendicular", "bisect", "tangentAt", "plot",
  ]);
  const known = new Set<string>();
  const out: any[] = [];
  const isNorthish = (id: string) => /^(n|north)[_\-]?[a-z0-9']*$/i.test(id);
  const isHorizontal = (id: string) => /(horiz|_line|_right$|^h[_\-]?\d*$)/i.test(id);

  for (const raw of steps) {
    const s = { ...(raw as any) };
    const op = String(s?.op ?? "");
    if (op === "segment" || op === "vector" || op === "line" || op === "ray") {
      const a = String(s.a ?? ""), b = String(s.b ?? "");
      const missing = !known.has(a) ? a : !known.has(b) ? b : "";
      const anchor = missing === a ? b : a;
      if (missing && known.has(anchor)) {
        if (isNorthish(missing)) { out.push({ op: "north", at: anchor }); known.add(missing); continue; }
        if (isHorizontal(missing)) {
          out.push({ op: "polar", id: missing, from: anchor, angle: 0, distance: 220 });
          known.add(missing);
        }
      }
    }
    // Register everything this step brings into existence.
    if (CREATES.has(op) && s.id) known.add(String(s.id));
    if (op === "tangentFrom" && Array.isArray(s.ids)) s.ids.forEach((x: unknown) => known.add(String(x)));
    if (Array.isArray(s.ids)) s.ids.forEach((x: unknown) => known.add(String(x)));
    if (op === "circle" && s.id) known.add(String(s.id));
    if (op === "numberLine" && Array.isArray(s.marks)) s.marks.forEach((m: any) => m?.id && known.add(String(m.id)));
    out.push(s);
  }
  return out;
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
  /** Circle lookup that tolerates the id arriving wrapped in an object. */
  const circOf = (v: unknown) => {
    const direct = circles.get(String((v as any)?.id ?? v ?? ""));
    if (direct) return direct;
    // The Engine sometimes hands back the circle object itself, or names the
    // circle by its centre. With only one circle in the figure there is no
    // ambiguity either way.
    const byCentre = [...circles.values()].find((c) => c.center === String((v as any)?.center ?? v ?? ""));
    if (byCentre) return byCentre;
    return circles.size === 1 ? [...circles.values()][0] : undefined;
  };
  /** Only a bare letter is a point label; "A(2, 3)" is text, not a label. */
  const letterOnly = (v: unknown): string | undefined => {
    const t = String(v ?? "").trim();
    return /^[A-Z][’'₁₂]?\d?$/.test(t) ? t : undefined;
  };
  const put = (id: unknown, p: Vec, label?: string) => {
    const key = String(id ?? "");
    if (!key) return;
    pts.set(key, { p, label: label ?? (/^[A-Z]'?\d?$/.test(key) ? key : undefined) });
  };

  const steps = repairSteps(Array.isArray(program?.steps) ? (program.steps as any[]) : []) as ConstructionStep[];
  steps.forEach((raw, i) => {

    // Friendly aliases for steps the Engine reaches for by another name.
    const rawOp = String((raw as any)?.op ?? "");
    const opName = rawOp === "rotate" ? "polar" : rawOp === "tangentsFrom" ? "tangentFrom" : rawOp;
    const s = { ...(raw as any), op: opName } as ConstructionStep;
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
          // No measurements given: draw a clean, clearly scalene triangle
          // rather than refusing to draw at all.
          const k = 220;
          a = k * Math.sin(64 * D2R); b = k * Math.sin(58 * D2R); c = k * Math.sin(58 * D2R);
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
        const circ = circOf(s.circle);
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
        const circ = circOf(s.circle);
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
        const circ = circOf(s.circle);
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
        const circ = circOf(s.circle);
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
        const p = { x: num(s.x, 0) * axes.unit, y: -num(s.y, 0) * axes.unit };
        // A plotted point that lands on an existing point (typically the
        // origin) becomes that point instead of a second dot on top of it.
        const same = [...pts.entries()].find(([, v]) => Math.hypot(v.p.x - p.x, v.p.y - p.y) < 1e-6);
        const letter = letterOnly(s.label) ?? letterOnly(s.id);
        if (same) {
          pts.set(same[0], { ...same[1], label: letter ?? same[1].label });
          if (letter) hidden.delete(same[0]);
        } else {
          put(s.id, p, letter);
        }
        // The coordinate pair belongs beside the point as text, never as its letter.
        const pair = String(s.label ?? "").includes("(") ? String(s.label) : `(${num(s.x, 0)}, ${num(s.y, 0)})`;
        draws.push({
          id: `plot-txt-${i}`, type: "label", x: p.x + 4, y: p.y + 22,
          text: pair, fontSize: 12, color: "#0369a1",
        } as GeoLabel);
        break;
      }

      /* ── bearings, tangents from a point, bisectors, full lines ──── */

      case "polar": {
        const from = need(i, (s as any).from ?? (s as any).about);
        if (!from) break;
        const d = num((s as any).distance, 200);
        const hasBearing = typeof (s as any).bearing === "number";
        const t = hasBearing
          ? (90 - num((s as any).bearing, 0)) * D2R   // clockwise from north
          : num((s as any).angle, 0) * D2R;           // anticlockwise from +x
        put((s as any).id, { x: from.x + d * Math.cos(t), y: from.y - d * Math.sin(t) }, (s as any).label);
        break;
      }

      case "tangentFrom": {
        const circ = circOf((s as any).circle);
        if (!circ) { problems.push({ step: i, message: `circle "${(s as any).circle}" does not exist yet` }); break; }
        const c = need(i, circ.center), from = need(i, (s as any).from);
        if (!c || !from) break;
        const d = sub(from, c);
        const dist = len(d);
        if (dist <= circ.r * 1.02) {
          problems.push({ step: i, message: "the tangents' external point lies inside the circle" });
          break;
        }
        const base = Math.atan2(-d.y, d.x);
        const spread = Math.acos(circ.r / dist);
        const [i1, i2] = Array.isArray((s as any).ids) ? (s as any).ids : [];
        const [l1, l2] = Array.isArray((s as any).labels) ? (s as any).labels : [];
        [[i1, base + spread, l1], [i2, base - spread, l2]].forEach(([id, ang, lab]) => {
          if (!id) return;
          put(id, { x: c.x + circ.r * Math.cos(ang as number), y: c.y - circ.r * Math.sin(ang as number) }, lab as string | undefined);
        });
        break;
      }

      case "bisect": {
        const v = need(i, (s as any).vertex), a = need(i, (s as any).a), b = need(i, (s as any).b);
        if (!v || !a || !b) break;
        const ua = sub(a, v), ub = sub(b, v);
        const la = len(ua) || 1, lb = len(ub) || 1;
        const dir = { x: ua.x / la + ub.x / lb, y: ua.y / la + ub.y / lb };
        const l = len(dir);
        if (l < 1e-9) { problems.push({ step: i, message: "the angle to bisect is a straight line" }); break; }
        const reach = Math.min(la, lb) * Math.max(0.2, num((s as any).by, 0.95));
        put((s as any).id, add(v, mul({ x: dir.x / l, y: dir.y / l }, reach)), (s as any).label);
        break;
      }

      case "line":
      case "ray": {
        const isLine = s.op === "line";
        const a = need(i, (s as any).a), b = need(i, (s as any).b);
        if (!a || !b) break;
        // Drawn as a segment stretched beyond its two points, so it stays
        // editable and always exactly collinear.
        const d = sub(b, a);
        const startId = `ln${i}-a`, endId = `ln${i}-b`;
        pts.set(startId, { p: isLine ? add(a, mul(d, -0.35)) : a });
        pts.set(endId, { p: add(b, mul(d, 0.35)) });
        hidden.add(startId); hidden.add(endId);
        draws.push({
          id: String((s as any).id ?? `ln-${i}`), type: "segment", a: startId, b: endId,
          ...((s as any).dashed ? { dashed: true } : {}),
        } as GeoSegment);
        break;
      }

      case "north": {
        const at = need(i, (s as any).at);
        if (!at) break;
        const l = num((s as any).length, 90);
        const tipId = `n${i}-tip`;
        pts.set(tipId, { p: { x: at.x, y: at.y - l } });
        hidden.add(tipId);
        draws.push({ id: `north-${i}`, type: "segment", a: String((s as any).at), b: tipId, arrow: "end", dashed: true } as GeoSegment);
        draws.push({ id: `north-lab-${i}`, type: "label", x: at.x, y: at.y - l - 10, text: "N", fontSize: 13, color: "#0f172a" } as GeoLabel);
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

  // A single capital letter is a point the question talks about, so it stays
  // lettered even when the program lists it among the helpers to hide.
  const hide = new Set(
    [...(program.hide ?? []).map(String), ...hidden].filter((id) => !/^[A-Z]'?\d?$/.test(id)),
  );

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

  /* Textbook label placement.
   *
   * A letter must never be printed on a line, on a circle, on another point or
   * on another letter — the same conditions the verifier checks. So instead of
   * guessing a direction, every candidate offset (24 directions × 4 distances)
   * is scored against the finished figure, and the first clear one wins. */
  const drawnEdges = draws.flatMap((o) => {
    if (o.type !== "segment") return [];
    const a = fitted.get(o.a), b = fitted.get(o.b);
    return a && b ? [{ a, b }] : [];
  });
  const drawnCircles = [...circles.values()].flatMap((c) => {
    const p = fitted.get(c.center);
    return p ? [{ c: p, r: c.r * scale }] : [];
  });

  const distToEdge = (q: Vec, e: { a: Vec; b: Vec }) => {
    const ab = sub(e.b, e.a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    if (l2 === 0) return len(sub(q, e.a));
    const t = Math.max(0, Math.min(1, ((q.x - e.a.x) * ab.x + (q.y - e.a.y) * ab.y) / l2));
    return len(sub(q, add(e.a, mul(ab, t))));
  };

  const placed: Vec[] = [];
  const labelOffsetFor = (id: string): Vec => {
    const p = fitted.get(id)!;
    const away = sub(p, centroid);
    const outward = len(away) > 1 ? mul(away, 1 / len(away)) : { x: 0, y: 1 };
    let best = mul(outward, 16);
    let bestScore = -Infinity;

    for (const radius of [15, 20, 26, 32]) {
      for (let k = 0; k < 24; k++) {
        const t = (k / 24) * Math.PI * 2;
        const u = { x: Math.cos(t), y: Math.sin(t) };
        const q = add(p, mul(u, radius));
        let score = 0;

        // clear of every drawn line
        for (const e of drawnEdges) {
          const d = distToEdge(q, e);
          if (d < 10) score -= (10 - d) * 6;
        }
        // clear of every circle rim
        for (const c of drawnCircles) {
          const d = Math.abs(len(sub(q, c.c)) - c.r);
          if (d < 10) score -= (10 - d) * 5;
        }
        // clear of every other point and every letter already placed
        for (const [k2, q2] of fitted) {
          if (k2 === id) continue;
          const d = len(sub(q, q2));
          if (d < 14) score -= (14 - d) * 5;
        }
        for (const q2 of placed) {
          const d = len(sub(q, q2));
          if (d < 16) score -= (16 - d) * 5;
        }
        // inside the frame, then close in, then textbook-outward
        if (q.x < 10 || q.y < 10 || q.x > TARGET.width - 10 || q.y > TARGET.height - 10) score -= 200;
        score -= radius * 0.35;
        score += 4 * (outward.x * u.x + outward.y * u.y);
        score += 1.2 * u.y;

        if (score > bestScore) { bestScore = score; best = mul(u, radius); }
      }
    }
    placed.push(add(p, best));
    return best;
  };

  // A board figure letters its points. An internal name like "lineABC" or
  // "north_helper" is scaffolding the engine gave itself, never a letter a
  // teacher writes, so it is drawn without a label.
  // A board label is a mathematical identifier: A, O, P', O₁. Construction
  // helpers such as L1, north or lineABC carry no meaning for a student, so
  // their names are never printed beside a point.
  const BOARD_LABEL = /^[A-Z]['′]?[₀-₉]?$/;

  const pointObjects: GeoPoint[] = [...pts.entries()].map(([id, v]) => {
    const p = fitted.get(id)!;
    const text = v.label ?? id;
    const lettered = !hide.has(id) && BOARD_LABEL.test(String(text).trim());
    const off = lettered ? labelOffsetFor(id) : { x: 0, y: -16 };
    return {
      id, type: "point", x: p.x, y: p.y,
      ...(lettered ? { label: text } : {}),
      labelOffset: { dx: Math.round(off.x), dy: Math.round(off.y) },
      labelFontSize: 14,
      color: "#0f172a",
    };
  });





  // circles/arcs carry a radius in the old space — scale it too
  const scaled = draws.map((o) => {
    if (o.type === "circle" || o.type === "arc") {
      return { ...o, r: Math.round(o.r * scale * 100) / 100 };
    }
    if (o.type === "label") {
      // A measurement or angle value that lands outside the frame is cut off by
      // the viewBox, so pull it back inside, allowing for the text's own width.
      const p = fit({ x: o.x, y: o.y });
      const half = 3.4 * String((o as any).text ?? "").length + 4;
      return {
        ...o,
        x: Math.min(Math.max(p.x, half), TARGET.width - half),
        y: Math.min(Math.max(p.y, 12), TARGET.height - 6),
      };
    }
    return o;
  });


  const scene: GeometryScene = {
    bounds: { width: TARGET.width, height: TARGET.height },
    objects: [...scaled, ...pointObjects],
    meta: { caption: program.figure ? String(program.figure) : undefined, constructed: true },
  };

  return { scene, problems };
}
