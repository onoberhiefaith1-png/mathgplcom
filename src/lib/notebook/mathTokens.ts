// Atomic-structure math tokenizer.
//
// A mathematical STRUCTURE is one object, never a spray of words. A matrix,
// a summation with bounds, an integral, a limit, a fraction, a root, an
// accent or a \left…\right group must arrive at the renderer whole; the old
// "split on spaces at brace depth 0" readers chopped
// `\begin{bmatrix}2 & 1 \\ 3 & 4\end{bmatrix}` into fragments, and a
// fragment with no closing tag degrades into visible raw syntax.
//
// Shared by the Floating Highlighting page, the Floating Numbers page and
// the floating compiler so every surface reads mathematics the same way.

const ENVS = [
  "matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix",
  "smallmatrix", "cases", "aligned", "align", "array",
];

/** Macros whose arguments/bounds belong to the same single object. */
const STRUCTURE_MACROS = [
  "frac", "dfrac", "tfrac", "sqrt", "root", "binom",
  "sum", "prod", "coprod", "int", "iint", "iiint", "oint", "lim", "limsup", "liminf",
  "vec", "hat", "bar", "overline", "underline", "tilde", "dot", "ddot",
  "abs", "norm", "floor", "ceil", "overrightarrow",
];

/** Read a balanced `{…}` (or `[…]`) group starting at `i`; -1 when unbalanced. */
function matchGroup(s: string, i: number, open: "{" | "[" = "{"): number {
  const close = open === "{" ? "}" : "]";
  if (s[i] !== open) return -1;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === open) depth++;
    else if (s[j] === close) {
      depth--;
      if (depth === 0) return j + 1;
    }
  }
  return -1;
}

/** Consume `_{…}` / `^{…}` / `_x` / `^x` scripts sitting after a structure. */
function eatScripts(s: string, i: number): number {
  let j = i;
  for (;;) {
    if (s[j] !== "_" && s[j] !== "^") return j;
    let k = j + 1;
    if (s[k] === "{") {
      const end = matchGroup(s, k);
      if (end < 0) return j;
      k = end;
    } else if (k < s.length && /[^\s]/.test(s[k])) {
      if (s[k] === "\\") {
        const m = /^\\[A-Za-z]+/.exec(s.slice(k));
        k += m ? m[0].length : 1;
      } else k += 1;
    } else return j;
    j = k;
  }
}

/**
 * If a complete structure starts at `i`, return the index just AFTER it.
 * Returns -1 when nothing structural starts there (or it is incomplete).
 */
export function readStructureAt(s: string, i: number): number {
  if (s[i] !== "\\") return -1;
  const rest = s.slice(i);

  // \begin{env} … \end{env} — one indivisible environment.
  const begin = /^\\begin\s*\{([A-Za-z*]+)\}/.exec(rest);
  if (begin) {
    const env = begin[1];
    if (!ENVS.includes(env.replace(/\*$/, ""))) return -1;
    const endTag = new RegExp(`\\\\end\\s*\\{${env.replace("*", "\\*")}\\}`);
    const m = endTag.exec(rest);
    if (!m) return -1;
    return eatScripts(s, i + m.index + m[0].length);
  }

  // \left … \right — the bracket and its whole content are one object.
  if (/^\\left/.test(rest)) {
    const m = /\\right(?:\\[A-Za-z]+|.)/.exec(rest);
    if (!m) return -1;
    return eatScripts(s, i + m.index + m[0].length);
  }

  const mac = /^\\([A-Za-z]+)/.exec(rest);
  if (!mac) return -1;
  if (!STRUCTURE_MACROS.includes(mac[1])) return -1;

  let j = i + mac[0].length;
  // Bounds first: \sum_{i=1}^{n}, \int_0^1, \lim_{x \to 0}
  j = eatScripts(s, j);
  // Optional root index: \sqrt[3]{x}
  if (s[j] === "[") {
    const end = matchGroup(s, j, "[");
    if (end > 0) j = end;
  }
  // Braced arguments, e.g. \frac{a}{b}, \binom{n}{r}, \vec{AB}
  while (s[j] === "{") {
    const end = matchGroup(s, j);
    if (end < 0) break;
    j = end;
  }
  return eatScripts(s, j);
}

/**
 * Whitespace tokenizer that keeps every complete structure as ONE token.
 * Whitespace inside a structure (matrix cells, `\lim_{x \to 0}` …) never
 * splits it.
 */
export function tokenizeMath(line: string): string[] {
  const src = String(line ?? "");
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  let i = 0;
  while (i < src.length) {
    const jump = readStructureAt(src, i);
    if (jump > i) {
      cur += src.slice(i, jump);
      i = jump;
      continue;
    }
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) {
      if (cur) { out.push(cur); cur = ""; }
    } else {
      cur += ch;
    }
    i++;
  }
  if (cur) out.push(cur);
  return out;
}


/* ------------------------------------------------------------------------
 * Tokenizer v2 — fraction-tolerant and fraction-separable.
 *
 * `tokenizeMath` (v1) is FROZEN: saved highlights store `{line, tok}` indices
 * into its output, so changing its boundaries would silently move every saved
 * highlight. v2 is used only for content whose highlights were saved with
 * `tokVer: 2` (or that has none yet); see `highlightTokVersion` in the
 * Floating Preparation page. Differences from v1, for fractions only:
 *   1. Whitespace inside a fraction is tolerated: `\frac {3}{4}`,
 *      `\frac{3} {4}` and `\frac 3 4` are each ONE token.
 *   2. A fraction glued to an operator is its own token, so it can be
 *      selected: `x=\dfrac{a+b}{2c}` -> `x=` | `\dfrac{a+b}{2c}`, and
 *      `\frac{1}{2}\times\frac{3}{5}` -> three tokens. A sign stays with the
 *      term it belongs to (`+\frac{1}{3}`), a coefficient or mixed-number
 *      whole part stays with its fraction (`2\frac{x}{3}`, `1\frac{1}{2}`),
 *      and nothing splits inside brackets or braces.
 * ---------------------------------------------------------------------- */

export const TOKENIZER_VERSION = 2;

const FRACTION_MACROS = ["frac", "dfrac", "cfrac", "tfrac"];

/** Operator / relation macros that separate a fraction from its neighbours. */
const OPERATOR_MACROS = new Set([
  "times", "div", "cdot", "pm", "mp", "ast", "star", "circ",
  "leq", "le", "geq", "ge", "neq", "ne", "approx", "equiv", "sim", "simeq", "cong", "propto",
  "to", "rightarrow", "leftarrow", "Rightarrow", "Leftarrow", "leftrightarrow", "Leftrightarrow",
  "implies", "iff", "mapsto",
]);

const OPERATOR_CHARS = "=<>×÷*≤≥≠≈≡∼≅·";

/** Read one fraction argument at `i`: a `{…}` group, a macro, or one letter/digit. */
function readFractionArg(s: string, i: number): number {
  if (s[i] === "{") return matchGroup(s, i);
  if (s[i] === "\\") {
    const m = /^\\[A-Za-z]+/.exec(s.slice(i));
    return m ? i + m[0].length : -1;
  }
  return i < s.length && /[0-9A-Za-z]/.test(s[i]) ? i + 1 : -1;
}

/**
 * If a complete fraction (`\frac`, `\dfrac`, `\cfrac`, `\tfrac`) starts at `i`,
 * return the index just after it, tolerating whitespace around its two
 * arguments. -1 when it is incomplete (the caller then reads it as before).
 */
export function readFractionAt(s: string, i: number): number {
  if (s[i] !== "\\") return -1;
  const mac = /^\\([A-Za-z]+)/.exec(s.slice(i, i + 8));
  if (!mac || !FRACTION_MACROS.includes(mac[1])) return -1;
  let j = i + mac[0].length;
  const skipWs = () => { while (j < s.length && /\s/.test(s[j])) j++; };
  skipWs();
  const a = readFractionArg(s, j);
  if (a < 0) return -1;
  j = a;
  skipWs();
  const b = readFractionArg(s, j);
  if (b < 0) return -1;
  return eatScripts(s, b);
}

/** Does the text just before a fraction end with an operator that should separate it? */
function endsWithSeparator(cur: string): "split" | "sign" | null {
  if (!cur) return null;
  const last = cur[cur.length - 1];
  if (last === "+" || last === "-" || last === "−" || last === "±" || last === "∓") {
    // A sign belongs to the fraction after it; anything before the sign splits off.
    return cur.length > 1 ? "sign" : null;
  }
  if (OPERATOR_CHARS.includes(last)) return "split";
  const m = /\\([A-Za-z]+)$/.exec(cur);
  if (m && OPERATOR_MACROS.has(m[1])) return "split";
  return null;
}

/** What follows a fraction at `i`: does it separate (and is the next sign carried over)? */
function startsWithSeparator(s: string, i: number): boolean {
  if (i >= s.length) return false;
  const ch = s[i];
  if (OPERATOR_CHARS.includes(ch) || ch === "+" || ch === "-" || ch === "−" || ch === "±" || ch === "∓") return true;
  const m = /^\\([A-Za-z]+)/.exec(s.slice(i, i + 16));
  return !!(m && OPERATOR_MACROS.has(m[1]));
}

export function tokenizeMathV2(line: string): string[] {
  const src = String(line ?? "");
  const out: string[] = [];
  let cur = "";
  let depth = 0; // braces
  let paren = 0; // ( and [ outside structures
  let i = 0;
  const push = () => { if (cur) { out.push(cur); cur = ""; } };
  while (i < src.length) {
    const frac = readFractionAt(src, i);
    if (frac > i) {
      if (depth === 0 && paren === 0) {
        const sep = endsWithSeparator(cur);
        if (sep === "split") push();
        else if (sep === "sign") {
          const sign = cur[cur.length - 1];
          cur = cur.slice(0, -1);
          push();
          cur = sign;
        }
      }
      cur += src.slice(i, frac);
      i = frac;
      if (depth === 0 && paren === 0 && startsWithSeparator(src, i)) {
        push();
        // A following + / - sign starts the next token (sign law); other
        // operators are read normally and stay with the text after them.
      }
      continue;
    }
    const jump = readStructureAt(src, i);
    if (jump > i) {
      cur += src.slice(i, jump);
      i = jump;
      continue;
    }
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === "(" || ch === "[") paren++;
    else if (ch === ")" || ch === "]") paren = Math.max(0, paren - 1);
    if (/\s/.test(ch) && depth === 0) {
      push();
      paren = 0;
    } else {
      cur += ch;
    }
    i++;
  }
  push();
  return out;
}

/** The tokenizer a saved highlight set was indexed against. */
export function tokenizerFor(version: 1 | 2): (line: string) => string[] {
  return version === 2 ? tokenizeMathV2 : tokenizeMath;
}

export default tokenizeMath;
