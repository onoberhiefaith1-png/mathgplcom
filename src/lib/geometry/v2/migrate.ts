// Best-effort migration from the legacy `GeometryScene` (src/lib/geometry/scene.ts)
// to the new v2 scene model. Only Points are converted for Phase 1. Later
// phases will map segments → lines, circles → circles with a synthesised
// radius point, and arcs → arcs with synthesised start/end points.

import type { GeometryScene } from "@/lib/geometry/scene";
import {
  EMPTY_V2_SCENE,
  addPoint,
  type V2Scene,
} from "./scene";

export function migrateLegacyToV2(legacy: GeometryScene | null | undefined): V2Scene {
  if (!legacy) return EMPTY_V2_SCENE;
  let scene: V2Scene = {
    ...EMPTY_V2_SCENE,
    bounds: {
      width: legacy.bounds?.width || EMPTY_V2_SCENE.bounds.width,
      height: legacy.bounds?.height || EMPTY_V2_SCENE.bounds.height,
    },
  };
  for (const o of legacy.objects ?? []) {
    if (o.type === "point") {
      const { scene: next } = addPoint(scene, o.x, o.y, {
        labelText: o.label || undefined,
        labelOffset: o.labelOffset
          ? { dx: o.labelOffset.dx, dy: o.labelOffset.dy }
          : undefined,
        hidden: o.hidden,
      });
      scene = next;
    }
  }
  return scene;
}
