// GeometryScene — the single source of truth for an editable textbook
// diagram. A diagram is a small JSON document describing points, segments,
// circles, arcs, angles and labels in a logical coordinate space. The
// renderer (`GeometryDiagram`) draws this JSON as inline SVG; the AI edits
// it by producing a patched copy.

export type GeoId = string;

export interface GeoPoint {
  id: GeoId;
  type: "point";
  x: number;
  y: number;
  label?: string;
  labelOffset?: { dx: number; dy: number };
  hidden?: boolean;
  /** Optional per-point color override (defaults to STROKE). */
  color?: string;
  /** Dot radius (default 2.4). */
  size?: number;
  /** Font size (px) of the point's letter label (default 14). */
  labelFontSize?: number;
  /** Auto-inserted at a structure intersection (safe to remove). */
  auto?: boolean;
}

export interface GeoSegment {
  id: GeoId;
  type: "segment";
  a: GeoId; // point id
  b: GeoId; // point id
  label?: string;
  /** Draggable offset for the segment name label. */
  labelOffset?: { dx: number; dy: number };
  /** Render the label along the line (rotated with it). */
  labelRotate?: boolean;
  /** Optional measurement text shown along the segment (legacy). */
  length?: string;
  /** Preferred measurement text (draggable via distanceOffset). */
  distance?: string;
  distanceOffset?: { dx: number; dy: number };
  /** Font size for the distance chip. */
  distanceFontSize?: number;
  /** Colour for the distance chip. */
  distanceColor?: string;
  /** Diagram-attached free text added with the right-hand Add Text tool. */
  lineText?: string;
  lineTextOffset?: { dx: number; dy: number };
  lineTextFontSize?: number;
  lineTextColor?: string;
  marks?:
    | "tick" | "double" | "triple" | "quadruple" | "right"
    | "parallel" | "double-parallel" | "triple-parallel"
    | null;
  /** Independent parallel-marks group: 0-3 chevrons. */
  parallelMarks?: 0 | 1 | 2 | 3;
  dashed?: boolean | "dotted";
  /** Optional per-segment color override. */
  color?: string;
  arrow?: "none" | "start" | "end" | "both";
}
export interface GeoLine {
  id: GeoId;
  type: "line";
  a: GeoId;
  b: GeoId;
  dashed?: boolean;
}
export interface GeoRay {
  id: GeoId;
  type: "ray";
  a: GeoId; // origin
  b: GeoId; // through
  dashed?: boolean;
}
export interface GeoCircle {
  id: GeoId;
  type: "circle";
  center: GeoId; // point id
  r: number;
  label?: string;
  dashed?: boolean;
  /** Fill color for enclosed disk. */
  fill?: string;
  /** Fill opacity 0..1. */
  fillOpacity?: number;
  /** Teacher-facing area override (any text). */
  area?: string;
}
export interface GeoArc {
  id: GeoId;
  type: "arc";
  center: GeoId;
  r: number;
  from: number; // degrees, ccw from +x
  to: number;
  dashed?: boolean;
  fill?: string;
  fillOpacity?: number;
  area?: string;
}

export interface GeoAngle {
  id: GeoId;
  type: "angle";
  vertex: GeoId;
  a: GeoId; // point on first arm
  b: GeoId; // point on second arm
  value?: string; // displayed text, e.g. "30°"
  marker?: "arc" | "double" | "right";
  /** When true, the arc is drawn on the opposite (reflex) side. */
  reflex?: boolean;
  /** Draggable offset for the value chip. */
  valueOffset?: { dx: number; dy: number };
  /** Font size for the value chip. */
  valueFontSize?: number;
  /** Colour for the value chip. */
  valueColor?: string;
}
/**
 * A boundary edge inside a `GeoRegion`. The order of the region's
 * `boundary` point ids determines the traversal direction; each `edges[i]`
 * describes how boundary[i] is connected to boundary[i+1].
 */
export type GeoRegionEdge =
  | { kind: "segment"; ref: GeoId }
  | { kind: "arc"; ref: GeoId; sweep?: "short" | "long" }
  | { kind: "circle"; ref: GeoId; sweep?: "short" | "long" }
  | { kind: "curve"; ref: GeoId }
  | { kind: "straight" };

export interface GeoRegion {
  id: GeoId;
  type: "region";
  /** Ordered boundary point ids that form a closed loop. */
  boundary: GeoId[];
  /** Optional per-edge geometry references (parallel to boundary). */
  edges?: GeoRegionEdge[];
  fill?: string;
  opacity?: number;
  /** Teacher-facing area override (any text). */
  area?: string;
}
export interface GeoPolygon {
  id: GeoId;
  type: "polygon";
  points: GeoId[];
  fill?: string;
  label?: string;
}
export interface GeoLabel {
  id: GeoId;
  type: "label";
  x: number;
  y: number;
  text: string;
  /** Rotation in degrees, clockwise. */
  rotation?: number;
  /** Font size (px). Default 13. */
  fontSize?: number;
  /** Text color. */
  color?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface GeoCurve {
  id: GeoId;
  type: "curve";
  /** Quadratic-Bezier form: start, middle (bend), end. */
  a?: GeoId;
  mid?: GeoId;
  b?: GeoId;
  /** Legacy multi-point form (Catmull-Rom). Kept for backwards compat. */
  points?: GeoId[];
  dashed?: boolean;
  color?: string;
  fill?: string;
  fillOpacity?: number;
  area?: string;
}



export type GeoObject =
  | GeoPoint
  | GeoSegment
  | GeoLine
  | GeoRay
  | GeoCircle
  | GeoArc
  | GeoAngle
  | GeoPolygon
  | GeoCurve
  | GeoRegion
  | GeoLabel;

export interface GeometryScene {
  bounds: { width: number; height: number };
  objects: GeoObject[];
  meta?: {
    topic?: string;
    caption?: string;
    /** Teacher-curated relationships per selection signature. */
    relationships?: Record<string, unknown>;
  };
}

export const EMPTY_SCENE: GeometryScene = {
  bounds: { width: 360, height: 240 },
  objects: [],
};

export function isGeometryScene(x: unknown): x is GeometryScene {
  if (!x || typeof x !== "object") return false;
  const s = x as any;
  return (
    s.bounds &&
    typeof s.bounds.width === "number" &&
    typeof s.bounds.height === "number" &&
    Array.isArray(s.objects)
  );
}

/** Lookup helper used by the renderer + AI edits. */
export function pointById(scene: GeometryScene, id: GeoId): GeoPoint | null {
  const o = scene.objects.find((o) => o.id === id);
  return o && o.type === "point" ? o : null;
}

/** Stable diff between two scenes — used by the preview to highlight changes. */
export interface SceneDiff {
  added: Set<GeoId>;
  removed: Set<GeoId>;
  changed: Set<GeoId>;
}
export function diffScenes(prev: GeometryScene, next: GeometryScene): SceneDiff {
  const prevMap = new Map(prev.objects.map((o) => [o.id, o]));
  const nextMap = new Map(next.objects.map((o) => [o.id, o]));
  const added = new Set<GeoId>();
  const removed = new Set<GeoId>();
  const changed = new Set<GeoId>();
  for (const [id, obj] of nextMap) {
    if (!prevMap.has(id)) added.add(id);
    else if (JSON.stringify(prevMap.get(id)) !== JSON.stringify(obj)) changed.add(id);
  }
  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) removed.add(id);
  }
  return { added, removed, changed };
}

/** Minimal scene sanitizer — drops malformed objects, fills defaults. */
export function sanitizeScene(raw: unknown): GeometryScene | null {
  if (!isGeometryScene(raw)) return null;
  const bounds = {
    width: clamp(Number(raw.bounds.width) || 360, 80, 1200),
    height: clamp(Number(raw.bounds.height) || 240, 80, 1200),
  };
  const ids = new Set<string>();
  const objects: GeoObject[] = [];
  for (const o of raw.objects) {
    if (!o || typeof o !== "object" || typeof (o as any).id !== "string") continue;
    if (ids.has((o as any).id)) continue;
    ids.add((o as any).id);
    objects.push(o as GeoObject);
  }
  return { bounds, objects, meta: raw.meta ?? undefined };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
