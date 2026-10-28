// Geometry pick bus — every click on a diagram object, even a repeat click on
// the object that is already selected.
//
// Selection state alone cannot drive the property composer's "pick from
// diagram" sensor: clicking the same part twice leaves `selectedIds`
// unchanged, so the composer would appear dead and force the teacher to
// double-click somewhere else first. This bus reports the CLICK, not the
// resulting state, so the sensor stays live continuously.

import type { GeoId } from "@/lib/geometry/scene";

type Listener = (id: GeoId) => void;

const listeners = new Set<Listener>();

export function emitGeoPick(id: GeoId): void {
  listeners.forEach((l) => {
    try { l(id); } catch { /* a listener must never break the canvas */ }
  });
}

export function onGeoPick(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
