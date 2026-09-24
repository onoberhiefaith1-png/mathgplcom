// Structured maths reader + numeric equivalence.
// Reads stored (\frac, \sqrt, ^{}), typed (3x/3, √(x+2), x²) and chip input
// into a tree, reports whether the structure is complete, and proves line
// equivalence by evaluating the tree — never by comparing text.
import { normEq } from "@/lib/smartboard/rowAscii";

export type Ast =
  | { k: "num"; v: number }
  | { k: "var"; n: string }
  | { k: "const"; n: "pi" | "e" }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Ast; b: Ast }
  | { k: "neg"; a: Ast }
  | { k: "fn"; n: string; a: Ast; idx?: Ast }
  | { k: "abs"; a: Ast };

export type Relation = "=" | "<" | ">" | "<=" | ">=" | "!=";
export type StructureState = "valid" | "incomplete" | "invalid";

export interface ParsedLine {
  state: StructureState;
  /** Plain-words reason for an incomplete structure. */
  missing?: string;
  sides: Ast[];
  relations: Relation[];
}

const FNS = ["sqrt", "cbrt", "sin", "cos", "tan", "log", "ln", "exp", "root"];

/** Read a balanced {...} group starting at `i` (which must be "{"). */
const braceGroup = (s: string, i: number): [string, number] | null => {
  if (s[i] !== "{") return null;
  let d = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") d++;
    else if (s[j] === "}" && --d === 0) return [s.slice(i + 1, j), j + 1];
  }
  return null;
};

/** \frac{a}{b} → ((a)/(b)), handling any nesting depth. */
const expandFracs = (src: string): string => {
  let s = src;
  for (let guard = 0; guard < 50; guard++) {
    const at = s.search(/\\[dt]?frac\s*\{/);
    if (at < 0) return s;
    const open = s.indexOf("{", at);
    const num = braceGroup(s, open);
    if (!num) return s;
    let k = num[1];
    while (s[k] === " ") k++;
    const den = braceGroup(s, k);
    if (!den) return s;
    s = s.slice(0, at) + "((" + num[0] + ")/(" + den[0] + "))" + s.slice(den[1]);
  }
  return s;
};

/** Convert every supported notation into one plain linear form. */
export const linearize = (raw: string): string => {
  let s = String(raw ?? "");
  s = s.replace(/\\left|\\right/g, "").replace(/\\[,;!: ]/g, "");
  s = s.replace(/\\pm\b/g, "±").replace(/\\mp\b/g, "∓").replace(/\+-|\+\/-/g, "±");
  s = expandFracs(s);
  // Juxtaposed brackets are multiplication: 4(5) → 4*(5), (5)(-4) → (5)*(-4).
  // Must happen before normEq strips "(5)" → "5" (which made 4(5) read as 45).
  s = s.replace(/(\d|\))\s*\(/g, "$1*(");
  s = s.replace(/\\(le|leq)\b/g, "<=").replace(/\\(ge|geq)\b/g, ">=").replace(/\\(ne|neq)\b/g, "!=");
  s = s.replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/≠/g, "!=");
  s = s.replace(/\\sqrt\[([^\]]*)\]\{/g, "root#$1#(").replace(/\\sqrt\{/g, "sqrt(");
  s = s.replace(/∛/g, "cbrt").replace(/∜/g, "root#4#").replace(/\\pi\b|π/g, "pi");
  s = s.replace(/\\(sin|cos|tan|log|ln)\b/g, "$1");
  s = s.replace(/\\(cdot|times)/g, "*").replace(/\\div/g, "/");
  // normEq handles \frac{a}{b}, superscripts, −, ×, ÷, √ and whitespace.
  s = normEq(s);
  s = s.replace(/[{}]/g, (c) => (c === "{" ? "(" : ")"));
  s = s.replace(/root#([^#]*)#/g, "root($1)");
  return s;
};

class P {
  i = 0;
  constructor(private s: string) {}
  peek() { return this.s[this.i]; }
  eat(c: string) { if (this.s.startsWith(c, this.i)) { this.i += c.length; return true; } return false; }
  end() { return this.i >= this.s.length; }
  expr(): Ast {
    let a = this.term();
    for (;;) {
      if (this.eat("+")) a = { k: "bin", op: "+", a, b: this.term() };
      else if (this.peek() === "-" ) { this.i++; a = { k: "bin", op: "-", a, b: this.term() }; }
      else return a;
    }
  }
  term(): Ast {
    let a = this.unary();
    for (;;) {
      if (this.eat("*")) a = { k: "bin", op: "*", a, b: this.unary() };
      else if (this.eat("/")) a = { k: "bin", op: "/", a, b: this.unary() };
      else if (!this.end() && /[a-z0-9(|.]/.test(this.peek()) && !this.atClosingBar())
        a = { k: "bin", op: "*", a, b: this.power() };
      else return a;
    }
  }
  bars = 0;
  atClosingBar() { return this.peek() === "|" && this.bars > 0; }
  unary(): Ast {
    if (this.eat("-")) return { k: "neg", a: this.unary() };
    if (this.eat("+")) return this.unary();
    return this.power();
  }
  power(): Ast {
    const base = this.atom();
    if (this.eat("^")) return { k: "bin", op: "^", a: base, b: this.unary() };
    return base;
  }
  atom(): Ast {
    if (this.end()) throw new Incomplete("finish the expression");
    const c = this.peek();
    if (this.eat("(")) {
      if (this.end()) throw new Incomplete("close the bracket");
      const e = this.expr();
      if (!this.eat(")")) throw new Incomplete("close the bracket");
      return e;
    }
    if (c === "|") {
      this.i++; this.bars++;
      const e = this.expr();
      this.bars--;
      if (!this.eat("|")) throw new Incomplete("close the absolute value");
      return { k: "abs", a: e };
    }
    const num = /^\d+(\.\d+)?/.exec(this.s.slice(this.i));
    if (num) { this.i += num[0].length; return { k: "num", v: parseFloat(num[0]) }; }
    for (const f of FNS) {
      if (this.s.startsWith(f, this.i)) {
        this.i += f.length;
        if (f === "root") {
          if (!this.eat("(")) throw new Invalid();
          const idx = this.expr();
          if (!this.eat(")")) throw new Incomplete("finish the root");
          if (this.end()) throw new Incomplete("finish the root");
          return { k: "fn", n: "root", idx, a: this.power() };
        }
        if (this.end()) throw new Incomplete(f.includes("rt") ? "finish the root" : "finish the function");
        return { k: "fn", n: f, a: this.power() };
      }
    }
    if (this.s.startsWith("pi", this.i)) { this.i += 2; return { k: "const", n: "pi" }; }
    if (/[a-z]/.test(c)) { this.i++; return { k: "var", n: c }; }
    if (c === ")" ) throw new Invalid();
    throw new Invalid();
  }
}
class Incomplete { constructor(public why: string) {} }
class Invalid {}

const REL = /(<=|>=|!=|=|<|>)/;

export const parseLine = (raw: string): ParsedLine => {
  const src = String(raw ?? "");
  // A stored fraction with an empty slot is an unfinished structure.
  if (/\\frac\s*\{\s*\}|\\frac\s*\{[^{}]*\}\s*\{\s*\}|\\frac\s*$|\\sqrt\s*\{\s*\}|\\sl\{\}|□/.test(src))
    return { state: "incomplete", missing: /sqrt/.test(src) ? "finish the root" : "finish the fraction", sides: [], relations: [] };
  const opens = (src.match(/\{/g) ?? []).length, closes = (src.match(/\}/g) ?? []).length;
  if (opens > closes) return { state: "incomplete", missing: "finish the structure", sides: [], relations: [] };
  const lin = linearize(src);
  if (/[±∓]/.test(lin)) {
    // ± is two lines at once: both branches must be well-formed.
    const plus = parseLine(lin.replace(/±/g, "+").replace(/∓/g, "-"));
    const minus = parseLine(lin.replace(/±/g, "-").replace(/∓/g, "+"));
    return plus.state !== "valid" ? plus : minus.state !== "valid" ? minus : plus;
  }
  if (!lin) return { state: "incomplete", missing: "start writing", sides: [], relations: [] };
  const parts = lin.split(REL);
  const sides: Ast[] = [];
  const relations: Relation[] = [];
  try {
    for (let j = 0; j < parts.length; j++) {
      if (j % 2 === 1) { relations.push(parts[j] as Relation); continue; }
      const txt = parts[j];
      if (!txt) throw new Incomplete(j === parts.length - 1 ? "complete the other side" : "write the left side");
      if (/[+\-*/^]$/.test(txt)) throw new Incomplete("finish the expression");
      const p = new P(txt);
      const ast = p.expr();
      if (!p.end()) {
        if (p.peek() === ")") throw new Invalid();
        throw new Invalid();
      }
      sides.push(ast);
    }
  } catch (e) {
    if (e instanceof Incomplete) return { state: "incomplete", missing: e.why, sides: [], relations: [] };
    return { state: "invalid", sides: [], relations: [] };
  }
  return { state: "valid", sides, relations };
};

const evalAst = (a: Ast, env: Record<string, number>): number => {
  switch (a.k) {
    case "num": return a.v;
    case "var": return env[a.n] ?? (env[a.n] = 0.37 + a.n.charCodeAt(0) * 0.013);
    case "const": return a.n === "pi" ? Math.PI : Math.E;
    case "neg": return -evalAst(a.a, env);
    case "abs": return Math.abs(evalAst(a.a, env));
    case "bin": {
      const x = evalAst(a.a, env), y = evalAst(a.b, env);
      if (a.op === "+") return x + y;
      if (a.op === "-") return x - y;
      if (a.op === "*") return x * y;
      if (a.op === "/") return y === 0 ? NaN : x / y;
      return Math.pow(x, y);
    }
    case "fn": {
      const v = evalAst(a.a, env);
      switch (a.n) {
        case "sqrt": return Math.sqrt(v);
        case "cbrt": return Math.cbrt(v);
        case "root": { const n = evalAst(a.idx!, env); return v < 0 && n % 2 === 1 ? -Math.pow(-v, 1 / n) : Math.pow(v, 1 / n); }
        case "sin": return Math.sin(v);
        case "cos": return Math.cos(v);
        case "tan": return Math.tan(v);
        case "log": return Math.log10(v);
        case "ln": return Math.log(v);
        case "exp": return Math.exp(v);
      }
      return NaN;
    }
  }
};

const vars = (a: Ast, out = new Set<string>()): Set<string> => {
  if (a.k === "var") out.add(a.n);
  else if (a.k === "bin") { vars(a.a, out); vars(a.b, out); }
  else if (a.k === "neg" || a.k === "abs") vars(a.a, out);
  else if (a.k === "fn") { vars(a.a, out); if (a.idx) vars(a.idx, out); }
  return out;
};

const flip: Record<Relation, Relation> = { "=": "=", "!=": "!=", "<": ">", ">": "<", "<=": ">=", ">=": "<=" };

/**
 * Two single-relation lines are equivalent when (lhs−rhs) of one is a constant
 * multiple of the other at every sample point (positive multiple for an
 * inequality, with the sign flipping the relation). Expressions: equal values.
 */
export const structurallyEquivalent = (a: string, b: string): boolean => {
  const la = linearize(a), lb = linearize(b);
  const pmA = /[±∓]/.test(la), pmB = /[±∓]/.test(lb);
  if (pmA || pmB) {
    if (pmA !== pmB) return false;
    const br = (s: string, sign: "+" | "-") =>
      s.replace(/[±∓]/g, (c) => (c === "±" ? sign : sign === "+" ? "-" : "+"));
    return equivCore(br(la, "+"), br(lb, "+")) && equivCore(br(la, "-"), br(lb, "-"));
  }
  return equivCore(a, b);
};

const equivCore = (a: string, b: string): boolean => {
  const A = parseLine(a), B = parseLine(b);
  if (A.state !== "valid" || B.state !== "valid") return false;
  if (A.relations.length !== B.relations.length || A.relations.length > 1) return false;
  const names = new Set([...A.sides.flatMap((s) => [...vars(s)]), ...B.sides.flatMap((s) => [...vars(s)])]);
  const diff = (L: ParsedLine, env: Record<string, number>) =>
    L.sides.length === 1 ? evalAst(L.sides[0], env) : evalAst(L.sides[0], env) - evalAst(L.sides[1], env);
  let ratio: number | null = null;
  let good = 0;
  for (let t = 0; t < 12; t++) {
    const env: Record<string, number> = {};
    let k = 0;
    for (const n of names) env[n] = 0.61 + ((t * 7 + k * 3) % 11) * 0.437 + k * 0.19, k++;
    const x = diff(A, env), y = diff(B, env);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    good++;
    const tol = 1e-7 * Math.max(1, Math.abs(x), Math.abs(y));
    if (A.relations.length === 0) { if (Math.abs(x - y) > tol) return false; continue; }
    if (Math.abs(x) < tol && Math.abs(y) < tol) continue;
    if (Math.abs(x) < tol || Math.abs(y) < tol) return false;
    const r = x / y;
    if (ratio === null) ratio = r;
    else if (Math.abs(r - ratio) > 1e-6 * Math.max(1, Math.abs(ratio))) return false;
  }
  if (good < 3) return false;
  if (A.relations.length === 1) {
    const ra = A.relations[0], rb = B.relations[0];
    if (ratio === null) return ra === rb || (ra === "=" && rb === "=");
    if (ra === "=" || ra === "!=") return ra === rb;
    return ratio > 0 ? ra === rb : ra === flip[rb];
  }
  return true;
};
