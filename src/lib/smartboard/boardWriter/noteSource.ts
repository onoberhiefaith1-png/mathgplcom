// NOTE SOURCE — the single law for teaching notes.
//
// A line has a note if and only if its OWN saved highlight authored one
// (`precedingNotebook`, carried on the reservoir line as `notebook`).
// There is NO fallback of any kind:
//   - no `explanation` substitution (that leaked whole solution tails
//     into the notebook icon),
//   - no positional guessing,
//   - no equation-match guessing.
//
// Both the Floating Number panel and the Presenter Preview MUST read
// notes through this module so the two sides are guaranteed identical:
// an icon on the panel ⇔ a visible note in the preview.

export interface NoteCarrier {
  notebook?: string;
  /** Notes-layer objects (diagrams) attached to this line's note. */
  noteObjects?: unknown[];
}

/** NOTE-PURITY LAW: a note is prose. A row is treated as math-shaped
 *  only when it has NO alphabetic characters at all and is dominated by
 *  digits/operators (e.g. "3 + 4 = 7", "x = -2"). Rows that contain any
 *  letters are always considered prose — so notes like "Subtract 5 from
 *  both sides" or "Divide by 2" are kept, while phantom equation tails
 *  are still rejected. */
const looksLikeMath = (l: string): boolean => {
  const s = l.trim();
  if (!s) return false;
  if (/[A-Za-z]/.test(s)) return false; // any letter → prose
  // No letters. If it has an operator or is entirely digits/punctuation,
  // it's a math row masquerading as a note — reject it.
  if (/[=+\-−×÷/^]/.test(s)) return true;
  if (/^[\d\s.,()πθ]+$/.test(s)) return true;
  return false;
};

/** The ONLY way to read a line's teaching note.
 *  No saved note ⇒ empty string ⇒ no icon, nothing to write. Ever. */
export const noteForLine = (line: NoteCarrier | undefined | null): string => {
  const text = String(line?.notebook ?? "").trim();
  if (!text) return "";
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (rows.length === 0) return "";
  // Per-ROW purity: a bare equation tail is dropped, but the prose rows
  // around it survive. One stray row can never delete a real teaching note.
  const prose = rows.filter((r) => !looksLikeMath(r));
  if (prose.length === 0) return "";
  return prose.join("\n");

};

/** Notes-layer objects attached to a line's note. A diagram is note content by
 *  law, so a line with objects HAS a note even when it carries no prose. */
export const noteObjectsForLine = <T,>(line: { noteObjects?: T[] } | undefined | null): T[] =>
  Array.isArray(line?.noteObjects) ? (line!.noteObjects as T[]) : [];

/** True when the line has anything a teacher can place on the board. */
export const hasNoteContent = (line: NoteCarrier | undefined | null): boolean =>
  noteForLine(line).length > 0 || noteObjectsForLine(line).length > 0;
