// Shared Unicode-math normalizer. Converts LaTeX/code syntax (\sqrt, ^{},
// \log_, *, \pm, ...) into classroom Unicode (√, ², log₂, ×, ±, ...).
// Used by the floating-number extractor on both server and client so chips
// never display raw `\sqrt`, `^{2}`, `**`, etc.

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "(": "⁽", ")": "⁾",
  "n": "ⁿ", "i": "ⁱ",
};
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "(": "₍", ")": "₎",
};

const toSup = (s: string) => s.split("").map((c) => SUP[c] ?? c).join("");
const toSub = (s: string) => s.split("").map((c) => SUB[c] ?? c).join("");

/** Convert any LaTeX / code-flavored math to Unicode classroom math. */
export const toUnicodeMath = (input: string): string => {
  if (!input) return "";
  let s = String(input);

  // Strip KaTeX-style $...$ / $$...$$ delimiters.
  s = s.replace(/\$+/g, "");

  // \sqrt
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_m, x) => `√(${x})`);
  s = s.replace(/\\sqrt\s*([A-Za-z0-9])/g, (_m, x) => `√${x}`);
  s = s.replace(/\\sqrt\b/g, "√");
  s = s.replace(/\\root\b/g, "√");
  s = s.replace(/\bsqrt\s*\(([^()]*)\)/gi, (_m, x) => `√(${x})`);
  s = s.replace(/\bsqrt\b/gi, "√");
  // collapse √(N) where N is a single atom → √N
  s = s.replace(/√\(([A-Za-z0-9]+)\)/g, (_m, x) => `√${x}`);

  // Leave \frac{a}{b} intact — the notebook renderer draws a real stacked
  // fraction from it. Collapsing to "(a)/(b)" produces a slash render
  // which is pedagogically wrong (it reads as (a/b)·…). Compound fillers
  // containing \frac are filtered out by isStillDirty.
  s = s.replace(/\\(?:d|t)?frac\b(?!\s*\{)/g, "□/□");

  // log subscripts
  s = s.replace(/\\log_\s*\{([^{}]+)\}/g, (_m, x) => `log${toSub(x)}`);
  s = s.replace(/\\log_\s*([0-9])/g, (_m, x) => `log${toSub(x)}`);
  s = s.replace(/\\log\b/g, "log");
  s = s.replace(/\\ln\b/g, "ln");

  // Generic subscript _{...} or _N
  s = s.replace(/_\{([0-9+\-()]+)\}/g, (_m, x) => toSub(x));
  s = s.replace(/_([0-9])/g, (_m, x) => toSub(x));

  // Powers ^{...}, ^N, **N
  s = s.replace(/\^\{([^{}]+)\}/g, (_m, x) => toSup(x));
  s = s.replace(/\^([0-9A-Za-z+\-()])/g, (_m, x) => toSup(x));
  s = s.replace(/\*\*([0-9A-Za-z]+)/g, (_m, x) => toSup(x));

  // operators / symbols
  s = s.replace(/\\cdot|\\times/g, "×");
  s = s.replace(/(?<![A-Za-z0-9])\*(?!\*)/g, "×");
  s = s.replace(/\\div/g, "÷");
  s = s.replace(/\\pm/g, "±").replace(/\\mp/g, "∓");
  s = s.replace(/\\leq/g, "≤").replace(/\\geq/g, "≥");
  s = s.replace(/\\neq/g, "≠").replace(/\\approx/g, "≈");
  s = s.replace(/\\infty/g, "∞");
  s = s.replace(/\\pi/g, "π").replace(/\\theta/g, "θ");
  s = s.replace(/\\alpha/g, "α").replace(/\\beta/g, "β").replace(/\\gamma/g, "γ");

  // Spacing macros / stray escapes
  s = s.replace(/\\left\b|\\right\b/g, "");
  s = s.replace(/\\[,!;: ]/g, " ");
  s = s.replace(/\\\\/g, " ");
  s = s.replace(/\\(?=[√πθαβγ])/g, "");
  s = s.replace(/\\(?=[()[\]{}+\-−=×÷*/])/g, "");

  // Hyphen → proper minus when between math atoms
  s = s.replace(/([0-9A-Za-z\)\]√π])\s*-\s*(?=[0-9A-Za-z\(\[√π])/g, "$1−");
  if (s.startsWith("-")) s = "−" + s.slice(1);

  // Strip stray braces left behind
  s = s.replace(/[{}]/g, "");

  return s.trim();
};

/** Returns true if any forbidden code-syntax substring is still present. */
export const isStillDirty = (s: string): boolean => {
  if (!s) return false;
  if (/\\[A-Za-z]+/.test(s)) return true;     // any \word
  if (/\\$/.test(s)) return true;             // trailing backslash
  if (/\^\{|_\{/.test(s)) return true;        // ^{...} or _{...}
  if (/\bsqrt\s*\(/i.test(s)) return true;    // sqrt(
  if (/\*\*/.test(s)) return true;            // **
  return false;
};
