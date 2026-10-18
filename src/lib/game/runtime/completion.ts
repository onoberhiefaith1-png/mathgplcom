// A Game question is complete only when every required line has been
// checked and awarded. Reaching the last row index is not enough.

export type CompletionQuestion = {
  questionRowId: string;
  lineIds: string[];
  lineNoteOnly?: boolean[];
  lineHasFloatingNumbers?: boolean[];
};

/** The lines a student must solve: not note-only, and carrying Floating Numbers. */
export function requiredLineIds(q: CompletionQuestion): string[] {
  return q.lineIds.filter((_, i) => q.lineNoteOnly?.[i] !== true && q.lineHasFloatingNumbers?.[i] !== false);
}

export function allRequiredLinesAwarded(q: CompletionQuestion, awardedKeys: Iterable<string>): boolean {
  const required = requiredLineIds(q);
  if (required.length === 0) return true;
  const set = awardedKeys instanceof Set ? (awardedKeys as Set<string>) : new Set(awardedKeys);
  return required.every((id) => set.has(`${q.questionRowId}:${id}`));
}
