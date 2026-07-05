// Board Writer — ROW LEDGER.
//
// The SINGLE source of truth for "where does this line's ink go".
// Both independent writing channels (Presenter Preview channel and
// Floating Number channel) consult this ledger before every write, so
// interleaved writes from either channel always land on the first free
// row below the previous line's ink — no clashes, no jumps.
//
// Pure functions over an immutable snapshot. No React, no refs, no
// retries, no "deepest ink anywhere" scans.

import type { Row } from "@/lib/smartboard/mathTree";
import { rowHasTallStructure } from "@/lib/smartboard/mathTree";
import { rowHasVisibleInk } from "@/lib/smartboard/rowAscii";
import { mirrorLessonNoteRow, rowSignature } from "@/lib/smartboard/mirrorFromLessonNote";

export interface BoardSnapshot {
  /** Live ink map (freeLines). Keys may be whole rows (n) or half rows (n+0.5). */
  ink: Record<number, Row>;
  /** Row → owning solution-line index. */
  rowOwners: Record<number, number>;
  /** Locked (notebook/note) rows — never writable. */
  lockedRows: ReadonlySet<number>;
  /** First writable row of the active band (fresh-section start). */
  bandStartRow: number;
}

const SCAN_CAP = 200;

/** True iff the row (whole or half) carries visible ink. */
export const rowIsInked = (snap: BoardSnapshot, r: number): boolean => {
  const whole = snap.ink[r];
  const half = snap.ink[r + 0.5];
  return (
    (!!whole && rowHasVisibleInk(whole)) ||
    (!!half && rowHasVisibleInk(half))
  );
};

const inkAt = (snap: BoardSnapshot, r: number): Row | undefined =>
  snap.ink[r] ?? snap.ink[r + 0.5];

/** Extra rows a tall structure (stacked fraction, matrix, big-op) on `r`
 *  occupies below its baseline. THE LAW: tall → exactly 1, else 0. */
export const tallSpan = (snap: BoardSnapshot, r: number): number => {
  const row = inkAt(snap, r);
  return row && rowHasVisibleInk(row) && rowHasTallStructure(row) ? 1 : 0;
};

/** True iff a tall structure on an EARLIER row covers row `r`. */
const coveredByTallAbove = (snap: BoardSnapshot, r: number): boolean => {
  for (const key of Object.keys(snap.ink)) {
    const srcRaw = Number(key);
    const src = Math.floor(srcRaw);
    if (src >= r) continue;
    const row = snap.ink[srcRaw];
    if (!row || !rowHasVisibleInk(row)) continue;
    if (rowHasTallStructure(row) && src + 1 >= r) return true;
  }
  return false;
};

/** A row is blocked when it has ink, is locked, or sits inside a tall
 *  structure's footprint. Same rule for every line, every channel. */
export const rowIsBlocked = (snap: BoardSnapshot, r: number): boolean =>
  rowIsInked(snap, r) || snap.lockedRows.has(r) || coveredByTallAbove(snap, r);

/** First board row owned by exactly `lineIdx` that still carries content
 *  (stale ownership whose ink was erased is ignored). Null when none. */
export const rowOfLine = (snap: BoardSnapshot, lineIdx: number): number | null => {
  let best: number | null = null;
  for (const key of Object.keys(snap.rowOwners)) {
    const r = Number(key);
    if (snap.rowOwners[r] !== lineIdx) continue;
    if (!rowIsInked(snap, r) && !snap.lockedRows.has(r)) continue;
    if (best === null || r < best) best = r;
  }
  return best;
};

/** Deepest LIVE row owned by any line ≤ `lineIdx` — the anchor this
 *  line's ink must land below. -1 when no owned row exists yet. */
export const lastAnchorRowFor = (snap: BoardSnapshot, lineIdx: number): number => {
  let anchor = -1;
  for (const key of Object.keys(snap.rowOwners)) {
    const r = Number(key);
    const owner = snap.rowOwners[r];
    if (typeof owner !== "number" || owner > lineIdx) continue;
    if (!rowIsInked(snap, r) && !snap.lockedRows.has(r)) continue;
    if (r > anchor) anchor = r;
  }
  return anchor;
};

/** THE placement rule — identical for every line and both channels:
 *  start one row below the line's anchor (clearing a tall structure's
 *  footprint), then take the FIRST unblocked row. With no anchor, start
 *  at the band's first writable row. */
export const nextFreeRow = (snap: BoardSnapshot, lineIdx: number): number => {
  const anchor = lastAnchorRowFor(snap, lineIdx);
  let t =
    anchor >= 0
      ? anchor + 1 + tallSpan(snap, anchor)
      : Math.max(0, Math.floor(snap.bandStartRow));
  for (let g = 0; g < SCAN_CAP && rowIsBlocked(snap, t); g++) {
    t += 1 + tallSpan(snap, t);
  }
  return t;
};

/** Row whose ink signature matches `text` (repeat-click detection), or
 *  null. Empty/unrenderable text never matches. */
export const findTextRow = (snap: BoardSnapshot, text: string): number | null => {
  const raw = (text ?? "").trim();
  if (!raw) return null;
  const m = mirrorLessonNoteRow(raw);
  if (!m.ok) return null;
  for (const key of Object.keys(snap.ink)) {
    const row = snap.ink[Number(key)];
    if (!row || row.length === 0) continue;
    if (rowSignature(row) === m.signature) return Math.floor(Number(key));
  }
  return null;
};
