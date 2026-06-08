// Canonical-form normalizer for linear equations.
// Parses an ASCII expression like "5x + 7 = 17" or "5x = 17 - 7" and reduces
// it to a canonical (a*x + b = 0) pair as exact integer fractions.
//
// Used by lineValidator for true symbolic equivalence and by the generator
// to compute solving paths without depending on the wider mathboard engine.

export interface Frac { n: number; d: number; }

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const F = (n: number, d = 1): Frac => {
  if (d === 0) return { n: NaN, d: 1 };
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), Math.abs(d)) || 1;
  return { n: n / g, d: d / g };
};
const fAdd = (a: Frac, b: Frac) => F(a.n * b.d + b.n * a.d, a.d * b.d);
const fSub = (a: Frac, b: Frac) => F(a.n * b.d - b.n * a.d, a.d * b.d);
const fMul = (a: Frac, b: Frac) => F(a.n * b.n, a.d * b.d);
const fDiv = (a: Frac, b: Frac) => F(a.n * b.d, a.d * b.n);
const fEq  = (a: Frac, b: Frac) => a.n * b.d === b.n * a.d;
const fNeg = (a: Frac): Frac => F(-a.n, a.d);
const fZero = (a: Frac) => a.n === 0;

/** Linear polynomial in x: a*x + b. */
export interface Lin { a: Frac; b: Frac; }
const L = (a: Frac, b: Frac): Lin => ({ a, b });
const Lzero: Lin = { a: F(0), b: F(0) };
const linAdd = (x: Lin, y: Lin) => L(fAdd(x.a, y.a), fAdd(x.b, y.b));
const linSub = (x: Lin, y: Lin) => L(fSub(x.a, y.a), fSub(x.b, y.b));
const linNeg = (x: Lin) => L(fNeg(x.a), fNeg(x.b));
const linMul = (x: Lin, y: Lin): Lin | null => {
  // Linear * linear must collapse to linear (one side has a=0).
  if (fZero(x.a)) return L(fMul(y.a, x.b), fMul(y.b, x.b));
  if (fZero(y.a)) return L(fMul(x.a, y.b), fMul(x.b, y.b));
  return null; // would be quadratic
};
const linDiv = (x: Lin, y: Lin): Lin | null => {
  if (!fZero(y.a)) return null; // dividing by something with x — not supported
  if (fZero(y.b)) return null;
  return L(fDiv(x.a, y.b), fDiv(x.b, y.b));
};

// ---------- Tokenizer ----------
type Tok =
  | { k: "num"; v: Frac }
  | { k: "x" }
  | { k: "op"; op: "+" | "-" | "*" | "/" }
  | { k: "lp" } | { k: "rp" }
  | { k: "eq" };

const tokenize = (raw: string): Tok[] | null => {
  const s = raw
    .replace(/÷/g, "/")
    .replace(/×/g, "*")
    .replace(/−/g, "-")
    .replace(/\s+/g, "");
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c >= "0" && c <= "9") {
      let j = i;
      while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
      const numStr = s.slice(i, j);
      if (numStr.includes(".")) {
        // turn decimal into fraction
        const [whole, frac = ""] = numStr.split(".");
        const denom = Math.pow(10, frac.length);
        out.push({ k: "num", v: F(Number(whole + frac), denom) });
      } else {
        out.push({ k: "num", v: F(Number(numStr)) });
      }
      i = j;
    } else if (c === "x" || c === "X") {
      out.push({ k: "x" });
      i++;
    } else if (c === "+" || c === "-" || c === "*" || c === "/") {
      out.push({ k: "op", op: c });
      i++;
    } else if (c === "(") { out.push({ k: "lp" }); i++; }
    else if (c === ")") { out.push({ k: "rp" }); i++; }
    else if (c === "=") { out.push({ k: "eq" }); i++; }
    else return null; // unknown char
  }
  return out;
};

// Insert implicit multiplication: number followed by x or '(', x followed by '('.
const withImplicitMul = (toks: Tok[]): Tok[] => {
  const out: Tok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    out.push(t);
    const n = toks[i + 1];
    if (!n) continue;
    const aIsValue = t.k === "num" || t.k === "x" || t.k === "rp";
    const bIsValue = n.k === "num" || n.k === "x" || n.k === "lp";
    if (aIsValue && bIsValue) out.push({ k: "op", op: "*" });
  }
  return out;
};

// ---------- Pratt parser → Lin ----------
class Parser {
  i = 0;
  constructor(public toks: Tok[]) {}
  peek() { return this.toks[this.i]; }
  eat() { return this.toks[this.i++]; }
  parseExpr(prec = 0): Lin | null {
    let left = this.parseUnary();
    if (!left) return null;
    while (true) {
      const t = this.peek();
      if (!t || t.k !== "op") break;
      const p = (t.op === "+" || t.op === "-") ? 1 : 2;
      if (p < prec) break;
      this.eat();
      const right = this.parseExpr(p + 1);
      if (!right) return null;
      if (t.op === "+") left = linAdd(left, right);
      else if (t.op === "-") left = linSub(left, right);
      else if (t.op === "*") { const r = linMul(left, right); if (!r) return null; left = r; }
      else if (t.op === "/") { const r = linDiv(left, right); if (!r) return null; left = r; }
    }
    return left;
  }
  parseUnary(): Lin | null {
    const t = this.peek();
    if (!t) return null;
    if (t.k === "op" && (t.op === "+" || t.op === "-")) {
      this.eat();
      const inner = this.parseUnary();
      if (!inner) return null;
      return t.op === "-" ? linNeg(inner) : inner;
    }
    return this.parseAtom();
  }
  parseAtom(): Lin | null {
    const t = this.eat();
    if (!t) return null;
    if (t.k === "num") return L(F(0), t.v);
    if (t.k === "x")   return L(F(1), F(0));
    if (t.k === "lp") {
      const e = this.parseExpr(0);
      if (!e) return null;
      const r = this.eat();
      if (!r || r.k !== "rp") return null;
      return e;
    }
    return null;
  }
}

/** Parse one side of an equation ascii into a linear form (a*x + b). */
export const parseLin = (ascii: string): Lin | null => {
  const toks = tokenize(ascii);
  if (!toks) return null;
  return parseSide(toks);
};

const parseSide = (toks: Tok[]): Lin | null => {
  if (!toks.length) return null;
  const p = new Parser(withImplicitMul(toks));
  const r = p.parseExpr(0);
  if (!r) return null;
  if (p.i !== p.toks.length) return null;
  return r;
};

// ---------- Public API ----------
export interface Canonical {
  a: Frac;   // coefficient of x in (lhs - rhs)
  b: Frac;   // constant in (lhs - rhs)
}

/** Parse "ax+b=cx+d" (ascii) into canonical (a*x + b = 0). null if parse fails. */
export const canonical = (ascii: string): Canonical | null => {
  const toks = tokenize(ascii);
  if (!toks) return null;
  const eqIdx = toks.findIndex((t) => t.k === "eq");
  if (eqIdx < 0) return null;
  const lhs = parseSide(toks.slice(0, eqIdx));
  const rhs = parseSide(toks.slice(eqIdx + 1));
  if (!lhs || !rhs) return null;
  const diff = linSub(lhs, rhs);
  return { a: diff.a, b: diff.b };
};

/** Equation is degenerate identity / has no x — useful for guarding. */
export const isLinearWithX = (c: Canonical) => !fZero(c.a);

/** Equivalence after normalizing sign (so 5x-10=0 and -5x+10=0 match). */
export const canonicalEqual = (a: Canonical, b: Canonical): boolean => {
  // If both have a=0, compare b directly (constant equations).
  if (fZero(a.a) && fZero(b.a)) return fEq(a.b, b.b);
  if (fZero(a.a) || fZero(b.a)) return false;
  // Compare ratios a/b: cross-multiplied (a1*a2_b - a2*a1_b ... normalize via division)
  // Simpler: divide each by its 'a' so x coefficient becomes 1.
  const an = fDiv(a.a, a.a); const bnA = fDiv(a.b, a.a);
  const an2 = fDiv(b.a, b.a); const bnB = fDiv(b.b, b.a);
  void an; void an2;
  return fEq(bnA, bnB);
};

/** Solve a*x + b = 0 → x = -b/a. Returns null if unsolvable / no x. */
export const solveX = (c: Canonical): Frac | null => {
  if (fZero(c.a)) return null;
  return fDiv(fNeg(c.b), c.a);
};

export const fracToString = (f: Frac): string =>
  f.d === 1 ? String(f.n) : `${f.n}/${f.d}`;

export const isInteger = (f: Frac) => f.d === 1;
