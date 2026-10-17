// Pure helpers: which lesson-note objects travel with a question, and where.
//
// A question's own diagram sits on the QUESTION (after its text, before Line 1).
// A diagram drawn inside the Solution is a NOTE: it belongs to the solution
// line it follows and appears when that line's note is reached. Neither is
// ever a line to answer.

import { isFloatableObject, readSolutionObjects, sortByPlacement, type SolutionObject } from "@/lib/floating/solutionItems";

/** Keep only presentable, non-floatable objects, in lesson-note order. */
export function questionObjectsFor(objects: SolutionObject[] | null | undefined): SolutionObject[] {
  return sortByPlacement((objects ?? []).filter((o) => o && o.nodeType && !isFloatableObject(o)));
}

/** Objects stored on a raw lesson-note block (used by the offline pack). */
export function blockQuestionObjects(contentJson: unknown): SolutionObject[] {
  const raw = (contentJson as { objects?: unknown } | null)?.objects;
  return questionObjectsFor(readSolutionObjects({ objects: Array.isArray(raw) ? raw : [] }));
}

export function isGeometryDiagram(o: SolutionObject): boolean {
  return o.nodeType === "geometryDiagram";
}

/**
 * Split a question's objects into the ones shown on the question surface and
 * the solution-note diagrams keyed by the 1-based solution line they follow.
 */
export function splitQuestionObjects(
  objects: SolutionObject[] | null | undefined,
  lineCount: number,
): { question: SolutionObject[]; notes: Map<number, SolutionObject[]> } {
  const question: SolutionObject[] = [];
  const notes = new Map<number, SolutionObject[]>();
  const last = Math.max(1, lineCount);
  for (const o of questionObjectsFor(objects)) {
    if (!o.inSolution || lineCount < 1) {
      question.push(o);
      continue;
    }
    const after = Number.isFinite(o.afterLine) ? Math.floor(o.afterLine) : last;
    const line = Math.min(last, Math.max(1, after));
    notes.set(line, [...(notes.get(line) ?? []), o]);
  }
  return { question, notes };
}
