import { equationsEquivalent, equationsMatch } from "./rowAscii";

export interface GameOwnedRow {
  row: number;
  ascii: string;
}

export interface GameExpectedLine {
  index: number;
  equation: string;
}

const withoutEquationLabel = (value: string): string =>
  value
    .replace(/^\s*\(\s*\d+\s*\)\s*/, "")
    .replace(/\s*\(\s*\d+\s*\)\s*$/, "")
    .trim();

const matchesExpectedLine = (actual: string, expected: string): boolean => {
  const cleanActual = withoutEquationLabel(actual);
  const cleanExpected = withoutEquationLabel(expected);
  return equationsMatch(cleanActual, cleanExpected)
    || equationsEquivalent(cleanActual, cleanExpected);
};

/**
 * Rebuilds Game row ownership for boards saved before ownership was stored.
 *
 * A row that matches an expected step takes that step's line. A row that
 * matches nothing goes to the next line that has no writing yet; it only joins
 * the line above when, together with that line's rows, it completes that
 * line's equation (an equation split over two rows). Rows from different
 * lines are therefore never joined onto one writing surface.
 */
export const seedGameLineOwners = (
  rows: GameOwnedRow[],
  expectedLines: GameExpectedLine[],
): Record<number, number> => {
  const owners: Record<number, number> = {};
  if (expectedLines.length === 0) return owners;
  const last = expectedLines.length - 1;

  let cursor = 0;
  /** Text written so far on the line at `cursor` (unmatched rows only). */
  let pending = "";
  /** Position of the line holding `pending`, or -1 when it is empty. */
  let pendingAt = -1;

  for (const row of rows) {
    const matchingPosition = expectedLines.findIndex((target, position) =>
      position >= cursor && matchesExpectedLine(row.ascii, target.equation),
    );
    if (matchingPosition >= cursor) {
      owners[row.row] = expectedLines[matchingPosition].index;
      cursor = Math.min(matchingPosition + 1, last);
      pending = "";
      pendingAt = -1;
      continue;
    }

    if (pendingAt >= 0) {
      const combined = `${pending} ${row.ascii}`.trim();
      if (matchesExpectedLine(combined, expectedLines[pendingAt].equation)) {
        // The second half of a split equation belongs with the first half.
        owners[row.row] = expectedLines[pendingAt].index;
        cursor = Math.min(pendingAt + 1, last);
        pending = "";
        pendingAt = -1;
        continue;
      }
      // Its own step: never stacked onto the line that already has writing.
      cursor = Math.min(pendingAt + 1, last);
    }
    owners[row.row] = expectedLines[cursor].index;
    pending = pendingAt === cursor ? `${pending} ${row.ascii}`.trim() : row.ascii;
    pendingAt = cursor;
  }

  return owners;
};
