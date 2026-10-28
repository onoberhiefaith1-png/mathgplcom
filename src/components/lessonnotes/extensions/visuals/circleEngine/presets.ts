// Preset builders — every circle-family tile seeds one UCEModel.
// Tiles map onto the shared engine; the Type dropdown in the panel lets
// the teacher freely morph a "sector" into a "segment" or "arc" etc.

import { DEFAULT_CIRCLE, newCircleId, type UCECircle, type UCEModel, type CircleType } from "./types";

const W = 220, H = 180;

function mk(overrides: Partial<UCECircle>): UCECircle {
  return {
    ...DEFAULT_CIRCLE,
    cx: W / 2,
    cy: H / 2,
    r: 60,
    ...overrides,
    id: overrides.id ?? newCircleId(),
  } as UCECircle;
}

export function buildPreset(id: string): UCEModel {
  const preset = (id || "circle").toLowerCase();
  const base = { presetId: preset, width: W, height: H };
  const one = (c: UCECircle): UCEModel => ({ ...base, circles: [c] });

  switch (preset) {
    case "circle":
      return one(mk({ showCentre: true, centreLabel: "O" }));
    case "radius":
    case "circleradius":
      return one(mk({ showCentre: true, centreLabel: "O", radii: [0] }));
    case "diameter":
    case "circlediameter":
      return one(mk({ showCentre: true, centreLabel: "O", showDiameter: true, diameterAngleDeg: 0 }));
    case "sector":
    case "circlesector":
      return one(mk({ type: "sector", startDeg: 30, sweepDeg: 90, fill: "#3b82f6", fillOpacity: 0.2 }));
    case "segment":
    case "circlesegmentchord":
      return one(mk({ type: "segment", startDeg: 20, sweepDeg: 140, fill: "#3b82f6", fillOpacity: 0.2 }));
    case "arc":
      return one(mk({ type: "arc", startDeg: 30, sweepDeg: 120 }));
    case "semicircle":
      return one(mk({ type: "semicircle", startDeg: 0, sweepDeg: 180, fill: "#3b82f6", fillOpacity: 0.15 }));
    case "quadrant":
      return one(mk({ type: "quadrant", startDeg: 0, sweepDeg: 90, fill: "#3b82f6", fillOpacity: 0.15 }));
    case "tangent":
    case "circletangent":
      // Circle with a diameter marker + radius; the tangent line itself
      // can be added later via the "add line" flow. Keep it simple here.
      return one(mk({ r: 50, showCentre: true, centreLabel: "O", radii: [270] }));
    case "concentric":
    case "concentriccircles":
      return {
        ...base,
        circles: [
          mk({ r: 70, showCentre: true, centreLabel: "O" }),
          mk({ r: 45 }),
          mk({ r: 22 }),
        ],
      };
    default:
      return one(mk({ showCentre: true, centreLabel: "O" }));
  }
}

export const CIRCLE_TYPES: CircleType[] = [
  "circle", "arc", "sector", "segment", "semicircle", "quadrant",
];
