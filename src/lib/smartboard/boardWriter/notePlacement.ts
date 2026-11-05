// Where a Smartboard teaching note is inserted.
//
// Game Play writes through the floating-number ledger and scrolls to the
// landed row. The Smartboard keeps the note directly under THIS line's
// equation (later work moves down) but must use the same row rule:
//   - a whole row, never a half-row index
//   - one extra row under a tall structure (fraction, matrix, big operator)
//   - measured text height must not move the note; the board already pushes
//     later rows down visually when a line is taller than one pitch
//
// A fractional splice index does not open that gap. The note then lands on
// an existing row (often the next equation, or a row the band does not show)
// and never scrolls into view.

/** First whole row directly under the deepest row this line owns. */
export const noteRowBelowOwned = (
  ownedRows: readonly number[],
  tallAtFloor: (floorRow: number) => boolean,
): number | null => {
  const floors = ownedRows
    .map((row) => Math.floor(row))
    .filter((row) => Number.isFinite(row));
  if (floors.length === 0) return null;
  const deepest = Math.max(...floors);
  return deepest + 1 + (tallAtFloor(deepest) ? 1 : 0);
};
