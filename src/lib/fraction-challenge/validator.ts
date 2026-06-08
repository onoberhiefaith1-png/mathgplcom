// Fraction Challenge — dedicated validator.
// Parses a MathBoard Node[] into a single canonical reduced fraction.
// Supports: integers, decimals, frac{num/den}, mixed{whole num/den},
// implicit mixed ("5" followed by frac → 5 + n/d), inline brackets,
// leading +/-, chained + and -. Multiplication/division between terms
// is intentionally ignored (out of scope for v1 add/sub fractions).

import { Node } from "@/lib/mathboard/tokens";

export interface Frac { n: number; d: number } // d > 0; sign in n; reduced

const gcd = (a: number, b: number): number => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};

export const reduce = (f: Frac): Frac => {
  if (f.d === 0) return f;
  if (f.d < 0) { f = { n: -f.n, d: -f.d }; }
  const g = gcd(Math.abs(f.n), f.d);
  return { n: f.n / g, d: f.d / g };
};

const add = (a: Frac, b: Frac): Frac => reduce({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const mul = (a: Frac, b: Frac): Frac => reduce({ n: a.n * b.n, d: a.d * b.d });
const div = (a: Frac, b: Frac): Frac | null => b.n === 0 ? null : reduce({ n: a.n * b.d, d: a.d * b.n });
const neg = (a: Frac): Frac => ({ n: -a.n, d: a.d });

const isAddOp = (n: Node | undefined): boolean =>
  !!n && n.kind === "op" && (n.op === "+" || n.op === "-");

const isMulOp = (n: Node | undefined): boolean =>
  !!n && n.kind === "op" && (n.op === "*" || n.op === "/" || n.op === "·");

interface ParseResult { value: Frac; next: number }

const readIntegerRun = (nodes: Node[], i: number): { val: number; next: number } | null => {
  if (i >= nodes.length || nodes[i].kind !== "num") return null;
  let s = "";
  let j = i;
  while (j < nodes.length && nodes[j].kind === "num") {
    s += (nodes[j] as any).value;
    j++;
  }
  // also allow trailing ".xxx" via op "."
  if (j < nodes.length && nodes[j].kind === "op" && (nodes[j] as any).op === ".") {
    s += ".";
    j++;
    while (j < nodes.length && nodes[j].kind === "num") {
      s += (nodes[j] as any).value;
      j++;
    }
  }
  const v = Number(s);
  if (!isFinite(v)) return null;
  return { val: v, next: j };
};

const numberToFrac = (v: number): Frac => {
  if (Number.isInteger(v)) return { n: v, d: 1 };
  // limited-precision decimal → fraction
  const s = String(v);
  const dot = s.indexOf(".");
  if (dot < 0) return { n: Math.round(v), d: 1 };
  const decimals = s.length - dot - 1;
  const den = Math.pow(10, decimals);
  return reduce({ n: Math.round(v * den), d: den });
};

const parseTerm = (nodes: Node[], i: number): ParseResult | null => {
  const n = nodes[i];
  if (!n) return null;

  if (n.kind === "bracket") {
    const v = parseExpr((n as any).body);
    if (!v) return null;
    return { value: v, next: i + 1 };
  }

  if (n.kind === "frac") {
    const num = parseExpr((n as any).num);
    const den = parseExpr((n as any).den);
    if (!num || !den) return null;
    const v = div(num, den);
    if (!v) return null;
    return { value: v, next: i + 1 };
  }

  if (n.kind === "mixed") {
    const w = parseExpr((n as any).whole);
    const nn = parseExpr((n as any).num);
    const dd = parseExpr((n as any).den);
    if (!w || !nn || !dd) return null;
    const frac = div(nn, dd);
    if (!frac) return null;
    // sign from whole
    const sign = w.n < 0 ? -1 : 1;
    return { value: add(w, sign < 0 ? neg(frac) : frac), next: i + 1 };
  }

  if (n.kind === "num") {
    const intRun = readIntegerRun(nodes, i);
    if (!intRun) return null;
    let value = numberToFrac(intRun.val);
    let next = intRun.next;
    // implicit mixed: integer immediately followed by frac (no op between) = whole + n/d
    if (
      next < nodes.length &&
      nodes[next].kind === "frac" &&
      Number.isInteger(intRun.val)
    ) {
      const fr = nodes[next] as any;
      const fnum = parseExpr(fr.num);
      const fden = parseExpr(fr.den);
      if (fnum && fden) {
        const fracPart = div(fnum, fden);
        if (fracPart) {
          const sign = value.n < 0 ? -1 : 1;
          value = add(value, sign < 0 ? neg(fracPart) : fracPart);
          next++;
        }
      }
    }
    return { value, next };
  }

  return null;
};

const parseProduct = (nodes: Node[], i: number): ParseResult | null => {
  const first = parseTerm(nodes, i);
  if (!first) return null;
  let value = first.value;
  let next = first.next;
  while (next < nodes.length && isMulOp(nodes[next])) {
    const op = (nodes[next] as any).op as "*" | "/" | "·";
    next++;
    const t = parseTerm(nodes, next);
    if (!t) return null;
    if (op === "/") {
      const v = div(value, t.value);
      if (!v) return null;
      value = v;
    } else {
      value = mul(value, t.value);
    }
    next = t.next;
  }
  return { value, next };
};

export const parseExpr = (nodes: Node[]): Frac | null => {
  if (!nodes || nodes.length === 0) return null;
  let i = 0;
  let sign = 1;
  while (i < nodes.length && isAddOp(nodes[i])) {
    if ((nodes[i] as any).op === "-") sign = -sign;
    i++;
  }
  const first = parseProduct(nodes, i);
  if (!first) return null;
  let total: Frac = sign < 0 ? neg(first.value) : first.value;
  i = first.next;
  while (i < nodes.length) {
    if (!isAddOp(nodes[i])) return null;
    let s = 1;
    while (i < nodes.length && isAddOp(nodes[i])) {
      if ((nodes[i] as any).op === "-") s = -s;
      i++;
    }
    const t = parseProduct(nodes, i);
    if (!t) return null;
    total = add(total, s < 0 ? neg(t.value) : t.value);
    i = t.next;
  }
  return reduce(total);
};

/** True if the row is a single canonical term equal to the question:
 *  - single integer, OR
 *  - single frac with gcd(num,den)=1 and 0 < |num| < den, OR
 *  - single mixed with gcd=1 in the fractional part and |num| < den. */
export const isSingleCanonical = (nodes: Node[], expected: Frac): boolean => {
  if (!nodes || nodes.length === 0) return false;
  let i = 0;
  let sign = 1;
  while (i < nodes.length && isAddOp(nodes[i])) {
    if ((nodes[i] as any).op === "-") sign = -sign;
    i++;
  }
  const remaining = nodes.slice(i);
  if (remaining.length === 0) return false;

  // Single integer (possibly multi-digit)
  if (remaining.every((n) => n.kind === "num")) {
    const v = Number(remaining.map((n: any) => n.value).join(""));
    if (!isFinite(v)) return false;
    const f = reduce({ n: sign * v, d: 1 });
    return f.n === expected.n && f.d === expected.d;
  }

  if (remaining.length === 1) {
    const n: any = remaining[0];
    if (n.kind === "frac") {
      const num = parseExpr(n.num);
      const den = parseExpr(n.den);
      if (!num || !den || den.d !== 1 || num.d !== 1) return false;
      if (den.n <= 0) return false;
      if (num.n === 0) return expected.n === 0;
      if (Math.abs(num.n) >= den.n) return false; // not reduced beyond proper
      if (gcd(Math.abs(num.n), den.n) !== 1) return false;
      const f = reduce({ n: sign * num.n, d: den.n });
      return f.n === expected.n && f.d === expected.d;
    }
    if (n.kind === "mixed") {
      const w = parseExpr(n.whole);
      const nn = parseExpr(n.num);
      const dd = parseExpr(n.den);
      if (!w || !nn || !dd || w.d !== 1 || nn.d !== 1 || dd.d !== 1) return false;
      if (w.n <= 0) return false;
      if (dd.n <= 0 || nn.n <= 0 || nn.n >= dd.n) return false;
      if (gcd(nn.n, dd.n) !== 1) return false;
      const f = add({ n: sign * w.n, d: 1 }, { n: sign * nn.n, d: dd.n });
      return f.n === expected.n && f.d === expected.d;
    }
  }
  return false;
};

export type ValidationStatus = "final" | "equivalent" | "invalid" | "unparseable";

export interface ValidationResult {
  status: ValidationStatus;
  studentValue: Frac | null;
  expected: Frac | null;
}

export const validateRow = (
  studentNodes: Node[],
  questionNodes: Node[],
): ValidationResult => {
  const expected = parseExpr(questionNodes);
  const student = parseExpr(studentNodes);
  if (!expected) return { status: "unparseable", studentValue: null, expected: null };
  if (!student) return { status: "unparseable", studentValue: null, expected };
  const equal =
    reduce(student).n === reduce(expected).n &&
    reduce(student).d === reduce(expected).d;
  if (!equal) return { status: "invalid", studentValue: student, expected };
  if (isSingleCanonical(studentNodes, expected)) {
    return { status: "final", studentValue: student, expected };
  }
  return { status: "equivalent", studentValue: student, expected };
};
