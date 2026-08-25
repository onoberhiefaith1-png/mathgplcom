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
