// Pure math + SVG renderers for the constructions available in "Add Component".
// Each construction reads from live nodes so it automatically follows drags
// and Adjust edits.

import { createElement as h, Fragment, type ReactNode } from "react";
import type { Nodes, Point } from "./geometry";
import { dist, mid, projectOnLine, bearing, polar } from "./geometry";
import type { LiveComponent } from "./schema";

const S = "currentColor";

function line(a: Point, b: Point, key: string, dash?: string, sw = 1.4) {
  return h("line", {
    key, x1: a.x, y1: a.y, x2: b.x, y2: b.y,
    stroke: S, strokeWidth: sw, strokeDasharray: dash,
  });
}
function dot(p: Point, key: string, r = 1.8) {
  return h("circle", { key, cx: p.x, cy: p.y, r, fill: S });
}
function text(p: Point, str: string, key: string) {
  return h("text", {
    key, x: p.x, y: p.y, textAnchor: "middle", dominantBaseline: "middle",
    fontSize: 7, fill: S,
    style: { paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: 2 },
  }, str);
}

function sideMid(nodes: Nodes, side: string): Point | null {
  if (side.length < 2) return null;
  const a = nodes[side[0]]; const b = nodes[side[1]];
  if (!a || !b) return null;
  return mid(a, b);
}

function sideEndpoints(nodes: Nodes, side: string): [Point, Point] | null {
  if (side.length < 2) return null;
  const a = nodes[side[0]]; const b = nodes[side[1]];
  if (!a || !b) return null;
  return [a, b];
}

export function renderComponent(c: LiveComponent, nodes: Nodes): ReactNode {
  switch (c.kind) {
    case "altitude": {
      const V = nodes[c.refs.from]; const seg = sideEndpoints(nodes, c.refs.to || "");
      if (!V || !seg) return null;
      const foot = projectOnLine(V, seg[0], seg[1]);
      return h(Fragment, { key: c.id },
        line(V, foot, `${c.id}-l`, "3 2"),
        dot(foot, `${c.id}-f`),
      );
    }
    case "median": {
      const V = nodes[c.refs.from]; const m = sideMid(nodes, c.refs.to || "");
      if (!V || !m) return null;
      return h(Fragment, { key: c.id },
        line(V, m, `${c.id}-l`, "2 2"),
        dot(m, `${c.id}-m`),
      );
    }
    case "midpoint": {
      const m = sideMid(nodes, c.refs.side || "");
      if (!m) return null;
      return dot(m, c.id, 2.4);
    }
    case "perpendicular": {
      const V = nodes[c.refs.from]; const seg = sideEndpoints(nodes, c.refs.to || "");
      if (!V || !seg) return null;
      const foot = projectOnLine(V, seg[0], seg[1]);
      return h(Fragment, { key: c.id }, line(V, foot, `${c.id}-l`, "3 2"));
    }
    case "parallel": {
      const V = nodes[c.refs.from]; const seg = sideEndpoints(nodes, c.refs.to || "");
      if (!V || !seg) return null;
      const dx = seg[1].x - seg[0].x, dy = seg[1].y - seg[0].y;
      const p1 = { x: V.x - dx * 0.6, y: V.y - dy * 0.6 };
      const p2 = { x: V.x + dx * 0.6, y: V.y + dy * 0.6 };
      return line(p1, p2, c.id, "4 2");
    }
    case "rightAngleMark": {
      const V = nodes[c.refs.vertex]; const A = nodes[c.refs.a]; const B = nodes[c.refs.b];
      if (!V || !A || !B) return null;
      const uA = unit(sub(A, V)); const uB = unit(sub(B, V));
      const size = 9;
      const p1 = add(V, mul(uA, size));
      const p2 = add(V, add(mul(uA, size), mul(uB, size)));
      const p3 = add(V, mul(uB, size));
      return h("polyline", {
        key: c.id, points: `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`,
        stroke: S, strokeWidth: 1.2, fill: "none",
      });
    }
    case "equalTicks": {
      const seg = sideEndpoints(nodes, c.refs.side || "");
      if (!seg) return null;
      const m = mid(seg[0], seg[1]);
      const u = unit(sub(seg[1], seg[0]));
      const n = { x: -u.y, y: u.x };
      const count = Number(c.refs.count) || 1;
      const gap = 2.2;
      const items: ReactNode[] = [];
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * gap;
        const centre = add(m, mul(u, off));
        const a = add(centre, mul(n, 2.2));
        const b = add(centre, mul(n, -2.2));
        items.push(line(a, b, `${c.id}-t${i}`, undefined, 1));
      }
      return h(Fragment, { key: c.id }, ...items);
    }
    case "lengthMeasure": {
      const seg = sideEndpoints(nodes, c.refs.side || "");
      if (!seg) return null;
      const m = mid(seg[0], seg[1]);
      const u = unit(sub(seg[1], seg[0]));
      const n = { x: -u.y, y: u.x };
      const pos = add(m, mul(n, -8));
      return text(pos, (dist(seg[0], seg[1]) / 10).toFixed(1), c.id);
    }
    case "angleMeasure": {
      const V = nodes[c.refs.vertex]; const A = nodes[c.refs.a]; const B = nodes[c.refs.b];
      if (!V || !A || !B) return null;
      const ang = Math.abs(bearing(V, B) - bearing(V, A));
      const shown = ang > 180 ? 360 - ang : ang;
      const bis = (bearing(V, A) + bearing(V, B)) / 2;
      const pos = polar(V, 20, bis);
      return text(pos, `${Math.round(shown)}°`, c.id);
    }
    default:
      return null;
  }
}

// ── vec helpers ────────────────────────────────────────────────────────
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const unit = (a: Point): Point => { const d = Math.hypot(a.x, a.y) || 1; return { x: a.x / d, y: a.y / d }; };
