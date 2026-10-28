// Board Writer — SENSOR PARKING. One rule, no cap.
//
// After any write (note, chip, present-mode), the sensor parks on the
// FIRST genuinely free, writable row below the ink. The walk uses the
// SAME `rowIsBlocked` rule the ledger uses for placement, with the same
// generous scan cap (200) — it can never expire early, so the sensor is
// never parked on a locked or inked row. Identical for line 1 and
// line ∞.

import { rowIsBlocked, tallSpan, type BoardSnapshot } from "./ledger";

const SCAN_CAP = 200;

/** First unblocked row strictly below `lastInkRow`, clearing a tall
 *  structure's footprint on the way down. Never returns a locked or
 *  inked row (within the scan cap of 200 rows). */
export const parkRowBelow = (snap: BoardSnapshot, lastInkRow: number): number => {
  const from = Math.floor(lastInkRow);
  let t = from + 1 + tallSpan(snap, from);
  for (let g = 0; g < SCAN_CAP && rowIsBlocked(snap, t); g++) {
    t += 1 + tallSpan(snap, t);
  }
  return t;
};
