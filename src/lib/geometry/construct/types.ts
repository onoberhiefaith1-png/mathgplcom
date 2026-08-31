// Construction programs — the mathematical description of a 2D diagram.
//
// A diagram is never "painted" from guessed coordinates. The Math Engine
// returns a CONSTRUCTION PROGRAM (what is true about the figure), and the
// application solves it into exact coordinates, checks it, and only then
// renders it as an editable GeometryScene.

export type ConstructionStep =
  /** A free point. Coordinates are a hint only; the compiler re-fits the figure. */
  | { op: "point"; id: string; x: number; y: number; label?: string }
  /** Triangle solved from its angles (degrees) and one side length ratio. */
  | { op: "triangle"; ids: [string, string, string]; angles?: [number, number, number]; sides?: [number, number, number] }
  /** Right-angled triangle with the right angle at ids[1]. */
  | { op: "rightTriangle"; ids: [string, string, string]; legs?: [number, number] }
  /** Regular polygon with n = ids.length vertices. */
  | { op: "regular"; ids: string[]; radius?: number }
  /** Rectangle / square / parallelogram (ids in cyclic order). */
  | { op: "quad"; ids: [string, string, string, string]; width?: number; height?: number; skew?: number }
  /** A circle centred on an existing point. */
  | { op: "circle"; id: string; center: string; r: number; label?: string; dashed?: boolean }
  /** A point that lies EXACTLY on a circle, at `angle` degrees (ccw from +x). */
  | { op: "onCircle"; id: string; circle: string; angle: number; label?: string }
  /** A point on segment a→b at parameter t (0 = a, 1 = b). Exactly collinear. */
  | { op: "onSegment"; id: string; a: string; b: string; t: number; label?: string }
  /** Midpoint of a→b. */
  | { op: "midpoint"; id: string; a: string; b: string; label?: string }
  /** A point collinear with a→b, beyond b, at `by` × |ab|. */
  | { op: "extend"; id: string; a: string; b: string; by?: number; label?: string }
  /** Foot of the perpendicular from p onto line a→b. */
  | { op: "foot"; id: string; p: string; a: string; b: string; label?: string }
  /** Intersection of lines a→b and c→d. */
  | { op: "intersect"; id: string; a: string; b: string; c: string; d: string; label?: string }
  /** Drawn edge between two constructed points. */
  | {
      op: "segment"; a: string; b: string; id?: string; label?: string; distance?: string;
      dashed?: boolean; marks?: "tick" | "double" | "triple" | "right" | "parallel" | null;
      arrow?: "none" | "start" | "end" | "both";
    }
  /** Close a chain of points with segments. */
  | { op: "path"; points: string[]; close?: boolean; dashed?: boolean }
  /** Angle marker at `vertex`, between arms to a and b. */
  | { op: "angle"; vertex: string; a: string; b: string; value?: string; marker?: "arc" | "double" | "right" }
  /** Arc of an existing circle between two of its points (short way round). */
  | { op: "arc"; id?: string; circle: string; from: string; to: string; dashed?: boolean }
  /** Shaded region bounded by the listed points. */
  | { op: "shade"; points: string[]; fill?: string; opacity?: number; area?: string }
  /** Free text placed near a constructed point. */
  | { op: "text"; near?: string; text: string; dx?: number; dy?: number; fontSize?: number }
  /** A point through `through`, in the direction of a→b (exactly parallel). */
  | { op: "parallel"; id: string; through: string; a: string; b: string; by?: number; label?: string }
  /** A point through `through`, exactly perpendicular to a→b. */
  | { op: "perpendicular"; id: string; through: string; a: string; b: string; by?: number; label?: string }
  /** A point making `at`→id the tangent to `circle` at the point `at`. */
  | { op: "tangentAt"; id: string; circle: string; at: string; by?: number; label?: string }
  /** Both points of tangency of the tangents drawn from an EXTERNAL point. */
  | { op: "tangentFrom"; ids: [string, string]; circle: string; from: string; labels?: [string, string] }
  /**
   * A point at a distance and direction from another point — the bearings
   * primitive. `bearing` is measured clockwise from north (0° = north);
   * `angle` is measured anticlockwise from the positive x-direction.
   */
  | { op: "polar"; id: string; from: string; distance: number; bearing?: number; angle?: number; label?: string }
  /** A point on the bisector of angle a–vertex–b. */
  | { op: "bisect"; id: string; vertex: string; a: string; b: string; by?: number; label?: string }
  /** An infinite line through two constructed points. */
  | { op: "line"; a: string; b: string; id?: string; dashed?: boolean }
  /** A ray from a through b. */
  | { op: "ray"; a: string; b: string; id?: string; dashed?: boolean }
  /** A north arrow drawn at a point (bearings figures). */
  | { op: "north"; at: string; length?: number }

  /** Arrowed segment (a vector). */
  | { op: "vector"; a: string; b: string; label?: string; dashed?: boolean }
  /** Sector of a circle between two of its points. */
  | { op: "sector"; circle: string; from: string; to: string; fill?: string; opacity?: number; area?: string }
  /** A number line from `from` to `to`, ticked every `step`. */
  | { op: "numberLine"; from: number; to: number; step?: number; marks?: Array<{ value: number; id?: string; label?: string }> }
  /** Coordinate axes with optional grid. */
  | { op: "axes"; xMin?: number; xMax?: number; yMin?: number; yMax?: number; step?: number; grid?: boolean; origin?: string }
  /** A plotted point in axes coordinates (requires an earlier "axes" step). */
  | { op: "plot"; id: string; x: number; y: number; label?: string };


export interface ConstructionProgram {
  /** One-line description of the figure, for the caption. */
  figure?: string;
  steps: ConstructionStep[];
  /** Point ids whose letter labels should stay hidden (helper points). */
  hide?: string[];
}

export interface ConstructionProblem {
  step: number;
  message: string;
}
