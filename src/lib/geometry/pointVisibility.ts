// POINT ACTIVATION — one place decides whether construction points are seen.
//
// The geometry itself never changes: automatic points (intersections, helper
// anchors) stay in the scene so lengths, angles, areas and dragging keep
// working. When Point activation is OFF they simply carry no dot and no
// A/B/C label, so a drawn line is all the teacher sees.

import type { GeometryScene, GeoPoint } from "./scene";

export function applyPointVisibility(scene: GeometryScene, showPoints: boolean): GeometryScene {
  if (showPoints) return scene;
  let changed = false;
  const objects = scene.objects.map((o) => {
    if (o.type !== "point") return o;
    const p = o as GeoPoint;
    if (!p.auto) return o;
    if (p.hidden && !p.label) return o;
    changed = true;
    return { ...p, hidden: true, label: "" };
  });
  return changed ? { ...scene, objects } : scene;
}

export default applyPointVisibility;
