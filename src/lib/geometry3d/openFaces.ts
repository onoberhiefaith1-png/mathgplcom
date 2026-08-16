// Open Face — turning a closed solid into an inspectable hollow shell.
//
// Opening a face never touches the mathematics or the stored geometry: the
// solid simply records which topological faces are currently OPEN, and the
// renderer draws the remaining faces as a shell (one mesh per real face) so
// the teacher can look inside through the opening.

import * as THREE from "three";
import type { Solid3D, Vec3 } from "./scene3d";
import { geometryFor } from "./geometryFactory";

/** Defensive parse of a stored open-face list. */
export function normalizeOpenFaces(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out = raw
    .filter((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)
    .map((n) => Math.round(n as number));
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

export function openFacesOf(solid: Solid3D): number[] {
  return normalizeOpenFaces(solid.openFaces);
}

export function isFaceOpen(solid: Solid3D, index: number): boolean {
  return openFacesOf(solid).includes(index);
}

export function withFaceOpen(solid: Solid3D, index: number): number[] {
  return normalizeOpenFaces([...openFacesOf(solid), index]);
}

export function withFaceClosed(solid: Solid3D, index: number): number[] {
  return openFacesOf(solid).filter((i) => i !== index);
}

/** Convex polygon (a real flat face) → triangle-fan geometry. */
export function polygonFaceGeometry(points: Vec3[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    pos.push(...points[0], ...points[i], ...points[i + 1]);
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * The curved surface of a curved solid on its own — the caps are drawn
 * separately as real disc faces, so opening a cap reveals a hollow tube.
 */
export function curvedSurfaceGeometry(solid: Solid3D): THREE.BufferGeometry {
  const p = solid.params ?? {};
  const r = p.radius ?? 1;
  const h = p.height ?? 2;
  switch (solid.kind) {
    case "cylinder":
      return new THREE.CylinderGeometry(r, r, h, 48, 1, true);
    case "cone":
      return new THREE.ConeGeometry(r, h, 48, 1, true);
    case "frustum":
      return new THREE.CylinderGeometry(p.topRadius ?? 0.6, r, h, 48, 1, true);
    default:
      // Sphere / hemisphere: the curved surface IS the whole geometry.
      return geometryFor(solid);
  }
}
