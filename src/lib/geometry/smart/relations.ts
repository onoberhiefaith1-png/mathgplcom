// Theorem library — generic mathematical relationships the engine can
// surface when parts are selected. Each theorem returns the applicability
// + a "Relationship Mode" generic form + an "Apply Mode" instantiation
// that substitutes the actual values from the current selection.

import type { SmartGraph, SmartPartBase } from "./parts";

export interface AppliedTheorem {
  equation: string;       // e.g. "40 + 65 + x = 180"
  knowns: Record<string, number | string>;
  unknown?: string;       // e.g. "x"
  explanation: string;
}

export interface Theorem {
  id: string;
  name: string;
  formula: string;        // generic, e.g. "A + B + C = 180°"
  why: string;
  /** True when this theorem could apply to the selected parts. */
  applies(selection: SmartPartBase[], graph: SmartGraph): boolean;
  /** Produce the substituted form. May return null if values are unknown. */
  apply(selection: SmartPartBase[], graph: SmartGraph): AppliedTheorem | null;
}

const isAngle = (p: SmartPartBase) => p.kind === "angle";
const isSide = (p: SmartPartBase) => p.kind === "side";

function trianglePartsFromAngles(angles: SmartPartBase[]): SmartPartBase[] | null {
  // Each derived angle has id `angle:vertex:<vid>@triangle:<a>-<b>-<c>`.
  const triIds = angles.map((a) => a.id.split("@")[1]).filter(Boolean);
  if (triIds.length === 0) return null;
  const first = triIds[0];
  if (!triIds.every((t) => t === first)) return null;
  return angles;
}

const THEOREMS: Theorem[] = [
  {
    id: "triangle-angle-sum",
    name: "Sum of angles in a triangle",
    formula: "A + B + C = 180°",
    why: "The three interior angles of any triangle add up to 180°.",
    applies(sel) {
      const angles = sel.filter(isAngle);
      if (angles.length < 1 || angles.length > 3) return false;
      return trianglePartsFromAngles(angles) !== null;
    },
    apply(sel) {
      const angles = sel.filter(isAngle);
      const tri = trianglePartsFromAngles(angles);
      if (!tri) return null;
      const labels = ["A", "B", "C"];
      const parts = angles.map((a, i) => {
        const v = a.value;
        const sym = a.label.replace(/^∠/, "") || labels[i];
        return v != null ? `${v}` : sym;
      });
      // Pad up to 3 with x, y, z for unknowns.
      while (parts.length < 3) parts.push(["x", "y", "z"][parts.length - 1]);
      const unknown = parts.find((p) => /[a-z]/i.test(p));
      return {
        equation: `${parts.join(" + ")} = 180°`,
        knowns: Object.fromEntries(angles.map((a) => [a.label, a.value ?? "?"])),
        unknown,
        explanation: "All three interior angles add to 180°.",
      };
    },
  },
  {
    id: "isosceles",
    name: "Isosceles triangle theorem",
    formula: "If two sides are equal, the base angles are equal.",
    why: "Equal sides face equal angles.",
    applies(sel) {
      const sides = sel.filter(isSide);
      return sides.length === 2 && sides.every((s) => s.value != null) &&
        Math.abs((sides[0].value ?? 0) - (sides[1].value ?? 1)) < 0.5;
    },
    apply(sel) {
      const sides = sel.filter(isSide);
      return {
        equation: `${sides[0].label} = ${sides[1].label} ⇒ base angles equal`,
        knowns: {},
        explanation: "Two equal sides ⇒ the angles opposite them are equal.",
      };
    },
  },
  {
    id: "exterior-angle",
    name: "Exterior angle of a triangle",
    formula: "Exterior angle = sum of two opposite interior angles",
    why: "Straight line (180°) − adjacent interior angle = sum of the other two.",
    applies(sel) { return sel.filter(isAngle).length === 1; },
    apply(sel) {
      const a = sel.find(isAngle)!;
      return {
        equation: `ext(${a.label}) = sum of two non-adjacent interior angles`,
        knowns: {},
        explanation: "An exterior angle equals the sum of the two non-adjacent interior angles.",
      };
    },
  },
  {
    id: "vertically-opposite",
    name: "Vertically opposite angles",
    formula: "Vertically opposite angles are equal.",
    why: "Two straight lines crossing produce two pairs of equal angles.",
    applies(sel) { return sel.filter(isAngle).length === 2; },
    apply(sel) {
      const [a, b] = sel.filter(isAngle);
      return {
        equation: `${a.label} = ${b.label}`,
        knowns: {},
        explanation: "When two straight lines cross, opposite angles are equal.",
      };
    },
  },
  {
    id: "straight-line",
    name: "Angles on a straight line",
    formula: "Angles on a straight line add to 180°",
    why: "A straight line is half a full turn.",
    applies(sel) {
      const a = sel.filter(isAngle);
      return a.length === 2 || a.length === 3;
    },
    apply(sel) {
      const parts = sel.filter(isAngle).map((a) => a.value != null ? `${a.value}` : a.label.replace(/^∠/, "x"));
      return {
        equation: `${parts.join(" + ")} = 180°`,
        knowns: {},
        explanation: "Adjacent angles on a straight line sum to 180°.",
      };
    },
  },
  {
    id: "pythagoras",
    name: "Pythagoras' theorem",
    formula: "a² + b² = c²",
    why: "In a right-angled triangle, the squares of the two legs sum to the square of the hypotenuse.",
    applies(sel) { return sel.filter(isSide).length === 3 || sel.filter(isSide).length === 2; },
    apply(sel) {
      const sides = sel.filter(isSide);
      const labels = sides.map((s, i) => s.value != null ? `${s.value}` : ["a", "b", "c"][i]);
      return {
        equation: `${labels[0]}² + ${labels[1] ?? "b"}² = ${labels[2] ?? "c"}²`,
        knowns: {},
        explanation: "Applies when the triangle has a right angle.",
      };
    },
  },
  {
    id: "tangent-radius",
    name: "Tangent ⟂ radius",
    formula: "A tangent to a circle is perpendicular to the radius at the point of contact.",
    why: "Radius meets the tangent at 90°.",
    applies(sel) {
      const hasT = sel.some((p) => p.kind === "tangent");
      const hasR = sel.some((p) => p.kind === "radius");
      return hasT || (hasT && hasR);
    },
    apply(sel) {
      return {
        equation: "tangent ⊥ radius (90°)",
        knowns: {},
        explanation: "At the point of tangency, the radius is perpendicular to the tangent line.",
      };
    },
  },
  {
    id: "angle-at-centre",
    name: "Angle at centre = 2 × angle at circumference",
    formula: "∠centre = 2 × ∠circumference",
    why: "Both subtend the same arc.",
    applies(sel) {
      return sel.some((p) => p.kind === "centre") && sel.some((p) => p.kind === "angle");
    },
    apply(sel) {
      return {
        equation: "∠O = 2 × ∠P (same arc)",
        knowns: {},
        explanation: "The angle at the centre is twice the angle at the circumference subtending the same arc.",
      };
    },
  },
  {
    id: "same-segment",
    name: "Angles in the same segment",
    formula: "Angles subtended by the same arc in the same segment are equal.",
    why: "All such angles share the arc.",
    applies(sel) {
      return sel.filter((p) => p.kind === "angle").length >= 2 &&
        sel.some((p) => p.kind === "circle" || p.kind === "pointOnCircle" || p.kind === "arc");
    },
    apply(sel) {
      const a = sel.filter((p) => p.kind === "angle");
      return {
        equation: `${a.map((x) => x.label).join(" = ")}`,
        knowns: {},
        explanation: "Equal because they subtend the same arc.",
      };
    },
  },
  {
    id: "cyclic-quadrilateral",
    name: "Cyclic quadrilateral",
    formula: "Opposite angles sum to 180°",
    why: "Inscribed angles on a circle's diameter.",
    applies(sel) {
      return sel.filter((p) => p.kind === "angle").length === 2 &&
        sel.some((p) => p.kind === "circle");
    },
    apply(sel) {
      const [a, b] = sel.filter((p) => p.kind === "angle");
      const av = a.value != null ? `${a.value}` : "A";
      const bv = b.value != null ? `${b.value}` : "C";
      return {
        equation: `${av} + ${bv} = 180°`,
        knowns: {},
        explanation: "Opposite angles of a cyclic quadrilateral are supplementary.",
      };
    },
  },
];

export function candidateTheorems(graph: SmartGraph, selection: SmartPartBase[]): Theorem[] {
  if (selection.length === 0) return [];
  return THEOREMS.filter((t) => {
    try { return t.applies(selection, graph); } catch { return false; }
  });
}

export function allTheorems(): Theorem[] { return THEOREMS; }
