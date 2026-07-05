// FLOATING CHANNEL — Floating Number panel → Smartboard.
//
// The panel's notebook button (and any future FN-side prose write) goes
// through THIS channel only. It shares the same data source (the
// notebook/reservoir line) and the same dumb primitive as the Preview
// channel, but no code path here touches previewChannel.ts — the two
// writers are fully independent and can be interleaved freely.

import type { BoardWriteHost } from "./host";
import { findTextRow, nextFreeRow } from "./ledger";
import { planDirectWrite } from "./directWrite";

export type FloatingChannelHost = BoardWriteHost;

/** Write the notebook note for `lineIdx` onto the board. Repeat clicks
 *  scroll to the existing ink instead of rewriting. Returns the row the
 *  note landed on (or already lives on), or null when nothing landed. */
export const floatingWriteNote = (
  lineIdx: number,
  text: string,
  host: FloatingChannelHost,
): number | null => {
  const raw = (text ?? "").trim();
  if (!raw) return null;

  const snap = host.getSnapshot();
  const existing = findTextRow(snap, raw);
  if (existing != null) {
    host.scrollToRow(existing);
    host.markNoteShown?.(lineIdx);
    return existing;
  }

  const start = nextFreeRow(snap, lineIdx);
  const plan = planDirectWrite(snap, start, raw);
  if (!plan) return null;

  host.commitPlan(plan, { lock: true });
  host.scrollToRow(plan.rows[0].row);
  host.markNoteShown?.(lineIdx);
  return plan.landedRow;
};
