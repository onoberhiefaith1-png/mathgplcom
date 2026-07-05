// FLOATING CHANNEL — Floating Number panel → Smartboard.
//
// The panel's notebook button (and any future FN-side prose write) goes
// through THIS channel only. It shares the same data source (the
// notebook/reservoir line) and the same dumb primitive as the Preview
// channel, but no code path here touches previewChannel.ts — the two
// writers are fully independent and can be interleaved freely.
//
// Notes: every click writes a fresh copy. There is NO dedupe. The
// teacher is in charge — undo removes an accidental double-click.

import type { BoardWriteHost } from "./host";
import { writeNoteOnce } from "./writeNote";

export type FloatingChannelHost = BoardWriteHost;

/** Write the notebook note for `lineIdx` onto the board. Always writes —
 *  ten clicks write ten copies. Returns the landed row, or null when
 *  nothing renderable was provided. */
export const floatingWriteNote = (
  lineIdx: number,
  text: string,
  host: FloatingChannelHost,
): number | null => writeNoteOnce(lineIdx, text, host);
