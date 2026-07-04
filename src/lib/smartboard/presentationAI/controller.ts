// Presentation AI — controller interface.
// PresentationView owns the actual Smartboard state; it exposes this small
// imperative surface to the AI hook so autoplay, inspection, and repair can
// drive playback without prop drilling. All getters return live values so
// the inspector reads current state at inspect-time.

import type { Beat, Reservoir, ReservoirLine } from "@/lib/smartboard/presentation";

export interface PresentationController {
  beats: Beat[];
  reservoirs: Reservoir[];
  notebookId?: string | null;
  notebookTitle?: string | null;

  getBeatCursor: () => number;
  setBeatCursor: (n: number) => void;

  getActiveLineIdx: () => number;
  setActiveLineIdx: (n: number) => void;

  getShownNotebookIdx: () => Set<number>;
  markNotebookShown: (idx: number) => void;

  writeProseLineOnBoard: (raw: string) => void;
  addNotebookAttention: (idx: number) => void;

  getActiveReservoir: () => Reservoir | undefined;
  getActiveGuidedLines: () => ReservoirLine[];

  /**
   * Teacher-style progressive equation writer. Writes the first
   * `prefixTokenCount` fillers of the guided line at `lineIdx` onto the
   * Smartboard. Idempotent by row signature — safe to call repeatedly.
   */
  writeEquationPrefix: (lineIdx: number, prefixTokenCount: number) => void;

  /** Current board row signature for the guided line (empty string if none). */
  getBoardRowSignatureFor: (lineIdx: number) => string;

  /** Expected full-row signature computed from the reservoir line. */
  getExpectedRowSignatureFor: (lineIdx: number) => string;

  /** Expected prefix signature (first k fillers) for filler-level checks. */
  getExpectedPrefixSignatureFor: (lineIdx: number, prefixTokenCount: number) => string;

  /** True iff the Smartboard currently has a row whose ink signature matches
   *  the expected Teacher Note for `lineIdx`. Empty note → true. */
  getBoardHasNoteFor?: (lineIdx: number) => boolean;

  /** Erase the note row (if any) previously written for `lineIdx`. */
  eraseNoteAt?: (lineIdx: number) => void;

  /** Scroll the Smartboard so `lineIdx` is in view. */
  scrollBoardTo?: (lineIdx: number) => void;

  /** Detect overlap between the row owning `lineIdx` and any other line. */
  detectOverlap?: (lineIdx: number) => { overlapsWith: number | null; kind: "row" | "note" };

  /** Programmatic click of the Floating Number tile — used by the AI to
   *  perform the same action a teacher would perform manually. */
  pickFloatingNumber?: (lineIdx: number, fillerIdx: number) => void;
  openFloatingPanel?: () => void;
  closeFloatingPanel?: () => void;
  isFloatingPanelOpen?: () => boolean;

  /** Preview panel card element for a beat id (used for scroll checks). */
  getPreviewCardEl?: (beatId: string) => HTMLElement | null;
}
