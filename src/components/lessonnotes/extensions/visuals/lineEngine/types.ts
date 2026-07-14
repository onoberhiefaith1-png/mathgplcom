// Universal Line Engine — shared types.
//
// One data shape powers every asset in the "Lines & Angles" group:
// segment, ray, vector, intersecting lines, parallel + transversal, and
// all four angle presets. Each preset just seeds a different ULEModel.

export type EndCap = "plain" | "closedDot" | "openDot" | "arrow" | "doubleArrow";
export type LineStyle = "solid" | "dashed" | "dotted";
export type SnapIncrement = 0 | 15 | 30 | 45 | 90;

export interface ULELine {
  id: string;
  ax: number; ay: number;
  bx: number; by: number;
  thickness: number;      // px
  color: string;          // CSS color / theme token
  style: LineStyle;
  opacity: number;        // 0..1
  endA: EndCap;
  endB: EndCap;
  label: string;
  showLength: boolean;
  unit: "px" | "cm" | "units";
  lockLen: boolean;
  lockAngle: boolean;
  snap: SnapIncrement;
}

export type RelationKind = "parallel" | "perpendicular" | "equalLength" | "lockIntersect";

export interface ULERelation {
  id: string;
  kind: RelationKind;
  lineIds: [string, string];
}

export interface AngleMark {
  /** vertex — id of the shared endpoint of two lines */
  vertexLineA: string;
  vertexLineB: string;
  showArc: boolean;
  showValue: boolean;
  label: string;
  arcRadius: number;
  arcs: 1 | 2 | 3;
}

export interface ULEModel {
  presetId: string;
  lines: ULELine[];
  relations: ULERelation[];
  angleMarks: AngleMark[];
  /** viewport, in SVG user units */
  width: number;
  height: number;
}

export const DEFAULT_LINE: Omit<ULELine, "id" | "ax" | "ay" | "bx" | "by"> = {
  thickness: 2,
  color: "#111111",
  style: "solid",
  opacity: 1,
  endA: "plain",
  endB: "plain",
  label: "",
  showLength: false,
  unit: "units",
  lockLen: false,
  lockAngle: false,
  snap: 0,
};

export function newLineId(): string {
  return `l_${Math.random().toString(36).slice(2, 8)}`;
}
