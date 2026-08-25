// Matrix quick-access model — the single source of truth for the compact
// Matrix palette in the lesson-note ribbon.
//
// It is a NOTATION builder, never a calculator: nothing is evaluated,
// inverted or expanded. The palette collects a dimension plus compatible
// operations / special types, and this module turns that selection into the
// LaTeX the editor's `mathInline` node already understands.
//
// The existing full Matrix builder (MatrixCreateDialog) is untouched.

export type MatrixOpId = "transpose" | "determinant" | "inverse" | "adjoint";
export type MatrixSpecialId =
  | "identity" | "zero" | "diagonal" | "scalar" | "row" | "column";

export interface QuickDim { rows: number; cols: number }

export interface QuickSelection {
  dim: QuickDim | null;
  /** Operations in the teacher's click order. */
  ops: MatrixOpId[];
  special: MatrixSpecialId | null;
}

export const QUICK_DIMS: QuickDim[] = [
  { rows: 2, cols: 2 }, { rows: 2, cols: 3 }, { rows: 3, cols: 2 }, { rows: 3, cols: 3 },
  { rows: 3, cols: 4 }, { rows: 4, cols: 3 }, { rows: 4, cols: 4 }, { rows: 4, cols: 5 },
  { rows: 5, cols: 4 },
];

export const QUICK_OPS: Array<{ id: MatrixOpId; label: string }> = [
  { id: "transpose", label: "Transpose" },
  { id: "determinant", label: "Determinant" },
  { id: "inverse", label: "Inverse" },
  { id: "adjoint", label: "Adjoint" },
];

export const QUICK_SPECIALS: Array<{ id: MatrixSpecialId; label: string }> = [
  { id: "identity", label: "Identity" },
  { id: "zero", label: "Zero" },
  { id: "diagonal", label: "Diagonal" },
  { id: "scalar", label: "Scalar" },
  { id: "row", label: "Row" },
  { id: "column", label: "Column" },
];

/** Options that only exist for square matrices. */
const SQUARE_OPS: MatrixOpId[] = ["determinant", "inverse", "adjoint"];
const SQUARE_SPECIALS: MatrixSpecialId[] = ["identity", "diagonal", "scalar"];

export const isSquare = (d: QuickDim | null) => !!d && d.rows === d.cols;

const SQUARE_REASON = "Only for square matrices (2×2, 3×3, 4×4…)";

export const emptySelection = (): QuickSelection => ({ dim: null, ops: [], special: null });

const needsSquare = (s: QuickSelection) =>
  s.ops.some((o) => SQUARE_OPS.includes(o)) ||
  (s.special ? SQUARE_SPECIALS.includes(s.special) : false);

export interface ChipState { enabled: boolean; reason?: string }

/** Which dimension chips can be clicked from the current selection. */
export function dimState(s: QuickSelection, d: QuickDim): ChipState {
  if (needsSquare(s) && d.rows !== d.cols) return { enabled: false, reason: SQUARE_REASON };
  if (s.special === "row" && d.rows !== 1) {
    return { enabled: false, reason: "A row matrix has exactly one row" };
  }
  if (s.special === "column" && d.cols !== 1) {
    return { enabled: false, reason: "A column matrix has exactly one column" };
  }
  return { enabled: true };
}

export function opState(s: QuickSelection, id: MatrixOpId): ChipState {
  if (s.ops.includes(id)) return { enabled: true };
  if (SQUARE_OPS.includes(id)) {
    if (s.dim && !isSquare(s.dim)) return { enabled: false, reason: SQUARE_REASON };
    if (s.special === "row" || s.special === "column") {
      return { enabled: false, reason: SQUARE_REASON };
    }
  }
  return { enabled: true };
}

export function specialState(s: QuickSelection, id: MatrixSpecialId): ChipState {
  if (s.special === id) return { enabled: true };
  if (SQUARE_SPECIALS.includes(id) && s.dim && !isSquare(s.dim)) {
    return { enabled: false, reason: SQUARE_REASON };
  }
  if ((id === "row" || id === "column") && s.ops.some((o) => SQUARE_OPS.includes(o))) {
    return { enabled: false, reason: "Not compatible with the selected operation" };
  }
  return { enabled: true };
}

/** Pick a dimension, dropping anything it makes impossible. */
export function chooseDim(s: QuickSelection, d: QuickDim): QuickSelection {
  const square = d.rows === d.cols;
  let special = s.special;
  if (special && SQUARE_SPECIALS.includes(special) && !square) special = null;
  if (special === "row" && d.rows !== 1) special = null;
  if (special === "column" && d.cols !== 1) special = null;
  const ops = square ? s.ops : s.ops.filter((o) => !SQUARE_OPS.includes(o));
  return { dim: d, ops, special };
}

/** Toggle an operation; a square-only operation squares nothing by itself. */
export function toggleOp(s: QuickSelection, id: MatrixOpId): QuickSelection {
  if (s.ops.includes(id)) return { ...s, ops: s.ops.filter((o) => o !== id) };
  if (!opState(s, id).enabled) return s;
  return { ...s, ops: [...s.ops, id] };
}

/**
 * Toggle a special type. Row / Column force the shape, keeping the other
 * dimension the teacher already picked.
 */
export function toggleSpecial(s: QuickSelection, id: MatrixSpecialId): QuickSelection {
  if (s.special === id) return { ...s, special: null };
  if (!specialState(s, id).enabled) return s;
  let dim = s.dim;
  if (id === "row") dim = { rows: 1, cols: dim ? Math.max(2, dim.cols) : 3 };
  else if (id === "column") dim = { rows: dim ? Math.max(2, dim.rows) : 3, cols: 1 };
  else if (SQUARE_SPECIALS.includes(id)) {
    const n = dim ? Math.max(dim.rows, dim.cols) : 3;
    dim = { rows: n, cols: n };
  }
  const ops = dim && dim.rows !== dim.cols ? s.ops.filter((o) => !SQUARE_OPS.includes(o)) : s.ops;
  return { dim, ops, special: id };
}

const OP_WORD: Record<MatrixOpId, string> = {
  transpose: "Transpose",
  determinant: "Determinant",
  inverse: "Inverse",
  adjoint: "Adjoint",
};

const SPECIAL_WORD: Record<MatrixSpecialId, string> = {
  identity: "identity",
  zero: "zero",
  diagonal: "diagonal",
  scalar: "scalar",
  row: "row",
  column: "column",
};

export const isReady = (s: QuickSelection) => !!s.dim;

/** Human sentence shown above Enter, e.g. "Inverse of a 3 × 3 matrix". */
export function previewSentence(s: QuickSelection): string {
  if (!s.dim) return "Choose a dimension to begin";
  const shape = `${s.dim.rows} × ${s.dim.cols}`;
  const kind = s.special ? `${shape} ${SPECIAL_WORD[s.special]} matrix` : `${shape} matrix`;
  if (!s.ops.length) return kind.charAt(0).toUpperCase() + kind.slice(1);
  const words = s.ops.map((o) => OP_WORD[o]);
  const head = words.join(" of the ");
  return `${head} of a ${kind}`;
}

const SLOT = "\\sl{}";

function cellFor(s: QuickSelection, r: number, c: number): string {
  switch (s.special) {
    case "identity": return r === c ? "1" : "0";
    case "zero": return "0";
    case "diagonal": return r === c ? SLOT : "0";
    case "scalar": return r === c ? "k" : "0";
    default: return SLOT;
  }
}

/**
 * LaTeX for the pending selection, using only constructs the lesson-note
 * math renderer already parses (`\begin{pmatrix|vmatrix}`, `^{…}`, `\sl{}`).
 */
export function buildQuickMatrixLatex(s: QuickSelection): string {
  const dim = s.dim ?? { rows: 2, cols: 2 };
  const rows = Math.max(1, Math.min(20, dim.rows));
  const cols = Math.max(1, Math.min(20, dim.cols));

  const body: string[] = [];
  for (let r = 0; r < rows; r++) {
    const line: string[] = [];
    for (let c = 0; c < cols; c++) line.push(cellFor(s, r, c));
    body.push(line.join(" & "));
  }

  const env = s.ops.includes("determinant") ? "vmatrix" : "pmatrix";
  let out = `\\begin{${env}} ${body.join(" \\\\ ")} \\end{${env}}`;

  let sup = "";
  for (const op of s.ops) {
    if (op === "transpose") sup += "T";
    else if (op === "inverse") sup += "-1";
  }
  if (sup) out = `${out}^{${sup}}`;
  if (s.ops.includes("adjoint")) out = `adj ${out}`;
  return out;
}
