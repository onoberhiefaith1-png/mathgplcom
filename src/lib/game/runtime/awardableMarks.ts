// AWARDABLE MARKS — the Game's "out of" must be exactly the marks a student
// can actually earn on a question.
//
// Two kinds of reward pay marks in a Game question:
//   • a Game Line (plain line, fraction, sum, unit, table row/column) pays its
//     own line marks once, when the board proves it;
//   • a calculated table Subcell pays the marks the Game configures for it
//     (Game settings → tables), when its working and answer are both right.
//
// A Subcell's *reservoir line* (orientation "subcell") is never paid as a Game
// Line — its reward is the Subcell itself, and solving the Subcell is what
// completes that line. Counting the line's own marks in the total as well made
// the maximum larger than anything a student could reach. Note-only lines pay
// nothing.

import { calculatedSubcells, tableCellConfigOf, type GameTableConfig } from "@/lib/slate/tableSurface";

interface BoardLineLike {
  table?: {
    objId?: string;
    orientation?: string;
    grid?: unknown;
    cellKeys?: string[];
  } | null;
}

export interface AwardableBoardLike {
  lineIds: string[];
  lineMarks: number[];
  lineNoteOnly?: boolean[];
  boardSource?: { reservoirs?: { lines?: BoardLineLike[] }[] } | null;
}

export interface AwardableMarks {
  /** Per Game Line: the marks that line can pay (0 when it never pays itself). */
  lineMarks: number[];
  /** Per Game Line: false for lines that are never paid as a line. */
  lineAwardable: boolean[];
  /** Marks from calculated Subcells across this question's tables. */
  subcellMarks: number;
  /** The question's true maximum: line marks + Subcell marks. */
  total: number;
}

const boardLines = (board: AwardableBoardLike): BoardLineLike[] =>
  board.boardSource?.reservoirs?.[0]?.lines ?? [];

export const isSubcellLine = (line: BoardLineLike | undefined): boolean =>
  line?.table?.orientation === "subcell";

export function questionAwardableMarks(
  board: AwardableBoardLike,
  tables?: GameTableConfig | null,
): AwardableMarks {
  const lines = boardLines(board);
  const lineAwardable = board.lineIds.map((_, i) =>
    board.lineNoteOnly?.[i] !== true && !isSubcellLine(lines[i]));
  const lineMarks = board.lineIds.map((_, i) =>
    lineAwardable[i] ? Math.max(0, Number(board.lineMarks[i]) || 0) : 0);

  // Each table once, whichever of its lines carries the grid snapshot.
  const grids = new Map<string, unknown>();
  for (const line of lines) {
    const objId = line?.table?.objId;
    if (!objId || !line.table?.grid || grids.has(objId)) continue;
    grids.set(objId, line.table.grid);
  }
  let subcellMarks = 0;
  for (const [objId, grid] of grids) {
    for (const key of calculatedSubcells(grid as Parameters<typeof calculatedSubcells>[0])) {
      subcellMarks += tableCellConfigOf(tables?.[objId]?.[key]).marks;
    }
  }
  const lineTotal = lineMarks.reduce((sum, m) => sum + m, 0);
  return { lineMarks, lineAwardable, subcellMarks, total: lineTotal + subcellMarks };
}

/** The reservoir line (0-based) that holds one Subcell's calculation, or -1. */
export function subcellLineIndex(board: AwardableBoardLike, objId: string, key: string): number {
  return boardLines(board).findIndex((line) =>
    isSubcellLine(line) && line.table?.objId === objId && (line.table?.cellKeys ?? []).includes(key));
}
