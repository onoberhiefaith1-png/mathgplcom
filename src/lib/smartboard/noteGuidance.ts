// AUTO NOTE GUIDANCE — one rule for every board (Smartboard main + classroom,
// Practice, Play, Game).
//
// Existing semantics (PresentationView `activateNoteOnce`): "The first forward
// movement from a line activates its note once for this attempt; manual
// opening remains available, and Reset clears shownNotebookIdx." Before this
// module that rule only ran inside the Next / counter buttons, so a line left
// any other way — the automatic advance after a correct line (the normal path
// in Practice/Play/Game), tapping a later line, a reasoning jump — never showed
// its note. Whether notes appeared depended on HOW the solver moved on.
//
// `notesDueOnLineChange` is the single decision; the board calls it from one
// effect whenever the active line changes, so every path is covered.

export interface LineChange {
  /** Active line before the change (null on first observation). */
  from: number | null;
  /** Active line after the change. */
  to: number;
  /** Number of guided lines on the current question. */
  lineCount: number;
  /** The authored note for a line ("" when none). Never invented. */
  noteFor: (lineIdx: number) => string;
  /** Notes already shown in this attempt (manual or automatic). */
  shown: ReadonlySet<number>;
  /** False for programmatic moves (restore, remote mirror, viewer). */
  userDriven: boolean;
}

/** Line indexes whose note must be shown now. Only the line being LEFT going
 *  forward qualifies: never a future line (no answer leaks), never on Back,
 *  never twice in one attempt (a dismissed note stays dismissed). */
export function notesDueOnLineChange(c: LineChange): number[] {
  if (!c.userDriven || c.from === null) return [];
  if (!(c.to > c.from)) return [];
  const k = c.from;
  if (k < 0 || k >= c.lineCount) return [];
  if (c.shown.has(k)) return [];
  return c.noteFor(k).trim() ? [k] : [];
}
