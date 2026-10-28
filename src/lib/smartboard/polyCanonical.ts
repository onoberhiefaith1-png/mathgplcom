// Polynomial canonicaliser for arbitrary-degree equations in one or more
// variables. Used by the Smartboard line-status rail to recognise
// mathematically equivalent equations even when the teacher reorders
// terms or shuffles sides (e.g. "5 − 10x + 3x² = 0" ≡ "3x² − 10x + 5 = 0").
//
// Returns a map { signature → rational coefficient } representing the
// fully reduced polynomial `(lhs − rhs)`. Two equations are equivalent
// when their maps are equal up to an overall ±1 multiplier.

type Frac = { n: number; d: number };

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const F = (n: number, d = 1): Frac => {
  if (d === 0) return { n: NaN, d: 1 };
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), Math.abs(d)) || 1;
  return { n: n / g, d: d / g };
};
const fAdd = (a: Frac, b: Frac) => F(a.n * b.d + b.n * a.d, a.d * b.d);
const fNeg = (a: Frac): Frac => F(-a.n, a.d);
const fMul = (a: Frac, b: Frac) => F(a.n * b.n, a.d * b.d);
const fDiv = (a: Frac, b: Frac): Frac | null => (b.n === 0 ? null : F(a.n * b.d, a.d * b.n));
const fZero = (a: Frac) => a.n === 0;
const fEq = (a: Frac, b: Frac) => a.n * b.d === b.n * a.d;

/** A polynomial term: rational coefficient × product of variable powers. */
interface Term { c: Frac; v: Map<string, number>; }
type Poly = Term[];

const sigOf = (v: Map<string, number>): string =>
  [...v.entries()]
    .filter(([, e]) => e !== 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, e]) => `${k}^${e}`)
    .join("*");

const reduce = (p: Poly): Map<string, Frac> => {
  const m = new Map<string, Frac>();
  for (const t of p) {
    if (fZero(t.c)) continue;
    const k = sigOf(t.v);
    const cur = m.get(k);
    const next = cur ? fAdd(cur, t.c) : t.c;
    if (fZero(next)) m.delete(k);
    else m.set(k, next);
  }
  return m;
};

const polyNum = (n: Frac): Poly => [{ c: n, v: new Map() }];
const polyVar = (name: string): Poly => [{ c: F(1), v: new Map([[name, 1]]) }];
const polyAdd = (a: Poly, b: Poly): Poly => a.concat(b);
const polyNeg = (a: Poly): Poly => a.map((t) => ({ c: fNeg(t.c), v: t.v }));
const polySub = (a: Poly, b: Poly): Poly => polyAdd(a, polyNeg(b));
const polyMul = (a: Poly, b: Poly): Poly => {
  const out: Poly = [];
  for (const x of a) for (const y of b) {
    const v = new Map(x.v);
    for (const [k, e] of y.v) v.set(k, (v.get(k) ?? 0) + e);
    out.push({ c: fMul(x.c, y.c), v });
  }
  return out;
};
const polyPow = (a: Poly, n: number): Poly | null => {
  if (!Number.isInteger(n) || n < 0 || n > 8) return null;
  if (n === 0) return polyNum(F(1));
  let r = a;
  for (let i = 1; i < n; i++) r = polyMul(r, a);
  return r;
};
/** Division only when divisor is a non-zero constant polynomial. */
const polyDiv = (a: Poly, b: Poly): Poly | null => {
  const red = reduce(b);
  if (red.size > 1) return null;
  if (red.size === 0) return null;
  const [k, c] = [...red.entries()][0];
  if (k !== "") return null;
  const inv = fDiv(F(1), c);
  if (!inv) return null;
  return a.map((t) => ({ c: fMul(t.c, inv), v: t.v }));
};

// ---------- Tokenizer ----------
type Tok =
  | { k: "num"; v: Frac }
  | { k: "var"; n: string }
  | { k: "op"; op: "+" | "-" | "*" | "/" | "^" }
  | { k: "lp" } | { k: "rp" }
  | { k: "eq" };

const SUP: Record<string, string> = {
  "⁰": "0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9",
};
const SUB: Record<string, string> = {
  "₀":"0","₁":"1","₂":"2","₃":"3","₄":"4","₅":"5","₆":"6","₇":"7","₈":"8","₉":"9",
};

const tokenize = (raw: string): Tok[] | null => {
  let s = raw;
  // Unicode fraction-slash U+2044 → plain slash so sup/sub fraction forms
  // (e.g. ¹⁰⁄₃) can be recognised below.
  s = s.replace(/⁄/g, "/");
  // Stacked-fraction unicode pattern: SUP+/SUB+ → (num)/(den). Must run
  // BEFORE the "letter+SUP → letter^N" step or sup digits would be eaten
  // as powers.
  s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\/([₀₁₂₃₄₅₆₇₈₉]+)/g, (_, sup: string, sub: string) => {
    const num = [...sup].map((c) => SUP[c] ?? "").join("");
    const den = [...sub].map((c) => SUB[c] ?? "").join("");
    return `(${num})/(${den})`;
  });
  // Remaining unicode superscripts (powers like x²) → ^N.
  s = s.replace(/([a-zA-Z\)])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, base, sups) => {
    const digs = [...sups].map((c) => SUP[c] ?? "").join("");
    return `${base}^${digs}`;
  });
  // Stray sub digits → normal digits.
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉]+/g, (run) => [...run].map((c) => SUB[c] ?? "").join(""));
  s = s
    .replace(/÷/g, "/")
    .replace(/[×·]/g, "*")
    .replace(/−/g, "-")
    .replace(/\s+/g, "");
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if ((c >= "0" && c <= "9") || c === ".") {
      let j = i;
      while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
      const str = s.slice(i, j);
      if (str.includes(".")) {
        const [w, fr = ""] = str.split(".");
        out.push({ k: "num", v: F(Number(w + fr), Math.pow(10, fr.length)) });
      } else {
        out.push({ k: "num", v: F(Number(str)) });
      }
      i = j;
    } else if (/[a-zA-Z]/.test(c)) {
      out.push({ k: "var", n: c.toLowerCase() });
      i++;
    } else if (c === "+" || c === "-" || c === "*" || c === "/" || c === "^") {
      out.push({ k: "op", op: c });
      i++;
    } else if (c === "(") { out.push({ k: "lp" }); i++; }
    else if (c === ")") { out.push({ k: "rp" }); i++; }
    else if (c === "=") { out.push({ k: "eq" }); i++; }
    else return null;
  }
  return out;
};

const withImplicitMul = (toks: Tok[]): Tok[] => {
  const out: Tok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    out.push(t);
    const n = toks[i + 1];
    if (!n) continue;
    const aIs = t.k === "num" || t.k === "var" || t.k === "rp";
    const bIs = n.k === "num" || n.k === "var" || n.k === "lp";
    if (aIs && bIs) out.push({ k: "op", op: "*" });
  }
  return out;
};

// Precedence: + - = 1, * / = 2, ^ = 3 (right-assoc).
class Parser {
  i = 0;
  constructor(public t: Tok[]) {}
  peek() { return this.t[this.i]; }
  eat() { return this.t[this.i++]; }
  expr(prec = 0): Poly | null {
    let left = this.unary();
    if (!left) return null;
    while (true) {
      const tk = this.peek();
      if (!tk || tk.k !== "op") break;
      const p = tk.op === "^" ? 3 : (tk.op === "*" || tk.op === "/") ? 2 : 1;
      if (p < prec) break;
      this.eat();
      const right = this.expr(tk.op === "^" ? p : p + 1);
      if (!right) return null;
      if (tk.op === "+") left = polyAdd(left, right);
      else if (tk.op === "-") left = polySub(left, right);
      else if (tk.op === "*") left = polyMul(left, right);
      else if (tk.op === "/") { const r = polyDiv(left, right); if (!r) return null; left = r; }
      else if (tk.op === "^") {
        // Right side must reduce to an integer constant.
        const red = reduce(right);
        if (red.size !== 1) return null;
        const [k, c] = [...red.entries()][0];
        if (k !== "" || c.d !== 1) return null;
        const r = polyPow(left, c.n);
        if (!r) return null;
        left = r;
      }
    }
    return left;
  }
  unary(): Poly | null {
    const tk = this.peek();
    if (!tk) return null;
    if (tk.k === "op" && (tk.op === "+" || tk.op === "-")) {
      this.eat();
      const inner = this.unary();
      if (!inner) return null;
      return tk.op === "-" ? polyNeg(inner) : inner;
    }
    return this.atom();
  }
  atom(): Poly | null {
    const tk = this.eat();
    if (!tk) return null;
    if (tk.k === "num") return polyNum(tk.v);
    if (tk.k === "var") return polyVar(tk.n);
    if (tk.k === "lp") {
      const e = this.expr(0);
      if (!e) return null;
      const r = this.eat();
      if (!r || r.k !== "rp") return null;
      return e;
    }
    return null;
  }
}

const parseSide = (toks: Tok[]): Map<string, Frac> | null => {
  if (!toks.length) return null;
  const p = new Parser(withImplicitMul(toks));
  const r = p.expr(0);
  if (!r) return null;
  if (p.i !== p.t.length) return null;
  return reduce(r);
};

const mapsEqual = (a: Map<string, Frac>, b: Map<string, Frac>): boolean => {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const w = b.get(k);
    if (!w || !fEq(v, w)) return false;
  }
  return true;
};

const negMap = (m: Map<string, Frac>): Map<string, Frac> => {
  const out = new Map<string, Frac>();
  for (const [k, v] of m) out.set(k, fNeg(v));
  return out;
};

/** Canonicalise an equation like `lhs = rhs` into the reduced polynomial
 *  `(lhs − rhs)` as a signature → coefficient map. Returns null when the
 *  input doesn't parse as a polynomial equation we can handle. */
export const polyCanonical = (ascii: string): Map<string, Frac> | null => {
  const toks = tokenize(ascii);
  if (!toks) return null;
  const eqIdx = toks.findIndex((t) => t.k === "eq");
  if (eqIdx < 0) return null;
  const lhs = parseSide(toks.slice(0, eqIdx));
  const rhs = parseSide(toks.slice(eqIdx + 1));
  if (!lhs || !rhs) return null;
  // Compute lhs - rhs
  const out = new Map<string, Frac>(lhs);
  for (const [k, v] of rhs) {
    const cur = out.get(k);
    const next = cur ? fAdd(cur, fNeg(v)) : fNeg(v);
    if (fZero(next)) out.delete(k);
    else out.set(k, next);
  }
  return out;
};

/** Two equations are polynomially equivalent when one reduces to ±1 times
 *  the other. Returns false on parse failure. */
export const polyEquivalent = (a: string, b: string): boolean => {
  const pa = polyCanonical(a);
  const pb = polyCanonical(b);
  if (!pa || !pb) return false;
  if (pa.size === 0 && pb.size === 0) return true;
  if (mapsEqual(pa, pb)) return true;
  return mapsEqual(pa, negMap(pb));
};
