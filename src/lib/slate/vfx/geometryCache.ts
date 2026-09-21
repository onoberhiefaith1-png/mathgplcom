// Build a piece of geometry once, reuse it forever.
//
// Rebuilding extruded glyph solids or a shaped writing surface is the single
// most expensive thing the slate does, and it happens again every time the
// game object changes identity. Keyed caching turns the second and every later
// build into a lookup, so selecting an effect, placing one or firing one never
// blocks a frame.

import type * as THREE from "three";

const LIMIT = 96;
const cache = new Map<string, THREE.BufferGeometry>();

export function cachedGeometry<T extends THREE.BufferGeometry>(key: string, build: () => T): T {
  const existing = cache.get(key);
  if (existing) {
    // refresh recency
    cache.delete(key);
    cache.set(key, existing);
    return existing as T;
  }
  const built = build();
  cache.set(key, built);
  if (cache.size > LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.get(oldest)?.dispose();
      cache.delete(oldest);
    }
  }
  return built;
}

/** Stable short key for a float, so near-identical sizes reuse one build. */
export const q = (value: number, places = 3) => value.toFixed(places);

/** A lost graphics context invalidates every uploaded buffer: start clean. */
export function clearGeometryCache() {
  cache.forEach((geometry) => geometry.dispose());
  cache.clear();
}
