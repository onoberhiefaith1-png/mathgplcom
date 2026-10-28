// Preset builders — every 3D solid tile seeds one UCESolidModel.

import { DEFAULT_SOLID, newSolidId, type SolidType, type UCESolid, type UCESolidModel } from "./types";

const W = 220, H = 180;

function mk(type: SolidType, overrides: Partial<UCESolid> = {}): UCESolid {
  return {
    ...DEFAULT_SOLID,
    type,
    x: W / 2,
    y: H / 2,
    ...overrides,
    id: overrides.id ?? newSolidId(),
  } as UCESolid;
}

export function buildSolidPreset(id: string): UCESolidModel {
  const preset = (id || "cube").toLowerCase();
  const one = (s: UCESolid): UCESolidModel => ({ presetId: preset, width: W, height: H, solids: [s] });

  switch (preset) {
    case "cube":
      return one(mk("cube", { width: 80, height: 80, depth: 80 }));
    case "cuboid":
      return one(mk("cuboid", { width: 110, height: 70, depth: 70 }));
    case "cylinder":
      return one(mk("cylinder", { width: 90, height: 110, depth: 90, rotX: -15, rotY: 0 }));
    case "cone":
      return one(mk("cone", { width: 90, height: 110, depth: 90, rotX: -15, rotY: 0 }));
    case "sphere":
      return one(mk("sphere", { width: 90, height: 90, depth: 90, rotX: 0, rotY: 0 }));
    case "hemisphere":
      return one(mk("hemisphere", { width: 100, height: 60, depth: 100, rotX: -15, rotY: 0 }));
    case "prism":
    case "triangularprism":
      return one(mk("triangularPrism", { width: 70, height: 70, depth: 90 }));
    case "pyramid":
    case "squarepyramid":
      return one(mk("squarePyramid", { width: 90, height: 90, depth: 90 }));
    case "triangularpyramid":
      return one(mk("triangularPyramid", { width: 80, height: 80, depth: 80 }));
    case "frustum":
      return one(mk("frustum", { width: 100, height: 80, depth: 100 }));
    default:
      return one(mk("cube"));
  }
}

export const SOLID_TYPES: SolidType[] = [
  "cube", "cuboid", "cylinder", "cone", "sphere", "hemisphere",
  "prism", "pyramid", "squarePyramid", "triangularPrism",
  "triangularPyramid", "frustum",
];

export const SOLID_TYPE_LABEL: Record<SolidType, string> = {
  cube: "Cube",
  cuboid: "Cuboid",
  cylinder: "Cylinder",
  cone: "Cone",
  sphere: "Sphere",
  hemisphere: "Hemisphere",
  prism: "Prism",
  pyramid: "Pyramid",
  squarePyramid: "Square-based pyramid",
  triangularPrism: "Triangular prism",
  triangularPyramid: "Triangular pyramid",
  frustum: "Frustum",
};

export function hasDepth(type: SolidType): boolean {
  return type !== "sphere";
}
