// three.js geometry factory for the solid library.
// Kept separate so both the renderer and the annotation layer can use it
// without a circular import.

import * as THREE from "three";
import type { Solid3D } from "./scene3d";

/** kind → three.js geometry. Adding a solid later is one line here. */
export function geometryFor(solid: Solid3D): THREE.BufferGeometry {
  const p = solid.params ?? {};
  const r = p.radius ?? 1;
  const h = p.height ?? 2;
  switch (solid.kind) {
    case "cube":
      return new THREE.BoxGeometry(p.size ?? 2, p.size ?? 2, p.size ?? 2);
    case "cuboid":
      return new THREE.BoxGeometry(p.width ?? 2, p.height ?? 1.5, p.depth ?? 1);
    case "triangularPrism":
    case "pentagonalPrism":
    case "hexagonalPrism":
      return new THREE.CylinderGeometry(r, r, h, Math.max(3, Math.round(p.sides ?? 6)));
    case "squarePyramid":
    case "tetrahedron":
    case "pentagonalPyramid":
    case "hexagonalPyramid":
      return new THREE.ConeGeometry(r, h, Math.max(3, Math.round(p.sides ?? 4)));
    case "cone":
      return new THREE.ConeGeometry(r, h, 48);
    case "cylinder":
      return new THREE.CylinderGeometry(r, r, h, 48);
    case "frustum":
      return new THREE.CylinderGeometry(p.topRadius ?? 0.6, r, h, 48);
    case "sphere":
      return new THREE.SphereGeometry(r, 40, 28);
    case "hemisphere":
      return new THREE.SphereGeometry(r, 40, 28, 0, Math.PI * 2, 0, Math.PI / 2);
    case "octahedron":
      return new THREE.OctahedronGeometry(r);
    default:
      return new THREE.BoxGeometry(2, 2, 2);
  }
}

/**
 * Faceted solids get a small yaw so a flat face points at the default camera.
 * The topology layer is built in the same (un-yawed) local frame, so the
 * annotation layer must be mounted inside this same rotated group.
 */
export function baseRotationY(solid: Solid3D): number {
  const sides = Math.round(solid.params?.sides ?? 0);
  switch (solid.kind) {
    case "squarePyramid":
      return Math.PI / 4;
    case "triangularPrism":
    case "pentagonalPrism":
    case "hexagonalPrism":
    case "tetrahedron":
    case "pentagonalPyramid":
    case "hexagonalPyramid":
      return sides ? Math.PI / sides : 0;
    default:
      return 0;
  }
}
