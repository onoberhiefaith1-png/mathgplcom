// LOSSLESS MATH SERIALIZATION
//
// A `mathStructure` node in the lesson note is a real two-dimensional
// mathematical object (stacked fraction, radical, matrix, big operator…).
// Every downstream surface — Floating page, Smartboard, saved solution text —
// re-renders solution lines through `renderMathInline`, which speaks LaTeX.
//
// This module is the ONE place that turns a structure node into the LaTeX the
// renderer already understands, so a fraction stays a fraction everywhere and
// nothing is ever flattened into ambiguous plain text.

const g = (slots: string[], i: number): string => (slots[i] ?? "").trim();
const wrap = (s: string) => `{${s}}`;

/** LaTeX for one `mathStructure`, given its already-serialized child slots. */
export function structureToLatex(
  kind: string,
  attrs: Record<string, unknown>,
  slots: string[],
): string {
  const op = String(attrs?.op ?? "");
  const mark = String(attrs?.mark ?? "");
  const index = String(attrs?.index ?? "");
  const br = String(attrs?.br ?? "(");
  const rows = Number(attrs?.rows ?? 0) || 0;
  const cols = Number(attrs?.cols ?? 0) || 0;
  const a = g(slots, 0), b = g(slots, 1), c = g(slots, 2);

  switch (kind) {
    case "fraction":
      return `\\frac${wrap(a)}${wrap(b)}`;
    case "slanted":
      return `${a}/${b}`;
    case "mixed":
      return `${a}\\frac${wrap(b)}${wrap(c)}`;
    case "binom":
      return `\\binom${wrap(a)}${wrap(b)}`;
    case "sqrt":
      return `\\sqrt${wrap(a)}`;
    case "cuberoot":
      return `\\sqrt[3]${wrap(a)}`;
    case "nroot":
      return `\\sqrt[${a || index}]${wrap(b)}`;
    case "power":
      return `${a}^${wrap(b)}`;
    case "sub":
      return `${a}_${wrap(b)}`;
    case "subsup":
      return `${a}_${wrap(b)}^${wrap(c)}`;
    case "log":
      return `\\log_${wrap(a)}${wrap(b)}`;
    case "ln":
      return `\\ln${wrap(a)}`;
    case "paren":
      return `\\left(${a}\\right)`;
    case "sqbracket":
      return `\\left[${a}\\right]`;
    case "brace":
      return `\\left\\{${a}\\right\\}`;
    case "abs":
      return `\\left|${a}\\right|`;
    case "norm":
      return `\\left\\|${a}\\right\\|`;
    case "floor":
      return `\\lfloor ${a}\\rfloor`;
    case "ceil":
      return `\\lceil ${a}\\rceil`;
    case "accent":
      return mark === "^" ? `\\hat${wrap(a)}` : `\\overline${wrap(a)}`;
    case "vector":
      return `\\vec${wrap(a)}`;
    case "func":
      return `${a}\\left(${b}\\right)`;
    case "deriv":
      return `\\frac{d${a}}{d${b}}`;
    case "partial":
      return `\\frac{\\partial ${a}}{\\partial ${b}}`;
    case "limit":
      return `\\lim_{${a} \\to ${b}}${wrap(c)}`;
    case "bigop": {
      const sym = op === "∫" ? "\\int"
        : op === "∬" ? "\\iint"
        : op === "∭" ? "\\iiint"
        : op === "∮" ? "\\oint"
        : op === "∐" ? "\\coprod"
        : op === "⋃" ? "\\bigcup"
        : op === "⋂" ? "\\bigcap"
        : op === "Π" || op === "∏" ? "\\prod"
        : "\\sum";

      return `${sym}_${wrap(a)}^${wrap(b)}${wrap(c)}`;
    }
    case "evalbar":
      return `\\left.${a}\\right|_${wrap(b)}^${wrap(c)}`;
    case "matrix": {
      if (!rows || !cols) return slots.join(" ");
      const env = br === "[" ? "bmatrix"
        : br === "{" ? "Bmatrix"
        : br === "|" ? "vmatrix"
        : br === "‖" ? "Vmatrix"
        : "pmatrix";
      const body: string[] = [];
      for (let r = 0; r < rows; r++) {
        const row: string[] = [];
        for (let cIdx = 0; cIdx < cols; cIdx++) row.push(g(slots, r * cols + cIdx));
        body.push(row.join(" & "));
      }
      return `\\begin{${env}}${body.join(" \\\\ ")}\\end{${env}}`;
    }
    case "piecewise":
    case "system": {
      const width = cols || 2;
      const body: string[] = [];
      for (let i = 0; i < slots.length; i += width) {
        body.push(slots.slice(i, i + width).map((s) => (s ?? "").trim()).join(" & "));
      }
      return `\\begin{cases}${body.join(" \\\\ ")}\\end{cases}`;
    }
    default:
      // Unknown structure: never invent syntax — keep the readable slots.
      return slots.map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
  }
}
