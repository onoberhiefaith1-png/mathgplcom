// Exact-first arithmetic re-computation — the browser-side mirror of
// supabase/functions/_shared/exactEval.ts. Kept as a separate port (not a
// shared import) because this runs in the Vite/browser bundle while the
// other runs in a Deno edge function; verify.ts and mathEngine.ts (server)
// already mirror each other the same way for the same reason.
//
// Strategy: exact symbolic check first (mathjs simplify, reduced to the
// literal "0" — no floating point involved), numeric sampling with a tight
// epsilon only as a fallback for genuinely irrational results.

import { create, all } from "mathjs";

const math = create(all, {});

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

/** \frac{a}{b}, \sqrt{a}, \sqrt[n]{a} (and sqrt(a)) → mathjs arithmetic. */
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
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

/** Board unicode (√, ², ×, ÷, −) into mathjs-parseable ASCII. */
function unicodeToMathjs(raw: string): string {
  let s = String(raw ?? "");
  s = s.replace(
    /([⁰¹²³⁴⁵⁶⁷⁸⁹]+)√/g,
    (_m, d: string) =>
      `NTHROOT${[...d].map((c) => SUPERSCRIPT_DIGIT[c] ?? "").join("")}_`,
  );
  s = s.replace(/NTHROOT(\d+)_\(([^()]*)\)/g, "nthRoot(($2),$1)");
  s = s.replace(/NTHROOT(\d+)_([0-9.]+|[a-zA-Z])/g, "nthRoot($2,$1)");
  s = s.replace(/√\(([^()]*)\)/g, "sqrt(($1))");
  s = s.replace(/√([0-9.]+|[a-zA-Z])/g, "sqrt($1)");
  s = s.replace(
    /([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g,
    (_m, d: string) =>
      `^(${[...d].map((c) => SUPERSCRIPT_DIGIT[c] ?? "").join("")})`,
  );
  s = s.replace(/[×·]/g, "*").replace(/[÷]/g, "/").replace(/[−–—]/g, "-");
  return s;
}

/** ab means a·b in school notation; expand multi-letter runs, keep function names. */
const FUNCS = new Set([
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "arcsin",
  "arccos",
  "arctan",
  "sqrt",
  "cbrt",
  "nthRoot",
  "abs",
  "ln",
  "log",
  "log10",
  "log2",
  "exp",
  "floor",
  "ceil",
  "round",
  "min",
  "max",
  "pi",
]);
function expandImplicitProducts(s: string): string {
  return s.replace(/[A-Za-z]{2,}(\s*\()?/g, (run, call) => {
    const name = call ? run.slice(0, run.length - call.length) : run;
    if (FUNCS.has(name)) return run;
    return name.split("").join("*") + (call ?? "");
  });
}

/** Implicit multiplication (2x, 3(x+1), x(x+1)) → explicit `*`. */
function expandImplicitMultiplication(raw: string): string {
  let s = expandImplicitProducts(raw);
  s = s.replace(/(\d)\s*([A-Za-z(])/g, "$1*$2");
  s = s.replace(/([A-Za-z0-9)])\s*\(/g, (m, ch, off: number, whole: string) => {
    const before = whole.slice(0, off + 1);
    const nameMatch = before.match(/[A-Za-z]+$/);
    if (nameMatch && FUNCS.has(nameMatch[0])) return m;
    return `${ch}*(`;
  });
  s = s.replace(/\)\s*([A-Za-z0-9(])/g, ")*$1");
  return s;
}

/**
 * Classroom trigonometry is in degrees; mathjs's sin/cos/tan are radians.
 * Wrap forward-trig arguments as (…)*pi/180, inverse-trig results as
 * (…)*180/pi — the same convention verify.ts used before this rewrite.
 */
function applyDegreeConvention(expr: string): string {
  const FORWARD = ["sin", "cos", "tan"];
  const INVERSE: Record<string, string> = {
    asin: "asin",
    acos: "acos",
    atan: "atan",
    arcsin: "asin",
    arccos: "acos",
    arctan: "atan",
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

/** Board notation (LaTeX templates, unicode, implicit products, degree trig) → mathjs syntax. */
export function boardToMathjs(raw: string): string {
  let s = latexTemplatesToMathjs(String(raw ?? ""));
  s = unicodeToMathjs(s);
  s = s.replace(/\s+/g, "");
  s = expandImplicitMultiplication(s);
  s = applyDegreeConvention(s);
  return s;
}

/** Replace whole-word occurrences of `variable` with `(value)`, textually —
 *  so an exact rational/surd value stays exact through substitution. */
export function substituteVariable(
  expr: string,
  variable: string,
  value: string,
): string {
  const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return expr.replace(new RegExp(`\\b${escaped}\\b`, "g"), `(${value})`);
}

// mathjs's node tree (SymbolNode/OperatorNode/FunctionNode/…) isn't usefully
// typeable for a generic tree walk — the same pragmatic `any` the sibling
// server-side mathEquivalence.ts already uses for the identical traversal.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryParse(expr: string): any | null {
  try {
    return math.parse(expr);
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isExactZero(node: any): boolean {
  try {
    return math.simplify(node).toString().replace(/\s+/g, "") === "0";
  } catch {
    return false;
  }
}

const EPS = 1e-6;

// Walk only the properties that hold actual OPERANDS — never `.fn`, which is
// itself a SymbolNode carrying the function's own name (e.g. "sqrt"). mathjs's
// generic `.traverse()` visits `.fn` too, which misreads every function call
// as if it referenced a variable named after that function.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectSymbols(node: any, out: Set<string>) {
  if (!node) return;
  if (node.isSymbolNode && typeof node.name === "string") {
    if (
      !["e", "pi", "i", "Infinity", "NaN", "true", "false"].includes(node.name)
    )
      out.add(node.name);
  }
  const kids = node.args ?? node.blocks ?? node.items ?? node.params ?? [];
  for (const k of kids) collectSymbols(k, out);
  if (node.object) collectSymbols(node.object, out);
  if (node.content) collectSymbols(node.content, out);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function numericZero(node: any): "equal" | "not_equal" | "unknown" {
  const vars = new Set<string>();
  collectSymbols(node, vars);
  const compiled = (() => {
    try {
      return node.compile();
    } catch {
      return null;
    }
  })();
  if (!compiled) return "unknown";
  const names = Array.from(vars);
  const samples = names.length === 0 ? 1 : 8;
  let anySuccess = false;
  for (let i = 0; i < samples; i++) {
    const scope: Record<string, number> = {};
    for (const n of names) scope[n] = (Math.random() - 0.5) * 6 + 1.7;
    let v: unknown;
    try {
      v = compiled.evaluate(scope);
    } catch {
      return "unknown";
    }
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    anySuccess = true;
    if (Math.abs(v) > EPS * Math.max(1, Math.abs(v))) return "not_equal";
  }
  return anySuccess ? "equal" : "unknown";
}

export interface ZeroCheck {
  ok: boolean;
  /** true when settled by exact symbolic simplification, no floating point. */
  exact: boolean;
  value?: number;
  detail?: string;
}

/** Does `boardExpr` (board notation) evaluate to zero — exactly wherever
 *  possible, numeric fallback only for genuinely irrational results? */
export function evaluatesToZero(boardExpr: string): ZeroCheck {
  const mathjsExpr = boardToMathjs(boardExpr);
  const node = tryParse(mathjsExpr);
  if (!node)
    return {
      ok: false,
      exact: false,
      detail: `could not parse "${boardExpr}"`,
    };

  if (isExactZero(node)) return { ok: true, exact: true };

  const verdict = numericZero(node);
  let value: number | undefined;
  try {
    value = node.compile().evaluate({});
  } catch {
    /* best effort */
  }
  if (verdict === "equal") return { ok: true, exact: false, value };
  if (verdict === "not_equal") {
    return {
      ok: false,
      exact: false,
      value,
      detail: `"${boardExpr}" evaluates to ${value ?? "?"}, not 0`,
    };
  }
  return {
    ok: false,
    exact: false,
    detail: `could not determine whether "${boardExpr}" is 0`,
  };
}

/** Compare two board-notation expressions/values — exact first, numeric fallback. */
export function evaluatesEqual(a: string, b: string): ZeroCheck {
  return evaluatesToZero(`(${a})-(${b})`);
}

/**
 * A value that is genuinely irrational (needed the numeric fallback) but is
 * written as a long bare decimal rather than a surd, fraction, or
 * π-expression — the "doesn't give exact value" defect.
 */
export function looksLikeUnroundedDecimal(raw: string): boolean {
  const s = String(raw ?? "");
  if (/[√π]|\\sqrt|\\frac|nthRoot/i.test(s)) return false;
  return /\d+\.\d{3,}/.test(s);
}
