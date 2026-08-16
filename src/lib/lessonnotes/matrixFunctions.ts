// Matrix function catalogue — NOTATION ONLY.
//
// The Matrix Builder is an expression builder, never a calculator. Selecting
// a function here only adds mathematical notation around/onto the matrix the
// teacher created. Nothing is ever evaluated, expanded or simplified.

export type MatrixFnId =
  | "transpose"
  | "inverse"
  | "determinant"
  | "adjoint"
  | "conjugate"
  | "conjugateTranspose"
  | "trace"
  | "rank"
  | "norm"
  | "power";

export interface MatrixFnDef {
  id: MatrixFnId;
  label: string;
  /** Where the notation attaches. */
  layer: "sup" | "over" | "outer" | "fence";
  /** Superscript glyph for sup-layer functions. */
  sup?: string;
  /** Operator name for outer-layer functions. */
  prefix?: string;
  hint: string;
}

export const MATRIX_FUNCTIONS: MatrixFnDef[] = [
  { id: "transpose", label: "Transpose", layer: "sup", sup: "T", hint: "Aᵀ" },
  { id: "inverse", label: "Inverse", layer: "sup", sup: "−1", hint: "A⁻¹" },
  { id: "determinant", label: "Determinant", layer: "outer", prefix: "det", hint: "det A" },
  { id: "adjoint", label: "Adjoint", layer: "outer", prefix: "adj", hint: "adj A" },
  { id: "conjugate", label: "Conjugate", layer: "over", hint: "A̅" },
  { id: "conjugateTranspose", label: "Conjugate transpose", layer: "sup", sup: "H", hint: "Aᴴ" },
  { id: "trace", label: "Trace", layer: "outer", prefix: "tr", hint: "tr A" },
  { id: "rank", label: "Rank", layer: "outer", prefix: "rank", hint: "rank A" },
  { id: "norm", label: "Norm", layer: "fence", hint: "‖A‖" },
  { id: "power", label: "Matrix power", layer: "sup", hint: "A^□" },
];

const BY_ID = new Map(MATRIX_FUNCTIONS.map((f) => [f.id, f]));

export const isMatrixFnId = (v: unknown): v is MatrixFnId =>
  typeof v === "string" && BY_ID.has(v as MatrixFnId);

/** Keep only known ids, de-duplicated, in the teacher's selection order. */
export function normaliseFns(raw: unknown): MatrixFnId[] {
  if (!Array.isArray(raw)) return [];
  const out: MatrixFnId[] = [];
  for (const v of raw) {
    if (isMatrixFnId(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

export interface MatrixNotation {
  /** Operator names rendered before the bracketed matrix, e.g. "det", "tr". */
  prefix: string;
  /** Superscript glyphs stacked in selection order, e.g. "−1T". */
  sup: string;
  /** Matrix power selected → an editable exponent placeholder is rendered. */
  power: boolean;
  /** Conjugate selected → overline across the bracketed matrix. */
  overline: boolean;
  /** Norm selected → ‖ … ‖ around the whole expression. */
  norm: boolean;
}

/**
 * Merge every selected function into ONE expression:
 *
 *   outer ‖ prefix ( bracketed matrix ) superscripts ‖
 *
 * The matrix bracket itself always stays whatever the teacher chose —
 * a function never forces a bracket style.
 */
export function composeNotation(fns: MatrixFnId[]): MatrixNotation {
  const prefixes: string[] = [];
  let sup = "";
  let power = false;
  let overline = false;
  let norm = false;
  for (const id of fns) {
    const def = BY_ID.get(id);
    if (!def) continue;
    if (def.layer === "sup") {
      if (id === "power") power = true;
      else if (def.sup) sup += def.sup;
    } else if (def.layer === "outer" && def.prefix) {
      prefixes.push(def.prefix);
    } else if (def.layer === "over") overline = true;
    else if (def.layer === "fence") norm = true;
  }
  return { prefix: prefixes.join(" "), sup, power, overline, norm };
}

/** Human-readable preview used by the builder dialog, e.g. "det (A)⁻¹ᵀ". */
export function previewNotation(fns: MatrixFnId[], br: string): string {
  const n = composeNotation(fns);
  const open = br === "[" ? "[" : br === "{" ? "{" : br === "|" ? "|" : "(";
  const close = br === "[" ? "]" : br === "{" ? "}" : br === "|" ? "|" : ")";
  let core = `${open}A${close}`;
  if (n.overline) core = `‾${core}‾`;
  const supText = `${n.sup}${n.power ? "□" : ""}`;
  if (supText) core = `${core}^${supText}`;
  if (n.prefix) core = `${n.prefix} ${core}`;
  if (n.norm) core = `‖${core}‖`;
  return core;
}
