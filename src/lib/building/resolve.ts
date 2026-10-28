/**
 * DEFAULT SETTINGS -> INDIVIDUAL SETTINGS.
 *
 * The building's `environment` record is the Default Settings: every hallway
 * and every classroom inherits it. An element may store Individual Settings —
 * a per-surface, per-field override — and only those fields win. Clearing an
 * override ("Reset to Default") deletes the key, so the element immediately
 * follows the current default again. Inheritance is decided here and nowhere
 * else, so no default is ever baked into geometry.
 */
import type {
  EnvironmentSettings,
  SurfaceDesign,
  SurfaceKey,
  SurfaceOverrides,
} from "./types";

const SURFACES: SurfaceKey[] = ["leftWall", "rightWall", "floor", "roof", "endWall", "startWall"];

/** Merge one element's overrides field-by-field over the default surfaces. */
export function resolveSurfaces(
  defaults: EnvironmentSettings,
  overrides: SurfaceOverrides | null | undefined,
): EnvironmentSettings {
  if (!overrides || Object.keys(overrides).length === 0) return defaults;
  const out: EnvironmentSettings = { ...defaults };
  for (const key of SURFACES) {
    const patch = overrides[key];
    if (!patch || Object.keys(patch).length === 0) continue;
    out[key] = { ...defaults[key], ...patch } as SurfaceDesign;
  }
  return out;
}

/** Does this element still follow the default for a given surface? */
export const isDefaultSurface = (
  overrides: SurfaceOverrides | null | undefined,
  key: SurfaceKey,
): boolean => {
  const patch = overrides?.[key];
  return !patch || Object.keys(patch).length === 0;
};

/** Set one surface's Individual Settings (full design stored as the override). */
export const withSurfaceOverride = (
  overrides: SurfaceOverrides | null | undefined,
  key: SurfaceKey,
  design: SurfaceDesign,
): SurfaceOverrides => ({ ...(overrides ?? {}), [key]: design });

/** Reset one surface to the Default Settings by removing its override. */
export const withoutSurfaceOverride = (
  overrides: SurfaceOverrides | null | undefined,
  key: SurfaceKey,
): SurfaceOverrides => {
  const next = { ...(overrides ?? {}) };
  delete next[key];
  return next;
};

/** Every storage/builtin texture path referenced by an override record. */
export const overrideTexturePaths = (overrides: SurfaceOverrides | null | undefined): string[] => {
  const out: string[] = [];
  for (const key of SURFACES) {
    const path = overrides?.[key]?.texture?.path;
    if (path) out.push(path);
  }
  return out;
};
