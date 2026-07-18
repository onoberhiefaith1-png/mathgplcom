// Annotation helpers — anchor point + drag support for the universal
// text-note feature. Every geometry object gets an optional list of
// annotations pinned to a natural anchor (segment midpoint, circle
// centre, etc.) plus a draggable offset.

import type { GeometryScene, GeoObject, GeoAnnotation, GeoPoint } from "../scene";
import { pointById } from "../scene";

export interface AnchorResult {
  x: number;
  y: number;
}

/** Where an annotation attaches, in scene coordinates (before PAD). */
export function annotationAnchor(scene: GeometryScene, o: GeoObject): AnchorResult | null {
  switch (o.type) {
    case "point": return { x: o.x + 10, y: o.y - 14 };
    case "segment": {
      const a = pointById(scene, o.a); const b = pointById(scene, o.b);
      if (!a || !b) return null;
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    case "circle": {
      const c = pointById(scene, o.center); if (!c) return null;
      return { x: c.x, y: c.y };
    }
    case "arc": {
      const c = pointById(scene, o.center); if (!c) return null;
      const mid = (o.from + o.to) / 2;
      return { x: c.x + Math.cos((mid * Math.PI) / 180) * o.r, y: c.y - Math.sin((mid * Math.PI) / 180) * o.r };
    }
    case "curve": {
      let pts: GeoPoint[] = [];
      if (o.a && o.mid && o.b) pts = [o.a, o.mid, o.b].map((id) => pointById(scene, id)).filter(Boolean) as GeoPoint[];
      else pts = (o.points ?? []).map((id) => pointById(scene, id)).filter(Boolean) as GeoPoint[];
      if (pts.length === 0) return null;
      const m = pts[Math.floor(pts.length / 2)];
      return { x: m.x, y: m.y };
    }
    case "region": {
      const pts = o.boundary.map((id) => pointById(scene, id)).filter(Boolean) as GeoPoint[];
      if (pts.length === 0) return null;
      let sx = 0, sy = 0;
      for (const p of pts) { sx += p.x; sy += p.y; }
      return { x: sx / pts.length, y: sy / pts.length };
    }
    case "polygon": {
      const pts = o.points.map((id) => pointById(scene, id)).filter(Boolean) as GeoPoint[];
      if (pts.length === 0) return null;
      let sx = 0, sy = 0;
      for (const p of pts) { sx += p.x; sy += p.y; }
      return { x: sx / pts.length, y: sy / pts.length };
    }
    default:
      return null;
  }
}

export function newAnnotationId(): string {
  return `a${Math.random().toString(36).slice(2, 8)}`;
}

/** Owner-agnostic getter for the annotations array. */
export function getAnnotations(o: GeoObject): GeoAnnotation[] {
  return ((o as any).annotations as GeoAnnotation[] | undefined) ?? [];
}
