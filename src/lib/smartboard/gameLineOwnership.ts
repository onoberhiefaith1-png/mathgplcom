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
 * Rebuilds Game row ownership from saved board ink.
 *
 * Each independently matching equation advances to its corresponding Floating
 * Numbers line. An unmatched continuation row remains with the current line,
 * preserving multi-row structures without allowing later complete steps to be
 * absorbed by the first writing surface.
 */
export const seedGameLineOwners = (
  rows: GameOwnedRow[],
  expectedLines: GameExpectedLine[],
): Record<number, number> => {
  const owners: Record<number, number> = {};
  if (expectedLines.length === 0) return owners;

  let cursor = 0;
  for (const row of rows) {
    const matchingPosition = expectedLines.findIndex((target, position) =>
      position >= cursor && matchesExpectedLine(row.ascii, target.equation),
    );

    if (matchingPosition >= cursor) {
      owners[row.row] = expectedLines[matchingPosition].index;
      cursor = Math.min(matchingPosition + 1, expectedLines.length - 1);
      continue;
    }

    owners[row.row] = expectedLines[Math.min(cursor, expectedLines.length - 1)].index;
  }

  return owners;
};