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
}

/** NOTE-PURITY LAW: a note is prose. If ANY line in the saved note is
 *  math-shaped (operators, or nearly all digits/punctuation), the whole
 *  note is rejected — a phantom equation must never render as a note. */
const looksLikeMath = (l: string): boolean => {
  const s = l.trim();
  if (!s) return false;
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
  if (rows.some(looksLikeMath)) return "";
  return text;
};
