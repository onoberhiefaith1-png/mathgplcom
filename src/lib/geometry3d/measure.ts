// Pure math for the Measurements, Angles, Surface Area and Volume lesson modes.
//
// Everything is computed from the solid's params and transform so a resized
// or moved solid always reports the correct numeric value.

import * as THREE from "three";
import { topologyFor, type EdgeEl, type FaceEl } from "./topology";
import { baseRotationY } from "./geometryFactory";
import type { Solid3D, Vec3 } from "./scene3d";

/**
 * Placement matrix for mathematical work. The object's `scale` is deliberately
 * ignored: it is a *display* property (see displayScale.ts) and must never
 * change a length, an area or a volume.
 */
export function worldMatrix(solid: Solid3D): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(solid.rotation[0], solid.rotation[1] + baseRotationY(solid), solid.rotation[2]),
  );
  m.compose(
    new THREE.Vector3(...solid.position),
    q,
    new THREE.Vector3(1, 1, 1),
  );
  return m;
}

export function toWorld(solid: Solid3D, local: Vec3): Vec3 {
  const v = new THREE.Vector3(...local).applyMatrix4(worldMatrix(solid));
  return [v.x, v.y, v.z];
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function edgeLength(solid: Solid3D, e: EdgeEl): number {
  if (e.shape === "circle") {
    return 2 * Math.PI * e.radius;
  }
  const a = toWorld(solid, e.a);
  const b = toWorld(solid, e.b);
  return distance(a, b);
}

/** Polygon area via the cross-product sum. */
function polygonArea(pts: Vec3[]): number {
  if (pts.length < 3) return 0;
  const p0 = new THREE.Vector3(...pts[0]);
  let sum = 0;
  const n = new THREE.Vector3();
  for (let i = 1; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(...pts[i]).sub(p0);
    const b = new THREE.Vector3(...pts[i + 1]).sub(p0);
    n.crossVectors(a, b);
    sum += n.length();
  }
  return sum / 2;
}

/** World-space face area. Curved faces use analytic formulas. */
export function faceArea(solid: Solid3D, f: FaceEl): number {
  const p = solid.params ?? {};
  const r = p.radius ?? 1;
  const rTop = p.topRadius ?? 0;
  const h = p.height ?? 2;

  if (f.shape === "curved") {
    switch (solid.kind) {
      case "cylinder": return 2 * Math.PI * r * h;
      case "cone": return Math.PI * r * Math.hypot(r, h);
      case "hemisphere": return 2 * Math.PI * r * r;
      case "sphere": return 4 * Math.PI * r * r;
      case "frustum": {
        const l = Math.hypot(h, r - rTop);
        return Math.PI * (r + rTop) * l;
      }
      default: return 0;
    }
  }
  if (!f.points) return 0;
  const worldPts = f.points.map((pt) => toWorld(solid, pt));
  return polygonArea(worldPts);
}

/** Full surface area — sum of every face area. */
export function totalSurfaceArea(solid: Solid3D): number {
  const t = topologyFor(solid);
  return t.faces.reduce((s, f) => s + faceArea(solid, f), 0);
}

/** Lateral surface area — everything except the top/bottom "cap" faces. */
export function lateralSurfaceArea(solid: Solid3D): number {
  const t = topologyFor(solid);
  return t.faces
    .filter((f) => !(f.shape === "polygon" && Math.abs(f.normal[1]) > 0.9))
    .reduce((s, f) => s + faceArea(solid, f), 0);
}

export interface VolumeInfo {
  formula: string;
  substitution: string;
  value: number;
  variables: { symbol: string; label: string; value: number; axis?: "x" | "y" | "z" }[];
}

/** Volume formula card values, in the current unit scale. */
export function volumeInfo(solid: Solid3D): VolumeInfo {
  const p = solid.params ?? {};
  const r = p.radius ?? 1;
  const rTop = p.topRadius ?? 0;
  const h = p.height ?? 2;
  const size = p.size ?? 2;
  const w = p.width ?? 2;
  const hCub = p.height ?? 1.5;
  const d = p.depth ?? 1;

  const round = (n: number) => Math.round(n * 1000) / 1000;

  switch (solid.kind) {
    case "cube":
      return { formula: "V = a³", substitution: `${round(size)}³`, value: size ** 3,
        variables: [{ symbol: "a", label: "Edge length", value: size }] };
    case "cuboid":
      return { formula: "V = l × w × h", substitution: `${round(w)} × ${round(d)} × ${round(hCub)}`,
        value: w * d * hCub,
        variables: [
          { symbol: "l", label: "Length", value: w, axis: "x" },
          { symbol: "w", label: "Depth", value: d, axis: "z" },
          { symbol: "h", label: "Height", value: hCub, axis: "y" },
        ] };
    case "cylinder":
      return { formula: "V = π r² h", substitution: `π × ${round(r)}² × ${round(h)}`,
        value: Math.PI * r * r * h,
        variables: [{ symbol: "r", label: "Radius", value: r }, { symbol: "h", label: "Height", value: h, axis: "y" }] };
    case "cone":
      return { formula: "V = ⅓ π r² h", substitution: `⅓ × π × ${round(r)}² × ${round(h)}`,
        value: (1 / 3) * Math.PI * r * r * h,
        variables: [{ symbol: "r", label: "Base radius", value: r }, { symbol: "h", label: "Height", value: h, axis: "y" }] };
    case "sphere":
      return { formula: "V = ⁴⁄₃ π r³", substitution: `⁴⁄₃ × π × ${round(r)}³`,
        value: (4 / 3) * Math.PI * r ** 3,
        variables: [{ symbol: "r", label: "Radius", value: r }] };
    case "hemisphere":
      return { formula: "V = ⅔ π r³", substitution: `⅔ × π × ${round(r)}³`,
        value: (2 / 3) * Math.PI * r ** 3,
        variables: [{ symbol: "r", label: "Radius", value: r }] };
    case "frustum":
      return { formula: "V = ⅓ π h (R² + Rr + r²)",
        substitution: `⅓ × π × ${round(h)} × (${round(r)}² + ${round(r)}·${round(rTop)} + ${round(rTop)}²)`,
        value: (1 / 3) * Math.PI * h * (r * r + r * rTop + rTop * rTop),
        variables: [
          { symbol: "R", label: "Base radius", value: r },
          { symbol: "r", label: "Top radius", value: rTop },
          { symbol: "h", label: "Height", value: h, axis: "y" },
        ] };
    case "triangularPrism":
    case "pentagonalPrism":
    case "hexagonalPrism": {
      const sides = Math.round(p.sides ?? 6);
      const baseArea = (1 / 2) * sides * r * r * Math.sin((2 * Math.PI) / sides);
      return { formula: "V = A_base × h", substitution: `${round(baseArea)} × ${round(h)}`,
        value: baseArea * h,
        variables: [{ symbol: "r", label: "Base radius", value: r }, { symbol: "h", label: "Height", value: h, axis: "y" }] };
    }
    case "squarePyramid":
    case "tetrahedron":
    case "pentagonalPyramid":
    case "hexagonalPyramid": {
      const sides = Math.round(p.sides ?? 4);
      const baseArea = (1 / 2) * sides * r * r * Math.sin((2 * Math.PI) / sides);
      return { formula: "V = ⅓ A_base × h", substitution: `⅓ × ${round(baseArea)} × ${round(h)}`,
        value: (1 / 3) * baseArea * h,
        variables: [{ symbol: "r", label: "Base radius", value: r }, { symbol: "h", label: "Height", value: h, axis: "y" }] };
    }
    case "octahedron":
      return { formula: "V = √2⁄3 × a³", substitution: `√2⁄3 × ${round(r * Math.SQRT2)}³`,
        value: (Math.SQRT2 / 3) * (r * Math.SQRT2) ** 3,
        variables: [{ symbol: "a", label: "Edge length", value: r * Math.SQRT2 }] };
    default:
      return { formula: "—", substitution: "—", value: 0, variables: [] };
  }
}

/** Angle between two straight edges in degrees. */
export function edgeEdgeAngle(solid: Solid3D, a: EdgeEl, b: EdgeEl): number | null {
  if (a.shape !== "straight" || b.shape !== "straight") return null;
  const va = new THREE.Vector3().subVectors(new THREE.Vector3(...a.b), new THREE.Vector3(...a.a));
  const vb = new THREE.Vector3().subVectors(new THREE.Vector3(...b.b), new THREE.Vector3(...b.a));
  if (!va.length() || !vb.length()) return null;
  const cos = Math.abs(va.normalize().dot(vb.normalize()));
  return (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
}

/** Dihedral angle between two faces (degrees). */
export function faceFaceAngle(_solid: Solid3D, a: FaceEl, b: FaceEl): number {
  const na = new THREE.Vector3(...a.normal).normalize();
  const nb = new THREE.Vector3(...b.normal).normalize();
  const cos = Math.max(-1, Math.min(1, na.dot(nb)));
  // Interior dihedral = 180 - angle between outward normals.
  return 180 - (Math.acos(cos) * 180) / Math.PI;
}

/** Angle between an edge (line) and a face (plane), in degrees. */
export function edgeFaceAngle(solid: Solid3D, e: EdgeEl, f: FaceEl): number | null {
  if (e.shape !== "straight") return null;
  const v = new THREE.Vector3().subVectors(new THREE.Vector3(...e.b), new THREE.Vector3(...e.a)).normalize();
  const n = new THREE.Vector3(...f.normal).normalize();
  const sin = Math.abs(v.dot(n));
  return (Math.asin(Math.min(1, sin)) * 180) / Math.PI;
}

export function formatNumber(n: number, decimals: number): string {
  const f = Math.pow(10, decimals);
  return (Math.round(n * f) / f).toFixed(decimals);
}
