// SMARTBOARD ↔ LESSON NOTE MIRROR ENGINE
//
// The Smartboard is a presentation layer. Lesson Notes is the source of
// truth. The Smartboard must never parse, interpret or "render" mathematics
// on its own — it only mirrors whatever Lesson Notes already produced.
//
// This module is the single entry point any Smartboard surface uses to take
// raw Lesson Note storage (`content_ascii` which may contain LaTeX such as
// `\frac{a}{b}`, `\sqrt{x}`, `x^{2}`) and convert it into Smartboard math
// tree `Row` nodes that render as proper stacked fractions, real radicals,
// superscripts, etc. — identical to how the Lesson Note editor itself
// displays the same source.
//
// After conversion a parity gate verifies that no LaTeX scaffolding
// (`\frac`, `\sqrt`, `^{`, `_{`, `\left`, `\right`, …) survived. If the
// gate fails, the Smartboard MUST refuse to commit the line.

import {
  mkChar, mkSup, mkSub,
  type Node, type Row,
} from "@/lib/smartboard/mathTree";
import { assertDisplaySafe } from "@/lib/notebook/mathDisplayGate";
import {
  latexToFriendly,
  stripLatexScaffolding,
} from "@/lib/notebook/mathFriendly";

/* ─────────── re-exports kept for legacy callers ─────────── */
export { latexToFriendly, stripLatexScaffolding };

/** Tokens that must never reach the Smartboard surface. */
const FORBIDDEN_RESIDUE = [
  "\\frac", "\\dfrac", "\\tfrac",
  "\\sqrt", "\\left", "\\right",
  "\\text", "\\displaystyle",
  "^{", "_{",
  "sqrt(", "**",
];

/** Operator / greek macros that map to a single glyph. */
const GLYPH: Record<string, string> = {
  times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓",
  leq: "≤", geq: "≥", neq: "≠", approx: "≈",
  to: "→", infty: "∞",
  pi: "π", theta: "θ", alpha: "α", beta: "β", gamma: "γ",
  delta: "δ", lambda: "λ", mu: "μ", sigma: "σ", phi: "φ", omega: "ω",
};

/** Match a balanced `{...}` group starting at `i` (`s[i]` must be `{`). */
const matchBrace = (s: string, i: number): number => {
  if (s[i] !== "{") return -1;
  let depth = 1;
  let j = i + 1;
  while (j < s.length && depth > 0) {
    const c = s[j];
    if (c === "\\") { j += 2; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) break; }
    j++;
  }
  return depth === 0 ? j + 1 : -1; // returns index AFTER the closing brace
};

/** Match a balanced `(...)` group starting at `i` (`s[i]` must be `(`).
 *  Returns index AFTER the closing paren, or -1 on failure. Used to
 *  recognise friendly-form radicals `√( ... )` that may reach the mirror
 *  in AI-generated ASCII (never `\sqrt{...}`). */
const matchParen = (s: string, i: number): number => {
  if (s[i] !== "(") return -1;
  let depth = 1;
  let j = i + 1;
  while (j < s.length && depth > 0) {
    const c = s[j];
    if (c === "\\") { j += 2; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) break; }
    j++;
  }
  return depth === 0 ? j + 1 : -1;
};

const SUP_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUP_TO_DIGIT: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
};

const charsOf = (s: string): Row => [...s].map(mkChar);

/* ─────────── LaTeX → Smartboard Row converter ─────────── */
//
// This is the heart of the mirror. It is deliberately recursive and only
// understands the SAME grammar Lesson Notes uses (\frac, \sqrt, ^, _, plain
// macros). It does NOT do any math reasoning.

const latexToRow = (src: string): Row => {
  const out: Row = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];

    // \frac{a}{b}  /  \dfrac{a}{b}  /  \tfrac{a}{b}
    const fracName = src.startsWith("\\frac", i) ? "\\frac"
                  : src.startsWith("\\dfrac", i) ? "\\dfrac"
                  : src.startsWith("\\tfrac", i) ? "\\tfrac" : "";
    if (fracName) {
      let p = i + fracName.length;
      while (src[p] === " ") p++;
      const aEnd = matchBrace(src, p);
      if (aEnd > 0) {
        let q = aEnd;
        while (src[q] === " ") q++;
        const bEnd = matchBrace(src, q);
        if (bEnd > 0) {
          const num = latexToRow(src.slice(p + 1, aEnd - 1));
          const den = latexToRow(src.slice(q + 1, bEnd - 1));
          out.push({ kind: "frac", rows: [num, den] } as Node);
          i = bEnd;
          continue;
        }
      }
      // Unbalanced — drop the command rather than leaking it.
      i += fracName.length;
      continue;
    }

    // \sqrt[n]{x}  /  \sqrt{x}
    if (src.startsWith("\\sqrt", i)) {
      let p = i + 5;
      let indexRow: Row | null = null;
      if (src[p] === "[") {
        const close = src.indexOf("]", p + 1);
        if (close > 0) {
          indexRow = latexToRow(src.slice(p + 1, close));
          p = close + 1;
        }
      }
      while (src[p] === " ") p++;
      const aEnd = matchBrace(src, p);
      if (aEnd > 0) {
        const body = latexToRow(src.slice(p + 1, aEnd - 1));
        out.push(
          indexRow
            ? ({ kind: "sqrt", rows: [body, indexRow] } as Node)
            : ({ kind: "sqrt", rows: [body] } as Node),
        );
        i = aEnd;
        continue;
      }
      i += 5;
      continue;
    }

    // Friendly-form radical:  √( ... )  or  ⁿ√( ... )  where n is one or
    // more unicode superscript digits. AI-generated content sometimes
    // emits this ASCII form instead of proper \sqrt{...}. Convert to a
    // real sqrt node so the connected radical (SVG hook + border-top
    // overline that grows with the radicand) is used everywhere — no
    // bracketed fallback.
    if (ch === "√" || SUP_DIGITS.includes(ch)) {
      // Consume leading superscript digits as the optional index.
      let p = i;
      let indexDigits = "";
      while (p < src.length && SUP_DIGITS.includes(src[p])) {
        indexDigits += SUP_TO_DIGIT[src[p]] ?? "";
        p++;
      }
      if (src[p] === "√") {
        let q = p + 1;
        while (src[q] === " ") q++;
        if (src[q] === "(") {
          const end = matchParen(src, q);
          if (end > 0) {
            const body = latexToRow(src.slice(q + 1, end - 1));
            const indexRow: Row | null =
              indexDigits.length > 0 ? charsOf(indexDigits) : null;
            out.push(
              indexRow
                ? ({ kind: "sqrt", rows: [body, indexRow] } as Node)
                : ({ kind: "sqrt", rows: [body] } as Node),
            );
            i = end;
            continue;
          }
        }
      }
      // Fall through — a stray √ or superscript digit becomes a char.
    }

    // \left, \right, \displaystyle — pure scaffolding, drop.
    if (src.startsWith("\\left", i))  { i += 5; continue; }
    if (src.startsWith("\\right", i)) { i += 6; continue; }
    if (src.startsWith("\\displaystyle", i)) { i += 13; continue; }

    // \text{...} — flatten contents as literal characters.
    if (src.startsWith("\\text", i) && src[i + 5] === "{") {
      const end = matchBrace(src, i + 5);
      if (end > 0) {
        out.push(...charsOf(src.slice(i + 6, end - 1)));
        i = end;
        continue;
      }
    }

    // Generic \word — operator macro or greek letter.
    if (ch === "\\") {
      const m = /^\\([A-Za-z]+)/.exec(src.slice(i));
      if (m) {
        const name = m[1];
        const glyph = GLYPH[name];
        if (glyph) out.push(mkChar(glyph));
        // Unknown macro: drop silently — never leak `\word` to the board.
        i += 1 + name.length;
        continue;
      }
    }

    // ^{...}  or  ^x
    if (ch === "^") {
      if (src[i + 1] === "{") {
        const end = matchBrace(src, i + 1);
        if (end > 0) {
          out.push({ kind: "sup", rows: [latexToRow(src.slice(i + 2, end - 1))] } as Node);
          i = end; continue;
        }
      } else if (src[i + 1]) {
        out.push({ kind: "sup", rows: [[mkChar(src[i + 1])]] } as Node);
        i += 2; continue;
      }
      i++; continue;
    }

    // _{...}  or  _x
    if (ch === "_") {
      if (src[i + 1] === "{") {
        const end = matchBrace(src, i + 1);
        if (end > 0) {
          out.push({ kind: "sub", rows: [latexToRow(src.slice(i + 2, end - 1))] } as Node);
          i = end; continue;
        }
      } else if (src[i + 1]) {
        out.push({ kind: "sub", rows: [[mkChar(src[i + 1])]] } as Node);
        i += 2; continue;
      }
      i++; continue;
    }

    // Stray ASCII operators → classroom glyphs.
    if (ch === "*") { out.push(mkChar("×")); i++; continue; }
    if (ch === "$") { i++; continue; }
    // Stray standalone braces shouldn't render as text.
    if (ch === "{" || ch === "}") { i++; continue; }

    out.push(mkChar(ch));
    i++;
  }
  return out;
};

/** Flatten a Row to plain text so it can be hashed / signature-compared. */
export const rowSignature = (row: Row): string => {
  let s = "";
  for (const n of row) {
    if (n.kind === "char") { s += n.ch; continue; }
    if ("rows" in n) {
      const rs = (n as { rows: Row[] }).rows;
      if (n.kind === "frac") { s += `(${rowSignature(rs[0] || [])})/(${rowSignature(rs[1] || [])})`; continue; }
      if (n.kind === "sqrt") {
        s += rs.length > 1
          ? `${rowSignature(rs[1] || [])}√(${rowSignature(rs[0] || [])})`
          : `√(${rowSignature(rs[0] || [])})`;
        continue;
      }
      if (n.kind === "sup") { s += `^(${rowSignature(rs[0] || [])})`; continue; }
      if (n.kind === "sub") { s += `_(${rowSignature(rs[0] || [])})`; continue; }
      for (const r of rs) s += rowSignature(r);
    }
  }
  return s;
};

/* ─────────── Public API ─────────── */

export interface MirrorRowResult {
  /** Smartboard math-tree row, ready to drop into `freeLines`. */
  row: Row;
  /** Signature of the row, used for idempotency comparisons. */
  signature: string;
  /** True iff no forbidden LaTeX residue survived the mirror. */
  ok: boolean;
  /** First forbidden token detected (diagnostic only). */
  offending?: string;
}

const containsForbidden = (s: string): string | null => {
  for (const t of FORBIDDEN_RESIDUE) if (s.includes(t)) return t;
  return null;
};

const stageRow = (raw: string): MirrorRowResult => {
  const gated = assertDisplaySafe(raw ?? "");
  // Use the gate's cleaned form as the canonical Lesson Note source.
  const cleaned = stripLatexScaffolding(gated.cleaned);
  const row = latexToRow(cleaned);
  const sig = rowSignature(row);
  const hit = containsForbidden(sig);
  return hit
    ? { row, signature: sig, ok: false, offending: hit }
    : { row, signature: sig, ok: true };
};

/** Mirror Lesson Note source onto the Smartboard as math-tree row nodes.
 *
 *  Workflow (matches the SMARTBOARD LESSON NOTE MIRROR ENGINE spec):
 *    1. Stage the Lesson Note source into a hidden Smartboard row.
 *    2. Run the parity gate.
 *    3. If NO → run one correction pass (re-stage from the signature).
 *    4. If still NO → return ok:false; caller MUST refuse to display.
 *    5. If YES → return the row for the board to commit. */
export const mirrorLessonNoteRow = (raw: string): MirrorRowResult => {
  const first = stageRow(raw);
  if (first.ok) return first;
  const second = stageRow(first.signature);
  if (second.ok) return second;
  // eslint-disable-next-line no-console
  console.warn(
    "[smartboard mirror] parity gate failed; refusing to display.",
    { offending: second.offending, signature: second.signature, source: raw },
  );
  return second;
};

/* ─────────── Legacy text-only API (kept for older callers) ─────────── */

export interface MirrorResult {
  text: string;
  ok: boolean;
  offending?: string;
}

/** Legacy: returns just the friendly text. Prefer `mirrorLessonNoteRow`. */
export const mirrorLessonNoteText = (raw: string): MirrorResult => {
  const r = mirrorLessonNoteRow(raw);
  return { text: r.signature, ok: r.ok, offending: r.offending };
};
