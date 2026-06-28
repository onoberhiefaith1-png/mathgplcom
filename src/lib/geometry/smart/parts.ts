// Smart parts — logical mathematical objects derived from a GeometryScene.
// Each part wraps one or more raw scene objects with a math identity that
// hover / select / theorem detection can reason about.

import type { GeoId, GeometryScene } from "@/lib/geometry/scene";

export type PartKind =
  | "vertex"
  | "side"
  | "angle"
  | "triangle"
  | "midpoint"
  | "centre"
  | "radius"
  | "diameter"
  | "chord"
  | "arc"
  | "circle"
  | "tangent"
  | "pointOnCircle"
  | "line"
  | "segment";

export interface SmartPartBase {
  id: string;            // stable derived id, e.g. "side:p1-p2"
  kind: PartKind;
  label: string;         // teacher-facing, e.g. "AB", "∠A", "radius OA"
  sourceObjectIds: GeoId[];
  /** Anchor in scene logical coords used by the overlay/halo. */
  anchor: { x: number; y: number };
  /** Hit-test geometry. */
  hit:
    | { kind: "point"; x: number; y: number; r: number }
    | { kind: "segment"; x1: number; y1: number; x2: number; y2: number }
    | { kind: "circle"; cx: number; cy: number; r: number }
    | { kind: "arc"; cx: number; cy: number; r: number; from: number; to: number };
  /** Optional numeric value (degrees, length, radius). */
  value?: number;
  unit?: "deg" | "len";
}

export interface SmartGraph {
  parts: SmartPartBase[];
  /** part.id -> part. */
  byId: Map<string, SmartPartBase>;
  /** Triangles found in the scene, by part id. */
  triangleIds: string[];
  scene: GeometryScene;
}
