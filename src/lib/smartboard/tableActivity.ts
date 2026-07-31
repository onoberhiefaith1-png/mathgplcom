// Table Activity — the Smart Table's second role on the Smartboard.
//
// A highlighted table generated several Floating Number lines. On the
// Smartboard those lines are NOT separate lesson steps: together they are one
// lesson step (the table), and inside it each line is one row (row-oriented)
// or one column (column-oriented) of the grid.
//
// This module is pure: grid + orientation + retention in, mappings and
// completion out. Nothing here knows about React or the board.

import type { ReservoirLine } from "@/lib/smartboard/presentation";
import type { FloatingTableRef } from "@/lib/lessonnotes/floatingCompile";
import { cellKey, parseCellKey } from "@/lib/floating/tableGrid";
import { cellNumber } from "@/components/lessonnotes/extensions/visuals/smarttable/evaluator";

export type TableGrid = NonNullable<FloatingTableRef["grid"]>;

export interface TableGroup {
  objId: string;
  label: string;
  orientation: "row" | "column";
  grid: TableGrid;
  /** Union of every retained (read-only, pre-filled) cell in the table. */
  retained: string[];
  /** Reservoir line indices owned by this table, in order. */
  memberLineIdxs: number[];
}

/** Per-table student entries: cellKey -> raw text. */
export type TableEntries = Record<string, string>;

const normalise = (raw: string): string =>
  String(raw ?? "")
    .replace(/\s+/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/[×✕]/g, "*")
    .replace(/[÷]/g, "/")
    .toLowerCase();

/** Collapse consecutive reservoir lines that came from the same table into
 *  one lesson step. Non-table lines are left untouched. */
export const buildTableGroups = (lines: ReservoirLine[]): TableGroup[] => {
  const out: TableGroup[] = [];
  lines.forEach((line, idx) => {
    const t = line?.table;
    if (!t?.objId || !t.grid) return;
    const last = out[out.length - 1];
    if (last && last.objId === t.objId) {
      last.memberLineIdxs.push(idx);
      for (const k of t.retained ?? []) {
        if (!last.retained.includes(k)) last.retained.push(k);
      }
      return;
    }
    out.push({
      objId: t.objId,
      label: t.label || t.grid.label || "Table",
      orientation: t.orientation === "column" ? "column" : "row",
      grid: t.grid,
      retained: [...(t.retained ?? [])],
      memberLineIdxs: [idx],
    });
  });
  return out;
};

export const groupForLine = (
  groups: TableGroup[],
  lineIdx: number,
): TableGroup | null => groups.find((g) => g.memberLineIdxs.includes(lineIdx)) ?? null;

/** First lesson-step line index of the group (the step's identity). */
export const groupAnchor = (group: TableGroup): number => group.memberLineIdxs[0] ?? 0;

/** Row (row-oriented) or column (column-oriented) index a member line owns. */
export const trackOf = (group: TableGroup, lineIdx: number): number | null => {
  const pos = group.memberLineIdxs.indexOf(lineIdx);
  if (pos < 0) return null;
  return pos;
};

/** Every cell the given member line owns, in reading order. */
export const cellKeysForLine = (group: TableGroup, lineIdx: number): string[] => {
  const track = trackOf(group, lineIdx);
  if (track === null) return [];
  const { rows, cols } = group.grid;
  return group.orientation === "row"
    ? Array.from({ length: cols }, (_, c) => cellKey(track, c))
    : Array.from({ length: rows }, (_, r) => cellKey(r, track));
};

/** Which member line a clicked cell belongs to (orientation-aware). */
export const lineIdxForCell = (group: TableGroup, key: string): number | null => {
  const pos = parseCellKey(key);
  if (!pos) return null;
  const track = group.orientation === "row" ? pos.r : pos.c;
  return group.memberLineIdxs[track] ?? null;
};

export const isRetained = (group: TableGroup, key: string): boolean =>
  group.retained.includes(key);

/** Cells the student must supply for this line. */
export const editableCellsForLine = (group: TableGroup, lineIdx: number): string[] =>
  cellKeysForLine(group, lineIdx).filter((k) => !isRetained(group, k));

export const expectedCellValue = (group: TableGroup, key: string): string => {
  const pos = parseCellKey(key);
  if (!pos) return "";
  return String(group.grid.cells?.[pos.r]?.[pos.c] ?? "");
};

/** A cell is satisfied when its entry matches the teacher's grid value,
 *  either textually or numerically (so "3+4" counts for "7"). */
export const isCellCorrect = (
  group: TableGroup,
  entries: TableEntries,
  key: string,
): boolean => {
  const expected = expectedCellValue(group, key).trim();
  const given = String(entries[key] ?? "").trim();
  if (!given) return false;
  if (!expected) return true; // blank teacher cell — any answer accepted
  if (normalise(given) === normalise(expected)) return true;
  const a = cellNumber(given);
  const b = cellNumber(expected);
  return a !== null && b !== null && Math.abs(a - b) < 1e-9;
};

export const isLineComplete = (
  group: TableGroup,
  entries: TableEntries,
  lineIdx: number,
): boolean => {
  const cells = editableCellsForLine(group, lineIdx).filter((k) =>
    expectedCellValue(group, k).trim().length > 0,
  );
  if (cells.length === 0) return false;
  return cells.every((k) => isCellCorrect(group, entries, k));
};

export const isGroupComplete = (group: TableGroup, entries: TableEntries): boolean =>
  group.memberLineIdxs.every((idx) => isLineComplete(group, entries, idx));

/** First cell of the line still waiting for the student. */
export const firstOpenCell = (
  group: TableGroup,
  entries: TableEntries,
  lineIdx: number,
): string | null =>
  editableCellsForLine(group, lineIdx).find(
    (k) => !String(entries[k] ?? "").trim(),
  ) ?? editableCellsForLine(group, lineIdx)[0] ?? null;

/** Next member line still incomplete (used for auto-advance). */
export const nextOpenLine = (
  group: TableGroup,
  entries: TableEntries,
  afterLineIdx: number,
): number | null => {
  const pos = group.memberLineIdxs.indexOf(afterLineIdx);
  for (let i = pos + 1; i < group.memberLineIdxs.length; i++) {
    const idx = group.memberLineIdxs[i];
    if (!isLineComplete(group, entries, idx)) return idx;
  }
  for (const idx of group.memberLineIdxs) {
    if (!isLineComplete(group, entries, idx)) return idx;
  }
  return null;
};

/** "Row 3" / "Column 2" — the orientation-aware assessment label. */
export const trackLabel = (group: TableGroup, lineIdx: number): string => {
  const track = trackOf(group, lineIdx);
  if (track === null) return group.orientation === "row" ? "Row" : "Column";
  if (group.orientation === "column") {
    const header = group.grid.headers?.[track]?.trim();
    return header ? `Column ${track + 1} — ${header}` : `Column ${track + 1}`;
  }
  return `Row ${track + 1}`;
};

/* ── HIDDEN VALIDATION STATE ──────────────────────────────────────────────
   The Smartboard is an input surface only: it must never show ticks, crosses,
   marks or scores. The same validation logic still runs, but silently — its
   output is this snapshot, consumed by the Reasoning / Assessment layer,
   which is the only place feedback may appear. */

export interface TableCellStatus {
  key: string;
  expected: string;
  given: string;
  status: "correct" | "incorrect" | "empty" | "retained";
}

export interface TableTrackStatus {
  lineIdx: number;
  label: string;
  complete: boolean;
  cells: TableCellStatus[];
}

export interface TableValidation {
  objId: string;
  label: string;
  orientation: "row" | "column";
  tracks: TableTrackStatus[];
  activeTrack: TableTrackStatus | null;
  groupComplete: boolean;
}

export const tableValidation = (
  group: TableGroup,
  entries: TableEntries,
  activeLineIdx: number,
): TableValidation => {
  const tracks: TableTrackStatus[] = group.memberLineIdxs.map((lineIdx) => ({
    lineIdx,
    label: trackLabel(group, lineIdx),
    complete: isLineComplete(group, entries, lineIdx),
    cells: cellKeysForLine(group, lineIdx).map((key) => {
      const expected = expectedCellValue(group, key);
      const given = String(entries[key] ?? "");
      const status: TableCellStatus["status"] = isRetained(group, key)
        ? "retained"
        : !given.trim()
          ? "empty"
          : isCellCorrect(group, entries, key)
            ? "correct"
            : "incorrect";
      return { key, expected, given, status };
    }),
  }));
  return {
    objId: group.objId,
    label: group.label,
    orientation: group.orientation,
    tracks,
    activeTrack: tracks.find((t) => t.lineIdx === activeLineIdx) ?? null,
    groupComplete: isGroupComplete(group, entries),
  };
};

