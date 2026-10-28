// Exact-first arithmetic re-computation, shared by every server-side gate
// that must check a claimed mathematical fact against the actual mathematics
// (currently: the Math Engine's `claim` verification in notebook-ai/mathEngine.ts).
//
// Strategy, same as the sibling step-grading engine in mathEquivalence.ts:
//   1. Symbolic (mathjs simplify) — exact, no floating point, for anything
//      that reduces to a bare "0" (all rational arithmetic/algebra).
//   2. Numeric sampling (mathjs) — only when (1) can't decide, e.g. an
//      expression that genuinely involves an irrational (sqrt/trig/log)
//      that doesn't symbolically cancel.
// A claim is "exact" when (1) alone settled it; "approximate" when it needed
// (2). That distinction is what lets the caller demand an exact surd/fraction
// form instead of a rounded decimal wherever one is actually available.

import { math, tryParse, numericEqual, normalize } from "./mathEquivalence.ts";

// mathEquivalence's simplifiesToZero() also accepts "simplify() folded to a
// float within 1e-6", which is right for comparing two written lines but
// wrong here: a decimal literal like 1.7320508 folds to a tiny-but-nonzero
// float, not to the symbol "0" — and that distinction is exactly what "is
// this genuinely exact" needs to preserve. So only the strict, no-floating-
// point form counts as exact here.
function isExactZero(node: any): boolean {
  try {
    return math.simplify(node).toString().replace(/\s+/g, "") === "0";
  } catch {
    return false;
  }
}

/** Read the balanced (...) group starting at `i` (s[i] must be "("). */
function readParenGroup(s: string, i: number): [string, number] {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "(") depth++;
    else if (s[j] === ")" && --depth === 0) return [s.slice(i + 1, j), j + 1];
  }
  throw new Error("unbalanced parentheses");
}

/** Read the balanced {...} group starting at `i` (s[i] must be "{"). */
function readBraceGroup(s: string, i: number): [string, number] {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}" && --depth === 0) return [s.slice(i + 1, j), j + 1];
  }
  throw new Error("unbalanced braces");
}

/**
 * Convert \frac{a}{b}, \sqrt{a}, \sqrt[n]{a} (and the plain-text forms
 * sqrt(a)) into mathjs-parseable arithmetic. Nested board notation such as
 * \frac{3 - \sqrt{2}}{7} converts correctly because groups are read with a
 * balanced-brace reader, not a regex.
 */
function latexTemplatesToMathjs(raw: string): string {
  const src = String(raw ?? "")
    .replace(/\\left|\\right|\\!|\\,|\\;|\\ /g, "")
    .replace(/\\dfrac|\\tfrac/g, "\\frac");

  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("\\frac", i)) {
      let j = i + 5;
      while (src[j] === " ") j++;
      const [a, afterA] = readBraceGroup(src, j);
      let k = afterA;
      while (src[k] === " ") k++;
      const [b, afterB] = readBraceGroup(src, k);
      out += `((${latexTemplatesToMathjs(a)})/(${latexTemplatesToMathjs(b)}))`;
      i = afterB;
      continue;
    }
    if (src.startsWith("\\sqrt[", i)) {
      const closeBracket = src.indexOf("]", i);
      const n = src.slice(i + 6, closeBracket);
      let j = closeBracket + 1;
      while (src[j] === " ") j++;
      const [a, after] = readBraceGroup(src, j);
      out += `nthRoot((${latexTemplatesToMathjs(a)}),(${n}))`;
      i = after;
      continue;
    }
    if (src.startsWith("\\sqrt", i)) {
      let j = i + 5;
      while (src[j] === " ") j++;
      const [a, after] = readBraceGroup(src, j);
      out += `sqrt((${latexTemplatesToMathjs(a)}))`;
      i = after;
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

const SUPERSCRIPT_DIGIT: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
};

/** Board unicode (√, ², ×, ÷, −) into mathjs-parseable ASCII. */
function unicodeToMathjs(raw: string): string {
  let s = String(raw ?? "");
  // ³√8, ²√11 — a leading superscript run before √ is the root's index.
  s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)√/g, (_m, d: string) =>
    `NTHROOT${[...d].map((c) => SUPERSCRIPT_DIGIT[c] ?? "").join("")}_`);
  s = s.replace(/NTHROOT(\d+)_\(([^()]*)\)/g, "nthRoot(($2),$1)");
  s = s.replace(/NTHROOT(\d+)_([0-9.]+|[a-zA-Z])/g, "nthRoot($2,$1)");
  s = s.replace(/√\(([^()]*)\)/g, "sqrt(($1))");
  s = s.replace(/√([0-9.]+|[a-zA-Z])/g, "sqrt($1)");
  // Trailing superscript runs are exponents: x²⁵ → x^(25).
  s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_m, d: string) =>
    `^(${[...d].map((c) => SUPERSCRIPT_DIGIT[c] ?? "").join("")})`);
  s = s.replace(/[×·]/g, "*").replace(/[÷]/g, "/").replace(/[−–—]/g, "-");
  return s;
}

/**
 * Classroom trigonometry is in degrees (sin 30 = 0.5), mathjs's sin/cos/tan
 * work in radians. Wrap sin(/cos(/tan( arguments as (…)*pi/180 on the way in,
 * and wrap asin(/acos(/atan( (and the arcsin spelling) results as (…)*180/pi
 * on the way out — mirroring the classroom convention exactly.
 */
function applyDegreeConvention(expr: string): string {
  const FORWARD = ["sin", "cos", "tan"];
  const INVERSE: Record<string, string> = {
    asin: "asin", acos: "acos", atan: "atan",
    arcsin: "asin", arccos: "acos", arctan: "atan",
  };
  let out = "";
  let i = 0;
  while (i < expr.length) {
    const rest = expr.slice(i);
    const idMatch = /^[a-zA-Z]+/.exec(rest);
    const name = idMatch?.[0];
    if (name && expr[i + name.length] === "(") {
      const parenAt = i + name.length;
      if (FORWARD.includes(name)) {
        const [arg, after] = readParenGroup(expr, parenAt);
        out += `${name}((${applyDegreeConvention(arg)})*pi/180)`;
        i = after;
        continue;
      }
      if (name in INVERSE) {
        const [arg, after] = readParenGroup(expr, parenAt);
        out += `(${INVERSE[name]}(${applyDegreeConvention(arg)})*180/pi)`;
        i = after;
        continue;
      }
      out += name;
      i += name.length;
      continue;
    }
    out += expr[i];
    i++;
  }
  return out;
}

/** Board notation (LaTeX templates, unicode, degree trig) → mathjs syntax. */
export function boardToMathjs(raw: string): string {
  let s = latexTemplatesToMathjs(String(raw ?? ""));
  s = unicodeToMathjs(s);
  s = normalize(s);
  s = applyDegreeConvention(s);
  return s;
}

/** Replace whole-word occurrences of `variable` with `(value)`, textually —
 *  so an exact rational/surd value stays exact through substitution instead
 *  of being rounded to a float first. */
export function substituteVariable(expr: string, variable: string, value: string): string {
  const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return expr.replace(new RegExp(`\\b${escaped}\\b`, "g"), `(${value})`);
}

export interface ZeroCheck {
  ok: boolean;
  /** true when settled by exact symbolic simplification, no floating point. */
  exact: boolean;
  value?: number;
  detail?: string;
}

/** Does `boardExpr` (already substituted, still in board notation) evaluate
 *  to zero — exactly wherever possible, falling back to a numeric check only
 *  for genuinely irrational results? */
export function evaluatesToZero(boardExpr: string): ZeroCheck {
  const mathjsExpr = boardToMathjs(boardExpr);
  const node = tryParse(mathjsExpr);
  const zero = tryParse("0");
  if (!node || !zero) return { ok: false, exact: false, detail: `could not parse "${boardExpr}"` };

  if (isExactZero(node)) return { ok: true, exact: true };

  const verdict = numericEqual(node, zero);
  if (verdict === "equal") {
    let value: number | undefined;
    try { value = node.compile().evaluate({}); } catch { /* best effort */ }
    return { ok: true, exact: false, value };
  }
  if (verdict === "not_equal") {
    let value: number | undefined;
    try { value = node.compile().evaluate({}); } catch { /* best effort */ }
    return { ok: false, exact: false, value, detail: `"${boardExpr}" evaluates to ${value ?? "?"}, not 0` };
  }
  return { ok: false, exact: false, detail: `could not determine whether "${boardExpr}" is 0` };
}

/**
 * Compare two board-notation expressions/values for equality — exact first,
 * numeric fallback. Used for the "arithmetic" claim (expression == value).
 */
export function evaluatesEqual(a: string, b: string): ZeroCheck {
  return evaluatesToZero(`(${a})-(${b})`);
}

/**
 * A value that is genuinely irrational (its exact check needed the numeric
 * fallback) but is written as a long bare decimal rather than a surd,
 * fraction, or π-expression is exactly the "doesn't give exact value" defect
 * — flag it so the caller can ask for the exact form instead.
 */
export function looksLikeUnroundedDecimal(raw: string): boolean {
  const s = String(raw ?? "");
  if (/[√π]|\\sqrt|\\frac|nthRoot/i.test(s)) return false; // already exact form
  return /\d+\.\d{3,}/.test(s);
}
