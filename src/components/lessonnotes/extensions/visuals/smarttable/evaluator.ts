// Small safe expression evaluator for the Smart Table.
// Supports: numbers, + − × ÷ * / ^, unary −, parentheses, √(x), x², x³.
// No `eval`, no identifiers other than the sqrt/pow shims we insert.

export type EvalResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

// Normalise the display expression (52 × 5, 12 ÷ 4, √9, 3²) into a canonical
// token stream the shunting-yard can chew on.
function normalize(src: string): string {
  return src
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/√\s*\(?/g, "√(") // ensure √ opens a group
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\s+/g, "");
}

type Tok =
  | { t: "num"; v: number }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "^" | "u-" }
  | { t: "fn"; v: "sqrt" }
  | { t: "lp" }
  | { t: "rp" };

function tokenize(src: string): Tok[] | string {
  const s = normalize(src);
  const out: Tok[] = [];
  let i = 0;
  let prev: Tok | null = null;
  while (i < s.length) {
    const c = s[i];
    if (c >= "0" && c <= "9" || c === ".") {
      let j = i;
      while (j < s.length && (s[j] === "." || (s[j] >= "0" && s[j] <= "9"))) j++;
      const n = Number(s.slice(i, j));
      if (!Number.isFinite(n)) return `Bad number "${s.slice(i, j)}"`;
      const tok: Tok = { t: "num", v: n };
      out.push(tok); prev = tok; i = j; continue;
    }
    if (c === "√") {
      const tok: Tok = { t: "fn", v: "sqrt" };
      out.push(tok); prev = tok; i++; continue;
    }
    if (c === "(") { out.push({ t: "lp" }); prev = { t: "lp" }; i++; continue; }
    if (c === ")") { out.push({ t: "rp" }); prev = { t: "rp" }; i++; continue; }
    if (c === "+" || c === "-" || c === "*" || c === "/" || c === "^") {
      // detect unary minus
      const isUnary: boolean =
        c === "-" &&
        (!prev || prev.t === "op" || prev.t === "lp" || prev.t === "fn");
      const op: Tok = isUnary
        ? { t: "op", v: "u-" }
        : { t: "op", v: c as any };
      out.push(op); prev = op; i++; continue;
    }
    return `Unexpected "${c}"`;
  }
  return out;
}

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "u-": 3, "^": 4 };
const RIGHT: Record<string, boolean> = { "^": true, "u-": true };

function toRPN(tokens: Tok[]): Tok[] | string {
  const out: Tok[] = [];
  const stack: Tok[] = [];
  for (const tok of tokens) {
    if (tok.t === "num") out.push(tok);
    else if (tok.t === "fn") stack.push(tok);
    else if (tok.t === "op") {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t === "fn") { out.push(stack.pop()!); continue; }
        if (top.t === "op") {
          const p1 = PREC[tok.v];
          const p2 = PREC[top.v];
          if (p2 > p1 || (p2 === p1 && !RIGHT[tok.v])) { out.push(stack.pop()!); continue; }
        }
        break;
      }
      stack.push(tok);
    } else if (tok.t === "lp") stack.push(tok);
    else if (tok.t === "rp") {
      while (stack.length && stack[stack.length - 1].t !== "lp") out.push(stack.pop()!);
      if (!stack.length) return "Mismatched )";
      stack.pop(); // discard lp
      if (stack.length && stack[stack.length - 1].t === "fn") out.push(stack.pop()!);
    }
  }
  while (stack.length) {
    const top = stack.pop()!;
    if (top.t === "lp") return "Mismatched (";
    out.push(top);
  }
  return out;
}

function evalRPN(rpn: Tok[]): EvalResult {
  const st: number[] = [];
  for (const tok of rpn) {
    if (tok.t === "num") st.push(tok.v);
    else if (tok.t === "op") {
      if (tok.v === "u-") {
        const a = st.pop();
        if (a === undefined) return { ok: false, error: "Missing value" };
        st.push(-a);
      } else {
        const b = st.pop(); const a = st.pop();
        if (a === undefined || b === undefined) return { ok: false, error: "Missing value" };
        let r = 0;
        if (tok.v === "+") r = a + b;
        else if (tok.v === "-") r = a - b;
        else if (tok.v === "*") r = a * b;
        else if (tok.v === "/") { if (b === 0) return { ok: false, error: "÷ 0" }; r = a / b; }
        else if (tok.v === "^") r = Math.pow(a, b);
        st.push(r);
      }
    } else if (tok.t === "fn") {
      const a = st.pop();
      if (a === undefined) return { ok: false, error: "Missing value" };
      if (tok.v === "sqrt") {
        if (a < 0) return { ok: false, error: "√ of negative" };
        st.push(Math.sqrt(a));
      }
    }
  }
  if (st.length !== 1) return { ok: false, error: "Invalid expression" };
  return { ok: true, value: st[0] };
}

export function evaluate(expr: string): EvalResult {
  if (!expr.trim()) return { ok: false, error: "Empty" };
  const tokens = tokenize(expr);
  if (typeof tokens === "string") return { ok: false, error: tokens };
  const rpn = toRPN(tokens);
  if (typeof rpn === "string") return { ok: false, error: rpn };
  return evalRPN(rpn);
}

/** Round to a sensible display precision (drop trailing zeros). */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 1e10) / 1e10;
  return String(rounded);
}

/** True when the string is already just a plain number (nothing to solve). */
const isPlainNumber = (s: string): boolean => /^[-−]?\d+(\.\d+)?$/.test(s.trim());

/**
 * Strip assignment noise so an AI-written cell behaves exactly like a typed
 * one. Handles a leading spreadsheet `=`, a dangling trailing `=` left after
 * deleting a result, and `left = right` (the LEFT side is the calculation).
 */
export function stripAssignment(raw: string): string {
  let s = (raw ?? "").trim();
  if (s.startsWith("=")) s = s.slice(1).trim();
  s = s.replace(/[=≡]\s*$/, "").trim();
  const parts = s.split(/=/);
  if (parts.length > 1) s = parts[0].trim();
  return s;
}

/** Cell calculator: returns the solved value as text when `raw` is a solvable
 *  arithmetic expression, else null (plain numbers and text are left alone). */
export function tryEvaluate(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const body = stripAssignment(s);
  if (!body) return null;
  if (!s.startsWith("=") && isPlainNumber(body)) return null;
  // Must contain at least one operator/function to count as a calculation.
  if (!/[+\-−*/^×÷√²³()]/.test(body)) return null;
  const r = evaluate(body);
  return r.ok ? formatNumber(r.value) : null;
}

/** Numeric value of a cell for summation. Empty/text cells → null. */
export function cellNumber(raw: string): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const body = stripAssignment(s);
  if (!body) return null;
  if (isPlainNumber(body)) return Number(body.replace(/−/g, "-"));
  const r = evaluate(body);
  return r.ok && Number.isFinite(r.value) ? r.value : null;
}

