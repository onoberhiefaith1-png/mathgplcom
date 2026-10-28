// Smart Structures — structure → grid adapters.
//
// SMART STRUCTURE PRINCIPLE
// Every mathematical layout (long division, prime-factorisation / division
// ladder, place-value chart, base conversion) has exactly two parts:
//
//   1. STATIC STRUCTURE — the teacher's drawing: division bracket, horizontal
//      rules, minus signs, vertical dividers, ladder, borders, alignment,
//      headings, "R" labels. Retained forever. NEVER a Floating Number.
//   2. EDITABLE CELLS   — the mathematical values. These, and only these,
//      become Floating Numbers.
//
// This module maps each structure asset's own attribute shape onto the SAME
// grid vocabulary the Smart Table already uses, plus a static mask, so the
// whole Floating Number pipeline works on structures without a second
// pipeline. The structure itself is never rebuilt — it is read, never redrawn.

import { flattenObjectAttrs, type SolutionObject } from "@/lib/floating/solutionItems";

export interface StructureGrid {
  objId: string;
  label: string;
  headers: string[];
  cells: string[][];
  rows: number;
  cols: number;
  /** `r:c` keys that are pure structure — retained, never Floating Numbers. */
  staticCells: string[];
  /** Glyph a structural cell renders (bracket, minus, divider, "R", …). */
  staticGlyphs: Record<string, string>;
  /** Which structure asset draws the static layer (never a table). */
  structureId: string;
  /** The teacher's original attributes — the static layer, verbatim. */
  structureAttrs: Record<string, any>;
}


type BuiltGrid = Omit<StructureGrid, "structureId" | "structureAttrs">;

const key = (r: number, c: number) => `${r}:${c}`;

/** Every structure asset we can decompose, mapped to its display label. */
export const STRUCTURE_IDS: Record<string, string> = {
  longdivision: "Long division",
  divisionladder: "Division ladder",
  primefactorisation: "Prime factorisation",
  placevaluechart: "Place-value chart",
  baseconversion: "Base conversion",
};

/** Identify a structure asset from a captured object (node type or attrs). */
export const structureIdOf = (obj: SolutionObject | null | undefined): string | null => {
  if (!obj) return null;
  const flat = flattenObjectAttrs((obj.attrs ?? {}) as Record<string, any>);
  const hints = [
    obj.nodeType,
    (obj.attrs as any)?.family,
    (obj.attrs as any)?.visual,
    flat?.family,
    flat?.visual,
    flat?.kind,
    flat?.variant,
    flat?.assetKind,
    flat?.type,
  ];
  for (const h of hints) {
    if (typeof h !== "string" || !h) continue;
    const id = h.toLowerCase();
    if (STRUCTURE_IDS[id]) return id;
  }
  return null;
};

export const isStructureObject = (obj: SolutionObject | null | undefined): boolean =>
  structureIdOf(obj) !== null;

const str = (v: unknown): string => String(v ?? "");

const rect = (rows: string[][], nCols: number): string[][] =>
  rows.map((r) => Array.from({ length: nCols }, (_, c) => str(r?.[c])));

/* ── Long division ─────────────────────────────────────────────────────────
   Column 0 holds the divisor (an editable value that lives outside the digit
   grid). Columns 1…n are the digit columns. Rows: quotient, dividend, then one
   row per working row. The bracket, the horizontal rules and the automatic
   minus signs are drawn by the asset — they are structure, not cells. */
const longDivisionGrid = (objId: string, label: string, a: Record<string, any>): BuiltGrid => {
  const dividend: string[] = Array.isArray(a.dividendDigits)
    ? a.dividendDigits.map(str)
    : str(a.dividend).split("");
  const nDigits = Math.max(1, dividend.length);
  const align = (arr: unknown): string[] => {
    const src = Array.isArray(arr) ? arr.map(str) : str(arr).split("");
    if (src.length >= nDigits) return src.slice(-nDigits);
    return Array(nDigits - src.length).fill("").concat(src);
  };
  const quotient = align(a.quotientDigits ?? a.quotient);
  const workingRaw: unknown[] = Array.isArray(a.workingRows) ? a.workingRows : [];
  const working = workingRaw.map(align);

  const cols = nDigits + 1;
  const cells: string[][] = [];
  const staticCells: string[] = [];
  const staticGlyphs: Record<string, string> = {};

  // Row 0 — quotient (divisor gutter is structure here).
  cells.push(["", ...quotient]);
  staticCells.push(key(0, 0));
  staticGlyphs[key(0, 0)] = "";

  // Row 1 — divisor + dividend under the bracket.
  cells.push([str(a.divisor), ...dividend]);

  // Working rows — the minus sign and rule belong to the structure.
  working.forEach((row, i) => {
    const r = cells.length;
    cells.push(["", ...row]);
    staticCells.push(key(r, 0));
    staticGlyphs[key(r, 0)] = i % 2 === 0 && a.autoMinus !== false ? "−" : "";
  });

  return {
    objId,
    label,
    headers: Array.from({ length: cols }, () => ""),
    cells: rect(cells, cols),
    rows: cells.length,
    cols,
    staticCells,
    staticGlyphs,
  };
};

/* ── Division ladder / prime factorisation ─────────────────────────────────
   Column 0 = divisors down the left of the divider, columns 1…n = the values.
   The vertical divider, the ladder and the alignment are structure. */
const ladderGrid = (objId: string, label: string, a: Record<string, any>): BuiltGrid => {
  const divisors: string[] = Array.isArray(a.divisors) && a.divisors.length
    ? a.divisors.map(str)
    : [""];
  const valueCols = Math.max(1, Number(a.cols) || 1);
  const raw: any[] = Array.isArray(a.values) ? a.values : [];
  const rowCount = divisors.length + 1;
  const cells: string[][] = [];
  const staticCells: string[] = [];
  const staticGlyphs: Record<string, string> = {};

  for (let r = 0; r < rowCount; r++) {
    const divisor = r < divisors.length ? divisors[r] : "";
    const vals = Array.from({ length: valueCols }, (_, c) => str(raw?.[r]?.[c]));
    cells.push([divisor, ...vals]);
    if (r >= divisors.length) {
      staticCells.push(key(r, 0));
      staticGlyphs[key(r, 0)] = "";
    }
  }
  const cols = valueCols + 1;
  return {
    objId,
    label,
    headers: Array.from({ length: cols }, () => ""),
    cells: rect(cells, cols),
    rows: cells.length,
    cols,
    staticCells,
    staticGlyphs,
  };
};

/* ── Base conversion ──────────────────────────────────────────────────────
   Column 0 = base (structure after the first row), column 1 = quotient,
   column 2 = remainder. The divider and the "R" heading are structure. */
const baseConversionGrid = (objId: string, label: string, a: Record<string, any>): BuiltGrid => {
  const rowsRaw: any[] = Array.isArray(a.rows) && a.rows.length ? a.rows : [{ q: "", r: "" }];
  const cells: string[][] = [];
  const staticCells: string[] = [];
  const staticGlyphs: Record<string, string> = {};
  rowsRaw.forEach((row, r) => {
    cells.push([r === 0 ? str(a.base) : "", str(row?.q), str(row?.r)]);
    if (r > 0) {
      staticCells.push(key(r, 0));
      staticGlyphs[key(r, 0)] = "";
    }
  });
  return {
    objId,
    label,
    headers: ["", "", "R"],
    cells: rect(cells, 3),
    rows: cells.length,
    cols: 3,
    staticCells,
    staticGlyphs,
  };
};

/* ── Place-value chart ────────────────────────────────────────────────────
   The headings (H | T | U | . | tenths …) are structure; the digit rows are
   editable cells. */
const placeValueGrid = (objId: string, label: string, a: Record<string, any>): BuiltGrid => {
  const wholeHeaders: string[] = Array.isArray(a.wholeHeaders) && a.wholeHeaders.length
    ? a.wholeHeaders.map(str)
    : ["H", "T", "U"];
  const decimalHeaders: string[] = Array.isArray(a.decimalHeaders) ? a.decimalHeaders.map(str) : [];
  const headers = [...wholeHeaders, ...decimalHeaders];
  const cols = Math.max(1, headers.length);
  const whole: any[] = Array.isArray(a.rows) ? a.rows : [[]];
  const dec: any[] = Array.isArray(a.decRows) ? a.decRows : [];
  const rowCount = Math.max(1, whole.length);
  const cells: string[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const left = Array.from({ length: wholeHeaders.length }, (_, c) => str(whole?.[r]?.[c]));
    const right = Array.from({ length: decimalHeaders.length }, (_, c) => str(dec?.[r]?.[c]));
    cells.push([...left, ...right]);
  }
  return {
    objId,
    label,
    headers: Array.from({ length: cols }, (_, c) => str(headers[c])),
    cells: rect(cells, cols),
    rows: cells.length,
    cols,
    staticCells: [],
    staticGlyphs: {},
  };
};

/** Decompose a highlighted Smart Structure into grid + static mask. Returns
 *  null when the object is not a recognised structure. */
export const structureGridFromObject = (obj: SolutionObject): StructureGrid | null => {
  const id = structureIdOf(obj);
  if (!id) return null;
  const a = flattenObjectAttrs((obj.attrs ?? {}) as Record<string, any>);
  const label = obj.label && obj.label !== "Object" && obj.label !== "Diagram"
    ? obj.label
    : STRUCTURE_IDS[id];
  const raw = ((obj.attrs ?? {}) as Record<string, any>);
  const built = ((): BuiltGrid | null => {
  switch (id) {
    case "longdivision":
      return longDivisionGrid(obj.objId, label, a);
    case "divisionladder":
    case "primefactorisation":
      return ladderGrid(obj.objId, label, a);
    case "baseconversion":
      return baseConversionGrid(obj.objId, label, a);
    case "placevaluechart":
      return placeValueGrid(obj.objId, label, a);
    default:
      return null;
  }
  })();
  if (!built) return null;
  // The static layer is the asset's own attributes — carried through so every
  // renderer redraws the teacher's structure instead of a generic table.
  return { ...built, structureId: id, structureAttrs: { ...a, ...raw } };
};

/** Write a grid of values back into the structure's OWN attribute shape, so
 *  the asset redraws itself (bracket, ladder, divider, alignment intact) with
 *  the new cell values. The static layer is never touched. */
export const attrsWithGrid = (
  structureId: string,
  attrs: Record<string, any>,
  cells: string[][],
): Record<string, any> => {
  const at = (r: number, c: number) => String(cells?.[r]?.[c] ?? "");
  const row = (r: number, from = 1) => (cells?.[r] ?? []).slice(from).map((v) => String(v ?? ""));
  switch (structureId) {
    case "longdivision": {
      const working: string[][] = [];
      for (let r = 2; r < (cells?.length ?? 0); r++) working.push(row(r));
      return {
        ...attrs,
        divisor: at(1, 0),
        quotientDigits: row(0),
        dividendDigits: row(1),
        workingRows: working,
        // LEGACY ANSWER FIELDS ARE STRIPPED. If they survive, the asset's own
        // migration effect fires on mount and pushes the teacher's whole
        // answer back as a bulk patch — the "solution appears by itself" bug.
        dividend: undefined,
        quotient: undefined,
      };
    }
    case "divisionladder":
    case "primefactorisation": {
      const divisors: string[] = [];
      const values: string[][] = [];
      for (let r = 0; r < (cells?.length ?? 0); r++) {
        if (r < (cells?.length ?? 0) - 1) divisors.push(at(r, 0));
        values.push(row(r));
      }
      return { ...attrs, divisors, values, cols: Math.max(1, (cells?.[0]?.length ?? 2) - 1) };
    }
    case "baseconversion":
      return {
        ...attrs,
        base: at(0, 0),
        rows: (cells ?? []).map((_, r) => ({ q: at(r, 1), r: at(r, 2) })),
      };
    case "placevaluechart": {
      const wholeLen = Array.isArray(attrs.wholeHeaders) && attrs.wholeHeaders.length
        ? attrs.wholeHeaders.length
        : 3;
      return {
        ...attrs,
        rows: (cells ?? []).map((r) => r.slice(0, wholeLen).map((v) => String(v ?? ""))),
        decRows: (cells ?? []).map((r) => r.slice(wholeLen).map((v) => String(v ?? ""))),
      };
    }
    default:
      return attrs;
  }
};
