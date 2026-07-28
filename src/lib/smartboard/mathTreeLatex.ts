// Parse LaTeX-ish math strings ↔ mathTree.Row. Covers the subset produced by
// `friendlyToLatex`: chars, `^{...}`, `_{...}`, `\frac{...}{...}`,
// `\sqrt{...}`, `\sqrt[n]{...}`, and paren/bracket groups. Anything else
// falls back to individual char nodes.

import {
  type Row,
  type Node,
  mkChar,
  mkFrac,
  mkSqrt,
  mkSubSup,
  subRowsOf,
} from "./mathTree";

const matchBrace = (s: string, i: number): number => {
  if (s[i] !== "{") return -1;
  let d = 1, j = i + 1;
  while (j < s.length && d > 0) {
    if (s[j] === "{") d++;
    else if (s[j] === "}") d--;
    if (d) j++;
  }
  // Returns the index AFTER the closing brace (every call site below slices
  // with `end - 1` and resumes at `end`). Returning the index OF the brace
  // silently dropped the last character of every group and made the
  // `src[aEnd] === "{"` test in \frac fail, leaking raw LaTeX into notes.
  return d === 0 ? j + 1 : -1;
};

const isBaseChar = (ch: string): boolean => /[A-Za-z0-9)\]}]/.test(ch);

export function latexToTree(src: string): Row {
  const row: Row = [];
  if (!src) return row;
  let i = 0;
  while (i < src.length) {
    // \frac{a}{b}
    if (src.startsWith("\\frac", i)) {
      const aOpen = i + 5;
      const aEnd = matchBrace(src, aOpen);
      if (aEnd > 0 && src[aEnd] === "{") {
        const bEnd = matchBrace(src, aEnd);
        if (bEnd > 0) {
          const num = latexToTree(src.slice(aOpen + 1, aEnd - 1));
          const den = latexToTree(src.slice(aEnd + 1, bEnd - 1));
          const n = mkFrac() as Extract<Node, { kind: "frac" }>;
          n.rows = [num, den];
          row.push(n);
          i = bEnd;
          continue;
        }
      }
    }
    // \sqrt[n]{x}
    if (src.startsWith("\\sqrt[", i)) {
      const close = src.indexOf("]", i + 6);
      if (close > 0 && src[close + 1] === "{") {
        const bEnd = matchBrace(src, close + 1);
        if (bEnd > 0) {
          const idx = latexToTree(src.slice(i + 6, close));
          const rad = latexToTree(src.slice(close + 2, bEnd - 1));
          const n = mkSqrt(true) as Extract<Node, { kind: "sqrt" }>;
          n.rows = [rad, idx];
          row.push(n);
          i = bEnd;
          continue;
        }
      }
    }
    // \sqrt{x}
    if (src.startsWith("\\sqrt", i) && src[i + 5] === "{") {
      const bEnd = matchBrace(src, i + 5);
      if (bEnd > 0) {
        const rad = latexToTree(src.slice(i + 6, bEnd - 1));
        const n = mkSqrt(false) as Extract<Node, { kind: "sqrt" }>;
        n.rows = [rad];
        row.push(n);
        i = bEnd;
        continue;
      }
    }
    // ^{...}
    if (src[i] === "^" && src[i + 1] === "{") {
      const bEnd = matchBrace(src, i + 1);
      if (bEnd > 0) {
        const body = latexToTree(src.slice(i + 2, bEnd - 1));
        // Attach to previous node if it's a base char/closing bracket;
        // otherwise attach to an empty base.
        const last = row[row.length - 1];
        let baseRow: Row;
        if (last && last.kind === "char" && isBaseChar(last.ch)) {
          baseRow = [row.pop()!];
        } else if (last && last.kind === "subsup" && subRowsOf(last)[2].length === 0) {
          // Extend existing subsup with sup
          const subs = subRowsOf(last).slice();
          subs[2] = body;
          (last as Extract<Node, { kind: "subsup" }>).rows = subs;
          i = bEnd;
          continue;
        } else {
          baseRow = [];
        }
        const n = mkSubSup() as Extract<Node, { kind: "subsup" }>;
        n.rows = [baseRow, [], body];
        row.push(n);
        i = bEnd;
        continue;
      }
    }
    // _{...}
    if (src[i] === "_" && src[i + 1] === "{") {
      const bEnd = matchBrace(src, i + 1);
      if (bEnd > 0) {
        const body = latexToTree(src.slice(i + 2, bEnd - 1));
        const last = row[row.length - 1];
        let baseRow: Row;
        if (last && last.kind === "char" && isBaseChar(last.ch)) {
          baseRow = [row.pop()!];
        } else if (last && last.kind === "subsup" && subRowsOf(last)[1].length === 0) {
          const subs = subRowsOf(last).slice();
          subs[1] = body;
          (last as Extract<Node, { kind: "subsup" }>).rows = subs;
          i = bEnd;
          continue;
        } else {
          baseRow = [];
        }
        const n = mkSubSup() as Extract<Node, { kind: "subsup" }>;
        n.rows = [baseRow, body, []];
        row.push(n);
        i = bEnd;
        continue;
      }
    }
    // Skip whitespace as space char
    row.push(mkChar(src[i]));
    i++;
  }
  return row;
}

export function treeToLatex(row: Row): string {
  let out = "";
  for (const n of row) {
    if (n.kind === "char") {
      out += n.ch;
      continue;
    }
    if (n.kind === "frac") {
      const [a, b] = subRowsOf(n);
      out += `\\frac{${treeToLatex(a)}}{${treeToLatex(b)}}`;
      continue;
    }
    if (n.kind === "sqrt") {
      const rows = subRowsOf(n);
      if (rows.length === 2) {
        out += `\\sqrt[${treeToLatex(rows[1])}]{${treeToLatex(rows[0])}}`;
      } else {
        out += `\\sqrt{${treeToLatex(rows[0])}}`;
      }
      continue;
    }
    if (n.kind === "subsup") {
      const [base, sub, sup] = subRowsOf(n);
      out += treeToLatex(base);
      if (sub.length > 0) out += `_{${treeToLatex(sub)}}`;
      if (sup.length > 0) out += `^{${treeToLatex(sup)}}`;
      continue;
    }
    if (n.kind === "power") {
      const [base, exp] = subRowsOf(n);
      out += `${treeToLatex(base)}^{${treeToLatex(exp)}}`;
      continue;
    }
    if (n.kind === "sup") {
      out += `^{${treeToLatex(subRowsOf(n)[0])}}`;
      continue;
    }
    if (n.kind === "sub") {
      out += `_{${treeToLatex(subRowsOf(n)[0])}}`;
      continue;
    }
    if (n.kind === "bracket") {
      out += `${n.left}${treeToLatex(subRowsOf(n)[0])}${n.right}`;
      continue;
    }
    // Fallback: emit children.
    for (const sub of subRowsOf(n)) out += treeToLatex(sub);
  }
  return out;
}

/** Build a subsup node with `term` as the base and `slot` (1=sub, 2=sup)
 *  as the empty landing sub-row. */
export function makeScriptWith(term: Row, slot: 1 | 2): Node {
  const n = mkSubSup() as Extract<Node, { kind: "subsup" }>;
  n.rows = [term, [], []];
  return n;
}
