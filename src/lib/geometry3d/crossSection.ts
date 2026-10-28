// Analytic cross-sections for the shape library.
//
// A slicing plane is either "y" (horizontal, at height t) or "x" / "z"
// (vertical). For each solid we return the resulting 2D shape (points in
// the slice plane) and its area so the tools panel can display both.

import type { Solid3D } from "./scene3d";
import { topologyFor } from "./topology";

export type PlaneAxis = "x" | "y" | "z";
export interface Plane {
  axis: PlaneAxis;
  /** Signed distance from origin along the plane's axis. */
  offset: number;
}

export interface Section2D {
  /** Points in a common 2D frame (u,v). */
  points: [number, number][];
  /** True when the outline is a smooth ellipse/circle. */
  smooth: boolean;
  area: number;
  label: string;
}

const nEllipse = 64;

function circleSection(radius: number): Section2D {
  const pts: [number, number][] = [];
  for (let i = 0; i <= nEllipse; i++) {
    const t = (i / nEllipse) * Math.PI * 2;
    pts.push([Math.cos(t) * radius, Math.sin(t) * radius]);
  }
  return { points: pts, smooth: true, area: Math.PI * radius * radius, label: `Circle r=${radius.toFixed(2)}` };
}

function ellipseSection(a: number, b: number): Section2D {
  const pts: [number, number][] = [];
  for (let i = 0; i <= nEllipse; i++) {
    const t = (i / nEllipse) * Math.PI * 2;
    pts.push([Math.cos(t) * a, Math.sin(t) * b]);
  }
  return { points: pts, smooth: true, area: Math.PI * a * b, label: `Ellipse a=${a.toFixed(2)} b=${b.toFixed(2)}` };
}

function polygonArea(pts: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** Regular n-gon inscribed in radius r (matches prism topology). */
function ngon(sides: number, r: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let k = 0; k < sides; k++) {
    const t = (k / sides) * Math.PI * 2;
    pts.push([Math.sin(t) * r, Math.cos(t) * r]);
  }
  return pts;
}

/** Slice a solid with the given plane. Returns null when the plane misses. */
export function sliceSolid(solid: Solid3D, plane: Plane): Section2D | null {
  const p = solid.params ?? {};

  const inHeight = (t: number, h: number) => t >= -h / 2 - 1e-6 && t <= h / 2 + 1e-6;

  switch (solid.kind) {
    case "sphere": {
      const r = p.radius ?? 1;
      const t = plane.offset;
      if (Math.abs(t) > r) return null;
      return circleSection(Math.sqrt(r * r - t * t));
    }
    case "hemisphere": {
      const r = p.radius ?? 1;
      const t = plane.offset;
      if (plane.axis === "y") {
        if (t < 0 || t > r) return null;
        return circleSection(Math.sqrt(r * r - t * t));
      }
      // vertical cut through a hemisphere → half-ellipse
      if (Math.abs(t) > r) return null;
      const rr = Math.sqrt(r * r - t * t);
      const pts: [number, number][] = [];
      for (let i = 0; i <= nEllipse; i++) {
        const a = (i / nEllipse) * Math.PI;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      pts.push([-rr, 0]);
      return { points: pts, smooth: true, area: (Math.PI * rr * rr) / 2, label: `Half-circle r=${rr.toFixed(2)}` };
    }
    case "cylinder": {
      const r = p.radius ?? 1;
      const h = p.height ?? 2;
      if (plane.axis === "y") {
        if (!inHeight(plane.offset, h)) return null;
        return circleSection(r);
      }
      if (Math.abs(plane.offset) > r) return null;
      const half = Math.sqrt(r * r - plane.offset * plane.offset);
      const pts: [number, number][] = [
        [-half, -h / 2], [half, -h / 2], [half, h / 2], [-half, h / 2],
      ];
      return { points: pts, smooth: false, area: 2 * half * h, label: `Rectangle ${(2 * half).toFixed(2)} × ${h.toFixed(2)}` };
    }
    case "cone": {
      const r = p.radius ?? 1;
      const h = p.height ?? 2;
      if (plane.axis === "y") {
        const t = plane.offset;
        if (t < -h / 2 || t > h / 2) return null;
        const rr = r * ((h / 2 - t) / h);
        return circleSection(rr);
      }
      // vertical cut through a cone (hyperbola-ish) → approximate by trapezium-of-slices
      if (Math.abs(plane.offset) > r) return null;
      const pts: [number, number][] = [];
      const N = 40;
      for (let i = 0; i <= N; i++) {
        const y = -h / 2 + (h * i) / N;
        const rr = r * ((h / 2 - y) / h);
        const half = rr * rr - plane.offset * plane.offset;
        if (half < 0) continue;
        pts.push([Math.sqrt(half), y]);
      }
      for (let i = pts.length - 1; i >= 0; i--) pts.push([-pts[i][0], pts[i][1]]);
      return { points: pts, smooth: true, area: polygonArea(pts), label: "Conic section" };
    }
    case "frustum": {
      const r = p.radius ?? 1;
      const rTop = p.topRadius ?? 0.6;
      const h = p.height ?? 2;
      if (plane.axis !== "y") return null;
      const t = plane.offset;
      if (t < -h / 2 || t > h / 2) return null;
      const rr = r + (rTop - r) * ((t + h / 2) / h);
      return circleSection(rr);
    }
    case "cube":
    case "cuboid": {
      const w = solid.kind === "cube" ? (p.size ?? 2) : (p.width ?? 2);
      const hh = solid.kind === "cube" ? (p.size ?? 2) : (p.height ?? 1.5);
      const d = solid.kind === "cube" ? (p.size ?? 2) : (p.depth ?? 1);
      if (plane.axis === "y") {
        if (!inHeight(plane.offset, hh)) return null;
        return { points: [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]],
          smooth: false, area: w * d, label: `Rectangle ${w} × ${d}` };
      }
      if (plane.axis === "x") {
        if (!inHeight(plane.offset, w)) return null;
        return { points: [[-d / 2, -hh / 2], [d / 2, -hh / 2], [d / 2, hh / 2], [-d / 2, hh / 2]],
          smooth: false, area: d * hh, label: `Rectangle ${d} × ${hh}` };
      }
      if (!inHeight(plane.offset, d)) return null;
      return { points: [[-w / 2, -hh / 2], [w / 2, -hh / 2], [w / 2, hh / 2], [-w / 2, hh / 2]],
        smooth: false, area: w * hh, label: `Rectangle ${w} × ${hh}` };
    }
    case "triangularPrism":
    case "pentagonalPrism":
    case "hexagonalPrism": {
      const sides = Math.max(3, Math.round(p.sides ?? 6));
      const r = p.radius ?? 1;
      const h = p.height ?? 2;
      if (plane.axis !== "y") return null;
      if (!inHeight(plane.offset, h)) return null;
      const pts = ngon(sides, r);
      return { points: pts, smooth: false, area: polygonArea(pts), label: `${sides}-gon r=${r.toFixed(2)}` };
    }
    case "squarePyramid":
    case "tetrahedron":
    case "pentagonalPyramid":
    case "hexagonalPyramid": {
      const sides = Math.max(3, Math.round(p.sides ?? 4));
      const r = p.radius ?? 1;
      const h = p.height ?? 2;
      if (plane.axis !== "y") return null;
      const t = plane.offset;
      if (t < -h / 2 || t > h / 2) return null;
      const rr = r * ((h / 2 - t) / h);
      const pts = ngon(sides, rr);
      return { points: pts, smooth: false, area: polygonArea(pts), label: `${sides}-gon r=${rr.toFixed(2)}` };
    }
    case "octahedron": {
      const r = p.radius ?? 1;
      if (plane.axis !== "y") return null;
      const t = plane.offset;
      if (Math.abs(t) > r) return null;
      const rr = r - Math.abs(t);
      return { points: [[rr, 0], [0, rr], [-rr, 0], [0, -rr]], smooth: false, area: 2 * rr * rr, label: `Square rotated (d=${(2 * rr).toFixed(2)})` };
    }
    default:
      // fallback: try nothing (uses topology to at least confirm intersection)
      return topologyFor(solid) ? null : null;
  }
}
