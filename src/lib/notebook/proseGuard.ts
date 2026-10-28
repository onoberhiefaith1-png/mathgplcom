// PROSE vs MATH — one law, one implementation.
//
// A teaching NOTE is prose. Prose is allowed to quote mathematics
// ("Compare with ax² + bx + c = 0:", "Substitute x = 2"), and must survive
// verbatim. A line is math ONLY when it carries no real words: a bare
// equation, a numeric tail, a symbol run.
//
// Function names, units and operator words are NOT words for this purpose —
// "x = 2 sin θ" is still mathematics.

const MATH_WORDS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "sinh", "cosh", "tanh",
  "arcsin", "arccos", "arctan", "log", "ln", "lg", "exp", "lim", "sqrt",
  "max", "min", "det", "mod", "gcd", "lcm", "cm", "mm", "km", "kg", "ms",
  "deg", "rad", "cm2", "cm3", "x", "y", "z", "n", "e", "i", "pi",
]);

/** True when the line contains at least one ordinary English word. */
export const hasProseWord = (line: string): boolean => {
  const words = String(line ?? "").toLowerCase().match(/[a-z]{2,}/g) ?? [];
  return words.some((w) => !MATH_WORDS.has(w));
};

/** True when the line is pure mathematics and must never be stored as a note. */
export const looksLikeMathOnly = (line: string): boolean => {
  const s = String(line ?? "").trim();
  if (!s) return false;
  if (hasProseWord(s)) return false;
  if (/[=+\-−×÷/^]/.test(s)) return true;
  if (/^[\d\s.,()πθ]+$/.test(s)) return true;
  return false;
};
