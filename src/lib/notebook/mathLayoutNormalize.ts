// Math Layout Normalizer.
//
// Universal rule: a mathematical structure occupies only the horizontal space
// its rendered content needs. No reserved space, no leftover editing spacing.
//
// This pass runs on the math *string* before it is stored or displayed, so the
// saved value is already tight. It never touches structure — only the spacing
// characters between tokens.

/** Structure-opening macros. Space directly before these is layout noise. */
const OPENERS = [
  "\\frac", "\\dfrac", "\\tfrac", "\\sqrt", "\\sum", "\\prod", "\\int",
  "\\oint", "\\lim", "\\binom", "\\begin", "\\vec", "\\hat", "\\bar",
  "\\abs", "\\norm", "\\floor", "\\ceil", "\\sl", "\\left", "\\right",
];

/** Characters that are structure boundaries in the flattened source. */
const BOUNDARY_CHARS = new Set([
  "{", "}", "^", "_", "(", ")", "[", "]", "|",
  "√", "∛", "∜", "∑", "∏", "∫", "∮",
]);

const isSpace = (ch: string | undefined) => ch === " " || ch === "\t" || ch === "\n";

const startsOpenerAt = (s: string, i: number): boolean =>
  OPENERS.some((m) => s.startsWith(m, i));

/**
 * Collapse space runs to a single space and drop spacing that sits directly
 * against a structure boundary (radicals, fractions, scripts, brackets, big
 * operators). Applies to every mathematical structure, present and future,
 * because it is driven by boundary tokens rather than a per-structure list.
 */
export const normalizeMathLayout = (raw: string): string => {
  if (!raw) return "";
  // 1. Explicit spacing macros carry no meaning once layout is tight.
  let s = raw.replace(/\\(,|;|:|!|quad|qquad|thinspace|enspace)/g, " ");
  // 2. Collapse every whitespace run to one plain space.
  s = s.replace(/[ \t\n\r]+/g, " ");

  // 3. Drop spaces adjacent to structure boundaries.
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (!isSpace(ch)) {
      out += ch;
      continue;
    }
    // previous significant char
    const prev = out[out.length - 1];
    // next significant char
    let j = i + 1;
    while (isSpace(s[j])) j++;
    const next = s[j];
    if (next === undefined) break; // trailing space
    if (prev === undefined) { i = j - 1; continue; } // leading space
    const prevBoundary = BOUNDARY_CHARS.has(prev);
    const nextBoundary = BOUNDARY_CHARS.has(next) || startsOpenerAt(s, j);
    if (prevBoundary || nextBoundary) {
      i = j - 1;
      continue;
    }
    out += " ";
    i = j - 1;
  }
  return out;
};

export default normalizeMathLayout;
