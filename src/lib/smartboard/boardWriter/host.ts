// Board Writer — host contract.
//
// The Smartboard (PresentationView) implements this tiny surface ONCE.
// Both independent channels receive it; neither channel ever calls the
// other. The host only knows how to (a) snapshot board state, (b)
// commit a WritePlan atomically, and (c) scroll a row into view.

import type { BoardSnapshot } from "./ledger";
import type { WritePlan } from "./directWrite";

export interface CommitOptions {
  /** Register the landed rows as owned by this solution line. */
  ownerLineIdx?: number;
  /** Lock the written rows (notebook/note ink — non-editable). */
  lock?: boolean;
}

export interface BoardWriteHost {
  getSnapshot: () => BoardSnapshot;
  commitPlan: (plan: WritePlan, opts: CommitOptions) => void;
  scrollToRow: (row: number) => void;
  /** Clears the note-gate glow for a line whose note is now visible. */
  markNoteShown?: (lineIdx: number) => void;
}
