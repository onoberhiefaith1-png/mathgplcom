// Floating Number Preparation — pure helpers.
// Used by FloatingNumbersPage to (a) shuffle a row of fillers in a controlled,
// repeatable pattern, and (b) compile every per-line workspace into the one
// Master Floating Bucket the Smartboard will later scroll through.

import { tokenizeMath } from "@/lib/notebook/mathTokens";



export type ContainerKind =
  | "fraction"
  | "bracket"
  | "radical"
  | "power"
  | "log"
  | "integral"
  | "matrix"
  | "differential"
  | "abs"
  | "vector";

/** A table-derived line: which table it came from, which cells it owns and
 *  the grid snapshot so the Smartboard can render the table without going
 *  back to the lesson note. */
export interface FloatingTableRef {
  objId: string;
  label?: string;
  orientation: "row" | "column";
  cellKeys: string[];
  /** Cells the teacher keeps visible (read-only) for students. */
  retained?: string[];
  /** True when the teacher built this line by clicking cells. */
  manual?: boolean;
  /** Snapshot of the table / Smart Structure grid (headers + cells). */
  grid?: {
    objId: string;
    label: string;
    headers: string[];
    cells: string[][];
    rows: number;
    cols: number;
    /** Matrix-as-grid: the Smartboard renders brackets, not table borders. */
    isMatrix?: boolean;
    matrixEnv?: string;
    matrixBrackets?: { left: string; right: string };
    sourceLatex?: string;
    /** Smart Structure: retained structural cells, never Floating Numbers. */
    staticCells?: string[];
    staticGlyphs?: Record<string, string>;
    /** Smart Structure: asset id + original attrs so the Smartboard redraws
     *  the teacher's exact structure instead of a generic table. */
    structureId?: string;
    structureAttrs?: Record<string, any>;
  };

}

export interface FloatingLine {
  lineId: string;
  /** PERMANENT identity of the highlighted line this row was generated from
   *  (`uid` on the saved highlight). This — and only this — is how notes and
   *  floating numbers are joined downstream. Never position, never text. */
  sourceUid?: string;
  /** Owning question (subsection) id. */
  questionId?: string;
  /** Durable identity of the highlight this line belongs to. Pairing is done
   *  through this id (then the equation text) — NEVER by array position. */
  groupId?: number;
  equation: string;

  /** Floating Terms in ASCII form with their operation signs preserved
   *  (e.g. "+2x²", "-4ac", "=", "±"). Leading "+" is dropped only at render. */
  fillers: string[];
  containers: ContainerKind[];
  /** index permutation applied to fillers when feeding the Smartboard */
  arrangement: number[];
  /** Optional teacher-facing explanation (e.g. "Multiply by the conjugate").
   *  Surfaced on the smartboard as a toggleable "+" marker beside the line. */
  explanation?: string;
  /** Persisted teacher highlight state, parallel to fillers. */
  fillersSelected?: boolean[];
  /** Persisted teacher highlight state, parallel to containers. */
  containersSelected?: boolean[];
  /** Marks awarded when a student reproduces this line correctly. */
  marks?: number;
  /** Set when this line was generated from a highlighted table workspace. */
  table?: FloatingTableRef;
  /** Notes-layer objects (diagrams) that belong to this line's NOTE. Never
   *  highlightable, never chips — lesson content that travels with the note. */
  noteObjects?: unknown[];
  /** TEACHER AUTHORITY: set the moment the teacher edits this line by hand
   *  (chip add/edit/remove, paste, delete, reorder, marks). A flagged line is
   *  never rewritten by "Generate Floating Numbers" — the teacher's saved
   *  version is what the Smartboard reads. Cleared only by the explicit
   *  per-line "Regenerate this line" action. */
  editedByTeacher?: boolean;
  /** ISO timestamp of the last teacher edit. */
  editedAt?: string;
}

/** Stamp a line as teacher-owned. Every manual mutation goes through this. */
export const markTeacherEdited = (line: FloatingLine): FloatingLine => ({
  ...line,
  editedByTeacher: true,
  editedAt: new Date().toISOString(),
});



export type ScoringMode = "equal" | "individual";

export interface FloatingScoring {
  /** Display label the teacher chose (Marks / Points / Score / Credits / Reward). */
  label: string;
  mode: ScoringMode;
  /** Used in equal mode — applied to every line. */
  marksPerLine: number;
}

export const SCORE_LABELS = ["Marks", "Points", "Score", "Credits", "Reward"] as const;

export const DEFAULT_SCORING: FloatingScoring = {
  label: "Marks",
  mode: "equal",
  marksPerLine: 1,
};

/** One saved line's mark value. Saved line marks are the source of truth. */
export const markForLine = (line: Pick<FloatingLine, "marks">): number => {
  const n = Number(line.marks);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/* ── PAIRING INTEGRITY ────────────────────────────────────────────────────
 * A floating line's chips must decompose ITS OWN equation. Historic saves
 * were paired by array position, which shifted every chip group onto the
 * neighbouring equation. These helpers detect that and repair it in place —
 * no teacher work is deleted, the chips simply return to their own line. */

const normForMatch = (s: string): string =>
  String(s ?? "")
    .replace(/\\left|\\right|\\!|\\,|\\;/g, "")
    .replace(/[{}\s]/g, "")
    .replace(/\\frac/g, "/")
    .replace(/\\sqrt/g, "√")
    .replace(/□/g, "");

/** How much of this chip set is actually present in the equation (0..1). */
export const fillerCoverage = (fillers: string[] | undefined, equation: string): number => {
  const chips = (fillers ?? []).map(normForMatch).filter(Boolean);
  if (chips.length === 0) return 1; // nothing to contradict
  const eq = normForMatch(equation);
  if (!eq) return 0;
  const hit = chips.filter((c) => eq.includes(c)).length;
  return hit / chips.length;
};

const MATCH_FLOOR = 0.6;

/** True when this line's chips plainly belong to its own equation. */
export const chipsBelongToLine = (line: Pick<FloatingLine, "fillers" | "equation">): boolean =>
  fillerCoverage(line.fillers, line.equation) >= MATCH_FLOOR;

/**
 * Repair a chip array that was saved one line out of step. Returns the same
 * array when nothing is wrong. Only a consistent whole-array shift is
 * corrected — a single odd line is left untouched.
 */
export const repairShiftedFloatingLines = <T extends FloatingLine>(lines: T[]): T[] => {
  const rows = lines.filter((l) => !l.table);
  if (rows.length < 2) return lines;

  const chipBearing = rows.filter((l) => (l.fillers?.length ?? 0) > 0);
  if (chipBearing.length < 2) return lines;

  let wrong = 0;
  let fitsShift = 0;
  rows.forEach((l, i) => {
    if ((l.fillers?.length ?? 0) === 0) return;
    if (chipsBelongToLine(l)) return;
    wrong++;
    const next = rows[i + 1];
    if (next && fillerCoverage(l.fillers, next.equation) >= MATCH_FLOOR) fitsShift++;
  });

  if (wrong === 0 || fitsShift < Math.ceil(chipBearing.length / 2)) return lines;

  // Chips are one line ahead of their equation: move each group down a line.
  const payload = (l: T) => ({
    fillers: l.fillers ?? [],
    containers: l.containers ?? [],
    arrangement: l.arrangement ?? [],
    fillersSelected: l.fillersSelected,
    containersSelected: l.containersSelected,
  });
  const empty = { fillers: [], containers: [], arrangement: [], fillersSelected: [], containersSelected: [] };

  const byRow = new Map<T, ReturnType<typeof payload> | typeof empty>();
  rows.forEach((l, i) => {
    byRow.set(l, i === 0 ? empty : payload(rows[i - 1]));
  });

  // eslint-disable-next-line no-console
  console.warn("[floating] repaired chip↔equation pairing that was saved one line out of step");
  return lines.map((l) => (byRow.has(l) ? ({ ...l, ...byRow.get(l)! } as T) : l));
};

/** Sum the per-line marks into a Total Available. */

export const totalMarks = (lines: Pick<FloatingLine, "marks">[]): number =>
  lines.reduce((sum, l) => sum + markForLine(l), 0);

/** Structure-aware tokenizer. Fallback when saved fillers are empty.
 *  A matrix, summation, integral, limit, fraction or root stays ONE token so
 *  it becomes one chip and one rendered symbol, never a spray of fragments. */
export const tokensFromEquation = (equation: string): string[] => {
  const src = String(equation ?? "");
  if (!src.trim()) return [];
  const out = tokenizeMath(src);
  // A single glued term such as "2x+3=7" still splits on operators, but only
  // when it holds no structure (splitting a matrix on "+" would break it).
  const hasStructure = /\\(?:begin|left|frac|dfrac|tfrac|sqrt|root|binom|sum|prod|int|oint|lim)\b/.test(src);
  if (out.length <= 1 && !/\s/.test(src) && !hasStructure) {
    const parts: string[] = [];
    let buf = "";
    for (const ch of src) {
      if (/[+\-=×÷]/.test(ch)) {
        if (buf) { parts.push(buf); buf = ""; }
        parts.push(ch);
      } else {
        buf += ch;
      }
    }
    if (buf) parts.push(buf);
    return parts.filter(Boolean);
  }
  return out;
};


export interface FloatingBucket {
  fillers: string[];
  containers: ContainerKind[];
  byLine: { lineId: string; fillerStart: number; fillerEnd: number }[];
  /** Combined floating numbers across every line, in original equation order. */
  viewCombined: string[];
  /** Continuous rearrangement of viewCombined using the 2,4,1,3 pattern. */
  viewRearranged: string[];
  /** Highlight state parallel to fillers / viewCombined. */
  selected: boolean[];
  /** Highlight state parallel to viewRearranged. */
  selectedRearranged: boolean[];
  /** Highlight state parallel to containers. */
  containersSelected: boolean[];
}

/** Rearrangement pattern — groups of four follow [2,4,1,3].
 *  Leftover 3 → [2,1,3] · leftover 2 → [2,1] · leftover 1 → unchanged. */
export const rearrangeIndices = (n: number): number[] => {
  const out: number[] = [];
  let i = 0;
  while (i + 4 <= n) {
    out.push(i + 1, i + 3, i + 0, i + 2);
    i += 4;
  }
  const rem = n - i;
  if (rem === 3) out.push(i + 1, i + 0, i + 2);
  else if (rem === 2) out.push(i + 1, i + 0);
  else if (rem === 1) out.push(i);
  return out;
};

export const applyArrangement = <T,>(items: T[], arr: number[]): T[] => {
  if (!arr.length || arr.length !== items.length) return items.slice();
  return arr.map((i) => items[i]);
};

/** Apply the rearrangement pattern directly to any array (used by View). */
export const rearrangeStream = <T,>(items: T[]): T[] =>
  applyArrangement(items, rearrangeIndices(items.length));

const identityArrangement = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** Compile all lines into the Master Floating Bucket + View Session. */
export const compileBucket = (lines: FloatingLine[]): FloatingBucket => {
  const fillers: string[] = [];
  const containerSet = new Map<ContainerKind, boolean>();
  const containers: ContainerKind[] = [];
  const byLine: FloatingBucket["byLine"] = [];
  const viewCombined: string[] = [];
  const selectedOrdered: boolean[] = [];
  const selectedCombined: boolean[] = [];

  for (const line of lines) {
    const start = fillers.length;
    const rawFillers = line.fillers ?? [];
    const rawSelected = line.fillersSelected ?? [];
    // Teacher chips are presentation-source-of-truth. Do not run display
    // conversion here: structural chips (\frac, \sqrt, brackets, powers)
    // must reach the Smartboard exactly as the teacher saved them.
    const cleanedWithIdx: { v: string; sel: boolean }[] = rawFillers.map((raw, i) => {
      return { v: String(raw ?? ""), sel: !!rawSelected[i] };
    });
    // Teacher chips are presentation-source-of-truth. Preserve every saved
    // highlighted/edited filler exactly: no sign stripping, no splitting, no
    // reconstruction.
    const cleanFillers = cleanedWithIdx.map((c) => c.v);
    const cleanSelected = cleanedWithIdx.map((c) => c.sel);
    const cleanArrangement = cleanFillers.length === rawFillers.length
      ? (line.arrangement ?? identityArrangement(cleanFillers.length))
      : identityArrangement(cleanFillers.length);
    const ordered = applyArrangement(cleanFillers, cleanArrangement);
    const orderedSel = applyArrangement(cleanSelected, cleanArrangement);
    fillers.push(...ordered);
    selectedOrdered.push(...orderedSel);
    viewCombined.push(...cleanFillers);
    selectedCombined.push(...cleanSelected);
    byLine.push({ lineId: line.lineId, fillerStart: start, fillerEnd: fillers.length });
    const lineContSel = line.containersSelected ?? [];
    for (let i = 0; i < line.containers.length; i++) {
      const c = line.containers[i];
      const sel = !!lineContSel[i];
      if (!containerSet.has(c)) {
        containerSet.set(c, sel);
        containers.push(c);
      } else if (sel) {
        containerSet.set(c, true);
      }
    }
  }
  const viewRearranged = viewCombined.slice();
  const selectedRearranged = selectedCombined.slice();
  const containersSelected = containers.map((c) => !!containerSet.get(c));
  return {
    fillers,
    containers,
    byLine,
    viewCombined,
    viewRearranged,
    selected: selectedOrdered,
    selectedRearranged,
    containersSelected,
  };
};
