// Transformation preview + apply for Lesson Mode: Transformations.
// The transform is stored as a small spec so it can be persisted as a
// ghost annotation, previewed, and then baked into the solid.

import * as THREE from "three";
import type { Solid3D, Vec3 } from "./scene3d";

export type TransformKind = "rotate" | "reflect" | "translate" | "scale";

export interface TransformSpec {
  kind: TransformKind;
  /** Rotate: axis (x/y/z), Reflect: plane ("xy"/"yz"/"xz"). */
  axis?: "x" | "y" | "z" | "xy" | "yz" | "xz";
  /** Rotate: degrees. */
  angleDeg?: number;
  /** Translate: [dx,dy,dz]. */
  vector?: Vec3;
  /** Scale: factor (uniform). */
  factor?: number;
  /** Scale/rotate center: "origin" | "centroid". */
  center?: "origin" | "centroid";
}

export function describeTransform(t: TransformSpec): string {
  switch (t.kind) {
    case "rotate": return `Rotated ${t.angleDeg ?? 0}° about ${t.axis?.toUpperCase()}`;
    case "reflect": return `Reflected in ${t.axis?.toUpperCase()} plane`;
    case "translate": return `Translated by (${(t.vector ?? [0, 0, 0]).map((n) => n.toFixed(1)).join(", ")})`;
    case "scale": return `Scaled ×${t.factor ?? 1} about ${t.center ?? "origin"}`;
  }
}

/** Matrix that maps the solid's local geometry into the transformed pose. */
export function transformMatrix(solid: Solid3D, t: TransformSpec): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  if (t.kind === "rotate") {
    const rad = ((t.angleDeg ?? 0) * Math.PI) / 180;
    if (t.axis === "x") m.makeRotationX(rad);
    else if (t.axis === "z") m.makeRotationZ(rad);
    else m.makeRotationY(rad);
    return m;
  }
  if (t.kind === "reflect") {
    const s = new THREE.Vector3(1, 1, 1);
    if (t.axis === "xy") s.z = -1;
    else if (t.axis === "yz") s.x = -1;
    else s.y = -1;
    return m.makeScale(s.x, s.y, s.z);
  }
  if (t.kind === "translate") {
    const v = t.vector ?? [0, 0, 0];
    return m.makeTranslation(v[0], v[1], v[2]);
  }
  const f = t.factor ?? 1;
  m.makeScale(f, f, f);
  if (t.center === "centroid") {
    const p = solid.position;
    const back = new THREE.Matrix4().makeTranslation(p[0], p[1], p[2]);
    const forward = new THREE.Matrix4().makeTranslation(-p[0], -p[1], -p[2]);
    return back.multiply(m).multiply(forward);
  }
  return m;
}

/** Bake the transform into the solid's position/rotation/scale (uniform only). */
export function applyTransform(solid: Solid3D, t: TransformSpec): Solid3D {
  const pre = new THREE.Matrix4().compose(
    new THREE.Vector3(...solid.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...solid.rotation)),
    new THREE.Vector3(...solid.scale),
  );
  const combined = transformMatrix(solid, t).multiply(pre);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  combined.decompose(pos, quat, scl);
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return {
    ...solid,
    position: [pos.x, pos.y, pos.z],
    rotation: [euler.x, euler.y, euler.z],
    scale: [scl.x, scl.y, scl.z],
  };
}
