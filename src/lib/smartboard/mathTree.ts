// Smartboard mathematics tree.
//
// Replaces the old "string with \sl{} placeholders" model. A line is now a
// `Row` (array of `Node`s). Each container node holds its own sub-rows
// (numerator/denominator, radicand, base/exp, etc.) so structures are
// first-class, nestable, and self-sizing in the DOM.
//
// A `Cursor` points into a particular row via an even-length path
// `[nodeIdx, subRowIdx, nodeIdx, subRowIdx, …]` and a position within that
// final row.

export type BracketKind =
  | "" | "(" | ")" | "[" | "]" | "{" | "}"
  | "|" | "‖" | "⌊" | "⌋" | "⌈" | "⌉";

export type Node =
  | { kind: "char"; ch: string }
  | { kind: "frac"; rows: Row[] }       // [num, den]
  | { kind: "sqrt"; rows: Row[] }       // [radicand] or [radicand, index]
  | { kind: "power"; rows: Row[] }      // [base, exp]
  | { kind: "sup"; rows: Row[] }        // [body]
  | { kind: "sub"; rows: Row[] }        // [body]
  | { kind: "subsup"; rows: Row[] }     // [base, sub, sup]
  | { kind: "bracket"; left: BracketKind; right: BracketKind; rows: Row[] } // [body]
  | { kind: "bigop"; op: "sum" | "prod" | "int" | "oint" | "lim"; rows: Row[] } // [body, lower, upper]
  | { kind: "matrix"; nRows: number; nCols: number; left: string; right: string; rows: Row[] }
  | { kind: "accent"; symbol: string; rows: Row[] } // [body]
  | { kind: "binom"; rows: Row[] }      // [top, bot]
  | { kind: "box"; rows: Row[] };       // [body] — single empty slot rendered as outlined cell, top-aligned


export type Row = Node[];

export interface Cursor {
  path: number[]; // even length: pairs of (nodeIdxInParentRow, subRowIdx)
  index: number;  // position within the deepest row
}

/* ─────────── builders ─────────── */

export const mkChar = (ch: string): Node => ({ kind: "char", ch });
export const mkFrac = (): Node => ({ kind: "frac", rows: [[], []] });
export const mkSqrt = (withIndex = false): Node =>
  withIndex ? { kind: "sqrt", rows: [[], []] } : { kind: "sqrt", rows: [[]] };
export const mkPower = (): Node => ({ kind: "power", rows: [[], []] });
export const mkSup = (): Node => ({ kind: "sup", rows: [[]] });
export const mkSub = (): Node => ({ kind: "sub", rows: [[]] });
export const mkSubSup = (): Node => ({ kind: "subsup", rows: [[], [], []] });
export const mkBracket = (l: BracketKind, r: BracketKind): Node =>
  ({ kind: "bracket", left: l, right: r, rows: [[]] });
export const mkAbs = (): Node => mkBracket("|", "|");
export const mkNorm = (): Node => mkBracket("‖", "‖");
export const mkFloor = (): Node => mkBracket("⌊", "⌋");
export const mkCeil = (): Node => mkBracket("⌈", "⌉");
export const mkBigOp = (op: "sum" | "prod" | "int" | "oint" | "lim"): Node =>
  ({ kind: "bigop", op, rows: [[], [], []] });
export const mkMatrix = (
  nRows: number, nCols: number, left = "(", right = ")",
): Node => ({
  kind: "matrix", nRows, nCols, left, right,
  rows: Array.from({ length: nRows * nCols }, () => [] as Row),
});
export const mkAccent = (symbol: string): Node =>
  ({ kind: "accent", symbol, rows: [[]] });
export const mkBinom = (): Node => ({ kind: "binom", rows: [[], []] });
export const mkBox = (): Node => ({ kind: "box", rows: [[]] });


/* ─────────── helpers ─────────── */

export const isContainer = (n: Node): boolean => n.kind !== "char";

export const subRowsOf = (n: Node): Row[] =>
  n.kind === "char" ? [] : (n as Exclude<Node, { kind: "char" }>).rows;

/** A row is "placeholder-only" when it has no chars and every container
 *  it holds has empty sub-rows. This is the leftover shape after tapping
 *  a structure chip (fraction/root/power/…) and never filling it. Used
 *  by the line-lock sweep to hide orphaned □ boxes once a line is
 *  locked; when the teacher moves back to the line it unlocks and the
 *  placeholder can be brought back editable. */
/** Collapse `box[ box[ … ] ]` down to a single box.
 *
 *  A `box` is a transparent writing cell. Nesting two of them creates TWO
 *  visible placeholder slots for ONE logical slot, so a fraction ends up
 *  showing four cells instead of two and typing lands in the wrong cell.
 *  There must be exactly one writable cell per slot. */
export const collapseNestedBoxes = (row: Row): Row =>
  row.map((n) => {
    if (n.kind === "char") return n;
    let node = n as Exclude<Node, { kind: "char" }>;
    // Unwrap chains of single-child boxes.
    while (
      node.kind === "box" &&
      node.rows.length === 1 &&
      node.rows[0].length === 1 &&
      node.rows[0][0].kind === "box"
    ) {
      node = node.rows[0][0] as Exclude<Node, { kind: "char" }>;
    }
    return { ...node, rows: node.rows.map(collapseNestedBoxes) } as Node;
  });

/** Structural fingerprint of a row: node kinds + arity + literal chars.
 *  Two renderings of the SAME mathematical object must produce the SAME
 *  hash. Used as the Reasoning panel's "math object id" debug readout. */
export const structureHash = (row: Row): string => {
  const sig = (r: Row): string =>
    r
      .map((n) =>
        n.kind === "char"
          ? `c${n.ch}`
          : `${n.kind}[${subRowsOf(n).map(sig).join("|")}]`,
      )
      .join(",");
  const s = sig(row);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
};

export const isPlaceholderOnly = (row: Row): boolean => {

  if (!row || row.length === 0) return false;
  for (const n of row) {
    if (n.kind === "char") return false;
    const subs = subRowsOf(n);
    for (const sub of subs) {
      if (sub.length > 0 && !isPlaceholderOnly(sub)) return false;
    }
  }
  return true;
};

const SCRIPT_SUBROWS: Record<string, Set<number>> = {
  sup: new Set([0]),
  sub: new Set([0]),
  power: new Set([1]),
  subsup: new Set([1, 2]),
};

export const exitCompletedScriptCursor = (root: Row, cursor: Cursor): Cursor => {
  if (cursor.path.length < 2) return cursor;
  const parentPath = cursor.path.slice(0, -2);
  const nodeIdx = cursor.path[cursor.path.length - 2];
  const subIdx = cursor.path[cursor.path.length - 1];
  const parentRow = getRowAt(root, parentPath);
  const node = parentRow[nodeIdx];
  if (!node || node.kind === "char") return cursor;
  const scriptRows = SCRIPT_SUBROWS[node.kind];
  if (!scriptRows?.has(subIdx)) return cursor;
  const activeRow = subRowsOf(node)[subIdx] ?? [];
  return activeRow.length > 0
    ? { path: parentPath, index: nodeIdx + 1 }
    : cursor;
};

export const getRowAt = (root: Row, path: number[]): Row => {
  let row: Row = root;
  for (let i = 0; i < path.length; i += 2) {
    const node = row[path[i]];
    if (!node || node.kind === "char") return row;
    row = subRowsOf(node)[path[i + 1]] ?? [];
  }
  return row;
};

export const setRowAt = (root: Row, path: number[], newRow: Row): Row => {
  if (path.length === 0) return newRow;
  const [nodeIdx, subIdx, ...rest] = path;
  const next = root.slice();
  const node = next[nodeIdx];
  if (!node || node.kind === "char") return root;
  const newRows = subRowsOf(node).slice();
  newRows[subIdx] = setRowAt(newRows[subIdx] ?? [], rest, newRow);
  next[nodeIdx] = { ...node, rows: newRows } as Node;
  return next;
};

export const firstEmptySub = (n: Node): number => {
  const rs = subRowsOf(n);
  for (let i = 0; i < rs.length; i++) if (rs[i].length === 0) return i;
  return 0;
};

/* ─────────── editing ─────────── */

export interface EditResult { root: Row; cursor: Cursor; }

/** The literal empty-slot glyph. It must NEVER survive as ink: it is a
 *  placeholder, so it renders as a slot and the first typed character
 *  replaces it (classic placeholder behaviour). */
export const SLOT_GLYPH = "□";

export const isSlotChar = (n: Node | undefined): boolean =>
  !!n && n.kind === "char" && n.ch === SLOT_GLYPH;

/** Insert a node at the cursor. For containers, descend into first empty sub-row. */
export const insertNode = (
  root: Row, cursor: Cursor, node: Node, descend = true,
): EditResult => {
  const row = getRowAt(root, cursor.path);
  // Placeholder overwrite: typing on/into a `□` slot replaces the slot
  // instead of pushing a character next to it.
  const overwrite = isSlotChar(row[cursor.index])
    ? cursor.index
    : isSlotChar(row[cursor.index - 1])
      ? cursor.index - 1
      : -1;
  const base = overwrite >= 0
    ? [...row.slice(0, overwrite), ...row.slice(overwrite + 1)]
    : row;
  const at = overwrite >= 0 ? overwrite : cursor.index;
  const newRow = [...base.slice(0, at), node, ...base.slice(at)];
  const newRoot = setRowAt(root, cursor.path, newRow);
  if (node.kind === "char" || !descend) {
    return { root: newRoot, cursor: { path: cursor.path, index: at + 1 } };
  }
  const sub = firstEmptySub(node);
  return {
    root: newRoot,
    cursor: { path: [...cursor.path, at, sub], index: 0 },
  };
};

export const insertChar = (root: Row, cursor: Cursor, ch: string): EditResult =>
  insertNode(root, cursor, mkChar(ch));


/** Backspace: delete previous node; if at row start of an empty container,
 *  remove the whole container; otherwise pop out to just before it. */
export const backspace = (root: Row, cursor: Cursor): EditResult => {
  const row = getRowAt(root, cursor.path);
  if (cursor.index > 0) {
    const newRow = [...row.slice(0, cursor.index - 1), ...row.slice(cursor.index)];
    return {
      root: setRowAt(root, cursor.path, newRow),
      cursor: { path: cursor.path, index: cursor.index - 1 },
    };
  }
  if (cursor.path.length === 0) return { root, cursor };
  const parentPath = cursor.path.slice(0, -2);
  const nodeIdx = cursor.path[cursor.path.length - 2];
  const parentRow = getRowAt(root, parentPath);
  const node = parentRow[nodeIdx];
  if (!node || node.kind === "char") return { root, cursor };
  const allEmpty = subRowsOf(node).every((r) => r.length === 0);
  if (allEmpty) {
    const newParent = [...parentRow.slice(0, nodeIdx), ...parentRow.slice(nodeIdx + 1)];
    return {
      root: setRowAt(root, parentPath, newParent),
      cursor: { path: parentPath, index: nodeIdx },
    };
  }
  return { root, cursor: { path: parentPath, index: nodeIdx } };
};

export const moveLeft = (root: Row, cursor: Cursor): Cursor => {
  if (cursor.index > 0) {
    const row = getRowAt(root, cursor.path);
    const prev = row[cursor.index - 1];
    if (prev && prev.kind !== "char") {
      const rs = subRowsOf(prev);
      const sub = rs.length - 1;
      return { path: [...cursor.path, cursor.index - 1, sub], index: rs[sub].length };
    }
    return { path: cursor.path, index: cursor.index - 1 };
  }
  if (cursor.path.length === 0) return cursor;
  const parentPath = cursor.path.slice(0, -2);
  const nodeIdx = cursor.path[cursor.path.length - 2];
  const subIdx = cursor.path[cursor.path.length - 1];
  // Hop to previous sub-row of the same container before exiting it.
  if (subIdx > 0) {
    const parentRow = getRowAt(root, parentPath);
    const node = parentRow[nodeIdx];
    if (node && node.kind !== "char") {
      const subs = subRowsOf(node);
      const target = subs[subIdx - 1] ?? [];
      return { path: [...parentPath, nodeIdx, subIdx - 1], index: target.length };
    }
  }
  return { path: parentPath, index: nodeIdx };
};

export const moveRight = (root: Row, cursor: Cursor): Cursor => {
  const row = getRowAt(root, cursor.path);
  if (cursor.index < row.length) {
    const next = row[cursor.index];
    if (next && next.kind !== "char") {
      return { path: [...cursor.path, cursor.index, 0], index: 0 };
    }
    return { path: cursor.path, index: cursor.index + 1 };
  }
  if (cursor.path.length === 0) return cursor;
  const parentPath = cursor.path.slice(0, -2);
  const nodeIdx = cursor.path[cursor.path.length - 2];
  const subIdx = cursor.path[cursor.path.length - 1];
  // Hop to next sub-row of the same container before exiting it.
  const parentRow = getRowAt(root, parentPath);
  const node = parentRow[nodeIdx];
  if (node && node.kind !== "char") {
    const subs = subRowsOf(node);
    if (subIdx + 1 < subs.length) {
      return { path: [...parentPath, nodeIdx, subIdx + 1], index: 0 };
    }
  }
  return { path: parentPath, index: nodeIdx + 1 };
};

/** Stoppers that delimit the "current run" left of the cursor for tag-wrap. */
const RUN_STOPPERS = new Set(["+", "−", "-", "×", "*", "÷", "/", "=", ",", ";", "(", "[", "{", " "]);

/** Find the contiguous char run ending at `index`, walking left until a
 *  stopper (operator/bracket/equals) or a container node is hit. */
export const extractRunLeftOf = (row: Row, index: number): { start: number; end: number } => {
  let s = index;
  while (s > 0) {
    const n = row[s - 1];
    if (!n) break;
    if (n.kind !== "char") break;
    if (RUN_STOPPERS.has(n.ch)) break;
    s--;
  }
  return { start: s, end: index };
};

/** Additive separators only — these break a multiplicative chain. Multiplication
 *  (×, *, ·, /, ÷) and juxtaposition (bracket / frac / root / power nodes,
 *  adjacent digits/letters) are absorbed into the wrap target. */
const ADDITIVE_STOPPERS = new Set(["+", "−", "-", "=", ",", ";"]);

/** Find the multiplicative run ending at `index`. Walks left and stops only at
 *  additive separators or row start; container nodes and multiplicative
 *  operator chars are absorbed. Leading whitespace at the boundary is
 *  trimmed so the wrapped slice doesn't carry a stray gap. */
export const extractWrapTargetLeftOf = (
  row: Row,
  index: number,
): { start: number; end: number } => {
  let s = index;
  while (s > 0) {
    const n = row[s - 1];
    if (!n) break;
    if (n.kind === "char" && ADDITIVE_STOPPERS.has(n.ch)) break;
    s--;
  }
  while (s < index) {
    const n = row[s];
    if (n && n.kind === "char" && n.ch === " ") s++;
    else break;
  }
  return { start: s, end: index };
};

/** Insert `node` into the row at `cursor.path`, optionally adopting the
 *  characters in `[wrapStart, wrapEnd)` of that row as `node.rows[wrapInto]`.
 *  Cursor lands inside the first OTHER empty sub-row (so the teacher fills
 *  the denominator after wrapping the numerator). */
export const insertNodeWrapping = (
  root: Row,
  cursor: Cursor,
  node: Node,
  wrapStart: number,
  wrapEnd: number,
  wrapInto = 0,
): EditResult => {
  const row = getRowAt(root, cursor.path);
  if (node.kind === "char") return insertNode(root, cursor, node, false);
  const subs = subRowsOf(node).slice();
  if (subs.length > 0 && wrapEnd > wrapStart) {
    subs[wrapInto] = row.slice(wrapStart, wrapEnd);
  }
  const wrappedNode = { ...node, rows: subs } as Node;
  const newRow = [...row.slice(0, wrapStart), wrappedNode, ...row.slice(wrapEnd)];
  const newRoot = setRowAt(root, cursor.path, newRow);
  // Land inside the next empty sub-row (or fallback to wrapInto+1).
  let targetSub = -1;
  for (let i = 0; i < subs.length; i++) {
    if (i !== wrapInto && subs[i].length === 0) { targetSub = i; break; }
  }
  if (targetSub < 0) targetSub = Math.min(wrapInto + 1, Math.max(0, subs.length - 1));
  return {
    root: newRoot,
    cursor: { path: [...cursor.path, wrapStart, targetSub], index: 0 },
  };
};

/** Depth-first walk of every row; returns the next/prev empty row's path. */
export const nextEmptyRow = (
  root: Row, cursor: Cursor, dir: 1 | -1 = 1,
): Cursor | null => {
  const all: number[][] = [];
  const walk = (row: Row, path: number[]) => {
    all.push(path);
    for (let i = 0; i < row.length; i++) {
      const n = row[i];
      if (n.kind !== "char") {
        subRowsOf(n).forEach((sub, si) => walk(sub, [...path, i, si]));
      }
    }
  };
  walk(root, []);
  const empties = all.filter((p) => getRowAt(root, p).length === 0);
  if (empties.length === 0) return null;
  const key = (p: number[]) => p.join(",");
  const idx = empties.findIndex((p) => key(p) === key(cursor.path));
  const len = empties.length;
  const target = dir > 0
    ? empties[((idx === -1 ? -1 : idx) + 1 + len) % len]
    : empties[((idx === -1 ? 0 : idx) - 1 + len) % len];
  return { path: target, index: 0 };
};

export const isRowEmpty = (r: Row): boolean => r.length === 0;

/** True when the row contains a genuinely TALL structure that physically
 *  occupies rows below its baseline: stacked fractions, binomials,
 *  matrices, big operators (∑ ∏ ∫ lim with limits). Plain text,
 *  superscripts/subscripts (x², aₙ), powers, brackets, accents and
 *  simple radicals are NOT tall — they never reserve extra rows.
 *  Recurses into every container so a fraction nested inside brackets
 *  or under a square root still counts. */
export const rowHasTallStructure = (row: Row): boolean => {
  for (const n of row) {
    if (n.kind === "char") continue;
    if (n.kind === "frac" || n.kind === "binom" || n.kind === "matrix" || n.kind === "bigop") {
      return true;
    }
    for (const sub of subRowsOf(n)) {
      if (rowHasTallStructure(sub)) return true;
    }
  }
  return false;
};
