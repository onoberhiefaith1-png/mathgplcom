// Table → Floating Number workspace model.
//
// A highlighted table is not a picture: it is a mini workspace that can
// generate MANY Floating Number lines. This module normalises whatever
// table-ish node the Highlighting Page captured into one plain grid, and
// turns that grid into Floating Number lines according to the workspace
// orientation (Row vs Column).

import { flattenObjectAttrs, type SolutionObject } from "@/lib/floating/solutionItems";
import { structureGridFromObject } from "@/lib/floating/structureGrid";

export type TableOrientation = "row" | "column";

export interface TableGrid {
  objId: string;
  label: string;
  /** Column headers (may be empty strings). */
  headers: string[];
  /** Data rows — always rectangular, headers excluded. */
  cells: string[][];
  rows: number;
  cols: number;
  /** Smart Structure static mask: `r:c` keys that are pure structure
   *  (division bracket, minus signs, dividers, ladders). These are retained
   *  exactly as the teacher drew them and never become Floating Numbers. */
  staticCells?: string[];
  /** Glyph a structural cell renders on the board. */
  staticGlyphs?: Record<string, string>;
}

/** True when the cell belongs to the retained structure, not the student. */
export const isStaticCell = (grid: TableGrid, key: string): boolean =>
  Array.isArray(grid.staticCells) && grid.staticCells.includes(key);


/** Stable cell address inside a grid: `r:c` over DATA rows (0-based). */
export const cellKey = (r: number, c: number): string => `${r}:${c}`;

export const parseCellKey = (key: string): { r: number; c: number } | null => {
  const m = /^(\d+):(\d+)$/.exec(String(key ?? ""));
  if (!m) return null;
  return { r: Number(m[1]), c: Number(m[2]) };
};

export const cellValue = (grid: TableGrid, key: string): string => {
  const pos = parseCellKey(key);
  if (!pos) return "";
  return String(grid.cells[pos.r]?.[pos.c] ?? "");
};

const asStringMatrix = (raw: any, rows: number, cols: number): string[][] => {
  const out: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(String(raw?.[r]?.[c] ?? ""));
    }
    out.push(row);
  }
  return out;
};

/** Normalise a captured table object into a grid. Returns null when the
 *  object carries no usable tabular data. */
export const gridFromObject = (obj: SolutionObject): TableGrid | null => {
  const a = flattenObjectAttrs((obj?.attrs ?? {}) as Record<string, any>);

  const rawCells = Array.isArray(a.cells)
    ? a.cells
    : Array.isArray(a.data)
      ? a.data
      : Array.isArray(a.values)
        ? a.values
        : null;
  const rawHeaders: string[] = Array.isArray(a.headers)
    ? a.headers.map((h: any) => String(h ?? ""))
    : [];
  const rows = Number(a.rows) > 0
    ? Math.floor(Number(a.rows))
    : Array.isArray(rawCells) ? rawCells.length : 0;
  const cols = Number(a.cols) > 0
    ? Math.floor(Number(a.cols))
    : Math.max(
        rawHeaders.length,
        Array.isArray(rawCells) ? Math.max(0, ...rawCells.map((r: any) => (Array.isArray(r) ? r.length : 0))) : 0,
      );
  if (!rows || !cols) return null;
  const headers = Array.from({ length: cols }, (_, c) => String(rawHeaders[c] ?? ""));
  return {
    objId: obj.objId,
    label: obj.label || "Table",
    headers,
    cells: asStringMatrix(rawCells, rows, cols),
    rows,
    cols,
  };
};

/** Every cell key of the grid, in reading order. */
export const allCellKeys = (grid: TableGrid): string[] => {
  const out: string[] = [];
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) out.push(cellKey(r, c));
  return out;
};

/** Orientation law: every cell of one Floating Number line must live in the
 *  same row (row-oriented) or the same column (column-oriented). */
export const cellFitsLine = (
  orientation: TableOrientation,
  existing: string[],
  key: string,
): boolean => {
  const pos = parseCellKey(key);
  if (!pos) return false;
  const first = existing.map(parseCellKey).find(Boolean);
  if (!first) return true;
  return orientation === "row" ? first.r === pos.r : first.c === pos.c;
};

export interface GeneratedTableLine {
  /** Cells belonging to this line, in reading order. */
  cellKeys: string[];
  /** Cell values, blank cells removed. */
  values: string[];
  /** Human label — the header (column mode) or "Row n" (row mode). */
  label: string;
}

/** Rebuild the automatic line set for a grid. Row mode → one line per data
 *  row; Column mode → one line per column. Blank lines are dropped. */
export const generateTableLines = (
  grid: TableGrid,
  orientation: TableOrientation,
): GeneratedTableLine[] => {
  const out: GeneratedTableLine[] = [];
  if (orientation === "row") {
    for (let r = 0; r < grid.rows; r++) {
      const keys = Array.from({ length: grid.cols }, (_, c) => cellKey(r, c));
      const values = keys.map((k) => cellValue(grid, k)).filter((v) => v.trim().length > 0);
      if (!values.length) continue;
      out.push({ cellKeys: keys, values, label: `Row ${r + 1}` });
    }
  } else {
    for (let c = 0; c < grid.cols; c++) {
      const keys = Array.from({ length: grid.rows }, (_, r) => cellKey(r, c));
      const values = keys.map((k) => cellValue(grid, k)).filter((v) => v.trim().length > 0);
      if (!values.length) continue;
      out.push({
        cellKeys: keys,
        values,
        label: grid.headers[c]?.trim() || `Column ${c + 1}`,
      });
    }
  }
  return out;
};

/** Equation text shown for a table-derived line. */
export const tableLineEquation = (grid: TableGrid, cellKeys: string[]): string =>
  cellKeys
    .map((k) => cellValue(grid, k))
    .filter((v) => v.trim().length > 0)
    .join("  ");
