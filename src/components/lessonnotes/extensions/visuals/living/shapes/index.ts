// Shape adapters for living diagrams. Each adapter owns its invariants
// (right angle locked, chord clamped to disk, …) and produces the SVG
// paths + handle list + live-updating labels every frame.

import type { ReactNode } from "react";
import { createElement as h, Fragment } from "react";
import type { Nodes, Point } from "../geometry";
import {
  angleAt, bearing, clamp, clampBox, clampToCircle, dist, formatDeg,
  formatLen, mid, polar, projectOnLine,
} from "../geometry";

export type Handle = { name: string; x: number; y: number };
export type LiveLabel = { x: number; y: number; text: string };
export type RenderOut = { svg: ReactNode; handles: Handle[]; liveLabels: LiveLabel[] };

export type Adapter = {
  initialNodes: Nodes;
  drag: (name: string, x: number, y: number, nodes: Nodes) => Nodes;
  render: (nodes: Nodes) => RenderOut;
  /** Editable properties (Adjust panel). */
  schema?: (nodes: Nodes) => import("../schema").Field[];
  /** Reshape by a typed measurement; return {error} on invalid input. */
  setMeasure?: (name: string, value: number, nodes: Nodes) => Nodes | { error: string };
  /** Menu entries for Add Component. */
  componentMenu?: () => import("../schema").ComponentDef[];
};

// ── tiny SVG helpers ────────────────────────────────────────────────────
const S = "currentColor";
const line = (a: Point, b: Point, key: string, dash?: string, sw = 2) =>
  h("line", { key, x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: S, strokeWidth: sw, strokeDasharray: dash });
const path = (d: string, key: string, sw = 2, fill: string = "none") =>
  h("path", { key, d, stroke: S, strokeWidth: sw, fill });
const poly = (pts: Point[], key: string) =>
  h("polygon", { key, points: pts.map(p => `${p.x},${p.y}`).join(" "), stroke: S, strokeWidth: 2, fill: "none" });
const circleEl = (c: Point, r: number, key: string, sw = 2, fill = "none") =>
  h("circle", { key, cx: c.x, cy: c.y, r, stroke: S, strokeWidth: sw, fill });
const dot = (p: Point, key: string, r = 1.8) =>
  h("circle", { key, cx: p.x, cy: p.y, r, fill: S });

// Right-angle square marker at vertex v, arms going towards a and b.
function rightMark(v: Point, a: Point, b: Point, key: string, size = 10): ReactNode {
  const ua = norm(sub(a, v)); const ub = norm(sub(b, v));
  const p1 = add(v, mul(ua, size));
  const p3 = add(v, mul(ub, size));
  const p2 = add(v, add(mul(ua, size), mul(ub, size)));
  return h("polyline", {
    key, points: `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`,
    stroke: S, strokeWidth: 1.4, fill: "none",
  });
}
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const norm = (a: Point): Point => { const d = Math.hypot(a.x, a.y) || 1; return { x: a.x / d, y: a.y / d }; };

// Small angle arc at vertex b, between rays b→a and b→c.
function angleArc(a: Point, b: Point, c: Point, key: string, r = 14): ReactNode {
  const start = polar(b, r, bearing(b, a));
  const end = polar(b, r, bearing(b, c));
  const ang = angleAt(a, b, c);
  const large = ang > 180 ? 1 : 0;
  // sweep flag chosen so arc lies on the interior side.
  const sweep = crossSign(sub(a, b), sub(c, b)) > 0 ? 0 : 1;
  return h("path", {
    key, d: `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} ${sweep} ${end.x} ${end.y}`,
    stroke: S, strokeWidth: 1.3, fill: "none",
  });
}
const crossSign = (u: Point, v: Point) => Math.sign(u.x * v.y - u.y * v.x);

// ── generic n-gon adapter (drag any vertex freely) ─────────────────────
function polygonAdapter(names: string[], initial: Point[]): Adapter {
  const initialNodes: Nodes = {};
  names.forEach((n, i) => (initialNodes[n] = initial[i]));
  return {
    initialNodes,
    drag: (name, x, y, nodes) => ({ ...nodes, [name]: clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 }) }),
    render: (nodes) => {
      const pts = names.map(n => nodes[n]);
      const handles = names.map(n => ({ name: n, x: nodes[n].x, y: nodes[n].y }));
      const liveLabels: LiveLabel[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]; const b = pts[(i + 1) % pts.length];
        const m = mid(a, b);
        liveLabels.push({ x: m.x, y: m.y, text: formatLen(dist(a, b)) });
      }
      return { svg: poly(pts, "poly"), handles, liveLabels };
    },
  };
}

// ── lines & angles ──────────────────────────────────────────────────────
const lineSegment: Adapter = {
  initialNodes: { A: { x: 30, y: 70 }, B: { x: 170, y: 70 } },
  drag: (n, x, y, nodes) => ({ ...nodes, [n]: clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 }) }),
  render: (nodes) => {
    const { A, B } = nodes;
    return {
      svg: h(Fragment, null, line(A, B, "l"), dot(A, "da"), dot(B, "db")),
      handles: [{ name: "A", ...A }, { name: "B", ...B }],
      liveLabels: [{ ...mid(A, B), text: formatLen(dist(A, B)) }],
    };
  },
};

lineSegment.schema = (n) => [
  { kind: "side", name: "AB", label: "Length AB", value: dist(n.A, n.B) / 10 },
];

lineSegment.setMeasure = (name, value, n): Nodes | { error: string } => {
  if (name !== "AB" && name !== "BA") return { error: "Only length AB is editable." };
  if (!(value > 0)) return { error: "Length must be positive." };
  const a = name === "AB" ? n.A : n.B;
  const b = name === "AB" ? n.B : n.A;
  const current = dist(a, b) || 1;
  const scale = (value * 10) / current;
  const next = {
    x: a.x + (b.x - a.x) * scale,
    y: a.y + (b.y - a.y) * scale,
  };
  return name === "AB" ? { ...n, B: next } : { ...n, A: next };
};

const ray: Adapter = {
  initialNodes: { T: { x: 30, y: 70 }, H: { x: 170, y: 70 } },
  drag: (n, x, y, nodes) => ({ ...nodes, [n]: clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 }) }),
  render: (nodes) => {
    const { T, H } = nodes;
    const u = norm(sub(H, T));
    const tip = add(H, mul(u, -6));
    const left = add(tip, { x: -u.y * 4, y: u.x * 4 });
    const right = add(tip, { x: u.y * 4, y: -u.x * 4 });
    return {
      svg: h(Fragment, null,
        line(T, H, "l"),
        dot(T, "d"),
        path(`M ${H.x} ${H.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`, "arr", 1.2, S),
      ),
      handles: [{ name: "T", ...T }, { name: "H", ...H }],
      liveLabels: [],
    };
  },
};

// Angle: vertex V, arm ends A and B.
function angleAdapter(): Adapter {
  return {
    initialNodes: { V: { x: 40, y: 110 }, A: { x: 180, y: 110 }, B: { x: 150, y: 30 } },
    drag: (n, x, y, nodes) => ({ ...nodes, [n]: clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 }) }),
    render: (nodes) => {
      const { V, A, B } = nodes;
      return {
        svg: h(Fragment, null, line(V, A, "la"), line(V, B, "lb")),
        handles: [{ name: "V", ...V }, { name: "A", ...A }, { name: "B", ...B }],
        liveLabels: [{ ...polar(V, 24, (bearing(V, A) + bearing(V, B)) / 2), text: formatDeg(angleAt(A, V, B)) }],
      };
    },
  };
}

const angleRightAdapter: Adapter = {
  initialNodes: { V: { x: 30, y: 110 }, A: { x: 180, y: 110 } },
  drag: (n, x, y, nodes) => {
    const p = clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 });
    return { ...nodes, [n]: p };
  },
  render: (nodes) => {
    const { V, A } = nodes;
    // B is A rotated +90° around V, distance = |VA|.
    const d = dist(V, A);
    const ang = bearing(V, A) + 90;
    const B = polar(V, d, ang);
    return {
      svg: h(Fragment, null, line(V, A, "la"), line(V, B, "lb")),
      handles: [{ name: "V", ...V }, { name: "A", ...A }],
      liveLabels: [{ ...polar(V, 24, ang - 45), text: "90°" }],
    };
  },
};

// ── triangles ───────────────────────────────────────────────────────────
const triangleScalene = polygonAdapter(["A", "B", "C"], [
  { x: 40, y: 30 }, { x: 20, y: 120 }, { x: 180, y: 100 },
]);

// Right triangle: right angle locked at C. Drag A → vertical over C.
// Drag B → horizontal from C. Drag C → translates whole shape.
const triangleRight: Adapter = {
  initialNodes: { A: { x: 20, y: 20 }, B: { x: 180, y: 120 }, C: { x: 20, y: 120 } },
  drag: (name, x, y, nodes): Nodes => {
    const p = clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 });
    if (name === "C") {
      // translate all three, preserving the right angle.
      const dx = p.x - nodes.C.x, dy = p.y - nodes.C.y;
      return { A: { x: nodes.A.x + dx, y: nodes.A.y + dy },
               B: { x: nodes.B.x + dx, y: nodes.B.y + dy }, C: p };
    }
    if (name === "A") return { ...nodes, A: { x: nodes.C.x, y: p.y } };
    if (name === "B") return { ...nodes, B: { x: p.x, y: nodes.C.y } };
    return nodes;
  },
  render: (nodes) => {
    const { A, B, C } = nodes;
    return {
      svg: h(Fragment, null, poly([A, B, C], "t")),
      handles: [{ name: "A", ...A }, { name: "B", ...B }, { name: "C", ...C }],
      liveLabels: [
        { ...mid(A, C), text: formatLen(dist(A, C)) },
        { ...mid(B, C), text: formatLen(dist(B, C)) },
        { ...mid(A, B), text: formatLen(dist(A, B)) },
        { ...polar(A, 18, bearing(A, mid(B, C))), text: formatDeg(angleAt(B, A, C)) },
        { ...polar(B, 18, bearing(B, mid(A, C))), text: formatDeg(angleAt(A, B, C)) },
      ],
    };
  },
};

// Isosceles: apex A, base BC. Drag A moves apex, base stays symmetric under A.
const triangleIso: Adapter = {
  initialNodes: { A: { x: 100, y: 20 }, B: { x: 20, y: 120 }, C: { x: 180, y: 120 } },
  drag: (name, x, y, nodes): Nodes => {
    const p = clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 });
    const baseY = nodes.B.y;
    const mx = (nodes.B.x + nodes.C.x) / 2;
    if (name === "A") return { ...nodes, A: { x: mx, y: p.y } };
    if (name === "B") {
      const half = mx - p.x;
      return { ...nodes, B: { x: mx - half, y: baseY }, C: { x: mx + half, y: baseY }, A: { x: mx, y: nodes.A.y } };
    }
    if (name === "C") {
      const half = p.x - mx;
      return { ...nodes, B: { x: mx - half, y: baseY }, C: { x: mx + half, y: baseY }, A: { x: mx, y: nodes.A.y } };
    }
    return nodes;
  },
  render: (nodes) => {
    const { A, B, C } = nodes;
    return {
      svg: poly([A, B, C], "t"),
      handles: [{ name: "A", ...A }, { name: "B", ...B }, { name: "C", ...C }],
      liveLabels: [
        { ...mid(A, B), text: formatLen(dist(A, B)) },
        { ...mid(A, C), text: formatLen(dist(A, C)) },
        { ...mid(B, C), text: formatLen(dist(B, C)) },
      ],
    };
  },
};

// Equilateral: single "size" handle at B. C mirrors B, A is apex.
const triangleEqui: Adapter = {
  initialNodes: { B: { x: 20, y: 120 }, C: { x: 180, y: 120 }, A: { x: 100, y: 120 - (160 * Math.sqrt(3)) / 2 } },
  drag: (name, x, y, nodes): Nodes => {
    const p = clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 });
    const cx = (nodes.B.x + nodes.C.x) / 2;
    const baseY = nodes.B.y;
    let half: number;
    if (name === "B") half = Math.max(10, cx - p.x);
    else if (name === "C") half = Math.max(10, p.x - cx);
    else return nodes; // A locked
    const B = { x: cx - half, y: baseY };
    const C = { x: cx + half, y: baseY };
    const A = { x: cx, y: baseY - half * Math.sqrt(3) };
    return { A, B, C };
  },
  render: (nodes) => {
    const { A, B, C } = nodes;
    return {
      svg: poly([A, B, C], "t"),
      handles: [{ name: "B", ...B }, { name: "C", ...C }],
      liveLabels: [{ ...mid(B, C), text: formatLen(dist(B, C)) }],
    };
  },
};

const triangleHyp: Adapter = triangleRight;

const triangleAltitude: Adapter = {
  ...triangleScalene,
  render: (nodes) => {
    const { A, B, C } = nodes;
    const foot = projectOnLine(A, B, C);
    return {
      svg: h(Fragment, null,
        poly([A, B, C], "t"),
        line(A, foot, "h", "4 3", 1.5),
      ),
      handles: [{ name: "A", ...A }, { name: "B", ...B }, { name: "C", ...C }],
      liveLabels: [
        { ...mid(A, foot), text: formatLen(dist(A, foot)) },
        { ...mid(B, C), text: formatLen(dist(B, C)) },
      ],
    };
  },
};

// ── quadrilaterals with invariants ─────────────────────────────────────
const rectangle: Adapter = {
  initialNodes: { TL: { x: 20, y: 30 }, BR: { x: 180, y: 110 } },
  drag: (name, x, y, nodes): Nodes => {
    const p = clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 });
    return { ...nodes, [name]: p };
  },
  render: (nodes) => {
    const { TL, BR } = nodes;
    const TR = { x: BR.x, y: TL.y };
    const BL = { x: TL.x, y: BR.y };
    return {
      svg: poly([TL, TR, BR, BL], "r"),
      handles: [{ name: "TL", ...TL }, { name: "BR", ...BR }],
      liveLabels: [
        { ...mid(TL, TR), text: formatLen(Math.abs(BR.x - TL.x)) },
        { ...mid(TR, BR), text: formatLen(Math.abs(BR.y - TL.y)) },
      ],
    };
  },
};

const square: Adapter = {
  initialNodes: { TL: { x: 40, y: 20 }, BR: { x: 160, y: 140 } },
  drag: (name, x, y, nodes): Nodes => {
    const p = clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 });
    if (name === "TL") {
      const size = Math.min(nodes.BR.x - p.x, nodes.BR.y - p.y);
      if (size < 10) return nodes;
      return { TL: { x: nodes.BR.x - size, y: nodes.BR.y - size }, BR: nodes.BR };
    }
    if (name === "BR") {
      const size = Math.min(p.x - nodes.TL.x, p.y - nodes.TL.y);
      if (size < 10) return nodes;
      return { TL: nodes.TL, BR: { x: nodes.TL.x + size, y: nodes.TL.y + size } };
    }
    return nodes;
  },
  render: (nodes) => {
    const { TL, BR } = nodes;
    const TR = { x: BR.x, y: TL.y };
    const BL = { x: TL.x, y: BR.y };
    const s = Math.abs(BR.x - TL.x);
    return {
      svg: poly([TL, TR, BR, BL], "sq"),
      handles: [{ name: "TL", ...TL }, { name: "BR", ...BR }],
      liveLabels: [{ ...mid(TL, TR), text: formatLen(s) }],
    };
  },
};

const parallelogram: Adapter = polygonAdapter(["A", "B", "C", "D"],
  [{ x: 40, y: 110 }, { x: 70, y: 30 }, { x: 180, y: 30 }, { x: 150, y: 110 }]);

const trapezium: Adapter = polygonAdapter(["A", "B", "C", "D"],
  [{ x: 20, y: 110 }, { x: 60, y: 30 }, { x: 140, y: 30 }, { x: 180, y: 110 }]);

const rhombus: Adapter = polygonAdapter(["N", "E", "S", "W"],
  [{ x: 100, y: 20 }, { x: 170, y: 70 }, { x: 100, y: 120 }, { x: 30, y: 70 }]);

const kite: Adapter = polygonAdapter(["N", "E", "S", "W"],
  [{ x: 100, y: 20 }, { x: 160, y: 70 }, { x: 100, y: 130 }, { x: 40, y: 70 }]);

// Scale a side to a target length while keeping the opposite side parallel.
// Returns new nodes with vertex `bName` moved along the AB direction.
function scaleSide(nodes: Nodes, aName: string, bName: string, targetPx: number): Nodes | null {
  const a = nodes[aName]; const b = nodes[bName];
  if (!a || !b) return null;
  const cur = Math.hypot(b.x - a.x, b.y - a.y);
  if (cur < 1e-6) return null;
  const k = targetPx / cur;
  const nb = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  return { ...nodes, [bName]: nb };
}

// ── parallelogram: opposite sides equal (AB=CD, BC=DA) ─────────────────
parallelogram.schema = (n) => {
  const AB = dist(n.A, n.B) / 10;
  const BC = dist(n.B, n.C) / 10;
  return [
    { kind: "side", name: "AB", label: "Side AB (=CD)", value: AB },
    { kind: "side", name: "BC", label: "Side BC (=DA)", value: BC },
  ];
};
parallelogram.setMeasure = (name, value, n): Nodes | { error: string } => {
  const px = value * 10;
  if (!(px > 0)) return { error: "Must be positive." };
  if (name === "AB" || name === "CD") {
    // Rescale A→B and D→C together to keep the parallelogram.
    const AB = { x: n.B.x - n.A.x, y: n.B.y - n.A.y };
    const cur = Math.hypot(AB.x, AB.y) || 1;
    const u = { x: AB.x / cur, y: AB.y / cur };
    return {
      ...n,
      B: { x: n.A.x + u.x * px, y: n.A.y + u.y * px },
      C: { x: n.D.x + u.x * px, y: n.D.y + u.y * px },
    };
  }
  if (name === "BC" || name === "DA") {
    const BC = { x: n.C.x - n.B.x, y: n.C.y - n.B.y };
    const cur = Math.hypot(BC.x, BC.y) || 1;
    const u = { x: BC.x / cur, y: BC.y / cur };
    return {
      ...n,
      C: { x: n.B.x + u.x * px, y: n.B.y + u.y * px },
      D: { x: n.A.x + u.x * px, y: n.A.y + u.y * px },
    };
  }
  return { error: "Not editable." };
};

// ── rhombus: all four sides equal ──────────────────────────────────────
rhombus.schema = (n) => {
  const s = dist(n.N, n.E) / 10;
  return [{ kind: "side", name: "side", label: "Side (all equal)", value: s }];
};
rhombus.setMeasure = (name, value, n): Nodes | { error: string } => {
  const px = value * 10;
  if (!(px > 0)) return { error: "Must be positive." };
  const cx = (n.N.x + n.S.x) / 2;
  const cy = (n.E.y + n.W.y) / 2;
  const halfV = Math.hypot(n.N.x - cx, n.N.y - cy);
  const halfH = Math.hypot(n.E.x - cx, n.E.y - cy);
  // Preserve ratio of the two diagonals, scale so side length = px.
  const ratio = halfV / (halfH || 1);
  // side² = halfH² + halfV², halfV = ratio*halfH → halfH = px/√(1+ratio²)
  const nh = px / Math.sqrt(1 + ratio * ratio);
  const nv = ratio * nh;
  return {
    N: { x: cx, y: cy - nv },
    S: { x: cx, y: cy + nv },
    E: { x: cx + nh, y: cy },
    W: { x: cx - nh, y: cy },
  };
};

// ── kite: NE = NW and SE = SW ──────────────────────────────────────────
kite.schema = (n) => {
  const top = dist(n.N, n.E) / 10;
  const bot = dist(n.S, n.E) / 10;
  return [
    { kind: "side", name: "top", label: "Top sides (NE=NW)", value: top },
    { kind: "side", name: "bottom", label: "Bottom sides (SE=SW)", value: bot },
  ];
};
kite.setMeasure = (name, value, n): Nodes | { error: string } => {
  const px = value * 10;
  if (!(px > 0)) return { error: "Must be positive." };
  const cx = (n.E.x + n.W.x) / 2;
  // Reposition E/W symmetrically around cx at the correct height for the chosen side length.
  const eY = n.E.y;
  if (name === "top") {
    const dy = n.N.y - eY;
    const halfH = Math.sqrt(Math.max(0, px * px - dy * dy));
    return { ...n, E: { x: cx + halfH, y: eY }, W: { x: cx - halfH, y: eY } };
  }
  if (name === "bottom") {
    const dy = n.S.y - eY;
    const halfH = Math.sqrt(Math.max(0, px * px - dy * dy));
    return { ...n, E: { x: cx + halfH, y: eY }, W: { x: cx - halfH, y: eY } };
  }
  return { error: "Not editable." };
};

// Regular polygon via single size handle. Store centre + one vertex.
function regularPolyAdapter(sides: number, initR = 55): Adapter {
  const adapter: Adapter = {
    initialNodes: { C: { x: 100, y: 70 }, V: { x: 100, y: 70 - initR } },
    drag: (name, x, y, nodes): Nodes => {
      const p = clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 });
      if (name === "C") {
        const dx = p.x - nodes.C.x, dy = p.y - nodes.C.y;
        return { C: p, V: { x: nodes.V.x + dx, y: nodes.V.y + dy } };
      }
      if (name === "V") return { ...nodes, V: p };
      return nodes;
    },
    render: (nodes) => {
      const { C, V } = nodes;
      const r = dist(C, V);
      const start = bearing(C, V);
      const pts: Point[] = [];
      for (let i = 0; i < sides; i++) pts.push(polar(C, r, start - (360 * i) / sides));
      return {
        svg: poly(pts, "p"),
        handles: [{ name: "C", ...C }, { name: "V", ...V }],
        liveLabels: [{ ...mid(pts[0], pts[1]), text: formatLen(dist(pts[0], pts[1])) }],
      };
    },
  };
  // Regular n-gon side length s = 2 r sin(π/n). Editing "side" scales radius.
  adapter.schema = (n) => {
    const r = dist(n.C, n.V);
    const s = 2 * r * Math.sin(Math.PI / sides);
    return [
      { kind: "side", name: "side", label: "Side length", value: s / 10 },
      { kind: "angle", name: "interior", label: "Interior angle", value: ((sides - 2) * 180) / sides, locked: true },
    ];
  };
  adapter.setMeasure = (name, value, n): Nodes | { error: string } => {
    if (name !== "side") return { error: "Not editable." };
    const px = value * 10;
    if (!(px > 0)) return { error: "Must be positive." };
    const nr = px / (2 * Math.sin(Math.PI / sides));
    const ang = bearing(n.C, n.V);
    return { ...n, V: polar(n.C, nr, ang) };
  };
  return adapter;
}

// ── circles ─────────────────────────────────────────────────────────────
function circleBase(): Adapter {
  return {
    initialNodes: { C: { x: 100, y: 70 }, R: { x: 160, y: 70 } },
    drag: (name, x, y, nodes): Nodes => {
      const p = clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 });
      if (name === "C") {
        const dx = p.x - nodes.C.x, dy = p.y - nodes.C.y;
        return { C: p, R: { x: nodes.R.x + dx, y: nodes.R.y + dy } };
      }
      return { ...nodes, R: p };
    },
    render: (nodes) => {
      const { C, R } = nodes;
      const r = dist(C, R);
      return {
        svg: circleEl(C, r, "c"),
        handles: [{ name: "C", ...C }, { name: "R", ...R }],
        liveLabels: [{ ...mid(C, R), text: `r=${formatLen(r)}` }],
      };
    },
  };
}

const circleRadius: Adapter = {
  ...circleBase(),
  render: (nodes) => {
    const { C, R } = nodes;
    const r = dist(C, R);
    return {
      svg: h(Fragment, null, circleEl(C, r, "c"), line(C, R, "r"), dot(C, "dc")),
      handles: [{ name: "C", ...C }, { name: "R", ...R }],
      liveLabels: [{ ...mid(C, R), text: `r=${formatLen(r)}` }],
    };
  },
};

const circleDiameter: Adapter = {
  ...circleBase(),
  render: (nodes) => {
    const { C, R } = nodes;
    const r = dist(C, R);
    const R2 = { x: 2 * C.x - R.x, y: 2 * C.y - R.y };
    return {
      svg: h(Fragment, null, circleEl(C, r, "c"), line(R2, R, "d")),
      handles: [{ name: "C", ...C }, { name: "R", ...R }],
      liveLabels: [{ ...mid(R2, R), text: `d=${formatLen(2 * r)}` }],
    };
  },
};

// Sector: centre + two rim endpoints A, B (both stay on circle radius = |CA|).
const circleSector: Adapter = {
  initialNodes: { C: { x: 100, y: 70 }, A: { x: 160, y: 70 }, B: { x: 100, y: 20 } },
  drag: (name, x, y, nodes): Nodes => {
    const p = clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 });
    if (name === "C") {
      const dx = p.x - nodes.C.x, dy = p.y - nodes.C.y;
      return { C: p, A: { x: nodes.A.x + dx, y: nodes.A.y + dy }, B: { x: nodes.B.x + dx, y: nodes.B.y + dy } };
    }
    const r = dist(nodes.C, nodes.A);
    if (name === "A") {
      // dragging A resizes radius; B follows so its bearing stays the same.
      const nr = Math.max(15, dist(nodes.C, p));
      const angA = bearing(nodes.C, p);
      const angB = bearing(nodes.C, nodes.B);
      return { C: nodes.C, A: polar(nodes.C, nr, angA), B: polar(nodes.C, nr, angB) };
    }
    if (name === "B") {
      return { ...nodes, B: polar(nodes.C, r, bearing(nodes.C, p)) };
    }
    return nodes;
  },
  render: (nodes) => {
    const { C, A, B } = nodes;
    const r = dist(C, A);
    const ang = angleAt(A, C, B);
    const large = ang > 180 ? 1 : 0;
    const sweep = crossSign(sub(A, C), sub(B, C)) > 0 ? 0 : 1;
    const d = `M ${C.x} ${C.y} L ${A.x} ${A.y} A ${r} ${r} 0 ${large} ${sweep} ${B.x} ${B.y} Z`;
    return {
      svg: path(d, "s"),
      handles: [{ name: "C", ...C }, { name: "A", ...A }, { name: "B", ...B }],
      liveLabels: [{ ...polar(C, 20, (bearing(C, A) + bearing(C, B)) / 2), text: formatDeg(ang) }],
    };
  },
};

// Chord/segment: centre, radius handle R (on circle), chord midpoint M clamped inside disk.
const circleSegmentChord: Adapter = {
  initialNodes: { C: { x: 100, y: 70 }, R: { x: 160, y: 70 }, M: { x: 100, y: 40 } },
  drag: (name, x, y, nodes): Nodes => {
    const p = clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 });
    if (name === "C") {
      const dx = p.x - nodes.C.x, dy = p.y - nodes.C.y;
      return { C: p, R: { x: nodes.R.x + dx, y: nodes.R.y + dy }, M: { x: nodes.M.x + dx, y: nodes.M.y + dy } };
    }
    if (name === "R") return { ...nodes, R: p };
    const r = dist(nodes.C, nodes.R);
    return { ...nodes, M: clampToCircle(p, nodes.C, r - 1) };
  },
  render: (nodes) => {
    const { C, R, M } = nodes;
    const r = dist(C, R);
    // Chord perpendicular to CM through M, endpoints on circle.
    const cm = sub(M, C);
    const perp = norm({ x: -cm.y, y: cm.x });
    const h2 = Math.sqrt(Math.max(0, r * r - (cm.x * cm.x + cm.y * cm.y)));
    const P1 = add(M, mul(perp, h2));
    const P2 = add(M, mul(perp, -h2));
    return {
      svg: h(Fragment, null, circleEl(C, r, "c"), line(P1, P2, "chord")),
      handles: [{ name: "C", ...C }, { name: "R", ...R }, { name: "M", ...M }],
      liveLabels: [{ ...mid(P1, P2), text: formatLen(dist(P1, P2)) }],
    };
  },
};

// Tangent: circle + tangent point T on circle, tangent line drawn.
const circleTangent: Adapter = {
  initialNodes: { C: { x: 100, y: 70 }, R: { x: 160, y: 70 }, T: { x: 100, y: 20 } },
  drag: (name, x, y, nodes): Nodes => {
    const p = clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 });
    if (name === "C") {
      const dx = p.x - nodes.C.x, dy = p.y - nodes.C.y;
      return { C: p, R: { x: nodes.R.x + dx, y: nodes.R.y + dy }, T: { x: nodes.T.x + dx, y: nodes.T.y + dy } };
    }
    const r = dist(nodes.C, nodes.R);
    if (name === "R") {
      const nr = Math.max(15, dist(nodes.C, p));
      return { C: nodes.C, R: p, T: polar(nodes.C, nr, bearing(nodes.C, nodes.T)) };
    }
    return { ...nodes, T: polar(nodes.C, r, bearing(nodes.C, p)) };
  },
  render: (nodes) => {
    const { C, R, T } = nodes;
    const r = dist(C, R);
    const u = norm(sub(T, C));
    const tangent = { x: -u.y, y: u.x };
    const p1 = add(T, mul(tangent, 60));
    const p2 = add(T, mul(tangent, -60));
    return {
      svg: h(Fragment, null, circleEl(C, r, "c"), line(p1, p2, "t"), dot(T, "dt")),
      handles: [{ name: "C", ...C }, { name: "R", ...R }, { name: "T", ...T }],
      liveLabels: [],
    };
  },
};

const circleInscribed: Adapter = {
  initialNodes: {
    C: { x: 100, y: 70 }, R: { x: 160, y: 70 },
    A: polar({ x: 100, y: 70 }, 60, 90),
    B: polar({ x: 100, y: 70 }, 60, 210),
    D: polar({ x: 100, y: 70 }, 60, 330),
  },
  drag: (name, x, y, nodes): Nodes => {
    const p = clampBox({ x, y }, { x: 4, y: 4 }, { x: 196, y: 136 });
    if (name === "C") {
      const dx = p.x - nodes.C.x, dy = p.y - nodes.C.y;
      const t: Nodes = {};
      for (const k of Object.keys(nodes)) t[k] = { x: nodes[k].x + dx, y: nodes[k].y + dy };
      t.C = p; return t;
    }
    const r = dist(nodes.C, nodes.R);
    if (name === "R") {
      const nr = Math.max(15, dist(nodes.C, p));
      return {
        C: nodes.C, R: p,
        A: polar(nodes.C, nr, bearing(nodes.C, nodes.A)),
        B: polar(nodes.C, nr, bearing(nodes.C, nodes.B)),
        D: polar(nodes.C, nr, bearing(nodes.C, nodes.D)),
      };
    }
    return { ...nodes, [name]: polar(nodes.C, r, bearing(nodes.C, p)) };
  },
  render: (nodes) => {
    const { C, R, A, B, D } = nodes;
    const r = dist(C, R);
    return {
      svg: h(Fragment, null, circleEl(C, r, "c"), poly([A, B, D], "p")),
      handles: [
        { name: "C", ...C }, { name: "R", ...R },
        { name: "A", ...A }, { name: "B", ...B }, { name: "D", ...D },
      ],
      liveLabels: [],
    };
  },
};

const cyclicQuadrilateral: Adapter = {
  initialNodes: {
    C: { x: 100, y: 70 }, R: { x: 160, y: 70 },
    A: polar({ x: 100, y: 70 }, 60, 60),
    B: polar({ x: 100, y: 70 }, 60, 150),
    D: polar({ x: 100, y: 70 }, 60, 240),
    E: polar({ x: 100, y: 70 }, 60, 330),
  },
  drag: circleInscribed.drag as Adapter["drag"], // same behaviour
  render: (nodes) => {
    const { C, R, A, B, D, E } = nodes;
    const r = dist(C, R);
    return {
      svg: h(Fragment, null, circleEl(C, r, "c"), poly([A, B, D, E], "p")),
      handles: [
        { name: "C", ...C }, { name: "R", ...R },
        { name: "A", ...A }, { name: "B", ...B }, { name: "D", ...D }, { name: "E", ...E },
      ],
      liveLabels: [],
    };
  },
};

// ── adapter extensions: schema / setMeasure / componentMenu ─────────────
import type { Field, ComponentDef } from "../schema";

const triangleGeometryMenu = (): ComponentDef[] => [
  { kind: "altitude",       label: "Altitude",       group: "Geometry", needs: [{ key: "from", label: "From vertex",  from: "vertex" }, { key: "to", label: "To side", from: "side" }] },
  { kind: "median",         label: "Median",         group: "Geometry", needs: [{ key: "from", label: "From vertex",  from: "vertex" }, { key: "to", label: "To side", from: "side" }] },
  { kind: "midpoint",       label: "Midpoint",       group: "Geometry", needs: [{ key: "side", label: "On side",      from: "side"   }] },
  { kind: "perpendicular",  label: "Perpendicular",  group: "Geometry", needs: [{ key: "from", label: "Through point", from: "vertex" }, { key: "to", label: "To side", from: "side" }] },
  { kind: "parallel",       label: "Parallel line",  group: "Geometry", needs: [{ key: "from", label: "Through point", from: "vertex" }, { key: "to", label: "Parallel to", from: "side" }] },
  { kind: "point",          label: "Point",          group: "Geometry", disabled: true },
  { kind: "lineSegment",    label: "Line segment",   group: "Geometry", disabled: true },
  { kind: "ray",            label: "Ray",            group: "Geometry", disabled: true },
  { kind: "bisector",       label: "Bisector",       group: "Geometry", disabled: true },
  { kind: "vector",         label: "Vector",         group: "Geometry", disabled: true },

  { kind: "pointLabel",     label: "Point label",    group: "Labels",   disabled: true },
  { kind: "sideLabel",      label: "Side label",     group: "Labels",   disabled: true },
  { kind: "angleLabel",     label: "Angle label",    group: "Labels",   disabled: true },
  { kind: "textNote",       label: "Text note",      group: "Labels",   disabled: true },

  { kind: "lengthMeasure",  label: "Length",         group: "Measurements", needs: [{ key: "side", label: "Side", from: "side" }] },
  { kind: "angleMeasure",   label: "Angle",          group: "Measurements", needs: [{ key: "vertex", label: "At vertex", from: "vertex" }, { key: "a", label: "Arm 1", from: "vertex" }, { key: "b", label: "Arm 2", from: "vertex" }] },
  { kind: "areaMeasure",    label: "Area",           group: "Measurements", disabled: true },
  { kind: "perimeterMeasure", label: "Perimeter",    group: "Measurements", disabled: true },

  { kind: "rightAngleMark", label: "Right-angle mark", group: "Marks", needs: [{ key: "vertex", label: "Vertex", from: "vertex" }, { key: "a", label: "Arm 1", from: "vertex" }, { key: "b", label: "Arm 2", from: "vertex" }] },
  { kind: "equalTicks",     label: "Equal-length ticks", group: "Marks", needs: [{ key: "side", label: "Side", from: "side" }] },
  { kind: "parallelArrows", label: "Parallel arrows",   group: "Marks", disabled: true },
  { kind: "congruentMarks", label: "Congruent marks",   group: "Marks", disabled: true },

  { kind: "childTriangle",  label: "Triangle",       group: "Shapes",   disabled: true },
  { kind: "childCircle",    label: "Circle",         group: "Shapes",   disabled: true },
  { kind: "childRectangle", label: "Rectangle",      group: "Shapes",   disabled: true },
  { kind: "childPolygon",   label: "Polygon",        group: "Shapes",   disabled: true },
];

// Triangle scalene — free vertices; sides/angles read live.
triangleScalene.schema = (n) => {
  const { A, B, C } = n;
  return [
    { kind: "side",  name: "AB", label: "Side AB", value: dist(A, B) / 10 },
    { kind: "side",  name: "BC", label: "Side BC", value: dist(B, C) / 10 },
    { kind: "side",  name: "AC", label: "Side AC", value: dist(A, C) / 10 },
    { kind: "angle", name: "A",  label: "∠A",      value: angleAt(B, A, C) },
    { kind: "angle", name: "B",  label: "∠B",      value: angleAt(A, B, C) },
    { kind: "angle", name: "C",  label: "∠C",      value: angleAt(A, C, B) },
  ];
};
triangleScalene.componentMenu = triangleGeometryMenu;
triangleScalene.setMeasure = (name, value, n): Nodes | { error: string } => {
  const px = value * 10;
  if (!(px > 0)) return { error: "Must be positive." };
  const stretch = (aN: keyof typeof n, bN: keyof typeof n) => {
    const a = n[aN]; const b = n[bN];
    const cur = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const k = px / cur;
    return { ...n, [bN]: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k } };
  };
  if (name === "AB" || name === "BA") return stretch("A", "B");
  if (name === "BC" || name === "CB") return stretch("B", "C");
  if (name === "AC" || name === "CA") return stretch("A", "C");
  return { error: "Not editable." };
};

// Isoceles — apex A, base BC. Editing "AB" keeps AC=AB (mirrors apex).
triangleIso.schema = (n) => {
  const { A, B, C } = n;
  return [
    { kind: "side", name: "AB", label: "Leg AB (=AC)", value: dist(A, B) / 10 },
    { kind: "side", name: "BC", label: "Base BC",      value: dist(B, C) / 10 },
  ];
};
triangleIso.setMeasure = (name, value, n): Nodes | { error: string } => {
  const px = value * 10;
  if (!(px > 0)) return { error: "Must be positive." };
  const cx = (n.B.x + n.C.x) / 2;
  const baseY = n.B.y;
  if (name === "AB" || name === "AC") {
    // Move apex up/down along vertical axis so |AB| = px, keeping base fixed.
    const halfBase = (n.C.x - n.B.x) / 2;
    if (Math.abs(halfBase) >= px) return { error: "Leg must exceed half the base." };
    const h = Math.sqrt(px * px - halfBase * halfBase);
    const sign = n.A.y <= baseY ? -1 : 1;
    return { ...n, A: { x: cx, y: baseY + sign * h } };
  }
  if (name === "BC") {
    const half = px / 2;
    return {
      ...n,
      B: { x: cx - half, y: baseY },
      C: { x: cx + half, y: baseY },
      A: { x: cx, y: n.A.y },
    };
  }
  return { error: "Not editable." };
};
triangleIso.componentMenu = triangleGeometryMenu;

// Equilateral — one editable side.
triangleEqui.schema = (n) => {
  const s = dist(n.B, n.C) / 10;
  return [
    { kind: "side",  name: "side", label: "Side length", value: s },
    { kind: "angle", name: "all",  label: "All angles",  value: 60, locked: true },
  ];
};
triangleEqui.setMeasure = (name, value, n): Nodes | { error: string } => {
  if (name !== "side") return { error: "Only 'side' is editable." };
  if (!(value > 0)) return { error: "Side must be positive." };
  const half = (value * 10) / 2;
  const cx = (n.B.x + n.C.x) / 2;
  const baseY = n.B.y;
  return {
    B: { x: cx - half, y: baseY },
    C: { x: cx + half, y: baseY },
    A: { x: cx, y: baseY - half * Math.sqrt(3) },
  };
};
triangleEqui.componentMenu = triangleGeometryMenu;

// Right triangle — C is the right angle. Legs AC (vertical) and BC (horizontal).
triangleRight.schema = (n) => {
  const { A, B, C } = n;
  const AC = dist(A, C), BC = dist(B, C), AB = dist(A, B);
  return [
    { kind: "side",  name: "AC", label: "Leg AC",       value: AC / 10 },
    { kind: "side",  name: "BC", label: "Leg BC",       value: BC / 10 },
    { kind: "side",  name: "AB", label: "Hypotenuse AB", value: AB / 10 },
    { kind: "angle", name: "A",  label: "∠A",           value: angleAt(B, A, C) },
    { kind: "angle", name: "B",  label: "∠B",           value: angleAt(A, B, C) },
    { kind: "angle", name: "C",  label: "∠C = 90°",     value: 90, locked: true },
  ];
};
triangleRight.setMeasure = (name, value, n): Nodes | { error: string } => {
  const px = value * 10;
  const { A, B, C } = n;
  if (name === "AC") {
    if (!(px > 0)) return { error: "Leg must be positive." };
    // A is directly above/below C.
    const sign = A.y <= C.y ? -1 : 1;
    return { ...n, A: { x: C.x, y: C.y + sign * px } };
  }
  if (name === "BC") {
    if (!(px > 0)) return { error: "Leg must be positive." };
    const sign = B.x >= C.x ? 1 : -1;
    return { ...n, B: { x: C.x + sign * px, y: C.y } };
  }
  if (name === "AB") {
    if (!(px > 0)) return { error: "Hypotenuse must be positive." };
    const AC = dist(A, C);
    if (px <= AC) return { error: "Hypotenuse must exceed leg AC." };
    // keep AC, recompute BC.
    const BCnew = Math.sqrt(px * px - AC * AC);
    const sign = B.x >= C.x ? 1 : -1;
    return { ...n, B: { x: C.x + sign * BCnew, y: C.y } };
  }
  if (name === "A" || name === "B") {
    if (!(value > 0 && value < 90)) return { error: "Angle must be between 0° and 90°." };
    const angA = name === "A" ? value : 90 - value;
    // keep AC fixed, BC = AC * tan(angA).
    const AC = dist(A, C);
    const BCnew = AC * Math.tan((angA * Math.PI) / 180);
    const sign = B.x >= C.x ? 1 : -1;
    return { ...n, B: { x: C.x + sign * BCnew, y: C.y } };
  }
  return { error: "This value is locked." };
};
triangleRight.componentMenu = triangleGeometryMenu;

// Rectangle — width × height.
rectangle.schema = (n) => {
  const w = Math.abs(n.BR.x - n.TL.x) / 10;
  const h2 = Math.abs(n.BR.y - n.TL.y) / 10;
  return [
    { kind: "side", name: "width",  label: "Width",  value: w },
    { kind: "side", name: "height", label: "Height", value: h2 },
    { kind: "angle", name: "corner", label: "All corners", value: 90, locked: true },
  ];
};
rectangle.setMeasure = (name, value, n): Nodes | { error: string } => {
  const px = value * 10;
  if (!(px > 0)) return { error: "Must be positive." };
  if (name === "width")  return { TL: n.TL, BR: { x: n.TL.x + px, y: n.BR.y } };
  if (name === "height") return { TL: n.TL, BR: { x: n.BR.x, y: n.TL.y + px } };
  return { error: "Locked." };
};
rectangle.componentMenu = () => [
  { kind: "midpoint",       label: "Midpoint",     group: "Geometry",  needs: [{ key: "side", label: "On side", from: "side" }] },
  { kind: "lengthMeasure",  label: "Length",       group: "Measurements", needs: [{ key: "side", label: "Side", from: "side" }] },
  { kind: "equalTicks",     label: "Equal ticks",  group: "Marks",     needs: [{ key: "side", label: "Side", from: "side" }] },
  { kind: "rightAngleMark", label: "Right-angle mark", group: "Marks", needs: [{ key: "vertex", label: "Vertex", from: "vertex" }, { key: "a", label: "Arm 1", from: "vertex" }, { key: "b", label: "Arm 2", from: "vertex" }] },
];

// Square — single side.
square.schema = (n) => [
  { kind: "side", name: "side", label: "Side", value: Math.abs(n.BR.x - n.TL.x) / 10 },
];
square.setMeasure = (name, value, n): Nodes | { error: string } => {
  const px = value * 10;
  if (name !== "side") return { error: "Locked." };
  if (!(px > 0)) return { error: "Must be positive." };
  return { TL: n.TL, BR: { x: n.TL.x + px, y: n.TL.y + px } };
};
square.componentMenu = rectangle.componentMenu;

// Circle base — radius/diameter editable.
function circleSchema(n: Nodes): Field[] {
  const C = n.C ?? { x: 0, y: 0 };
  const R = n.R ?? { x: C.x + 10, y: C.y };
  const r = dist(C, R) / 10;
  return [
    { kind: "coord", name: "C",        label: "Centre",   x: C.x / 10, y: C.y / 10 },
    { kind: "side",  name: "radius",   label: "Radius",   value: r },
    { kind: "side",  name: "diameter", label: "Diameter", value: r * 2 },
  ];
}

function circleSetMeasure(name: string, value: number, n: Nodes): Nodes | { error: string } {
  const px = value * 10;
  if (!(px > 0)) return { error: "Must be positive." };
  if (name === "radius")   return { ...n, R: { x: n.C.x + px, y: n.C.y } };
  if (name === "diameter") return { ...n, R: { x: n.C.x + px / 2, y: n.C.y } };
  return { error: "Not editable numerically." };
}
const circleMenu = (): ComponentDef[] => [
  { kind: "midpoint",       label: "Point on circle",  group: "Geometry",     disabled: true },
  { kind: "chord",          label: "Chord",            group: "Geometry",     disabled: true },
  { kind: "radius",         label: "Radius",           group: "Geometry",     disabled: true },
  { kind: "diameter",       label: "Diameter",         group: "Geometry",     disabled: true },
  { kind: "tangent",        label: "Tangent",          group: "Geometry",     disabled: true },
  { kind: "arc",            label: "Arc",              group: "Geometry",     disabled: true },
  { kind: "areaMeasure",    label: "Area",             group: "Measurements", disabled: true },
  { kind: "perimeterMeasure", label: "Circumference",  group: "Measurements", disabled: true },
];
for (const a of [circleRadius, circleDiameter, circleSector, circleSegmentChord, circleTangent, circleInscribed, cyclicQuadrilateral]) {
  a.schema = circleSchema;
  a.setMeasure = circleSetMeasure;
  a.componentMenu = circleMenu;
}

// ── registry ────────────────────────────────────────────────────────────
const circle = circleBase();
circle.schema = circleSchema;
circle.setMeasure = circleSetMeasure;
circle.componentMenu = circleMenu;

const ADAPTERS: Record<string, Adapter> = {
  // lines & angles
  lineSegment, ray,
  angleAcute: angleAdapter(), angleObtuse: angleAdapter(), angleReflex: angleAdapter(),
  angleRight: angleRightAdapter,
  // triangles
  triangleRight, triangleIso, triangleEqui, triangleScalene, triangleHyp, triangleAltitude,
  // quads
  rectangle, square, parallelogram, trapezium, rhombus, kite,
  pentagon: regularPolyAdapter(5), hexagon: regularPolyAdapter(6), octagon: regularPolyAdapter(8),
  // circles
  circle, circleRadius, circleDiameter,
  circleSector, circleSegmentChord, circleTangent, circleInscribed, cyclicQuadrilateral,
};

export function getAdapter(variant: string): Adapter | null {
  return ADAPTERS[variant] ?? null;
}

