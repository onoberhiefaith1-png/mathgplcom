// Shared types for the Smart Geometry Editor. Adapters describe their
// editable properties (Adjust) and buildable extras (Add Component); the
// panel shell is universal and reads only these types.

export type Field =
  | { kind: "side";   name: string; label: string; value: number; locked?: boolean }
  | { kind: "angle";  name: string; label: string; value: number; locked?: boolean }
  | { kind: "coord";  name: string; label: string; x: number; y: number }
  | { kind: "label";  name: string; label: string; value: string }
  | { kind: "number"; name: string; label: string; value: number; suffix?: string; min?: number; max?: number; step?: number; locked?: boolean }
  | { kind: "text";   name: string; label: string; value: string; placeholder?: string; locked?: boolean }
  | { kind: "select"; name: string; label: string; value: string; options: { value: string; label: string }[]; locked?: boolean };

export type VisibilityKey =
  | "sideLabels" | "angleLabels" | "dimensions"
  | "construction" | "coordLabels" | "grid" | "arrows";

export type Visibility = Partial<Record<VisibilityKey, boolean>>;

export const DEFAULT_VISIBILITY: Required<Visibility> = {
  sideLabels: true, angleLabels: true, dimensions: true,
  construction: true, coordLabels: true, grid: false, arrows: true,
};

export type ComponentGroup = "Geometry" | "Labels" | "Measurements" | "Marks" | "Shapes" | "Data";

export type ComponentKind =
  // wired
  | "altitude" | "median" | "midpoint" | "perpendicular" | "parallel"
  | "rightAngleMark" | "equalTicks" | "lengthMeasure" | "angleMeasure"
  // stubs
  | "point" | "lineSegment" | "ray" | "bisector" | "tangent"
  | "chord" | "radius" | "diameter" | "arc" | "vector"
  | "pointLabel" | "sideLabel" | "angleLabel" | "textNote"
  | "areaMeasure" | "perimeterMeasure"
  | "parallelArrows" | "congruentMarks"
  | "childTriangle" | "childCircle" | "childRectangle" | "childPolygon"
  | "addRow" | "addColumn" | "addBar" | "addMarker" | "addSeries";

export type ComponentDef = {
  kind: ComponentKind;
  label: string;
  group: ComponentGroup;
  disabled?: boolean;
  /** Prompts shown before creation (e.g. pick a vertex). */
  needs?: { key: string; label: string; from: "vertex" | "side" }[];
};

export type LiveComponent = {
  id: string;
  kind: ComponentKind;
  refs: Record<string, string>;
};

export function newComponentId(): string {
  return `c${Math.random().toString(36).slice(2, 9)}`;
}
