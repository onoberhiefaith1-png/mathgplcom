// Display scale vs mathematical dimensions.
//
// `solid.params` hold the REAL mathematical dimensions the teacher types
// (radius = 250 cm, edge = 5 km …). They must never change how big the model
// looks on screen. So the renderer works with a *view solid* whose params are
// normalised to a constant on-screen size, and every mathematical quantity is
// converted back with a single uniform factor `k` (maths units per view unit):
//
//   length  × k        area × k²        volume × k³
//
// The view solid keeps the exact proportions of the real one, so a tall thin
// cylinder still looks tall and thin.

import type { Solid3D } from "./scene3d";

/** On-screen size (world units) of the largest dimension of any solid. */
export const TARGET_EXTENT = 2.4;

/** Parameters that are lengths (and therefore get normalised). */
export const LENGTH_KEYS = ["size", "width", "height", "depth", "radius", "topRadius"] as const;

const isLength = (key: string) => (LENGTH_KEYS as readonly string[]).includes(key);

/** Largest real dimension of the solid, in mathematical units. */
export function mathExtent(solid: Solid3D): number {
  const p = solid.params ?? {};
  let max = 0;
  for (const [key, value] of Object.entries(p)) {
    if (!isLength(key) || !Number.isFinite(value) || value <= 0) continue;
    const extent = key === "radius" || key === "topRadius" ? value * 2 : value;
    if (extent > max) max = extent;
  }
  return max > 0 ? max : 1;
}

/**
 * Maths units per view unit. Multiply a value measured on the rendered
 * (view) solid by this to get the real mathematical value.
 */
export function mathScale(solid: Solid3D): number {
  return mathExtent(solid) / TARGET_EXTENT;
}

/** Teacher-chosen visual size of the model. 1 = 100%. */
export function displayScaleOf(solid: Solid3D): number {
  const s = solid.display?.scale;
  return Number.isFinite(s) && (s as number) > 0 ? (s as number) : 1;
}

/**
 * The solid as it should be drawn: real proportions, constant on-screen size,
 * multiplied by the teacher's Display Scale. Mathematics never reads this.
 */
export function viewSolid(solid: Solid3D): Solid3D {
  const k = mathScale(solid);
  const d = displayScaleOf(solid);
  const params: Record<string, number> = {};
  for (const [key, value] of Object.entries(solid.params ?? {})) {
    params[key] = isLength(key) ? value / k : value;
  }
  return {
    ...solid,
    params,
    scale: [solid.scale[0] * d, solid.scale[1] * d, solid.scale[2] * d],
  };
}

export const DISPLAY_SCALE_PRESETS = [0.25, 0.5, 1, 1.5, 2];
