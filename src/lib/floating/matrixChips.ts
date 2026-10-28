// Matrix = STRUCTURE + CELLS.
//
// A matrix is never delivered to the board as a finished object. Exactly like
// a fraction (`□/□`) or a radical (`√□`), the teacher first places an EMPTY
// bracketed grid and then fills each cell independently. This module encodes
// that split for the Floating Numbers pipeline:
//
//   highlighted `\begin{bmatrix}2 & 1\\3 & 4\end{bmatrix}`
//     → shell chip  `\begin{bmatrix}\square & \square\\\square & \square\end{bmatrix}`
//     → value chips `2`, `1`, `3`, `4`   (reading order, row-major)
//
// The shell stays a LaTeX matrix environment so every existing detection,
// persistence and rendering path keeps recognising it — it simply carries
// placeholders instead of values.

import { gridFromMatrixLatex } from "@/lib/floating/tableGrid";

export const MATRIX_SLOT = "\\square";

export interface MatrixShell {
  rows: number;
  cols: number;
  left: string;
  right: string;
  /** Original environment name (bmatrix, pmatrix, …). */
  env: string;
  /** LaTeX for the empty structure chip. */
  latex: string;
}

const envOf = (latex: string): string => {
  const m = /\\begin\s*\{([A-Za-z]+)\}/.exec(latex);
  return m ? m[1] : "bmatrix";
};

/** Build the empty-structure LaTeX for the given dimensions/environment. */
export const emptyMatrixLatex = (rows: number, cols: number, env = "bmatrix"): string => {
  const r = Math.max(1, Math.floor(rows));
  const c = Math.max(1, Math.floor(cols));
  const body = Array.from({ length: r }, () =>
    Array.from({ length: c }, () => MATRIX_SLOT).join(" & "),
  ).join("\\\\");
  return `\\begin{${env}}${body}\\end{${env}}`;
};

/** Describe a matrix chip (shell or filled) as dimensions + brackets. */
export const matrixShellFromLatex = (raw: string): MatrixShell | null => {
  const grid = gridFromMatrixLatex(raw);
  if (!grid?.isMatrix) return null;
  const env = grid.matrixEnv ?? envOf(String(raw));
  return {
    rows: grid.rows,
    cols: grid.cols,
    left: grid.matrixBrackets?.left ?? "",
    right: grid.matrixBrackets?.right ?? "",
    env,
    latex: emptyMatrixLatex(grid.rows, grid.cols, env),
  };
};

const isSlotCell = (cell: string): boolean => {
  const t = String(cell ?? "").trim();
  return t === "" || t === MATRIX_SLOT || t === "□" || t === "\\Box";
};

/** True when the chip carries no values — i.e. it is already a pure structure. */
export const isEmptyMatrixLatex = (raw: string): boolean => {
  const grid = gridFromMatrixLatex(raw);
  if (!grid?.isMatrix) return false;
  return grid.cells.every((row) => row.every(isSlotCell));
};

/** Split a matrix chip into its empty structure plus row-major cell values.
 *  Returns null when `raw` is not a matrix environment. */
export const splitMatrixChip = (
  raw: string,
): { shell: string; values: string[] } | null => {
  const shell = matrixShellFromLatex(raw);
  if (!shell) return null;
  const grid = gridFromMatrixLatex(raw)!;
  const values: string[] = [];
  for (const row of grid.cells) {
    for (const cell of row) {
      if (!isSlotCell(cell)) values.push(String(cell).trim());
    }
  }
  return { shell: shell.latex, values };
};

// ---------------------------------------------------------------------------
// Whole-line matrix chips.
//
// A highlighted line may hold several matrices joined by operators, e.g.
//   `\begin{bmatrix}1&2\\3&4\end{bmatrix} \times \begin{bmatrix}5\\6\end{bmatrix} = \begin{bmatrix}17\\39\end{bmatrix}`
// Every matrix becomes its EMPTY shell chip followed by its cell chips
// (row-major); the text between matrices (`×`, `=`, `+`, labels such as `A`)
// becomes ordinary chips in reading order. A filled matrix is never one chip.

/** Locate every top-level matrix environment in `src`, in order. */
const findMatrixSpans = (src: string): { start: number; end: number; latex: string }[] => {
  const spans: { start: number; end: number; latex: string }[] = [];
  const MATRIX_BEGIN_RE = /\\begin\s*\{(matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix)\}/g;
  let m: RegExpExecArray | null;
  while ((m = MATRIX_BEGIN_RE.exec(src))) {
    const env = m[1];
    // Walk forward balancing nested environments of the same name.
    const openRe = new RegExp(`\\\\begin\\s*\\{${env}\\}|\\\\end\\s*\\{${env}\\}`, "g");
    openRe.lastIndex = m.index + m[0].length;
    let depth = 1;
    let endAt = -1;
    let t: RegExpExecArray | null;
    while ((t = openRe.exec(src))) {
      depth += t[0].startsWith("\\begin") ? 1 : -1;
      if (depth === 0) { endAt = t.index + t[0].length; break; }
    }
    if (endAt < 0) break;
    spans.push({ start: m.index, end: endAt, latex: src.slice(m.index, endAt) });
    MATRIX_BEGIN_RE.lastIndex = endAt;
  }
  return spans;
};

/** Split the glue text between matrices into operator / term chips. */
const glueChips = (text: string): string[] => {
  const s = String(text ?? "")
    .replace(/\\(?:times|cdot)\b/g, "×")
    .replace(/\\div\b/g, "÷")
    .replace(/\\(?:left|right)\b/g, "")
    .replace(/\\[,;:! ]/g, " ")
    .replace(/\\quad\b|\\qquad\b/g, " ");
  const out: string[] = [];
  let buf = "";
  const flush = () => {
    const v = buf.trim();
    if (v) out.push(v);
    buf = "";
  };
  let depth = 0;
  for (const ch of s) {
    if (ch === "{" || ch === "(" || ch === "[") depth += 1;
    else if (ch === "}" || ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if (depth === 0 && /[+\-−=×÷*]/.test(ch)) {
      flush();
      out.push(ch === "*" ? "×" : ch);
    } else {
      buf += ch;
    }
  }
  flush();
  return out;
};

/** Floating Number chips for a whole line that contains matrices: each matrix
 *  → shell + row-major cell chips, operators/terms between them as their own
 *  chips. Returns null when the line holds no matrix. */
export const matrixLineChips = (raw: string): string[] | null => {
  const src = String(raw ?? "");
  const spans = findMatrixSpans(src);
  if (!spans.length) return null;
  const out: string[] = [];
  let cursor = 0;
  for (const span of spans) {
    out.push(...glueChips(src.slice(cursor, span.start)));
    const split = splitMatrixChip(span.latex);
    if (split) out.push(split.shell, ...split.values);
    else out.push(span.latex);
    cursor = span.end;
  }
  out.push(...glueChips(src.slice(cursor)));
  return out.length ? out : null;
};

/** True when a chip is (or contains) a FILLED matrix, i.e. a blob that must be
 *  split. Empty shells are already correct and are left alone. */
export const isFilledMatrixChip = (chip: string): boolean => {
  const src = String(chip ?? "");
  const spans = findMatrixSpans(src);
  if (!spans.length) return false;
  const pureShell = spans.length === 1 && src.trim() === spans[0].latex.trim() && isEmptyMatrixLatex(src);
  return !pureShell;
};

/** Expand every filled-matrix chip in a filler row into shell + cell chips.
 *  `source[i]` is the index of the original chip that produced output chip i,
 *  so parallel arrays (selection state) can be carried across. Returns null
 *  when nothing needed expanding. */
export const expandMatrixFillers = (
  fillers: string[],
): { fillers: string[]; source: number[] } | null => {
  if (!fillers.some(isFilledMatrixChip)) return null;
  const out: string[] = [];
  const source: number[] = [];
  fillers.forEach((chip, i) => {
    const parts = isFilledMatrixChip(chip) ? matrixLineChips(chip) ?? [chip] : [chip];
    for (const p of parts) { out.push(p); source.push(i); }
  });
  return { fillers: out, source };
};
