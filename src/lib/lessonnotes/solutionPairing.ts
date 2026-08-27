// Example ↔ Solution partnership.
//
// A Solution belongs to exactly one question (Example / Exercise / Classwork …)
// and must NEVER end up under a different one. Dragging a solution used to
// append its frame to the very end of the document, which — now that non-diagram
// frames render in normal flow — made it appear beneath a later Example.
//
// Two guarantees live here:
//   1. `reconcileSolutionOwnership` heals any document whose solution frame sits
//      outside its owner question's section, by moving it back to the end of
//      that section (and dropping the stale flow spacer it left behind).
//   2. `solutionSectionEnd` gives the only legal insertion point for new
//      solution content of a given question, so it can never be written past
//      the next question heading.

export interface DocNode {
  type: string;
  attrs?: Record<string, unknown> | null;
  content?: DocNode[];
  text?: string;
}

const isQuestionHeading = (n: DocNode): boolean =>
  n.type === "heading" && !!(n.attrs?.sectionId as string | null);

const solutionOwner = (n: DocNode): string | null => {
  if (n.type !== "canvasFrame") return null;
  if ((n.attrs?.objectKind as string | null) !== "solution") return null;
  return (n.attrs?.ownerQuestionId as string | null) ?? null;
};

/** Index of the question heading owning `questionId`, or -1. */
export function questionHeadingIndex(top: DocNode[], questionId: string): number {
  return top.findIndex((n) => isQuestionHeading(n) && n.attrs?.sectionId === questionId);
}

/**
 * End (exclusive top-level index) of a question's section: everything up to the
 * next question heading belongs to it.
 */
export function solutionSectionEnd(top: DocNode[], questionId: string): number {
  const start = questionHeadingIndex(top, questionId);
  if (start < 0) return -1;
  for (let j = start + 1; j < top.length; j += 1) {
    if (isQuestionHeading(top[j])) return j;
  }
  return top.length;
}

/**
 * Move every solution frame that drifted outside its owner question back into
 * it. Pure: returns a new document when something changed.
 */
export function reconcileSolutionOwnership<T extends { type: string; content?: DocNode[] }>(
  doc: T | null | undefined,
): { doc: T; changed: boolean } {
  if (!doc || !Array.isArray(doc.content)) return { doc: doc as T, changed: false };
  let top = [...doc.content];
  let changed = false;

  // Bounded loop: each pass fixes at most one frame, so at most one pass per node.
  for (let guard = 0; guard < top.length + 1; guard += 1) {
    let moved = false;
    for (let i = 0; i < top.length; i += 1) {
      const owner = solutionOwner(top[i]);
      if (!owner) continue;
      const start = questionHeadingIndex(top, owner);
      if (start < 0) continue;
      const end = solutionSectionEnd(top, owner);
      if (i > start && i < end) continue; // already partnered correctly

      const frame = top[i];
      const spacerId = (frame.attrs?.spacerId as string | null) ?? null;
      const clean: DocNode = {
        ...frame,
        attrs: { ...(frame.attrs ?? {}), spacerId: null, y: 0 },
      };
      const rest = top.filter((_, idx) => idx !== i);
      const target = solutionSectionEnd(rest, owner);
      const insertAt = target < 0 ? rest.length : target;
      top = [...rest.slice(0, insertAt), clean, ...rest.slice(insertAt)];
      if (spacerId) {
        top = top.filter(
          (n) => !(n.type === "sessionSpacer" && n.attrs?.spacerId === spacerId),
        );
      }
      changed = true;
      moved = true;
      break;
    }
    if (!moved) break;
  }

  if (!changed) return { doc, changed: false };
  return { doc: { ...doc, content: top }, changed: true };
}
