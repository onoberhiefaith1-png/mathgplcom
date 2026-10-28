// Board Writer — the DUMB WRITE PRIMITIVE.
//
// planDirectWrite puts ink at exactly the row it is told (sliding only
// past rows the ledger says are blocked). No searching for "deepest
// ink", no verify-retry escapes, no sensor hunts. It returns a pure
// WritePlan; the host commits it atomically.

import { mkChar, type Row } from "@/lib/smartboard/mathTree";
import { mirrorLessonNoteRow } from "@/lib/smartboard/mirrorFromLessonNote";
import { rowIsBlocked, tallSpan, type BoardSnapshot } from "./ledger";

export interface PlacedRow {
  row: number;
  ink: Row;
}

export interface WritePlan {
  rows: PlacedRow[];
  /** Last row that received ink. */
  landedRow: number;
  /** Where the sensor parks after the write: the FIRST unblocked row
   *  below the ink — uncapped walk (same SCAN_CAP as placement), so it
   *  is never left parked on a locked or inked row. */
  sensorRow: number;
}

const SCAN_CAP = 200;

/** Compute the exact rows a text write occupies, starting at `startRow`.
 *  Paragraph-shaped: blank-line breaks (or single newlines) become
 *  separate rows. Parity-gate failures fall back to plain characters so
 *  a click can never be a silent no-op. */
export const planDirectWrite = (
  snap: BoardSnapshot,
  startRow: number,
  text: string,
): WritePlan | null => {
  const raw = (text ?? "").trim();
  if (!raw) return null;

  const paragraphs = (raw.includes("\n\n") ? raw.split(/\n{2,}/) : raw.split(/\n+/))
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paragraphs.length === 0) return null;

  let mirrored = paragraphs
    .map((p) => mirrorLessonNoteRow(p))
    .filter((m) => m.ok && m.row.length > 0)
    .map((m) => m.row);
  if (mirrored.length === 0) {
    // Never a silent no-op — write the raw text as plain characters.
    mirrored = paragraphs.map((p) => [...p].map((ch) => mkChar(ch)));
  }
  if (mirrored.length === 0) return null;

  const taken = new Set<number>();
  const blocked = (r: number): boolean => taken.has(r) || rowIsBlocked(snap, r);

  const rows: PlacedRow[] = [];
  let target = Math.max(0, Math.floor(startRow));
  for (const ink of mirrored) {
    for (let g = 0; g < SCAN_CAP && blocked(target); g++) {
      target += 1 + tallSpan(snap, target);
    }
    rows.push({ row: target, ink });
    taken.add(target);
    target += 1;
  }

  const landedRow = rows[rows.length - 1].row;
  // Park on the first genuinely free row below the ink. UNCAPPED walk
  // (same SCAN_CAP as placement) — the old 4-step cap left the sensor
  // parked ON a locked row once the board got dense (line 6+ bug).
  let sensorRow = landedRow + 1;
  for (let g = 0; g < SCAN_CAP && blocked(sensorRow); g++) {
    sensorRow += 1 + tallSpan(snap, sensorRow);
  }

  return { rows, landedRow, sensorRow };
};
