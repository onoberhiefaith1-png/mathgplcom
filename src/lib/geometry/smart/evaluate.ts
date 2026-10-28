// Live-derived values (circumference, area, etc.) — read-only helpers
// used by the Relationship panel when the teacher edits a base value.

import type { SmartGraph, SmartPartBase } from "./parts";

export function derivedFor(part: SmartPartBase, _graph: SmartGraph): Array<{ label: string; value: string }> {
  if (part.kind === "circle" && part.value != null) {
    const r = part.value;
    return [
      { label: "Radius", value: round(r) },
      { label: "Diameter", value: round(2 * r) },
      { label: "Circumference", value: `2π × ${round(r)} ≈ ${round(2 * Math.PI * r)}` },
      { label: "Area", value: `π × ${round(r)}² ≈ ${round(Math.PI * r * r)}` },
    ];
  }
  if (part.kind === "radius" && part.value != null) {
    return [{ label: "Length", value: round(part.value) }];
  }
  if (part.kind === "side" && part.value != null) {
    return [{ label: "Length", value: round(part.value) }];
  }
  if (part.kind === "angle" && part.value != null) {
    return [{ label: "Measure", value: `${round(part.value)}°` }];
  }
  return [];
}

function round(n: number): string {
  return Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : n.toFixed(2);
}
