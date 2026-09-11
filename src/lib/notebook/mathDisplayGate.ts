// MathGPL client-side display gate — last line of defence.
//
// Runs synchronously whenever AI text is about to enter the notebook editor.
// Strips/repairs known-safe leaks (operator macros, $...$ delimiters, slash
// fractions over small operands) and refuses ("safe: false") when source-
// code residue still remains after repair. Callers should fall back to an
// empty editable math slot when safe=false so the teacher can retype, rather
// than letting raw \frac{...} reach the DOM.

import { repairLeakedSentinels } from "./sentinelRepair";

const ALLOWED_MACROS = new Set([
  "frac", "dfrac", "tfrac", "sqrt", "sl", "binom",
  "sum", "prod", "int", "oint", "lim",
  "log", "ln", "lg",
  "vec", "hat", "bar", "tilde", "dot", "ddot",
  "abs", "norm", "floor", "ceil",
  "begin", "end",
  "square",
]);

/** Brace-balanced `{...}` reader. */
function readBraced(src: string, start: number): { inner: string; end: number } | null {
  if (src[start] !== "{") return null;
  let depth = 1;
  let j = start + 1;
  while (j < src.length && depth > 0) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") depth--;
    if (depth) j++;
  }
  if (depth !== 0) return null;
  return { inner: src.slice(start + 1, j), end: j + 1 };
}

/**
 * Read ONE argument of a structural macro: a braced group, or — as classroom
 * TeX allows — a single bare token (`\frac12`, `\frac ab`, `\sqrt2`,
 * `\frac\pi2`). Without this, `\frac12` was treated as an unbalanced fraction
 * and its operands leaked into the sentence as the text "12" beside an empty
 * fraction shell.
 */
function readArg(src: string, start: number): { inner: string; end: number } | null {
  let p = start;
  while (src[p] === " ") p++;
  const braced = readBraced(src, p);
  if (braced) return braced;
  const ch = src[p];
  if (ch === undefined) return null;
  if (ch === "\\") {
    const m = /^\\[A-Za-z]+/.exec(src.slice(p));
    if (m) return { inner: m[0], end: p + m[0].length };
    return null;
  }
  // A single digit, letter or symbol glyph (π, θ, ∞ — operator macros are
  // already unicode by this point) is one argument; braces, grouping and
  // operators are not.
  if (/[0-9A-Za-z\u0370-\u03ff\u2190-\u22ff]/.test(ch)) return { inner: ch, end: p + 1 };
  return null;
}


/**
 * Walk `\frac` / `\dfrac` / `\tfrac` / `\sqrt` occurrences. When the braces
 * don't balance:
 *   • `editing` mode leaves an empty editable slot (`\frac{\sl{}}{\sl{}}`) so a
 *     teacher who is mid-typing keeps a target to fill;
 *   • `generated` mode drops the broken structure entirely — AI output must
 *     never put an empty fraction bar on the page.
 * Either way the raw LaTeX never reaches the DOM.
 */
function repairTemplates(src: string, reasons: string[], generated: boolean): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const fracCmd = src.startsWith("\\dfrac", i) ? "\\dfrac"
                  : src.startsWith("\\tfrac", i) ? "\\tfrac"
                  : src.startsWith("\\frac", i) ? "\\frac" : "";
    if (fracCmd) {
      const p = i + fracCmd.length;
      const a = readArg(src, p);
      let b: ReturnType<typeof readArg> = null;
      if (a) b = readArg(src, a.end);
      if (a && b) {
        const innerA = repairTemplates(a.inner, reasons, generated);
        const innerB = repairTemplates(b.inner, reasons, generated);
        out += `\\frac{${innerA}}{${innerB}}`;
        i = b.end;
        continue;
      }
      reasons.push(
        `unbalanced ${fracCmd} → ${generated ? "removed" : "replaced with empty slot"}`,
      );
      if (!generated) out += "\\frac{\\sl{}}{\\sl{}}";
      // Consume whatever partial argument we did manage to read, so an
      // operand can never leak into the sentence beside the empty shell.
      i = a ? a.end : i + fracCmd.length;
      continue;
    }
    if (src.startsWith("\\sqrt", i)) {
      let p = i + 5;
      let indexStr = "";
      if (src[p] === "[") {
        const close = src.indexOf("]", p + 1);
        if (close < 0) {
          reasons.push(`unbalanced \\sqrt[ → ${generated ? "removed" : "empty slot"}`);
          if (!generated) out += "\\sqrt{\\sl{}}";
          i = i + 5;
          continue;
        }
        indexStr = src.slice(p, close + 1);
        p = close + 1;
      }
      const a = readArg(src, p);
      if (!a) {
        reasons.push(`unbalanced \\sqrt → ${generated ? "removed" : "empty slot"}`);
        if (!generated) out += `\\sqrt${indexStr}{\\sl{}}`;
        i = i + 5 + indexStr.length;
        continue;
      }
      const inner = repairTemplates(a.inner, reasons, generated);
      out += `\\sqrt${indexStr}{${inner}}`;
      i = a.end;
      continue;
    }

    out += src[i];
    i++;
  }
  return out;
}

const OPERATOR_MACROS: [RegExp, string][] = [
  [/\$+/g, ""],
  [/\\left\s*([\(\[\{\|])/g, "$1"],
  [/\\right\s*([\)\]\}\|])/g, "$1"],
  [/\\left\./g, ""],
  [/\\right\./g, ""],
  [/\\(?:displaystyle|textstyle|scriptstyle)\b\s*/g, ""],
  [/\\,|\\;|\\:|\\!|\\quad|\\qquad/g, " "],
  [/\\text\s*\{([^{}]*)\}/g, "$1"],
  [/\\times\b/g, "×"],
  [/\\cdot\b/g, "·"],
  [/\\pm\b/g, "±"],
  [/\\mp\b/g, "∓"],
  [/\\leq\b/g, "≤"],
  [/\\geq\b/g, "≥"],
  [/\\neq\b/g, "≠"],
  [/\\div\b/g, "÷"],
  [/\\to\b/g, "→"],
  [/\\infty\b/g, "∞"],
  [/\\approx\b/g, "≈"],
];

/** Convert obvious inline slash fractions into `\frac{}{}`. */
function rewriteSlashFractions(src: string): string {
  // (a)/(b) — parenthesised
  let out = src.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, (_m, a, b) => `\\frac{${a}}{${b}}`);
  // bare integer/integer or var/integer (not URL-ish, not a date)
  out = out.replace(/(?<![\w/])(-?\d+|[a-zA-Z])\s*\/\s*(-?\d+)(?![\w/])/g, (_m, a, b) => `\\frac{${a}}{${b}}`);
  return out;
}

export interface DisplayGateResult {
  safe: boolean;
  cleaned: string;
  reasons: string[];
}

/** `editing` keeps an empty editable slot for a broken structure (a teacher is
 *  typing); `generated` removes it, because AI output must never show an empty
 *  fraction bar. */
export type DisplayGateMode = "editing" | "generated";

export function assertDisplaySafe(input: string, mode: DisplayGateMode = "editing"): DisplayGateResult {
  const reasons: string[] = [];
  if (!input) return { safe: true, cleaned: "", reasons };

  // Repair leaked converter sentinels FIRST: a power stored behind an old
  // ASCII sentinel ("xPOWERSCRIPT₀LOT") must become a real `^{□}` again
  // before anything else looks at the text, otherwise the power is gone.
  let s = repairLeakedSentinels(input);
  // Strip plain operator macros first.
  for (const [re, rep] of OPERATOR_MACROS) s = s.replace(re, rep);
  // Convert slash fractions before template repair (so they become \frac).
  s = rewriteSlashFractions(s);
  // Repair / mask broken \frac and \sqrt structures.
  s = repairTemplates(s, reasons, mode === "generated");

  // After repair, no `\letters` outside the allowed-macro set should remain.
  const leftover = (s.match(/\\[A-Za-z]+/g) || []).filter((cmd) => !ALLOWED_MACROS.has(cmd.slice(1)));
  let safe = true;
  if (leftover.length) {
    safe = false;
    reasons.push(`leftover LaTeX commands: ${Array.from(new Set(leftover)).slice(0, 6).join(" ")}`);
    // Strip them so the rendered output at least doesn't show raw \word.
    s = s.replace(/\\[A-Za-z]+/g, "");
  }
  if (/\bsqrt\s*\(/.test(s) || /(?<!\*)\*\*(?!\*)/.test(s)) {
    safe = false;
    reasons.push("programming syntax remained (sqrt(...) or **)");
    s = s.replace(/\bsqrt\s*\(/g, "√(").replace(/(?<!\*)\*\*(?!\*)/g, "^");
  }
  return { safe, cleaned: s, reasons };
}
