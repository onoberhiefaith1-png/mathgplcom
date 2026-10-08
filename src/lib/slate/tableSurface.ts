// Tables as Game Writing Surfaces.
//
// A Smartboard table joins the Game as ONE writing surface. The table itself
// (cells, Subcells, Floating Numbers, Calculate) is the existing Smartboard
// table — nothing here renders or marks mathematics. This module only adds
// the Game layer on top: which Game Lines collapse into the table surface,
// which Subcells carry coins/marks/Vaults, and which Subcells are solved.

import { cellKey, parseCellKey } from "@/lib/floating/tableGrid";
import { cellNumber, tryEvaluate } from "@/components/lessonnotes/extensions/visuals/smarttable/evaluator";

export interface TableCellConfig {
  /** Marks this calculated Subcell unlocks when solved. */
  marks: number;
  /** Completion Coin on this Subcell. */
  coin: boolean;
  /** Working stays hidden until the student opens the Vault. */
  vault: boolean;
}

/** objId -> Subcell key (`r:c`) -> configuration. */
export type GameTableConfig = Record<string, Record<string, Partial<TableCellConfig>>>;

interface GridLike {
  rows: number;
  cols: number;
  cells?: (string | number | null | undefined)[][];
  subcells?: Record<string, { expr?: string } | undefined>;
}

/** Every calculated Subcell of a table, in reading order. Raw data cells have none. */
export const calculatedSubcells = (grid: GridLike | null | undefined): string[] => {
  if (!grid) return [];
  const subs = grid.subcells ?? {};
  const out: string[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const k = cellKey(r, c);
      if (String(subs[k]?.expr ?? "").trim()) out.push(k);
    }
  }
  return out;
};

export const tableCellConfigOf = (
  raw: Partial<TableCellConfig> | null | undefined,
): TableCellConfig => {
  const marks = Number(raw?.marks);
  return {
    marks: Number.isFinite(marks) && marks >= 0 ? Math.min(100, Math.round(marks)) : 1,
    coin: raw?.coin !== false,
    vault: raw?.vault === true,
  };
};

const norm = (s: string) =>
  s.replace(/\s+/g, "").replace(/[−–—]/g, "-").replace(/[×✕]/g, "*").replace(/÷/g, "/").toLowerCase();

const sameValue = (a: string, b: string): boolean => {
  if (!a.trim() || !b.trim()) return false;
  if (norm(a) === norm(b)) return true;
  const x = cellNumber(a);
  const y = cellNumber(b);
  return x !== null && y !== null && Math.abs(x - y) < 1e-9;
};

/**
 * A Subcell is solved when the student wrote working above the line AND the
 * answer below it matches the teacher's value. When the working can be worked
 * out, it must also give that value — copying the answer alone never counts.
 */
export const isSubcellSolved = (
  grid: GridLike,
  entries: Record<string, string>,
  key: string,
): boolean => {
  const pos = parseCellKey(key);
  if (!pos) return false;
  const expected = String(grid.cells?.[pos.r]?.[pos.c] ?? "").trim();
  const working = String(entries[`sub:${key}`] ?? "").trim();
  const answer = String(entries[key] ?? "").trim();
  if (!expected || !working || !answer) return false;
  if (!sameValue(answer, expected)) return false;
  const worked = tryEvaluate(working.startsWith("=") ? working : `=${working}`);
  return worked === null ? true : sameValue(worked, expected);
};

export const solvedSubcells = (grid: GridLike, entries: Record<string, string>): string[] =>
  calculatedSubcells(grid).filter((k) => isSubcellSolved(grid, entries, k));

export const tableProgress = (grid: GridLike, entries: Record<string, string>) => ({
  done: solvedSubcells(grid, entries).length,
  total: calculatedSubcells(grid).length,
});

/**
 * Game Lines (1-based) that belong to a table collapse into ONE surface: the
 * first member line is the table surface, the others are not drawn.
 */
export const tableSurfaceLines = (
  lineTableIds: (string | null | undefined)[],
): { anchors: Map<number, string>; hidden: Set<number> } => {
  const anchors = new Map<number, string>();
  const hidden = new Set<number>();
  const seen = new Set<string>();
  lineTableIds.forEach((objId, i) => {
    if (!objId) return;
    const line = i + 1;
    if (seen.has(objId)) hidden.add(line);
    else { seen.add(objId); anchors.set(line, objId); }
  });
  return { anchors, hidden };
};

/** Award identity for one Subcell of one question — paid once, ever. */
export const subcellAwardKey = (questionRowId: string, objId: string, key: string) =>
  `${questionRowId}:sub:${objId}:${key}`;
