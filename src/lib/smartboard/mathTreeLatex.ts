// Parse LaTeX-ish math strings ↔ mathTree.Row.
//
// This grammar must stay in step with `renderMathInline` (the classroom
// renderer used by the AI Edit preview). Anything the renderer can display
// must be representable here, otherwise the editable node would fall back to
// raw backslash text. Covered: chars, `^{...}`, `_{...}`,
// `\frac{...}{...}`, `\binom{...}{...}`, `\sqrt{...}`, `\sqrt[n]{...}`,
// big operators (`\sum \prod \int \oint \lim`) with limits, accents
// (`\bar \overline \vec \hat \tilde \dot`), fences (`\abs \norm \floor
// \ceil` and `|…|`) and matrices (`\begin{pmatrix}…\end{pmatrix}`).

import {
  type Row,
  type Node,
  type BracketKind,
  mkChar,
  mkFrac,
  mkSqrt,
  mkSubSup,
  mkBigOp,
  mkAccent,
  mkBinom,
  mkGeoRef,

  mkBracket,
  mkMatrix,
  subRowsOf,
} from "./mathTree";
import { graphemes, isEmoji } from "@/lib/text/graphemes";

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

type BigOpName = "sum" | "prod" | "coprod" | "int" | "oint" | "lim";
// Longest first so `\coprod` is not read as `\prod` (and future long names win).
const BIG_OPS: BigOpName[] = ["coprod", "sum", "prod", "oint", "int", "lim"];


/** LaTeX accent macro → the glyph drawn above the body. */
const ACCENTS: Record<string, string> = {
  bar: "‾", overline: "‾", vec: "→", overrightarrow: "→",
  hat: "^", widehat: "^", tilde: "~", widetilde: "~", dot: "˙",
};
/** Reverse map used when serializing an accent node back to LaTeX. */
const ACCENT_MACRO: Record<string, string> = {
  "‾": "bar", "→": "vec", "^": "hat", "~": "tilde", "˙": "dot",
};

/** One-argument fence macros → bracket pair. */
const FENCES: Record<string, [BracketKind, BracketKind]> = {
  abs: ["|", "|"], norm: ["‖", "‖"], floor: ["⌊", "⌋"], ceil: ["⌈", "⌉"],
};
const FENCE_MACRO: Record<string, string> = {
  "|": "abs", "‖": "norm", "⌊": "floor", "⌈": "ceil",
};

const MATRIX_ENVS: Record<string, [string, string]> = {
  matrix: ["", ""], pmatrix: ["(", ")"], bmatrix: ["[", "]"],
  Bmatrix: ["{", "}"], vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"],
};
const MATRIX_ENV_FOR: Record<string, string> = {
  "": "matrix", "(": "pmatrix", "[": "bmatrix", "{": "Bmatrix",
  "|": "vmatrix", "‖": "Vmatrix",
};

/** Read `_{...}` / `^{...}` limits directly following a big operator. */
const readLimits = (src: string, start: number): { lower: Row; upper: Row; end: number } => {
  let i = start;
  let lower: Row = [];
  let upper: Row = [];
  for (let pass = 0; pass < 2; pass++) {
    const mark = src[i];
    if ((mark === "_" || mark === "^") && src[i + 1] === "{") {
      const end = matchBrace(src, i + 1);
      if (end < 0) break;
      const body = latexToTree(src.slice(i + 2, end - 1));
      if (mark === "_") lower = body; else upper = body;
      i = end;
      continue;
    }
    break;
  }
  return { lower, upper, end: i };
};


export function latexToTree(src: string): Row {
  const row: Row = [];
  if (!src) return row;
  let i = 0;
  while (i < src.length) {
    // \georef{objectId}{label} — the box IS the geometry object. The first
    // argument is the identity; the second is only the visible label and may
    // legitimately be empty.
    if (src.startsWith("\\georef", i)) {
      const aOpen = i + 7;
      const aEnd = matchBrace(src, aOpen);
      if (aEnd > 0 && src[aEnd] === "{") {
        const bEnd = matchBrace(src, aEnd);
        if (bEnd > 0) {
          const objectId = src.slice(aOpen + 1, aEnd - 1).trim();
          const label = latexToTree(src.slice(aEnd + 1, bEnd - 1));
          const n = mkGeoRef(objectId) as Extract<Node, { kind: "georef" }>;
          n.rows = [label];
          row.push(n);
          i = bEnd;
          continue;
        }
      }
    }
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
    // \binom{a}{b}
    if (src.startsWith("\\binom", i)) {
      const aOpen = i + 6;
      const aEnd = matchBrace(src, aOpen);
      if (aEnd > 0 && src[aEnd] === "{") {
        const bEnd = matchBrace(src, aEnd);
        if (bEnd > 0) {
          const n = mkBinom() as Extract<Node, { kind: "binom" }>;
          n.rows = [
            latexToTree(src.slice(aOpen + 1, aEnd - 1)),
            latexToTree(src.slice(aEnd + 1, bEnd - 1)),
          ];
          row.push(n);
          i = bEnd;
          continue;
        }
      }
    }
    // \begin{pmatrix} a & b \\ c & d \end{pmatrix}
    if (src.startsWith("\\begin{", i)) {
      const close = src.indexOf("}", i + 7);
      const env = close > 0 ? src.slice(i + 7, close) : "";
      const pair = MATRIX_ENVS[env];
      if (pair) {
        const endTag = `\\end{${env}}`;
        const endAt = src.indexOf(endTag, close);
        if (endAt > 0) {
          const body = src.slice(close + 1, endAt);
          const cellRows = body.split(/\\\\/).map((r) => r.split("&"));
          const nRows = cellRows.length;
          const nCols = Math.max(...cellRows.map((r) => r.length));
          const n = mkMatrix(nRows, nCols, pair[0], pair[1]) as Extract<Node, { kind: "matrix" }>;
          const cells: Row[] = [];
          for (let r = 0; r < nRows; r++) {
            for (let c = 0; c < nCols; c++) {
              cells.push(latexToTree((cellRows[r][c] ?? "").trim()));
            }
          }
          n.rows = cells;
          row.push(n);
          i = endAt + endTag.length;
          continue;
        }
      }
    }
    // Accents: \bar{x}, \overline{x}, \vec{v}, \hat{y}, \tilde{a}, \dot{x}
    {
      const m = /^\\([A-Za-z]+)\{/.exec(src.slice(i));
      if (m) {
        const name = m[1];
        const open = i + 1 + name.length;
        const glyph = ACCENTS[name];
        const fence = FENCES[name];
        if (glyph || fence) {
          const end = matchBrace(src, open);
          if (end > 0) {
            const body = latexToTree(src.slice(open + 1, end - 1));
            if (glyph) {
              const n = mkAccent(glyph) as Extract<Node, { kind: "accent" }>;
              n.rows = [body];
              row.push(n);
            } else {
              const n = mkBracket(fence![0], fence![1]) as Extract<Node, { kind: "bracket" }>;
              n.rows = [body];
              row.push(n);
            }
            i = end;
            continue;
          }
        }
      }
    }
    // Big operators with optional limits: \sum_{i=1}^{n}, \lim_{x \to 0}
    {
      const m = /^\\([A-Za-z]+)/.exec(src.slice(i));
      const name = m?.[1] as BigOpName | undefined;
      if (name && (BIG_OPS as string[]).includes(name)) {
        const { lower, upper, end } = readLimits(src, i + 1 + name.length);
        const n = mkBigOp(name) as Extract<Node, { kind: "bigop" }>;
        n.rows = [[], lower, upper];
        row.push(n);
        i = end;
        continue;
      }
    }
    // |…| absolute-value fence (paired scan on the same nesting level).
    if (src[i] === "|" || src[i] === "‖") {
      const mark = src[i];
      let j = i + 1;
      let depth = 0;
      while (j < src.length) {
        const ch = src[j];
        if (ch === "\\") { j += 2; continue; }
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
        else if (ch === mark && depth <= 0) break;
        j++;
      }
      if (j < src.length && src[j] === mark) {
        const n = mkBracket(mark as BracketKind, mark as BracketKind) as Extract<Node, { kind: "bracket" }>;
        n.rows = [latexToTree(src.slice(i + 1, j))];
        row.push(n);
        i = j + 1;
        continue;
      }
    }

    // Emoji identity: never split a surrogate pair / ZWJ sequence.
    const g = graphemes(src.slice(i, i + 16))[0] ?? src[i];
    if (g.length > 1 && isEmoji(g)) {
      row.push(mkChar(g));
      i += g.length;
      continue;
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
      const body = treeToLatex(subRowsOf(n)[0]);
      // ⌊ ⌋ / ⌈ ⌉ have no literal re-parse path, so serialize them as the
      // macro form the parser understands. | and ‖ round-trip literally.
      const macro = n.left === "⌊" || n.left === "⌈" ? FENCE_MACRO[n.left] : null;
      out += macro ? `\\${macro}{${body}}` : `${n.left}${body}${n.right}`;
      continue;
    }
    if (n.kind === "bigop") {
      const [body, lower, upper] = subRowsOf(n);
      out += `\\${n.op}`;
      if (lower.length > 0) out += `_{${treeToLatex(lower)}}`;
      if (upper.length > 0) out += `^{${treeToLatex(upper)}}`;
      out += treeToLatex(body);
      continue;
    }
    if (n.kind === "accent") {
      const macro = ACCENT_MACRO[n.symbol] ?? "bar";
      out += `\\${macro}{${treeToLatex(subRowsOf(n)[0])}}`;
      continue;
    }
    if (n.kind === "georef") {
      // Identity first, label second. An empty label still round-trips, so
      // clearing the text never loses the geometry link.
      out += `\\georef{${n.objectId}}{${treeToLatex(subRowsOf(n)[0] ?? [])}}`;
      continue;
    }
    if (n.kind === "binom") {

      const [a, b] = subRowsOf(n);
      out += `\\binom{${treeToLatex(a)}}{${treeToLatex(b)}}`;
      continue;
    }
    if (n.kind === "matrix") {
      const env = MATRIX_ENV_FOR[n.left] ?? "matrix";
      const cells = subRowsOf(n);
      const lines: string[] = [];
      for (let r = 0; r < n.nRows; r++) {
        const cols: string[] = [];
        for (let c = 0; c < n.nCols; c++) cols.push(treeToLatex(cells[r * n.nCols + c] ?? []));
        lines.push(cols.join(" & "));
      }
      out += `\\begin{${env}}${lines.join(" \\\\ ")}\\end{${env}}`;
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
