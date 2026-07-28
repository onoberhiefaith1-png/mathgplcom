// Bidirectional converter between LaTeX-ish storage and the
// "teacher-friendly" form shown inside the per-line editor.
//
// Storage keeps \frac{}{} / \sqrt{} so the math renderer can still draw
// stacked fractions and real radicals.  When the teacher clicks a line we
// flip it into friendly text — NO backslash commands ever appear in the
// input — and on commit we flip it back to storage form.

const SUP_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUP_DIGITS_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};
const SUP_TO_DIGIT: Record<string, string> = Object.fromEntries(
  Object.entries(SUP_DIGITS_MAP).map(([d, s]) => [s, d]),
);

/** Match a balanced `{...}` group starting at index `i` (`s[i]` must be `{`).
 *  Returns the index AFTER the closing brace, or -1 on failure. */
const matchBrace = (s: string, i: number): number => {
  if (s[i] !== "{") return -1;
  let depth = 1;
  let j = i + 1;
  while (j < s.length && depth > 0) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}") depth--;
    if (depth) j++;
  }
  return depth === 0 ? j : -1;
};

/** Match a balanced `(...)` group starting at index `i` (`s[i]` must be `(`). */
const matchParen = (s: string, i: number): number => {
  if (s[i] !== "(") return -1;
  let depth = 1;
  let j = i + 1;
  while (j < s.length && depth > 0) {
    if (s[j] === "(") depth++;
    else if (s[j] === ")") depth--;
    if (depth) j++;
  }
  return depth === 0 ? j : -1;
};

/** Pre-clean: remove non-visual LaTeX scaffolding. Safe on both forms. */
export const stripLatexScaffolding = (raw: string): string => {
  if (!raw) return "";
  let s = raw;
  s = s.replace(/\\left\s*([\(\[\{\|])/g, "$1");
  s = s.replace(/\\right\s*([\)\}\]\|])/g, "$1");
  s = s.replace(/\\left\./g, "").replace(/\\right\./g, "");
  s = s.replace(/\\(?:displaystyle|textstyle|scriptstyle)\b/g, "");
  s = s.replace(/\\,|\\;|\\:|\\!|\\quad|\\qquad/g, " ");
  s = s.replace(/\\text\s*\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\times\b/g, "×");
  s = s.replace(/\\cdot\b/g, "·");
  s = s.replace(/\\pm\b/g, "±");
  s = s.replace(/\\mp\b/g, "∓");
  s = s.replace(/\\leq\b/g, "≤");
  s = s.replace(/\\geq\b/g, "≥");
  s = s.replace(/\\neq\b/g, "≠");
  s = s.replace(/\\div\b/g, "÷");
  s = s.replace(/\\to\b/g, "→");
  s = s.replace(/\\infty\b/g, "∞");
  s = s.replace(/\\approx\b/g, "≈");
  return s;
};

/**
 * Convert storage form (\frac{a}{b}, \sqrt{x}, \sqrt[3]{y}, x^{2})
 * into the friendly form a teacher sees in the line editor.
 */
export const latexToFriendly = (raw: string): string => {
  if (!raw) return "";
  const src = stripLatexScaffolding(raw);
  let out = "";
  let i = 0;
  while (i < src.length) {
    // \frac{a}{b}  →  (a)/(b)
    if (src.startsWith("\\frac", i)) {
      const ai = i + 5;
      const aEnd = matchBrace(src, ai);
      if (aEnd > 0 && src[aEnd] === "{") {
        const bEnd = matchBrace(src, aEnd);
        if (bEnd > 0) {
          const a = latexToFriendly(src.slice(ai + 1, aEnd - 1));
          const b = latexToFriendly(src.slice(aEnd + 1, bEnd - 1));
          out += `(${a})/(${b})`;
          i = bEnd;
          continue;
        }
      }
    }
    // \sqrt[n]{x}  →  ⁿ√(x)
    if (src.startsWith("\\sqrt[", i)) {
      const close = src.indexOf("]", i + 6);
      if (close > 0 && src[close + 1] === "{") {
        const bEnd = matchBrace(src, close + 1);
        if (bEnd > 0) {
          const n = src.slice(i + 6, close).trim();
          const body = latexToFriendly(src.slice(close + 2, bEnd - 1));
          const supN = n.split("").map((c) => SUP_DIGITS_MAP[c] ?? c).join("");
          out += `${supN}√(${body})`;
          i = bEnd;
          continue;
        }
      }
    }
    // \sqrt{x}  →  √(x)
    if (src.startsWith("\\sqrt", i) && src[i + 5] === "{") {
      const bEnd = matchBrace(src, i + 5);
      if (bEnd > 0) {
        const body = latexToFriendly(src.slice(i + 6, bEnd - 1));
        out += `√(${body})`;
        i = bEnd;
        continue;
      }
    }
    // ^{x}  →  ^x  (single token) or ^(x) (multi)
    if (src[i] === "^" && src[i + 1] === "{") {
      const bEnd = matchBrace(src, i + 1);
      if (bEnd > 0) {
        const body = latexToFriendly(src.slice(i + 2, bEnd - 1));
        out += body.length === 1 ? `^${body}` : `^(${body})`;
        i = bEnd;
        continue;
      }
    }
    // _{x}  →  _x or _(x)
    if (src[i] === "_" && src[i + 1] === "{") {
      const bEnd = matchBrace(src, i + 1);
      if (bEnd > 0) {
        const body = latexToFriendly(src.slice(i + 2, bEnd - 1));
        out += body.length === 1 ? `_${body}` : `_(${body})`;
        i = bEnd;
        continue;
      }
    }
    out += src[i];
    i++;
  }
  return out;
};

/**
 * Convert the friendly form back to storage form so the renderer can produce
 * proper stacked fractions and real radicals.
 *
 * Recognised friendly tokens:
 *   (a)/(b)          → \frac{a}{b}    (paren-balanced)
 *   √(x), ∛(x), ∜(x) → \sqrt[n]{x}
 *   ⁿ√(x)            → \sqrt[n]{x}   (n is unicode super digits)
 *   ^x  / ^(x)       → ^{x}
 *   _x  / _(x)       → _{x}
 */
export const friendlyToLatex = (raw: string): string => {
  if (!raw) return "";
  let s = stripLatexScaffolding(raw);
  // Loop a few times in case fractions are nested inside fractions.
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    // (a)/(b) → \frac{a}{b}
    let out = "";
    let i = 0;
    while (i < s.length) {
      if (s[i] === "(") {
        const aEnd = matchParen(s, i);
        if (aEnd > 0 && s[aEnd] === "/" && s[aEnd + 1] === "(") {
          const bEnd = matchParen(s, aEnd + 1);
          if (bEnd > 0) {
            const a = s.slice(i + 1, aEnd - 1);
            const b = s.slice(aEnd + 2, bEnd - 1);
            out += `\\frac{${a}}{${b}}`;
            i = bEnd;
            changed = true;
            continue;
          }
        }
      }
      out += s[i];
      i++;
    }
    s = out;
    if (!changed) break;
  }
  // ⁿ√(x) → \sqrt[n]{x}
  s = s.replace(
    new RegExp(`([${SUP_DIGITS}]+)√\\(([^()]*)\\)`, "g"),
    (_m, supN: string, body: string) => {
      const n = supN.split("").map((c) => SUP_TO_DIGIT[c] ?? c).join("");
      return `\\sqrt[${n}]{${body}}`;
    },
  );
  // ∛(x), ∜(x) → indexed roots
  s = s.replace(/∛\(([^()]*)\)/g, (_m, b) => `\\sqrt[3]{${b}}`);
  s = s.replace(/∜\(([^()]*)\)/g, (_m, b) => `\\sqrt[4]{${b}}`);
  // √(x) → \sqrt{x}
  s = s.replace(/√\(([^()]*)\)/g, (_m, b) => `\\sqrt{${b}}`);
  // ^(x) → ^{x}; _(x) → _{x}; ^x / _x stay as-is (renderer wraps via normalize).
  s = s.replace(/\^\(([^()]*)\)/g, (_m, b) => `^{${b}}`);
  s = s.replace(/_\(([^()]*)\)/g, (_m, b) => `_{${b}}`);
  return s;
};
