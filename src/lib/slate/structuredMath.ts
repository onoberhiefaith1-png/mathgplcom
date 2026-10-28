import type { Cursor, Row } from "@/lib/smartboard/mathTree";

export interface GameMathRow {
  sourceRow: number;
  row: Row;
  cursor: Cursor | null;
}

export interface GameMathLine {
  rows: GameMathRow[];
}

/** Detach the Game mirror from the editor state without flattening it. */
export const cloneMathRow = (row: Row): Row =>
  row.map((node) => node.kind === "char"
    ? { ...node }
    : ({ ...node, rows: node.rows.map(cloneMathRow) } as typeof node));
