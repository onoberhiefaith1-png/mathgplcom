// Smartboard math-tree (Row) → ASCII flattener + tolerant equation comparator.
// Used by the line-by-line composer to detect when the teacher's handwritten
// line matches the Lesson Note's expected equation for that step.

import type { Node, Row } from "./mathTree";

const matchBalanced = (s: string, start: number, open = "{", close = "}"): number => {
  if (s[start] !== open) return -1;
  let depth = 1;
  for (let i = start + 1; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close) depth--;
    if (depth === 0) return i;
  }
  return -1;
};

const normalizeLatexFractions = (raw: string): string => {
  let s = raw;
  for (let pass = 0; pass < 6; pass++) {
    let out = "";
    let changed = false;
    for (let i = 0; i < s.length;) {
      const m = /^\\(?:d|t)?frac\s*/.exec(s.slice(i));
      if (!m) {
        out += s[i++];
        continue;
      }
      const aStart = i + m[0].length;
      const aEnd = matchBalanced(s, aStart);
      const bStart = aEnd + 1;
      const bEnd = aEnd >= 0 ? matchBalanced(s, bStart) : -1;
      if (aEnd < 0 || bEnd < 0) {
        out += s[i++];
        continue;
      }
      out += `(${s.slice(aStart + 1, aEnd)})/(${s.slice(bStart + 1, bEnd)})`;
      i = bEnd + 1;
      changed = true;
    }
    s = out;
    if (!changed) break;
  }
  return s;
};

const nodeToAscii = (n: Node): string => {
  switch (n.kind) {
    case "char": return n.ch;
    case "frac":
      return `(${rowToAscii(n.rows[0] || [])})/(${rowToAscii(n.rows[1] || [])})`;
    case "sqrt":
      return n.rows.length > 1
        ? `root(${rowToAscii(n.rows[1] || [])},${rowToAscii(n.rows[0] || [])})`
        : `sqrt(${rowToAscii(n.rows[0] || [])})`;
    case "power":
      return `(${rowToAscii(n.rows[0] || [])})^(${rowToAscii(n.rows[1] || [])})`;
    case "sup":   return `^(${rowToAscii(n.rows[0] || [])})`;
    case "sub":   return `_(${rowToAscii(n.rows[0] || [])})`;
    case "subsup":
      return `(${rowToAscii(n.rows[0] || [])})_(${rowToAscii(n.rows[1] || [])})^(${rowToAscii(n.rows[2] || [])})`;
    case "bracket":
      return `${n.left}${rowToAscii(n.rows[0] || [])}${n.right}`;
    case "bigop":
      return `${n.op}(${rowToAscii(n.rows[0] || [])})`;
    case "accent":
      return rowToAscii(n.rows[0] || []);
    case "binom":
      return `binom(${rowToAscii(n.rows[0] || [])},${rowToAscii(n.rows[1] || [])})`;
    case "matrix":
      return `[matrix]`;
  }
};

export const rowToAscii = (row: Row): string => row.map(nodeToAscii).join("");

/** True when a row contains VISIBLE ink: any non-whitespace character or a
 *  structural node (fraction, root, bracket, matrix, …). Rows holding only
 *  spaces — leftovers from typing/erasing — are NOT ink: they must never
 *  count as "the last written row" when the sensor computes where to park,
 *  and they must never claim Lesson-Line ownership. */
export const rowHasVisibleInk = (row: Row): boolean => {
  for (const n of row) {
    if (n.kind === "char") {
      if (n.ch.trim() !== "") return true;
    } else {
      return true; // any structural node is visible ink
    }
  }
  return false;
};

const SUPERSCRIPT_MAP: Record<string, string> = {
  "⁰": "^0", "¹": "^1", "²": "^2", "³": "^3", "⁴": "^4",
  "⁵": "^5", "⁶": "^6", "⁷": "^7", "⁸": "^8", "⁹": "^9",
};

/** Normalise an ASCII equation for tolerant comparison: lowercase, strip
 *  whitespace, unify operator glyphs, drop redundant single-token parens. */
export const normEq = (raw: string): string => {
  let s = normalizeLatexFractions(raw);
  for (const [k, v] of Object.entries(SUPERSCRIPT_MAP)) s = s.split(k).join(v);
  s = s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/−/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/√/g, "sqrt")
    .replace(/\*\*/g, "^");
  // Drop a single leading "+".
  if (s.startsWith("+")) s = s.slice(1);
  // Strip parens around a single alphanumeric token: (b) → b, (12) → 12.
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\(([a-z0-9]+)\)/g, "$1");
  }
  // Strip parens immediately after a caret around a single token: ^(2) → ^2.
  s = s.replace(/\^\(([^()]{1,3})\)/g, "^$1");
  return s;
};

/** Tolerant equation equivalence. Tries strict-normalised, then a looser
 *  paren-stripped pass for cases like (b^2-4ac) vs b^2-4ac. */
export const equationsMatch = (a: string, b: string): boolean => {
  const na = normEq(a);
  const nb = normEq(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const loose = (s: string) => s.replace(/[()]/g, "");
  return loose(na) === loose(nb);
};

import { polyEquivalent } from "./polyCanonical";

/** True mathematical equivalence: string-tolerant first, then full
 *  polynomial canonicalisation so reshuffled terms
 *  (e.g. "5 − 10x + 3x² = 0" vs "3x² − 10x + 5 = 0") are recognised as
 *  equal even when written in a different order or on different sides. */
export const equationsEquivalent = (a: string, b: string): boolean => {
  if (equationsMatch(a, b)) return true;
  return polyEquivalent(a, b);
};
