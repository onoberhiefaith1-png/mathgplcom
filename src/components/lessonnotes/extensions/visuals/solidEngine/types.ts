// Universal 3D Solid Engine — shared types.
//
// One data shape powers every solid: cube, cuboid, cylinder, cone, sphere,
// hemisphere, prism, pyramid, squarePyramid, triangularPrism,
// triangularPyramid, frustum. The teacher morphs one into another via the
// Type dropdown.

export type SolidType =
  | "cube" | "cuboid" | "cylinder" | "cone" | "sphere" | "hemisphere"
  | "prism" | "pyramid" | "squarePyramid" | "triangularPrism"
  | "triangularPyramid" | "frustum";

export type LineStyle = "solid" | "dashed" | "dotted";
export type HiddenEdgeMode = "hide" | "dashed" | "show";
export type FillMode = "none" | "solid" | "transparent";

export interface SolidLabel {
  id: string;
  text: string;
  /** SVG offset in canvas units */
  dx: number;
  dy: number;
}

export interface MeasurementEntry {
  enabled: boolean;
  /** Free-form label shown on the solid; falls back to the default letter when empty. */
  value: string;
}

export type MeasurementKey =
  | "height" | "width" | "length" | "radius" | "diameter" | "slantHeight";

export type Measurements = Record<MeasurementKey, MeasurementEntry>;

export const MEASUREMENT_LETTER: Record<MeasurementKey, string> = {
  height: "h", width: "w", length: "l",
  radius: "r", diameter: "d", slantHeight: "s",
};

export const MEASUREMENT_LABEL: Record<MeasurementKey, string> = {
  height: "Height", width: "Width", length: "Length",
  radius: "Radius", diameter: "Diameter", slantHeight: "Slant height",
};

const emptyEntry = (): MeasurementEntry => ({ enabled: false, value: "" });

export function normalizeMeasurements(raw: unknown): Measurements {
  const base: Measurements = {
    height: emptyEntry(), width: emptyEntry(), length: emptyEntry(),
    radius: emptyEntry(), diameter: emptyEntry(), slantHeight: emptyEntry(),
  };
  if (!raw || typeof raw !== "object") return base;
  const rec = raw as Record<string, unknown>;
  (Object.keys(base) as MeasurementKey[]).forEach((k) => {
    const v = rec[k];
    if (typeof v === "boolean") base[k] = { enabled: v, value: "" };
    else if (v && typeof v === "object") {
      const o = v as { enabled?: unknown; value?: unknown };
      base[k] = {
        enabled: Boolean(o.enabled),
        value: typeof o.value === "string" ? o.value : "",
      };
    }
  });
  return base;
}


export interface UCESolid {
  id: string;
  type: SolidType;

  // uniform scale
  size: number;
  // per-axis dimensions (canvas units)
  width: number;
  height: number;
  depth: number;

  // rotation (degrees)
  rotX: number;
  rotY: number;
  rotZ: number;

  // board position (centre in canvas units)
  x: number;
  y: number;

  // outline
  thickness: number;
  color: string;
  style: LineStyle;

  // fill
  fillMode: FillMode;
  fillColor: string;
  fillOpacity: number;

  hiddenEdges: HiddenEdgeMode;

  labels: SolidLabel[];
  measurements: Measurements;

  locked: boolean;
}

export interface UCESolidModel {
  presetId: string;
  width: number;   // canvas width
  height: number;  // canvas height
  solids: UCESolid[];
}

export const DEFAULT_SOLID: Omit<UCESolid, "id" | "type" | "x" | "y"> = {
  size: 1,
  width: 90,
  height: 90,
  depth: 90,
  rotX: -20,
  rotY: 25,
  rotZ: 0,
  thickness: 2,
  color: "#111827",
  style: "solid",
  fillMode: "none",
  fillColor: "#3b82f6",
  fillOpacity: 0.15,
  hiddenEdges: "dashed",
  labels: [],
  measurements: {
    height: { enabled: false, value: "" },
    width: { enabled: false, value: "" },
    length: { enabled: false, value: "" },
    radius: { enabled: false, value: "" },
    diameter: { enabled: false, value: "" },
    slantHeight: { enabled: false, value: "" },
  },
  locked: false,
};

export function newSolidId(): string {
  return `s_${Math.random().toString(36).slice(2, 8)}`;
}

export function newLabelId(): string {
  return `l_${Math.random().toString(36).slice(2, 6)}`;
}
