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

export default tokenizeMath;
