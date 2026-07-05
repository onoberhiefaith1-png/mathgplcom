// WRITE NOTE — the single, no-dedupe teacher-note write.
//
// LAW (per teacher): every click writes. If the note is already on the
// board, a second click writes it AGAIN below. Ten clicks = ten copies.
// Undo removes them. The teacher decides duplicates, not the code.
//
// This module runs identically for line 1 and line ∞. There is no
// "already visible → skip" branch, no signature scan, no repeat guard.
// The same call path serves the Floating Number panel AND the Presenter
// Preview — but they still use their own host, so the two engines
// remain independent.

import type { BoardWriteHost } from "./host";
import { nextFreeRow } from "./ledger";
import { planDirectWrite } from "./directWrite";

/** Write `text` as a teacher note for `lineIdx`. Always writes — never
 *  dedupes against existing ink. Returns the landed row, or null iff
 *  the text is empty / unrenderable. */
export const writeNoteOnce = (
  lineIdx: number,
  text: string,
  host: BoardWriteHost,
): number | null => {
  const raw = (text ?? "").trim();
  if (!raw) return null;
  const snap = host.getSnapshot();
  const start = nextFreeRow(snap, lineIdx);
  const plan = planDirectWrite(snap, start, raw);
  if (!plan) return null;
  host.commitPlan(plan, { lock: true });
  host.scrollToRow(plan.rows[0].row);
  host.markNoteShown?.(lineIdx);
  return plan.landedRow;
};
