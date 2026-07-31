// Labeling engine — the mathematics of *where a label goes*.
//
// Every label is attached to a mathematical element (vertex / edge / face) and
// described in the solid's LOCAL geometry frame, so it inherits the solid's
// transform and stays welded to the geometry while the object rotates.
//
// Nothing here touches React or three.js rendering: these are pure functions of
// the solid, which is what makes every label update the instant a dimension
// changes.

import { centroid, topologyFor, type EdgeEl, type FaceEl, type VertexEl } from "./topology";
import type { Solid3D, Vec3 } from "./scene3d";

export {
  DEFAULT_LABEL_SETTINGS, sanitizeLabelSettings,
  type EdgeDisplay, type LabelSettings,
} from "./labelSettings";
import type { EdgeDisplay } from "./labelSettings";


// ---------------------------------------------------------------- vectors

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const midOf = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

/** Any unit vector perpendicular to d. */
function anyPerp(d: Vec3): Vec3 {
  const ref: Vec3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return unit(cross(d, ref));
}

/** Component of v perpendicular to d, normalised (falls back to any perp). */
function perpTo(v: Vec3, d: Vec3): Vec3 {
  const p = sub(v, mul(d, dot(v, d)));
  return len(p) < 1e-6 ? anyPerp(d) : unit(p);
}

// ---------------------------------------------------------------- frames

export interface LabelFrame {
  /** Anchor on the element itself (local frame). */
  anchor: Vec3;
  /** Perpendicular direction the label is pushed along so it never covers the line. */
  offsetDir: Vec3;
  /** Baseline the label stays parallel to — null means "always face the camera". */
  alignDir: Vec3 | null;
}

/** Centre of mass of the solid's geometry, used to push labels outwards. */
export function bodyCenter(solid: Solid3D): Vec3 {
  const topo = topologyFor(solid);
  if (topo.vertices.length) return centroid(topo.vertices.map((v) => v.position));
  return [0, 0, 0];
}

export function edgeLabelFrame(edge: EdgeEl, center: Vec3 = [0, 0, 0]): LabelFrame {
  if (edge.shape === "circle") {
    // Front of the circle: the tangent there runs along X.
    const anchor: Vec3 = [0, edge.center[1], edge.radius];
    return { anchor, offsetDir: [0, 0, 1], alignDir: [1, 0, 0] };
  }
  const dir = unit(sub(edge.b, edge.a));
  const mid = midOf(edge.a, edge.b);
  const outward = perpTo(sub(mid, center), dir);
  return { anchor: mid, offsetDir: outward, alignDir: dir };
}

export function vertexLabelFrame(v: VertexEl, center: Vec3 = [0, 0, 0]): LabelFrame {
  const out = sub(v.position, center);
  const dir: Vec3 = len(out) < 1e-6 ? [0, 1, 0] : unit(out);
  return { anchor: v.position, offsetDir: dir, alignDir: null };
}

export function faceLabelFrame(f: FaceEl): LabelFrame {
  const align =
    f.shape === "polygon" && f.points && f.points.length > 1
      ? unit(sub(f.points[1], f.points[0]))
      : null;
  return { anchor: f.center, offsetDir: unit(f.normal), alignDir: align };
}

export function frameFor(
  kind: "vertex" | "edge" | "face",
  el: VertexEl | EdgeEl | FaceEl,
  center: Vec3,
): LabelFrame {
  if (kind === "vertex") return vertexLabelFrame(el as VertexEl, center);
  if (kind === "edge") return edgeLabelFrame(el as EdgeEl, center);
  return faceLabelFrame(el as FaceEl);
}

// ---------------------------------------------------------------- text

/** Edge caption honouring the teacher's name / length / both preference. */
export function edgeLabelText(
  name: string,
  length: string,
  display: EdgeDisplay,
): string {
  if (display === "length") return length;
  if (display === "name") return name;
  return `${name} = ${length}`;
}

// ---------------------------------------------------------------- construction

export interface ConstructionSeg {
  id: string;
  a: Vec3;
  b: Vec3;
  /** Caption drawn at the midpoint of the segment. */
  text?: string;
  color: string;
  dashed?: boolean;
  /** Arrowheads at both ends (dimension lines). */
  arrows?: boolean;
}

export interface ConstructionSpec {
  segments: ConstructionSeg[];
  /** Centre point of a circular solid, labelled O. */
  centre?: { position: Vec3; label: string };
}

export interface ConstructionOptions {
  radius: boolean;
  diameter: boolean;
  height: boolean;
  slantHeight: boolean;
}

/** The construction items a teacher can add, one annotation each. */
export type ConstructionKind = "radius" | "diameter" | "height" | "slant" | "topRadius";

const ROUND = new Set(["sphere", "hemisphere", "cylinder", "cone", "frustum"]);

export function isRoundSolid(kind: string): boolean {
  return ROUND.has(kind);
}

export const CONSTRUCTION_COLORS: Record<ConstructionKind, string> = {
  radius: "#38bdf8",
  topRadius: "#38bdf8",
  diameter: "#a78bfa",
  height: "#34d399",
  slant: "#f472b6",
};

/** Which construction lines make sense for this solid. */
export function availableConstructions(solid: Solid3D): { kind: ConstructionKind; label: string }[] {
  const k = solid.kind;
  const out: { kind: ConstructionKind; label: string }[] = [];
  if (isRoundSolid(k)) {
    out.push({ kind: "radius", label: "Radius" });
    out.push({ kind: "diameter", label: "Diameter" });
    if (k === "frustum") out.push({ kind: "topRadius", label: "Top radius" });
  }
  if (k !== "sphere") out.push({ kind: "height", label: "Height" });
  if (k === "cone" || k === "frustum" || k.endsWith("Pyramid") || k === "tetrahedron") {
    out.push({ kind: "slant", label: "Slant height" });
  }
  return out;
}

/** Centre O of a circular solid, in the solid's local frame. */
export function centreOf(solid: Solid3D): Vec3 | null {
  if (!isRoundSolid(solid.kind)) return null;
  const p = solid.params ?? {};
  const h = p.height ?? p.size ?? 2;
  // Sphere: true centre. Hemisphere: centre of the flat circular base (y = 0).
  // Cylinder / cone / frustum: centre of the base circle.
  const y = solid.kind === "sphere" || solid.kind === "hemisphere" ? 0 : -h / 2;
  return [0, y, 0];
}

/**
 * ONE construction line, recomputed from `params`, so it follows every edit.
 * Returns null when the item does not apply to this solid.
 */
export function constructionSegment(
  solid: Solid3D,
  kind: ConstructionKind,
  fmt: (n: number) => string,
): ConstructionSeg | null {
  const p = solid.params ?? {};
  const r = p.radius ?? (p.size ?? 2) / 2;
  const rTop = p.topRadius ?? 0;
  const h = p.height ?? p.size ?? 2;
  const solidKind = solid.kind;
  const color = CONSTRUCTION_COLORS[kind];

  if (kind === "radius") {
    if (solidKind === "sphere") {
      // Centre → a point on the spherical surface, lifted so the line reads.
      const c: Vec3 = [0, 0, 0];
      const dir: Vec3 = unit([Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0]);
      return { id: "radius", a: c, b: add(c, mul(dir, r)), text: `r = ${fmt(r)}`, color };
    }
    if (solidKind === "hemisphere") {
      // Centre of the flat base → the curved surface, staying in the base plane.
      return { id: "radius", a: [0, 0, 0], b: [r, 0, 0], text: `r = ${fmt(r)}`, color };
    }
    if (isRoundSolid(solidKind)) {
      const c = centreOf(solid)!;
      return { id: "radius", a: c, b: [r, c[1], 0], text: `r = ${fmt(r)}`, color };
    }
    return null;
  }

  if (kind === "topRadius") {
    if (solidKind !== "frustum" || rTop <= 0) return null;
    return { id: "topRadius", a: [0, h / 2, 0], b: [rTop, h / 2, 0], text: `r = ${fmt(rTop)}`, color };
  }

  if (kind === "diameter") {
    if (solidKind === "sphere") {
      return { id: "diameter", a: [-r, 0, 0], b: [r, 0, 0], text: `d = ${fmt(2 * r)}`, color, arrows: true };
    }
    if (solidKind === "hemisphere") {
      // Straight across the flat circular base — never through the curved cap.
      return { id: "diameter", a: [-r, 0, 0], b: [r, 0, 0], text: `d = ${fmt(2 * r)}`, color, arrows: true };
    }
    if (isRoundSolid(solidKind)) {
      const c = centreOf(solid)!;
      return { id: "diameter", a: [-r, c[1], 0], b: [r, c[1], 0], text: `d = ${fmt(2 * r)}`, color, arrows: true };
    }
    return null;
  }

  if (kind === "height") {
    if (solidKind === "sphere") return null;
    const topY = solidKind === "hemisphere" ? r : h / 2;
    const botY = solidKind === "hemisphere" ? 0 : -h / 2;
    return {
      id: "height",
      a: [0, botY, 0],
      b: [0, topY, 0],
      text: `h = ${fmt(topY - botY)}`,
      color,
      dashed: true,
      arrows: true,
    };
  }

  if (kind === "slant") {
    if (solidKind === "cone") {
      return { id: "slant", a: [r, -h / 2, 0], b: [0, h / 2, 0], text: `l = ${fmt(Math.hypot(r, h))}`, color };
    }
    if (solidKind === "frustum") {
      return {
        id: "slant", a: [r, -h / 2, 0], b: [rTop, h / 2, 0],
        text: `l = ${fmt(Math.hypot(h, r - rTop))}`, color,
      };
    }
    if (solidKind.endsWith("Pyramid") || solidKind === "tetrahedron") {
      const topo = topologyFor(solid);
      const base = topo.faces[0];
      if (base?.points && base.points.length > 1) {
        const m = midOf(base.points[0], base.points[1]);
        const apex: Vec3 = [0, h / 2, 0];
        return { id: "slant", a: m, b: apex, text: `l = ${fmt(len(sub(apex, m)))}`, color };
      }
    }
    return null;
  }

  return null;
}

/** Legacy bulk helper — kept so older callers keep compiling. */
export function constructionFor(
  solid: Solid3D,
  opts: ConstructionOptions,
  fmt: (n: number) => string,
): ConstructionSpec {
  const segments: ConstructionSeg[] = [];
  const want: ConstructionKind[] = [];
  if (opts.radius) want.push("radius", "topRadius");
  if (opts.diameter) want.push("diameter");
  if (opts.height) want.push("height");
  if (opts.slantHeight) want.push("slant");
  for (const k of want) {
    const s = constructionSegment(solid, k, fmt);
    if (s) segments.push(s);
  }
  const c = centreOf(solid);
  return { segments, centre: c ? { position: c, label: "O" } : undefined };
}

// ---------------------------------------------------------------- angle arcs

export interface ArcSpec {
  /** Corner the angle sits at. */
  vertex: Vec3;
  /** Unit directions of the two rays. */
  u: Vec3;
  v: Vec3;
  degrees: number;
  radius: number;
}

/** Arc for ∠ABC given three points (B is the corner). */
export function arcFromPoints(a: Vec3, b: Vec3, c: Vec3, size = 0.45): ArcSpec | null {
  const u = sub(a, b);
  const v = sub(c, b);
  if (len(u) < 1e-6 || len(v) < 1e-6) return null;
  const un = unit(u);
  const vn = unit(v);
  const cos = Math.max(-1, Math.min(1, dot(un, vn)));
  const degrees = (Math.acos(cos) * 180) / Math.PI;
  const radius = Math.min(size, len(u) * 0.35, len(v) * 0.35);
  return { vertex: b, u: un, v: vn, degrees, radius };
}

/** Sampled points along the arc, in the plane of the two rays. */
export function arcPoints(spec: ArcSpec, steps = 32): Vec3[] {
  const { vertex, u, v, radius } = spec;
  const n = cross(u, v);
  if (len(n) < 1e-6) return [];
  const w = unit(cross(n, u)); // in-plane, perpendicular to u, towards v
  const total = (spec.degrees * Math.PI) / 180;
  const out: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * total;
    const dir: Vec3 = add(mul(u, Math.cos(t)), mul(w, Math.sin(t)));
    out.push(add(vertex, mul(dir, radius)));
  }
  return out;
}

/** Square marker used for right angles. */
export function rightAngleSquare(spec: ArcSpec): Vec3[] {
  const { vertex, u, v, radius } = spec;
  const s = radius * 0.8;
  const p1 = add(vertex, mul(u, s));
  const p3 = add(vertex, mul(v, s));
  const p2 = add(p1, mul(v, s));
  return [p1, p2, p3];
}

/** Label position for an angle: along the bisector, just outside the arc. */
export function arcLabelPosition(spec: ArcSpec): Vec3 {
  const bis = unit(add(spec.u, spec.v));
  return add(spec.vertex, mul(bis, spec.radius * 1.5));
}

// ---------------------------------------------------------------- marks

export type MarkKind = "equal" | "parallel" | "rightAngle" | "midpoint";

/** Tick / chevron marks drawn across the middle of an edge, textbook style. */
export function markSegments(edge: EdgeEl, mark: MarkKind, count = 1, center: Vec3 = [0, 0, 0]) {
  if (edge.shape !== "straight") return { ticks: [] as [Vec3, Vec3][], dot: null as Vec3 | null };
  const dir = unit(sub(edge.b, edge.a));
  const mid = midOf(edge.a, edge.b);
  const out = perpTo(sub(mid, center), dir);
  const size = 0.11;

  if (mark === "midpoint") return { ticks: [], dot: mid };

  const ticks: [Vec3, Vec3][] = [];
  const n = Math.max(1, count);
  for (let i = 0; i < n; i++) {
    const shift = (i - (n - 1) / 2) * size * 1.4;
    const base = add(mid, mul(dir, shift));
    if (mark === "equal") {
      ticks.push([add(base, mul(out, size)), add(base, mul(out, -size))]);
    } else {
      // parallel chevron: two strokes forming ">"
      const tip = add(base, mul(dir, size));
      ticks.push([add(base, mul(out, size)), tip]);
      ticks.push([add(base, mul(out, -size)), tip]);
    }
  }
  return { ticks, dot: null };
}
