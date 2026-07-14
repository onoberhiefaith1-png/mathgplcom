import type { AssetDef } from "./types";

const S = (
  id: string,
  label: string,
  structure: string,
  slots: number,
  group: string,
  keywords: string[] = [],
  attrs?: Record<string, unknown>,
): AssetDef => ({
  id, label, category: "Structures", group,
  keywords: [id, label.toLowerCase(), ...keywords],
  render: { kind: "structure", structure, slots, attrs },
});

export const STRUCTURES: AssetDef[] = [
  // Fractions
  S("fraction", "Fraction", "fraction", 2, "Fractions", ["frac", "over", "divide"]),
  S("mixed", "Mixed number", "mixed", 3, "Fractions", ["whole", "fraction"]),
  S("complexfraction", "Complex fraction", "fraction", 2, "Fractions", ["nested", "compound"]),
  S("slantedfraction", "Slanted fraction", "slanted", 2, "Fractions", ["inline", "a/b"]),

  // Roots
  S("sqrt", "Square root", "sqrt", 1, "Roots", ["root", "radical"]),
  S("cuberoot", "Cube root", "cuberoot", 1, "Roots", ["root"], { index: "3" }),
  S("nroot", "nth root", "nroot", 2, "Roots", ["root", "radical"]),

  // Indices / logs
  S("power", "Power / exponent", "power", 2, "Indices", ["exp", "index", "superscript"]),
  S("subscript", "Subscript", "sub", 2, "Indices", ["index"]),
  S("subsup", "Subscript + power", "subsup", 3, "Indices"),
  S("logarithm", "Logarithm", "log", 2, "Indices", ["log"]),
  S("ln", "Natural log", "ln", 1, "Indices", ["log"]),

  // Groupings
  S("paren", "Parentheses", "paren", 1, "Groupings", ["brackets"]),
  S("bracket", "Square brackets", "sqbracket", 1, "Groupings", ["brackets"]),
  S("brace", "Curly braces", "brace", 1, "Groupings", ["set"]),
  S("absolutevalue", "Absolute value", "abs", 1, "Groupings", ["mod", "modulus"]),
  S("norm", "Norm", "norm", 1, "Groupings"),
  S("floor", "Floor", "floor", 1, "Groupings"),
  S("ceiling", "Ceiling", "ceil", 1, "Groupings", ["ceil"]),

  // Matrices & vectors — intelligent, dimension-aware. Each tile opens a
  // dialog that gathers dimensions + bracket, then inserts a single
  // `mathStructure kind="matrix"` node. The Matrix Settings toolbar handles
  // all further structural edits (rows, cols, brackets, templates).
  {
    id: "matrix", label: "Matrix", category: "Structures", group: "Matrices",
    keywords: ["matrix", "grid", "array"],
    render: { kind: "structure", structure: "matrix", slots: 4, attrs: { rows: 2, cols: 2, br: "(" } },
    openDialog: "matrix",
    hint: "Any size",
  },
  {
    id: "columnvector", label: "Column vector", category: "Structures", group: "Matrices",
    keywords: ["column", "vector"],
    render: { kind: "structure", structure: "matrix", slots: 3, attrs: { rows: 3, cols: 1, br: "(" } },
    openDialog: "matrixColVec",
  },
  {
    id: "rowvector", label: "Row vector", category: "Structures", group: "Matrices",
    keywords: ["row", "vector"],
    render: { kind: "structure", structure: "matrix", slots: 3, attrs: { rows: 1, cols: 3, br: "(" } },
    openDialog: "matrixRowVec",
  },
  {
    id: "identity", label: "Identity matrix", category: "Structures", group: "Matrices",
    keywords: ["identity", "I", "unit"],
    render: { kind: "structure", structure: "matrix", slots: 9, attrs: { rows: 3, cols: 3, br: "(", template: "identity" } },
    openDialog: "matrixIdentity",
  },
  {
    id: "augmented", label: "Augmented matrix", category: "Structures", group: "Matrices",
    keywords: ["augmented", "gaussian", "system"],
    render: { kind: "structure", structure: "matrix", slots: 6, attrs: { rows: 2, cols: 3, br: "(", divider: 2 } },
    openDialog: "matrixAugmented",
  },
  S("vector", "Vector arrow", "vector", 1, "Matrices", ["arrow"]),


  // Sums / products / limits
  S("sigma", "Summation (Σ)", "bigop", 3, "Sums", ["sum"], { op: "∑" }),
  S("product", "Product (Π)", "bigop", 3, "Sums", ["prod"], { op: "∏" }),
  S("limit", "Limit", "limit", 2, "Sums", ["lim"]),

  // Calculus
  S("integral", "Integral (∫)", "bigop", 3, "Calculus", ["int"], { op: "∫" }),
  S("doubleintegral", "Double integral", "bigop", 3, "Calculus", ["int"], { op: "∬" }),
  S("oint", "Contour integral", "bigop", 3, "Calculus", ["integral"], { op: "∮" }),
  S("derivative", "Derivative", "deriv", 2, "Calculus", ["dydx"]),
  S("partialderiv", "Partial derivative", "partial", 2, "Calculus"),
  S("evalbar", "Evaluated at bar", "evalbar", 3, "Calculus", ["at"]),

  // Accents
  S("hat", "Hat", "accent", 1, "Accents", [], { mark: "ˆ" }),
  S("bar", "Bar / conjugate", "accent", 1, "Accents", ["conjugate"], { mark: "¯" }),
  S("repeatbar", "Repeating decimal bar", "accent", 1, "Accents", ["recurring"], { mark: "¯" }),

  // Multi-line
  S("piecewise", "Piecewise function", "piecewise", 4, "Multi-line", ["cases", "brace"], { rows: 2 }),
  S("simultaneous", "Simultaneous equations", "system", 2, "Multi-line", ["system"], { rows: 2 }),
  S("binomial", "Binomial coefficient", "binom", 2, "Multi-line", ["choose", "ncr"]),
  S("longdivision", "Long division", "longdiv", 3, "Multi-line", ["divide"]),

  // Other
  S("polynomial", "Polynomial", "poly", 1, "Other"),
  S("function", "Function notation", "func", 2, "Other", ["fx"]),
];
