// Does this lesson-note text NEED a real mathematical figure?
//
// The Co-Pilot used to promise a diagram (blueprint `needsDiagram`) and then
// never draw one, so Problem Check complained afterwards: "this question refers
// to a figure, but no diagram was found". The decision now lives here, and is
// shared by the build (which draws) and the checker (which complains), so the
// two can never disagree.

/** Wording that only makes sense when a figure is on the page. */
const REFERS_TO_FIGURE =
  /\b(in|from|the)\s+(the\s+)?(diagram|figure|sketch|drawing)\b|\bas shown\b|\bshown (below|above|in)\b|\bdiagram below\b|\bfigure below\b/i;

/** Geometry objects and relationships that are taught with a figure. */
const GEOMETRIC_SUBJECT =
  /\b(tangent|chord|arc|sector|segment of a circle|cyclic quadrilateral|semicircle|circumference|radius|radii|diameter|centre O|center O|bearing|angle of (elevation|depression)|transversal|parallel lines|perpendicular bisector|angle bisector|locus|loci|similar triangles|congruent triangles|trapezium|parallelogram|rhombus|kite|pentagon|hexagon|polygon|quadrilateral|triangle|circle)\b/i;

/** An angle written the way a figure names it: ∠ABC, angle ABC, ABC = 40°. */
const NAMED_ANGLE = /∠\s*[A-Z]|(\bangle\s+[A-Z]{2,3}\b)|\b[A-Z]{3}\s*=\s*\d+\s*°/;

/**
 * True when the finished text describes mathematics a teacher would draw.
 * `flagged` is the blueprint's own `needsDiagram` decision and always wins.
 */
export function figureNeeded(text: string, flagged?: boolean): boolean {
  if (flagged) return true;
  const t = String(text ?? "");
  if (!t.trim()) return false;
  if (REFERS_TO_FIGURE.test(t) || NAMED_ANGLE.test(t)) return true;
  // A geometric object alone is enough only when the text also states or asks
  // for a measurement about it — a passing mention in prose is not a figure.
  return GEOMETRIC_SUBJECT.test(t) && /\d|\bfind\b|\bcalculate\b|\bshow that\b|\bprove\b/i.test(t);
}

/** Teacher-facing reason used when a promised figure could not be drawn. */
export const FIGURE_FAILED_DETAIL =
  "This needs a figure I could not draw accurately — open the diagram tools and I'll help you build it.";
