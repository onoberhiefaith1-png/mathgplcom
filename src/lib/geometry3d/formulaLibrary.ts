// The shape-specific mathematics library.
//
// Single source of truth for: editable dimensions, volume and surface-area
// formulas, the substitution / calculation lines a teacher writes on the
// board, and the teaching notes that explain WHY the formula works.
//
// Every value is derived live from solid.params combined with the object's
// scale, so resizing a solid instantly rewrites the mathematics.

import type { Solid3D, Solid3DKind } from "./scene3d";
import { SOLID_DEFS } from "./scene3d";
import { totalSurfaceArea, lateralSurfaceArea } from "./measure";
import { roundTo } from "./units";

/** An editable dimension of the solid. */
export interface Dimension {
  key: string;
  symbol: string;
  label: string;
  /** Effective (world) value = params[key] × scaleFactor. */
  value: number;
  /** Multiplier applied by the object's scale for this dimension. */
  scaleFactor: number;
  min: number;
  max: number;
  step: number;
  /** Which 3D guide to emphasise when the row is hovered. */
  guide: "radiusX" | "radiusZ" | "height" | "width" | "depth" | "edge" | "topRadius";
}

export interface Working {
  title: string;
  formula: string;
  substitution: string;
  calculation: string;
  value: number;
  /** 1 = length, 2 = area, 3 = volume. */
  power: 1 | 2 | 3;
  /** Extra board lines (e.g. base area worked out first). */
  steps?: string[];
}

export interface VariableMeaning {
  symbol: string;
  label: string;
  value: number;
  meaning: string;
}

export interface ShapeMath {
  kind: Solid3DKind;
  name: string;
  family: string;
  dimensions: Dimension[];
  variables: VariableMeaning[];
  volume: Working;
  totalSA: Working;
  lateralSA: Working | null;
  why: { volume: string; surfaceArea: string };
  how: { volume: string[]; surfaceArea: string[] };
  notes: string[];
  mistakes: string[];
}

const n3 = (n: number) => String(roundTo(n, 3));
const PI = Math.PI;

/**
 * Mathematical dimensions are read straight from params. The object's visual
 * scale is a display property only, so every factor here is 1.
 */
function factors(_solid: Solid3D) {
  return { sx: 1, sy: 1, sz: 1, radial: 1 };
}

function dim(
  solid: Solid3D, key: string, symbol: string, label: string,
  scaleFactor: number, guide: Dimension["guide"],
): Dimension | null {
  const def = SOLID_DEFS[solid.kind].fields.find((f) => f.key === key);
  const raw = solid.params?.[key];
  if (raw == null || !def) return null;
  return {
    key, symbol, label,
    value: raw * scaleFactor,
    scaleFactor,
    min: def.min * scaleFactor,
    max: def.max * scaleFactor,
    step: def.step,
    guide,
  };
}

function prismFamily(kind: Solid3DKind) {
  return kind.endsWith("Prism") || kind === "cube" || kind === "cuboid";
}

/** Area of a regular n-gon of circumradius r. */
function ngonArea(sides: number, r: number): number {
  return 0.5 * sides * r * r * Math.sin((2 * PI) / sides);
}

/** Perimeter of a regular n-gon of circumradius r. */
function ngonPerimeter(sides: number, r: number): number {
  return sides * 2 * r * Math.sin(PI / sides);
}

export function shapeMath(solid: Solid3D): ShapeMath {
  const p = solid.params ?? {};
  const f = factors(solid);
  const kind = solid.kind;
  const name = SOLID_DEFS[kind].label;

  const r = (p.radius ?? 1) * f.radial;
  const rTop = (p.topRadius ?? 0) * f.radial;
  const h = (p.height ?? 2) * f.sy;
  const sides = Math.max(3, Math.round(p.sides ?? 4));

  const dims: Dimension[] = [];
  const push = (d: Dimension | null) => { if (d) dims.push(d); };

  const totalSAValue = totalSurfaceArea(solid);
  const lateralSAValue = lateralSurfaceArea(solid);

  const base = {
    kind, name,
    family: prismFamily(kind) ? "Prism" : kind.toLowerCase().includes("pyramid") || kind === "tetrahedron" ? "Pyramid" : "Curved solid",
    notes: [] as string[],
    mistakes: [] as string[],
  };

  switch (kind) {
    case "cube": {
      const a = (p.size ?? 2) * f.sx;
      push(dim(solid, "size", "a", "Edge length", f.sx, "edge"));
      return {
        ...base,
        dimensions: dims,
        variables: [{ symbol: "a", label: "Edge length", value: a, meaning: "The length of one edge — all 12 edges are equal." }],
        volume: {
          title: "Volume", formula: "V = a\u00B3", substitution: `V = ${n3(a)}\u00B3`,
          calculation: `V = ${n3(a)} \u00D7 ${n3(a)} \u00D7 ${n3(a)}`, value: a ** 3, power: 3,
        },
        totalSA: {
          title: "Total surface area", formula: "A = 6a\u00B2", substitution: `A = 6 \u00D7 ${n3(a)}\u00B2`,
          calculation: `A = 6 \u00D7 ${n3(a * a)}`, value: 6 * a * a, power: 2,
        },
        lateralSA: {
          title: "Lateral surface area", formula: "A = 4a\u00B2", substitution: `A = 4 \u00D7 ${n3(a)}\u00B2`,
          calculation: `A = 4 \u00D7 ${n3(a * a)}`, value: 4 * a * a, power: 2,
        },
        why: {
          volume: "A cube is a prism: the square base of area a\u00B2 is stacked to a height of a, so V = a\u00B2 \u00D7 a = a\u00B3.",
          surfaceArea: "The net of a cube is six identical squares, so the surface area is 6 lots of a\u00B2.",
        },
        how: {
          volume: ["Measure one edge, a.", "Square it to get the base area.", "Multiply by the height (also a)."],
          surfaceArea: ["Find the area of one face: a\u00B2.", "Count the faces: 6.", "Multiply: 6a\u00B2."],
        },
        notes: ["All faces are congruent squares.", "Space diagonal = a\u221A3."],
        mistakes: ["Writing 3a instead of a\u00B3.", "Using 4 faces instead of 6 for total surface area."],
      };
    }
    case "cuboid": {
      const l = (p.width ?? 2) * f.sx;
      const w = (p.depth ?? 1) * f.sz;
      const hh = (p.height ?? 1.5) * f.sy;
      push(dim(solid, "width", "l", "Length", f.sx, "width"));
      push(dim(solid, "depth", "w", "Width (depth)", f.sz, "depth"));
      push(dim(solid, "height", "h", "Height", f.sy, "height"));
      return {
        ...base,
        dimensions: dims,
        variables: [
          { symbol: "l", label: "Length", value: l, meaning: "Horizontal edge along the x-axis." },
          { symbol: "w", label: "Width", value: w, meaning: "Horizontal edge along the z-axis." },
          { symbol: "h", label: "Height", value: hh, meaning: "Vertical edge along the y-axis." },
        ],
        volume: {
          title: "Volume", formula: "V = l \u00D7 w \u00D7 h",
          substitution: `V = ${n3(l)} \u00D7 ${n3(w)} \u00D7 ${n3(hh)}`,
          calculation: `V = ${n3(l * w)} \u00D7 ${n3(hh)}`, value: l * w * hh, power: 3,
          steps: [`Base area = l \u00D7 w = ${n3(l * w)}`],
        },
        totalSA: {
          title: "Total surface area", formula: "A = 2(lw + lh + wh)",
          substitution: `A = 2(${n3(l)}\u00D7${n3(w)} + ${n3(l)}\u00D7${n3(hh)} + ${n3(w)}\u00D7${n3(hh)})`,
          calculation: `A = 2(${n3(l * w)} + ${n3(l * hh)} + ${n3(w * hh)})`,
          value: 2 * (l * w + l * hh + w * hh), power: 2,
        },
        lateralSA: {
          title: "Lateral surface area", formula: "A = 2h(l + w)",
          substitution: `A = 2 \u00D7 ${n3(hh)} \u00D7 (${n3(l)} + ${n3(w)})`,
          calculation: `A = ${n3(2 * hh)} \u00D7 ${n3(l + w)}`, value: 2 * hh * (l + w), power: 2,
        },
        why: {
          volume: "The cuboid is a prism with a rectangular base of area l \u00D7 w, repeated through a height h.",
          surfaceArea: "Opposite faces are congruent, so the six faces form three matching pairs: lw, lh and wh.",
        },
        how: {
          volume: ["Work out the base area l \u00D7 w.", "Multiply by the height h.", "Write the answer in cubic units."],
          surfaceArea: ["Find the three different face areas.", "Double each one (opposite faces match).", "Add the three doubled areas."],
        },
        notes: ["Opposite faces are equal in area.", "Space diagonal = \u221A(l\u00B2 + w\u00B2 + h\u00B2)."],
        mistakes: ["Forgetting the factor of 2 for opposite faces.", "Mixing up the height with the depth."],
      };
    }
    case "cylinder": {
      push(dim(solid, "radius", "r", "Radius", f.radial, "radiusX"));
      push(dim(solid, "height", "h", "Height", f.sy, "height"));
      return {
        ...base,
        dimensions: dims,
        variables: [
          { symbol: "r", label: "Radius", value: r, meaning: "Radius of the circular base." },
          { symbol: "h", label: "Height", value: h, meaning: "Perpendicular distance between the two circular faces." },
        ],
        volume: {
          title: "Volume", formula: "V = \u03C0r\u00B2h",
          substitution: `V = \u03C0 \u00D7 ${n3(r)}\u00B2 \u00D7 ${n3(h)}`,
          calculation: `V = \u03C0 \u00D7 ${n3(r * r)} \u00D7 ${n3(h)}`,
          value: PI * r * r * h, power: 3,
          steps: [`Base area = \u03C0r\u00B2 = ${n3(PI * r * r)}`],
        },
        totalSA: {
          title: "Total surface area", formula: "A = 2\u03C0r\u00B2 + 2\u03C0rh",
          substitution: `A = 2\u03C0 \u00D7 ${n3(r)}\u00B2 + 2\u03C0 \u00D7 ${n3(r)} \u00D7 ${n3(h)}`,
          calculation: `A = ${n3(2 * PI * r * r)} + ${n3(2 * PI * r * h)}`,
          value: 2 * PI * r * r + 2 * PI * r * h, power: 2,
        },
        lateralSA: {
          title: "Curved surface area", formula: "A = 2\u03C0rh",
          substitution: `A = 2\u03C0 \u00D7 ${n3(r)} \u00D7 ${n3(h)}`,
          calculation: `A = ${n3(2 * PI * r)} \u00D7 ${n3(h)}`, value: 2 * PI * r * h, power: 2,
        },
        why: {
          volume: "A cylinder is a prism with a circular base: area \u03C0r\u00B2 stacked through height h.",
          surfaceArea: "Unroll the curved surface and it becomes a rectangle of width 2\u03C0r (the circumference) and height h, plus two circular ends.",
        },
        how: {
          volume: ["Find the base area \u03C0r\u00B2.", "Multiply by the height h.", "Round only at the end."],
          surfaceArea: ["Curved part: 2\u03C0rh.", "Two ends: 2\u03C0r\u00B2.", "Add them for the total."],
        },
        notes: ["Circumference of the base = 2\u03C0r.", "An open cylinder (no lid) has area 2\u03C0rh + \u03C0r\u00B2."],
        mistakes: ["Using diameter in place of radius.", "Forgetting one of the two circular ends."],
      };
    }
    case "cone": {
      const l = Math.hypot(r, h);
      push(dim(solid, "radius", "r", "Base radius", f.radial, "radiusX"));
      push(dim(solid, "height", "h", "Perpendicular height", f.sy, "height"));
      return {
        ...base,
        dimensions: dims,
        variables: [
          { symbol: "r", label: "Base radius", value: r, meaning: "Radius of the circular base." },
          { symbol: "h", label: "Perpendicular height", value: h, meaning: "Vertical height from base to apex." },
          { symbol: "l", label: "Slant height", value: l, meaning: "Distance from the apex down the curved surface: l = \u221A(r\u00B2 + h\u00B2)." },
        ],
        volume: {
          title: "Volume", formula: "V = \u2153\u03C0r\u00B2h",
          substitution: `V = \u2153 \u00D7 \u03C0 \u00D7 ${n3(r)}\u00B2 \u00D7 ${n3(h)}`,
          calculation: `V = \u2153 \u00D7 ${n3(PI * r * r)} \u00D7 ${n3(h)}`,
          value: (1 / 3) * PI * r * r * h, power: 3,
        },
        totalSA: {
          title: "Total surface area", formula: "A = \u03C0rl + \u03C0r\u00B2",
          substitution: `A = \u03C0 \u00D7 ${n3(r)} \u00D7 ${n3(l)} + \u03C0 \u00D7 ${n3(r)}\u00B2`,
          calculation: `A = ${n3(PI * r * l)} + ${n3(PI * r * r)}`,
          value: PI * r * l + PI * r * r, power: 2,
          steps: [`Slant height l = \u221A(${n3(r)}\u00B2 + ${n3(h)}\u00B2) = ${n3(l)}`],
        },
        lateralSA: {
          title: "Curved surface area", formula: "A = \u03C0rl",
          substitution: `A = \u03C0 \u00D7 ${n3(r)} \u00D7 ${n3(l)}`,
          calculation: `A = ${n3(PI * r)} \u00D7 ${n3(l)}`, value: PI * r * l, power: 2,
          steps: [`l = \u221A(r\u00B2 + h\u00B2) = ${n3(l)}`],
        },
        why: {
          volume: "Three cones fill exactly one cylinder of the same base and height, which is why the volume carries the factor \u2153.",
          surfaceArea: "The curved surface opens out into a sector of a circle of radius l, giving area \u03C0rl.",
        },
        how: {
          volume: ["Find \u03C0r\u00B2 for the base.", "Multiply by h.", "Divide by 3."],
          surfaceArea: ["Find the slant height with Pythagoras.", "Curved area = \u03C0rl.", "Add the base \u03C0r\u00B2 if the cone is closed."],
        },
        notes: ["Slant height l = \u221A(r\u00B2 + h\u00B2).", "Use h (not l) for volume, and l (not h) for curved area."],
        mistakes: ["Using slant height in the volume formula.", "Forgetting to divide by 3."],
      };
    }
    case "sphere": {
      push(dim(solid, "radius", "r", "Radius", f.radial, "radiusX"));
      return {
        ...base,
        dimensions: dims,
        variables: [{ symbol: "r", label: "Radius", value: r, meaning: "Distance from the centre to any point on the surface." }],
        volume: {
          title: "Volume", formula: "V = \u2074\u2044\u2083\u03C0r\u00B3",
          substitution: `V = \u2074\u2044\u2083 \u00D7 \u03C0 \u00D7 ${n3(r)}\u00B3`,
          calculation: `V = \u2074\u2044\u2083 \u00D7 \u03C0 \u00D7 ${n3(r ** 3)}`,
          value: (4 / 3) * PI * r ** 3, power: 3,
        },
        totalSA: {
          title: "Surface area", formula: "A = 4\u03C0r\u00B2",
          substitution: `A = 4\u03C0 \u00D7 ${n3(r)}\u00B2`,
          calculation: `A = 4\u03C0 \u00D7 ${n3(r * r)}`, value: 4 * PI * r * r, power: 2,
        },
        lateralSA: null,
        why: {
          volume: "The sphere fills two-thirds of the smallest cylinder that contains it (Archimedes' result).",
          surfaceArea: "The surface area equals exactly four great circles, each of area \u03C0r\u00B2.",
        },
        how: {
          volume: ["Cube the radius.", "Multiply by \u03C0.", "Multiply by 4 and divide by 3."],
          surfaceArea: ["Square the radius.", "Multiply by \u03C0.", "Multiply by 4."],
        },
        notes: ["A sphere has one curved surface, no edges and no vertices.", "It has no net — it cannot be flattened."],
        mistakes: ["Confusing 4\u03C0r\u00B2 (area) with \u2074\u2044\u2083\u03C0r\u00B3 (volume).", "Using the diameter as r."],
      };
    }
    case "hemisphere": {
      push(dim(solid, "radius", "r", "Radius", f.radial, "radiusX"));
      return {
        ...base,
        dimensions: dims,
        variables: [{ symbol: "r", label: "Radius", value: r, meaning: "Radius of the flat circular face and of the curved surface." }],
        volume: {
          title: "Volume", formula: "V = \u2154\u03C0r\u00B3",
          substitution: `V = \u2154 \u00D7 \u03C0 \u00D7 ${n3(r)}\u00B3`,
          calculation: `V = \u2154 \u00D7 \u03C0 \u00D7 ${n3(r ** 3)}`,
          value: (2 / 3) * PI * r ** 3, power: 3,
        },
        totalSA: {
          title: "Total surface area", formula: "A = 3\u03C0r\u00B2",
          substitution: `A = 2\u03C0 \u00D7 ${n3(r)}\u00B2 + \u03C0 \u00D7 ${n3(r)}\u00B2`,
          calculation: `A = ${n3(2 * PI * r * r)} + ${n3(PI * r * r)}`,
          value: 3 * PI * r * r, power: 2,
        },
        lateralSA: {
          title: "Curved surface area", formula: "A = 2\u03C0r\u00B2",
          substitution: `A = 2\u03C0 \u00D7 ${n3(r)}\u00B2`,
          calculation: `A = 2\u03C0 \u00D7 ${n3(r * r)}`, value: 2 * PI * r * r, power: 2,
        },
        why: {
          volume: "A hemisphere is exactly half a sphere, so its volume is half of \u2074\u2044\u2083\u03C0r\u00B3.",
          surfaceArea: "Half the sphere's surface (2\u03C0r\u00B2) plus the flat circular face (\u03C0r\u00B2) gives 3\u03C0r\u00B2.",
        },
        how: {
          volume: ["Find the sphere volume \u2074\u2044\u2083\u03C0r\u00B3.", "Halve it."],
          surfaceArea: ["Curved half: 2\u03C0r\u00B2.", "Flat circle: \u03C0r\u00B2.", "Add for a solid hemisphere."],
        },
        notes: ["A solid hemisphere has 2 faces (1 curved, 1 flat) and 1 circular edge."],
        mistakes: ["Using 2\u03C0r\u00B2 as the total surface area — the flat face is often forgotten."],
      };
    }
    case "frustum": {
      const l = Math.hypot(h, r - rTop);
      push(dim(solid, "radius", "R", "Base radius", f.radial, "radiusX"));
      push(dim(solid, "topRadius", "r", "Top radius", f.radial, "topRadius"));
      push(dim(solid, "height", "h", "Height", f.sy, "height"));
      return {
        ...base,
        dimensions: dims,
        variables: [
          { symbol: "R", label: "Base radius", value: r, meaning: "Radius of the larger circular face." },
          { symbol: "r", label: "Top radius", value: rTop, meaning: "Radius of the smaller circular face." },
          { symbol: "h", label: "Height", value: h, meaning: "Perpendicular distance between the two circles." },
          { symbol: "l", label: "Slant height", value: l, meaning: "l = \u221A(h\u00B2 + (R \u2212 r)\u00B2)." },
        ],
        volume: {
          title: "Volume", formula: "V = \u2153\u03C0h(R\u00B2 + Rr + r\u00B2)",
          substitution: `V = \u2153 \u00D7 \u03C0 \u00D7 ${n3(h)} \u00D7 (${n3(r)}\u00B2 + ${n3(r)}\u00D7${n3(rTop)} + ${n3(rTop)}\u00B2)`,
          calculation: `V = \u2153 \u00D7 \u03C0 \u00D7 ${n3(h)} \u00D7 ${n3(r * r + r * rTop + rTop * rTop)}`,
          value: (1 / 3) * PI * h * (r * r + r * rTop + rTop * rTop), power: 3,
        },
        totalSA: {
          title: "Total surface area", formula: "A = \u03C0(R + r)l + \u03C0R\u00B2 + \u03C0r\u00B2",
          substitution: `A = \u03C0(${n3(r)} + ${n3(rTop)}) \u00D7 ${n3(l)} + \u03C0 \u00D7 ${n3(r)}\u00B2 + \u03C0 \u00D7 ${n3(rTop)}\u00B2`,
          calculation: `A = ${n3(PI * (r + rTop) * l)} + ${n3(PI * r * r)} + ${n3(PI * rTop * rTop)}`,
          value: PI * (r + rTop) * l + PI * r * r + PI * rTop * rTop, power: 2,
          steps: [`l = \u221A(h\u00B2 + (R \u2212 r)\u00B2) = ${n3(l)}`],
        },
        lateralSA: {
          title: "Curved surface area", formula: "A = \u03C0(R + r)l",
          substitution: `A = \u03C0(${n3(r)} + ${n3(rTop)}) \u00D7 ${n3(l)}`,
          calculation: `A = ${n3(PI * (r + rTop))} \u00D7 ${n3(l)}`,
          value: PI * (r + rTop) * l, power: 2,
        },
        why: {
          volume: "A frustum is a cone with a smaller similar cone removed from the top; subtracting the two cone volumes gives the (R\u00B2 + Rr + r\u00B2) bracket.",
          surfaceArea: "The curved surface is the difference of two sector shapes, giving \u03C0(R + r)l.",
        },
        how: {
          volume: ["Square both radii and multiply them together.", "Add R\u00B2 + Rr + r\u00B2.", "Multiply by \u03C0h and divide by 3."],
          surfaceArea: ["Find the slant height l.", "Curved area \u03C0(R + r)l.", "Add both circular faces."],
        },
        notes: ["Setting r = 0 recovers the cone formulas."],
        mistakes: ["Using the slant height as the perpendicular height in the volume formula."],
      };
    }
    case "triangularPrism":
    case "pentagonalPrism":
    case "hexagonalPrism": {
      const baseArea = ngonArea(sides, r);
      const per = ngonPerimeter(sides, r);
      push(dim(solid, "radius", "r", "Base circumradius", f.radial, "radiusX"));
      push(dim(solid, "height", "h", "Height", f.sy, "height"));
      return {
        ...base,
        dimensions: dims,
        variables: [
          { symbol: "r", label: "Base circumradius", value: r, meaning: "Distance from the centre of the base polygon to a corner." },
          { symbol: "A", label: "Base area", value: baseArea, meaning: `Area of the regular ${sides}-gon base.` },
          { symbol: "P", label: "Base perimeter", value: per, meaning: "Total distance around the base polygon." },
          { symbol: "h", label: "Height", value: h, meaning: "Length of the prism (distance between the two bases)." },
        ],
        volume: {
          title: "Volume", formula: "V = A\u2098 \u00D7 h",
          substitution: `V = ${n3(baseArea)} \u00D7 ${n3(h)}`,
          calculation: `V = ${n3(baseArea * h)}`,
          value: baseArea * h, power: 3,
          steps: [`Base area A = \u00BD \u00D7 ${sides} \u00D7 ${n3(r)}\u00B2 \u00D7 sin(360\u00B0/${sides}) = ${n3(baseArea)}`],
        },
        totalSA: {
          title: "Total surface area", formula: "A = 2A\u2098 + P h",
          substitution: `A = 2 \u00D7 ${n3(baseArea)} + ${n3(per)} \u00D7 ${n3(h)}`,
          calculation: `A = ${n3(2 * baseArea)} + ${n3(per * h)}`,
          value: totalSAValue, power: 2,
        },
        lateralSA: {
          title: "Lateral surface area", formula: "A = P h",
          substitution: `A = ${n3(per)} \u00D7 ${n3(h)}`,
          calculation: `A = ${n3(per * h)}`, value: lateralSAValue, power: 2,
        },
        why: {
          volume: "Every prism is a base shape repeated through its length, so the volume is always base area \u00D7 height.",
          surfaceArea: "The net is two identical bases plus one long rectangle whose width is the base perimeter.",
        },
        how: {
          volume: ["Work out the area of the base polygon.", "Multiply by the height."],
          surfaceArea: ["Two bases: 2A.", "Sides: perimeter \u00D7 height.", "Add them together."],
        },
        notes: [`Base is a regular ${sides}-gon.`, "Cross-sections parallel to the base are all identical."],
        mistakes: ["Using the slant of a side face instead of the prism height.", "Forgetting the second base."],
      };
    }
    case "squarePyramid":
    case "tetrahedron":
    case "pentagonalPyramid":
    case "hexagonalPyramid": {
      const baseArea = ngonArea(sides, r);
      const apothem = r * Math.cos(PI / sides);
      const slant = Math.hypot(h, apothem);
      const per = ngonPerimeter(sides, r);
      push(dim(solid, "radius", "r", "Base circumradius", f.radial, "radiusX"));
      push(dim(solid, "height", "h", "Perpendicular height", f.sy, "height"));
      return {
        ...base,
        dimensions: dims,
        variables: [
          { symbol: "r", label: "Base circumradius", value: r, meaning: "Centre of the base to a corner." },
          { symbol: "A", label: "Base area", value: baseArea, meaning: `Area of the regular ${sides}-gon base.` },
          { symbol: "h", label: "Perpendicular height", value: h, meaning: "Vertical height from base to apex." },
          { symbol: "l", label: "Slant height", value: slant, meaning: "Height of a triangular face, measured to the midpoint of a base edge." },
        ],
        volume: {
          title: "Volume", formula: "V = \u2153 A\u2098 h",
          substitution: `V = \u2153 \u00D7 ${n3(baseArea)} \u00D7 ${n3(h)}`,
          calculation: `V = \u2153 \u00D7 ${n3(baseArea * h)}`,
          value: (1 / 3) * baseArea * h, power: 3,
          steps: [`Base area A = ${n3(baseArea)}`],
        },
        totalSA: {
          title: "Total surface area", formula: "A = A\u2098 + \u00BD P l",
          substitution: `A = ${n3(baseArea)} + \u00BD \u00D7 ${n3(per)} \u00D7 ${n3(slant)}`,
          calculation: `A = ${n3(baseArea)} + ${n3(0.5 * per * slant)}`,
          value: totalSAValue, power: 2,
          steps: [`Slant height l = \u221A(h\u00B2 + apothem\u00B2) = ${n3(slant)}`],
        },
        lateralSA: {
          title: "Lateral surface area", formula: "A = \u00BD P l",
          substitution: `A = \u00BD \u00D7 ${n3(per)} \u00D7 ${n3(slant)}`,
          calculation: `A = ${n3(0.5 * per * slant)}`, value: lateralSAValue, power: 2,
        },
        why: {
          volume: "Three identical pyramids fill the prism with the same base and height, so the pyramid takes \u2153 of it.",
          surfaceArea: "The net is the base polygon plus one triangle per base edge; each triangle has height l.",
        },
        how: {
          volume: ["Find the base area.", "Multiply by the perpendicular height.", "Divide by 3."],
          surfaceArea: ["Find the slant height l.", "Each triangle: \u00BD \u00D7 base edge \u00D7 l.", "Add the base area."],
        },
        notes: ["Slant height is measured on a face, not along an edge."],
        mistakes: ["Using the slant height for volume.", "Using the lateral edge instead of the slant height for area."],
      };
    }
    case "octahedron": {
      const a = r * Math.SQRT2;
      push(dim(solid, "radius", "r", "Circumradius", f.radial, "radiusX"));
      return {
        ...base,
        dimensions: dims,
        variables: [
          { symbol: "r", label: "Circumradius", value: r, meaning: "Centre to a vertex." },
          { symbol: "a", label: "Edge length", value: a, meaning: "a = r\u221A2 for a regular octahedron." },
        ],
        volume: {
          title: "Volume", formula: "V = (\u221A2/3) a\u00B3",
          substitution: `V = (\u221A2/3) \u00D7 ${n3(a)}\u00B3`,
          calculation: `V = ${n3(Math.SQRT2 / 3)} \u00D7 ${n3(a ** 3)}`,
          value: (Math.SQRT2 / 3) * a ** 3, power: 3,
        },
        totalSA: {
          title: "Total surface area", formula: "A = 2\u221A3 a\u00B2",
          substitution: `A = 2\u221A3 \u00D7 ${n3(a)}\u00B2`,
          calculation: `A = ${n3(2 * Math.sqrt(3))} \u00D7 ${n3(a * a)}`,
          value: 2 * Math.sqrt(3) * a * a, power: 2,
        },
        lateralSA: null,
        why: {
          volume: "Two square pyramids joined base to base make an octahedron, giving twice \u2153 \u00D7 a\u00B2 \u00D7 (a/\u221A2).",
          surfaceArea: "It has 8 congruent equilateral triangles, each of area (\u221A3/4)a\u00B2.",
        },
        how: {
          volume: ["Find the edge length a.", "Cube it.", "Multiply by \u221A2/3."],
          surfaceArea: ["Area of one equilateral triangle.", "Multiply by 8."],
        },
        notes: ["8 faces, 12 edges, 6 vertices — Euler: 8 + 6 \u2212 12 = 2."],
        mistakes: ["Confusing the circumradius with the edge length."],
      };
    }
    default: {
      return {
        ...base,
        dimensions: dims,
        variables: [],
        volume: { title: "Volume", formula: "\u2014", substitution: "\u2014", calculation: "\u2014", value: 0, power: 3 },
        totalSA: { title: "Total surface area", formula: "\u2014", substitution: "\u2014", calculation: "\u2014", value: totalSAValue, power: 2 },
        lateralSA: null,
        why: { volume: "", surfaceArea: "" },
        how: { volume: [], surfaceArea: [] },
        notes: [],
        mistakes: [],
      };
    }
  }
}
