// Equation → node tree + flat atom list for the Highlight Generation system.
//
// The parser understands LaTeX-style structures (\frac, \sqrt, ^{...}, _{...},
// \left/\right, \cdot, \times, \pi, ...) and turns them into a small node tree
// that the renderer can draw as REAL mathematics (stacked fractions, radicals,
// superscripts). Raw LaTeX commands MUST NEVER reach the screen.
//
// At the same time it exposes a flat list of selectable leaf atoms with stable
// ids. The Highlight Generation engine (highlightEngine.ts) works on that flat
// list — its contract is unchanged.

import { readStructureAt } from "@/lib/notebook/mathTokens";

/** Structures kept whole as ONE atom. `\frac` and `\sqrt` are excluded — the
 *  flat parser already draws them as real stacked/radical mathematics with
 *  individually selectable parts. */
const WHOLE_STRUCTURE = new Set([
  "begin", "left",
  "sum", "prod", "coprod", "int", "iint", "iiint", "oint",
  "lim", "limsup", "liminf", "binom",
  "vec", "hat", "bar", "overline", "underline", "tilde", "dot", "ddot",
  "abs", "norm", "floor", "ceil", "overrightarrow",
]);

/** End index of a whole-structure token starting at `i`, else -1. */
const wholeStructureAt = (s: string, i: number): number => {
  const m = /^\\([A-Za-z]+)/.exec(s.slice(i));
  if (!m || !WHOLE_STRUCTURE.has(m[1])) return -1;
  return readStructureAt(s, i);
};

export type AtomKind =
  | "number"
  | "variable"
  | "operator"
  | "equality"
  | "bracket-open"
  | "bracket-close"
  | "exponent"      // attachment — renders as superscript
  | "subscript"     // attachment — renders as subscript
  | "fraction-bar"  // container marker (the rule between num and den)
  | "root-sign"     // container marker (the √)
  | "function-name"
  | "symbol"
  /** A whole mathematical structure (matrix, Σ/∫/lim with bounds, binom,
   *  accent, \left…\right group) held as ONE indivisible atom. Its `value`
   *  is the source LaTeX; the renderer draws it with `renderMathInline`,
   *  exactly as the Highlighting page does. */
  | "structure";

export interface Atom {
  id: string;
  value: string;
  kind: AtomKind;
  /** True for exponent/subscript — render small + raised/lowered. */
  attachment?: boolean;
}

export type Node =
  | { kind: "leaf"; atom: Atom }
  | { kind: "frac"; bar: Atom; num: Node[]; den: Node[] }
  | { kind: "sqrt"; sign: Atom; radicand: Node[]; degree?: Node[] }
  | { kind: "bracket"; open: Atom; close: Atom; body: Node[] };

/* ───────── Unicode tables ───────── */

const SUP_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼",
  "(": "⁽", ")": "⁾", "n": "ⁿ", "i": "ⁱ",
};
const SUB_MAP: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌",
};
const SUP_CHARS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ";
const SUB_CHARS = "₀₁₂₃₄₅₆₇₈₉₊₋₌";

const toSuperStr = (s: string): string | null => {
  if (!s) return null;
  const out: string[] = [];
  for (const ch of s) {
    const m = SUP_MAP[ch];
    if (!m) return null;
    out.push(m);
  }
  return out.join("");
};
const toSubStr = (s: string): string | null => {
  if (!s) return null;
  const out: string[] = [];
  for (const ch of s) {
    const m = SUB_MAP[ch];
    if (!m) return null;
    out.push(m);
  }
  return out.join("");
};

const CMD_LETTERS: Record<string, [string, AtomKind]> = {
  alpha: ["α", "variable"], beta: ["β", "variable"], gamma: ["γ", "variable"],
  delta: ["δ", "variable"], epsilon: ["ε", "variable"], zeta: ["ζ", "variable"],
  eta: ["η", "variable"], theta: ["θ", "variable"], iota: ["ι", "variable"],
  kappa: ["κ", "variable"], lambda: ["λ", "variable"], mu: ["μ", "variable"],
  nu: ["ν", "variable"], xi: ["ξ", "variable"], pi: ["π", "variable"],
  rho: ["ρ", "variable"], sigma: ["σ", "variable"], tau: ["τ", "variable"],
  upsilon: ["υ", "variable"], phi: ["φ", "variable"], chi: ["χ", "variable"],
  psi: ["ψ", "variable"], omega: ["ω", "variable"],
  Alpha: ["Α", "variable"], Beta: ["Β", "variable"], Gamma: ["Γ", "variable"],
  Delta: ["Δ", "variable"], Theta: ["Θ", "variable"], Lambda: ["Λ", "variable"],
  Pi: ["Π", "variable"], Sigma: ["Σ", "variable"], Phi: ["Φ", "variable"],
  Omega: ["Ω", "variable"],
  infty: ["∞", "symbol"],
};
const CMD_OPS: Record<string, [string, AtomKind]> = {
  cdot: ["·", "operator"], times: ["×", "operator"], div: ["÷", "operator"],
  pm: ["±", "operator"], mp: ["∓", "operator"],
  leq: ["≤", "equality"], geq: ["≥", "equality"], neq: ["≠", "equality"],
  approx: ["≈", "equality"], to: ["→", "operator"],
};
const CMD_FUNCS = new Set([
  "sin", "cos", "tan", "csc", "sec", "cot",
  "arcsin", "arccos", "arctan",
  "log", "ln", "exp", "lim", "max", "min", "gcd", "lcm",
]);
// LaTeX spacing / formatting commands — silently dropped.
const CMD_SKIP = new Set([",", ";", ":", "!", "quad", "qquad", "displaystyle", "textstyle"]);

const isDigit = (c: string) => c >= "0" && c <= "9";
const isAlpha = (c: string) => /[A-Za-z]/.test(c);

/* ───────── Parser ───────── */

class Parser {
  i = 0;
  counter = 0;
  constructor(public s: string, public lineId: string) {}

  atom(value: string, kind: AtomKind, attachment = false): Atom {
    return { id: `${this.lineId}:a${this.counter++}`, value, kind, attachment };
  }

  parseRoot(): Node[] { return this.parseSequence(null); }

  /** stopChars: any single char in this string ends the sequence. */
  parseSequence(stopChars: string | null): Node[] {
    const out: Node[] = [];
    while (this.i < this.s.length) {
      const c = this.s[this.i];
      if (stopChars && stopChars.includes(c)) break;
      if (/\s/.test(c)) { this.i++; continue; }

      if (c === "\\") {
        // A complete structure the flat parser cannot draw (matrix, Σ/∫/lim
        // with bounds, binom, accent, \left…\right) is ONE atom carrying its
        // source LaTeX. Never chop it into characters.
        const end = wholeStructureAt(this.s, this.i);
        if (end > this.i) {
          out.push({ kind: "leaf", atom: this.atom(this.s.slice(this.i, end), "structure") });
          this.i = end;
          continue;
        }
        this.parseCommand(out);
        continue;
      }

      // Stray { → treat the group as a transparent container.
      if (c === "{") {
        this.i++;
        const inner = this.parseSequence("}");
        if (this.s[this.i] === "}") this.i++;
        out.push(...inner);
        continue;
      }
      if (c === "}") { this.i++; continue; }

      // ^ / _ — convert to unicode super/sub when possible, otherwise keep
      // body as a single attachment atom (renders raised/lowered, never as ^).
      if (c === "^" || c === "_") {
        const isExp = c === "^";
        this.i++;
        const body = this.readBraceOrChar();
        const conv = isExp ? toSuperStr(body) : toSubStr(body);
        const val = conv ?? body;
        if (val) {
          out.push({ kind: "leaf", atom: this.atom(val, isExp ? "exponent" : "subscript", true) });
        }
        continue;
      }

      // Unicode superscript / subscript run
      if (SUP_CHARS.includes(c)) {
        let j = this.i;
        while (j < this.s.length && SUP_CHARS.includes(this.s[j])) j++;
        out.push({ kind: "leaf", atom: this.atom(this.s.slice(this.i, j), "exponent", true) });
        this.i = j; continue;
      }
      if (SUB_CHARS.includes(c)) {
        let j = this.i;
        while (j < this.s.length && SUB_CHARS.includes(this.s[j])) j++;
        out.push({ kind: "leaf", atom: this.atom(this.s.slice(this.i, j), "subscript", true) });
        this.i = j; continue;
      }

      // Numbers
      if (isDigit(c) || (c === "." && isDigit(this.s[this.i + 1] ?? ""))) {
        let j = this.i;
        while (j < this.s.length && (isDigit(this.s[j]) || this.s[j] === ".")) j++;
        out.push({ kind: "leaf", atom: this.atom(this.s.slice(this.i, j), "number") });
        this.i = j; continue;
      }

      // Letters (single-letter variables — algebra convention)
      if (isAlpha(c)) {
        out.push({ kind: "leaf", atom: this.atom(c, "variable") });
        this.i++; continue;
      }

      // Brackets — pair them into a single `bracket` node so the highlight
      // engine's Structure Rule can keep them together.
      if (c === "(" || c === "[") {
        const openChar = c;
        const closeChar = openChar === "(" ? ")" : "]";
        const open = this.atom(openChar, "bracket-open");
        this.i++;
        // Append closeChar to current stopChars so nested parsing terminates.
        const innerStop = (stopChars ?? "") + closeChar;
        const body = this.parseSequence(innerStop);
        if (this.s[this.i] === closeChar) {
          const close = this.atom(closeChar, "bracket-close");
          this.i++;
          out.push({ kind: "bracket", open, close, body });
        } else {
          // Unmatched opener — fall back to a plain leaf.
          out.push({ kind: "leaf", atom: open });
          out.push(...body);
        }
        continue;
      }
      if (c === ")" || c === "]") {
        // Unmatched closer at top level — emit as leaf so it's still visible.
        out.push({ kind: "leaf", atom: this.atom(c, "bracket-close") });
        this.i++; continue;
      }

      if (c === "=" || c === "<" || c === ">" || c === "≤" || c === "≥" || c === "≠") {
        out.push({ kind: "leaf", atom: this.atom(c, "equality") });
        this.i++; continue;
      }

      if ("+-−–±×·÷*".includes(c)) {
        const norm =
          c === "*" ? "×" :
          (c === "-" || c === "–") ? "−" :
          c;
        out.push({ kind: "leaf", atom: this.atom(norm, "operator") });
        this.i++; continue;
      }

      if (c === "/") {
        out.push({ kind: "leaf", atom: this.atom("/", "fraction-bar") });
        this.i++; continue;
      }
      if (c === "√") {
        const sign = this.atom("√", "root-sign");
        this.i++;
        const radicand = this.parseGroupOrNext();
        out.push({ kind: "sqrt", sign, radicand });
        continue;
      }

      out.push({ kind: "leaf", atom: this.atom(c, "symbol") });
      this.i++;
    }
    return out;
  }

  readBraceOrChar(): string {
    if (this.s[this.i] === "{") {
      let depth = 0, j = this.i, body = "";
      for (; j < this.s.length; j++) {
        const ch = this.s[j];
        if (ch === "{") { depth++; if (depth === 1) continue; }
        else if (ch === "}") { depth--; if (depth === 0) { j++; break; } }
        body += ch;
      }
      this.i = j;
      return body;
    }
    if (this.i < this.s.length) {
      const c = this.s[this.i]; this.i++; return c;
    }
    return "";
  }

  parseGroup(): Node[] {
    if (this.s[this.i] !== "{") return [];
    this.i++;
    const body = this.parseSequence("}");
    if (this.s[this.i] === "}") this.i++;
    return body;
  }

  /** {…} group OR single next atom — used for bare √x. */
  parseGroupOrNext(): Node[] {
    if (this.s[this.i] === "{") return this.parseGroup();
    const oneChar = this.s[this.i] ?? "";
    if (!oneChar) return [];
    const saved = this.s;
    const before = this.i;
    this.s = oneChar;
    this.i = 0;
    const nodes = this.parseSequence(null);
    this.s = saved;
    this.i = before + 1;
    return nodes;
  }

  parseCommand(out: Node[]) {
    this.i++; // consume backslash
    let name = "";
    while (this.i < this.s.length && /[A-Za-z]/.test(this.s[this.i])) {
      name += this.s[this.i]; this.i++;
    }
    if (!name) {
      const c = this.s[this.i] ?? "";
      if (CMD_SKIP.has(c)) this.i++;
      return;
    }
    if (name === "frac" || name === "dfrac" || name === "tfrac") {
      const num = this.parseGroup();
      const den = this.parseGroup();
      const bar = this.atom("/", "fraction-bar");
      out.push({ kind: "frac", bar, num, den });
      return;
    }
    if (name === "sqrt") {
      let degree: Node[] | undefined;
      if (this.s[this.i] === "[") {
        this.i++;
        degree = this.parseSequence("]");
        if (this.s[this.i] === "]") this.i++;
      }
      const sign = this.atom("√", "root-sign");
      const radicand = this.parseGroup();
      out.push({ kind: "sqrt", sign, radicand, degree });
      return;
    }
    if (name === "left" || name === "right") {
      if (this.s[this.i] === ".") this.i++;
      return;
    }
    if (CMD_OPS[name]) {
      const [v, k] = CMD_OPS[name];
      out.push({ kind: "leaf", atom: this.atom(v, k) });
      return;
    }
    if (CMD_LETTERS[name]) {
      const [v, k] = CMD_LETTERS[name];
      out.push({ kind: "leaf", atom: this.atom(v, k) });
      return;
    }
    if (CMD_FUNCS.has(name)) {
      out.push({ kind: "leaf", atom: this.atom(name, "function-name") });
      return;
    }
    if (CMD_SKIP.has(name)) return;
    return;
  }
}

/* ───────── Public API ───────── */

export const parseNodes = (equation: string, lineId: string): Node[] =>
  new Parser(String(equation ?? ""), lineId).parseRoot();

/** DFS in visual reading order: num, bar, den for fractions; sign, degree,
 *  radicand for roots; open, body, close for brackets. */
export const flattenAtoms = (nodes: Node[]): Atom[] => {
  const out: Atom[] = [];
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.kind === "leaf") out.push(n.atom);
      else if (n.kind === "frac") {
        walk(n.num);
        out.push(n.bar);
        walk(n.den);
      } else if (n.kind === "sqrt") {
        out.push(n.sign);
        if (n.degree) walk(n.degree);
        walk(n.radicand);
      } else if (n.kind === "bracket") {
        out.push(n.open);
        walk(n.body);
        out.push(n.close);
      }
    }
  };
  walk(nodes);
  return out;
};

export const parseAtoms = (equation: string, lineId: string): Atom[] =>
  flattenAtoms(parseNodes(equation, lineId));

export const atomsToText = (atoms: Atom[]): string =>
  atoms.map((a) => a.value).join("");

/** Best-effort: greedily match legacy filler strings against contiguous runs
 *  of atoms so chip→atom hover rings still work for old data. */
export const reconstructAtomIds = (atoms: Atom[], fillers: string[]): string[][] => {
  const out: string[][] = [];
  const strip = (s: string) => s.replace(/\s+/g, "");
  let p = 0;
  for (const f of fillers) {
    const target = strip(f);
    let matched: string[] = [];
    for (let start = p; start < atoms.length; start++) {
      let buf = "";
      const ids: string[] = [];
      for (let j = start; j < atoms.length; j++) {
        buf += atoms[j].value;
        ids.push(atoms[j].id);
        if (strip(buf) === target) { matched = ids; p = j + 1; break; }
        if (strip(buf).length > target.length) break;
      }
      if (matched.length) break;
    }
    out.push(matched);
  }
  return out;
};
