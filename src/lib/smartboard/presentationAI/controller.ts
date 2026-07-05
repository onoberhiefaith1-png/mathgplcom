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
  /** Insert text into the ACTIVE sensor row — same route as tapping a
   *  Floating Number chip. Result is live/editable, cursor stays inside. */
  insertTextAtSensor?: (text: string) => void;
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

  /** Scroll the board so a specific ROW (grid line) is in view — used by
   *  Live Mirror after writing, since note rows have no line ownership. */
  scrollBoardToRow?: (row: number) => void;

  /** Detect overlap between the row owning `lineIdx` and any other line. */
  detectOverlap?: (lineIdx: number) => { overlapsWith: number | null; kind: "row" | "note" };

  /** Programmatic click of the Floating Number tile — used by the AI to
   *  perform the same action a teacher would perform manually. */
  pickFloatingNumber?: (lineIdx: number, fillerIdx: number) => void;
  openFloatingPanel?: (lineIdx?: number) => void;
  closeFloatingPanel?: () => void;
  isFloatingPanelOpen?: () => boolean;

  /** Wipe every mark from the Smartboard so autoplay starts from a blank
   *  surface. Does NOT touch reservoirs, plan, or lesson content. */
  resetBoard?: () => void;

  /** Clear all ink/rows but KEEP the beat cursor where it is — used by
   *  Live Mirror Mode so clearing never knocks the section back to 0. */
  clearInkOnly?: () => void;

  /** True iff some board row's ink signature matches `text`. Empty or
   *  unrenderable text returns false — a missing write can never pass. */
  boardHasTextRow?: (text: string) => boolean;

  /** Move the writing sensor by rows. Positive = down. */
  moveSensorUp?: (rows?: number) => void;
  moveSensorDown?: (rows?: number) => void;

  /** Pick the first free row for `lineIdx`, skipping notebook rows, ink,
   *  and fraction-denominator rows (which need extra clearance). Sets the
   *  sensor and claims the row via rowOwners. Returns chosen row. */
  moveSensorToSafeRow?: (lineIdx: number) => number;

  /** Erase all ink from a specific row and release row ownership.
   *  Guarded to only erase rows owned by `guardOwnerLineIdx` if provided. */
  eraseRow?: (row: number, guardOwnerLineIdx?: number) => void;

  /** Row occupancy classification — used by the AI to decide whether the
   *  next visual row is safe to write on. */
  getRowOccupancy?: (row: number) => "empty" | "ink" | "note" | "fraction-denominator";

  /** Write the given equation text whole onto the board — used for the
   *  question line (first line of a section), which the AI reproduces as
   *  presented rather than reconstructing chip by chip. */
  writeQuestionLine?: (lineIdx: number, equation: string) => void;

  /** Preview panel card element for a beat id (used for scroll checks). */
  getPreviewCardEl?: (beatId: string) => HTMLElement | null;

  /* ── Pipeline-repair side doors (all optional) ─────────────────
   * These let the AI Operator dispatch synthetic DOM events and force
   * re-renders when the normal click/render path is silently broken. */
  getNoteButtonEl?: (lineIdx: number) => HTMLElement | null;
  getHashFabEl?: () => HTMLElement | null;
  getChipEl?: (lineIdx: number, fillerIdx: number) => HTMLElement | null;
  rebuildRowOwnership?: (lineIdx: number) => void;
  forceRepaintLine?: (lineIdx: number) => void;
}
