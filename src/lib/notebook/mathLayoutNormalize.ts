// Math Layout Normalizer.
//
// Universal rule: a mathematical structure occupies only the horizontal space
// its rendered content needs. No reserved space, no leftover editing spacing.
//
// This pass runs on the math *string* before it is stored or displayed, so the
// saved value is already tight. It never touches structure — only the spacing
// characters between tokens.

/** Structure-opening macros. Space *inside* a slot next to these is noise. */
const OPENERS = [
  "\\frac", "\\dfrac", "\\tfrac", "\\sqrt", "\\sum", "\\prod", "\\int",
  "\\oint", "\\lim", "\\binom", "\\begin", "\\vec", "\\hat", "\\bar",
  "\\abs", "\\norm", "\\floor", "\\ceil", "\\sl", "\\left", "\\right",
];

const startsOpenerAt = (s: string, i: number): boolean =>
  OPENERS.some((m) => s.startsWith(m, i));

/**
 * Collapse space runs to a single space and remove spacing that a renderer
 * would never draw: inside braces, against script markers, and immediately
 * after a structure macro. Driven by boundary tokens rather than a
 * per-structure list, so it covers every structure present and future.
 */
export const normalizeMathLayout = (raw: string): string => {
  if (!raw) return "";
  // 1. Explicit spacing macros carry no meaning once layout is tight.
  let s = raw.replace(/\\(,|;|:|!|quad|qquad|thinspace|enspace)(?![a-zA-Z])/g, " ");
  // 2. Collapse every whitespace run to a single plain space — this is what
  //    turns `a +      \sqrt{b}` into `a + \sqrt{b}`.
  s = s.replace(/[ \t\n\r\f\v\u00a0\u2000-\u200a\u202f\u205f\u3000]+/g, " ");

  // 3. Remove spacing that carries no glyph: inside slots and against the
  //    script / structure markers.
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== " ") { out += ch; continue; }
    const prev = out[out.length - 1];
    const next = s[i + 1];
    if (prev === undefined || next === undefined) continue; // leading/trailing
    const dropByPrev = prev === "{" || prev === "^" || prev === "_" || prev === "[";
    const dropByNext =
      next === "}" || next === "^" || next === "_" || next === "]" ||
      (prev === "{" && startsOpenerAt(s, i + 1));
    // A space right after a structure macro name (e.g. `\sqrt {b}`) is
    // syntax padding, never visible spacing.
    const afterMacro = /\\[a-zA-Z]+$/.test(out) && (next === "{" || next === "[");
    if (dropByPrev || dropByNext || afterMacro) continue;
    out += " ";
  }
  return out;
};

export default normalizeMathLayout;
