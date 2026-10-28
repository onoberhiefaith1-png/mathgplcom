// Universal Circle Engine — shared types.
//
// One data shape powers every circle-family asset: circle, arc, sector,
// segment, semicircle, quadrant, chord, tangent, radius, diameter and
// concentric circles. Each tile just seeds a different UCEModel; the
// teacher morphs it via the Type dropdown afterwards.

export type CircleType =
  | "circle" | "arc" | "sector" | "segment" | "semicircle" | "quadrant";

export type LineStyle = "solid" | "dashed" | "dotted";

export interface RimLabel {
  angleDeg: number;
  text: string;
}

export interface UCECircle {
  id: string;
  cx: number; cy: number;
  r: number;
  type: CircleType;
  /** Start angle for arc/sector/segment (degrees, 0 = east, CCW positive). */
  startDeg: number;
  /** Sweep angle 0..360 for arc/sector/segment. */
  sweepDeg: number;

  // outline
  thickness: number;
  color: string;
  style: LineStyle;
  opacity: number;

  // fill
  fill: string;            // "none" or CSS color
  fillOpacity: number;     // 0..1

  // decorations
  showCentre: boolean;
  /** angles (deg) of radius lines drawn from centre to rim */
  radii: number[];
  showDiameter: boolean;
  diameterAngleDeg: number;

  // labels
  centreLabel: string;
  rimLabels: RimLabel[];

  // behaviour
  locked: boolean;
}

export interface UCEModel {
  presetId: string;
  width: number;
  height: number;
  circles: UCECircle[];
}

export const DEFAULT_CIRCLE: Omit<UCECircle, "id" | "cx" | "cy" | "r"> = {
  type: "circle",
  startDeg: 0,
  sweepDeg: 360,
  thickness: 2,
  color: "#111827",
  style: "solid",
  opacity: 1,
  fill: "none",
  fillOpacity: 0.25,
  showCentre: false,
  radii: [],
  showDiameter: false,
  diameterAngleDeg: 0,
  centreLabel: "",
  rimLabels: [],
  locked: false,
};

export function newCircleId(): string {
  return `c_${Math.random().toString(36).slice(2, 8)}`;
}
