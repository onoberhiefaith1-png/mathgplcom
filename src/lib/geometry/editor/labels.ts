// Auto-label generator for new points.

import type { GeometryScene } from "../scene";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function nextPointLabel(scene: GeometryScene): string {
  const used = new Set<string>();
  for (const o of scene.objects) {
    if (o.type === "point" && o.label) used.add(o.label);
  }
  for (const ch of ALPHA) {
    if (!used.has(ch)) return ch;
  }
  // After Z, use A1, B1, ...
  let n = 1;
  while (true) {
    for (const ch of ALPHA) {
      const cand = `${ch}${n}`;
      if (!used.has(cand)) return cand;
    }
    n++;
  }
}

export function newId(prefix: string, scene: GeometryScene): string {
  const used = new Set(scene.objects.map((o) => o.id));
  let i = 1;
  while (used.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}
