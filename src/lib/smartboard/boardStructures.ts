// Smartboard structure menu metadata. Each entry knows how to mint a fresh
// math-tree node when the user taps it. After insertion the cursor descends
// into the node's first empty sub-row (see `insertNode` in mathTree.ts).

import {
  Node, mkFrac, mkSqrt, mkPower, mkSub, mkSubSup, mkBracket, mkAbs, mkNorm,
  mkFloor, mkCeil, mkBigOp, mkAccent, mkBinom, mkMatrix,
} from "./mathTree";

export interface BoardStructureTemplate {
  id: string;
  label: string;
  title: string;
  group: "core" | "powers" | "brackets" | "calculus" | "linear" | "discrete";
  build: () => Node;
  /** When set, tapping the chip opens the Matrix Builder first
   *  (dimension → bracket → functions → create). */
  dialog?: "matrix";
}

export const BOARD_STRUCTURES: BoardStructureTemplate[] = [
  // — Core fractions & roots —
  { id: "frac",  label: "□⁄□", title: "Fraction",     group: "core", build: () => mkFrac() },
  { id: "sqrt",  label: "√□",  title: "Square root",  group: "core", build: () => mkSqrt(false) },
  { id: "nroot", label: "ⁿ√□", title: "nth root",     group: "core", build: () => mkSqrt(true) },

  // — Powers & subscripts —
  { id: "power",  label: "□^□",   title: "Power",                group: "powers", build: () => mkPower() },
  { id: "sub",    label: "□_□",   title: "Subscript",            group: "powers", build: () => mkSub() },
  { id: "subsup", label: "□_□^□", title: "Subscript + power",    group: "powers", build: () => mkSubSup() },

  // — Brackets —
  { id: "paren", label: "( □ )", title: "Parentheses",   group: "brackets", build: () => mkBracket("(", ")") },
  { id: "bra",   label: "[ □ ]", title: "Square brackets", group: "brackets", build: () => mkBracket("[", "]") },
  { id: "abs",   label: "|□|",   title: "Absolute value", group: "brackets", build: () => mkAbs() },
  { id: "norm",  label: "‖□‖",   title: "Norm",           group: "brackets", build: () => mkNorm() },
  { id: "floor", label: "⌊□⌋",   title: "Floor",          group: "brackets", build: () => mkFloor() },
  { id: "ceil",  label: "⌈□⌉",   title: "Ceiling",        group: "brackets", build: () => mkCeil() },

  // — Calculus / big operators —
  { id: "sum",      label: "Σ",     title: "Summation with bounds",  group: "calculus", build: () => mkBigOp("sum") },
  { id: "prod",     label: "Π",     title: "Product with bounds",    group: "calculus", build: () => mkBigOp("prod") },
  { id: "intdef",   label: "∫ᵃᵇ",  title: "Definite integral",      group: "calculus", build: () => mkBigOp("int") },
  { id: "oint",     label: "∮",     title: "Contour integral",       group: "calculus", build: () => mkBigOp("oint") },
  { id: "lim",      label: "lim",   title: "Limit",                  group: "calculus", build: () => mkBigOp("lim") },
  { id: "deriv",    label: "d⁄d□", title: "Derivative",              group: "calculus", build: () => mkFrac() },
  { id: "partial",  label: "∂⁄∂□", title: "Partial derivative",      group: "calculus", build: () => mkFrac() },

  // — Linear algebra —
  { id: "vec",  label: "→x", title: "Vector", group: "linear", build: () => mkAccent("→") },
  { id: "hat",  label: "x̂",  title: "Hat",    group: "linear", build: () => mkAccent("^") },
  { id: "bar",  label: "x̄",  title: "Bar",    group: "linear", build: () => mkAccent("‾") },
  // ONE matrix entry. Dimension, bracket and functions are all chosen in
  // the builder before insertion — the board never shows a matrix
  // configuration toolbar.
  {
    id: "matrix", label: "Matrix", title: "Matrix builder — dimension, bracket, functions",
    group: "linear", dialog: "matrix", build: () => mkMatrix(2, 2, "(", ")"),
  },

  // — Discrete / combinatorics —
  { id: "binom", label: "(ⁿₖ)", title: "Binomial coefficient", group: "discrete", build: () => mkBinom() },
];
