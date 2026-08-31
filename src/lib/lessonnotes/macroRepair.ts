// Model output travels as JSON. A model that writes `"\frac{140}{2}"` without
// escaping the backslash produces a real FORM FEED plus the text `rac{140}{2}`
// once the payload is parsed — the macro name is destroyed before any math
// parser sees it, and the notebook showed `rac140°2` beside an empty fraction
// bar.
//
// This pass restores the macro name, and ONLY when the characters that follow
// complete a macro we actually support. Ordinary tabs, newlines and returns are
// left untouched.

/** control character → macro tails it can begin */
const TAILS: Record<string, string[]> = {
  "\f": ["frac", "floor", "forall"],
  "\b": ["binom", "bar", "begin", "bigcup", "bigcap", "beta", "bmatrix"],
  "\v": ["vec", "vmatrix"],
  "\t": ["times", "tfrac", "tilde", "theta", "to", "tan", "text"],
  "\r": ["right", "rightarrow", "rho"],
  "\n": ["neq", "norm", "newline", "nu"],
  "\x07": ["alpha", "approx", "abs", "array", "angle"],
};

export function repairMangledMacros(input: string): string {
  if (!input) return "";
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    const tails = TAILS[ch];
    if (tails) {
      const rest = input.slice(i + 1);
      // The tail must be followed by a boundary — `{`, `[`, whitespace, digit,
      // punctuation — so ordinary words are never rewritten.
      const hit = tails
        .filter((t) => rest.startsWith(t.slice(1)) && !/^[A-Za-z]/.test(rest.slice(t.length - 1)))
        .sort((a, b) => b.length - a.length)[0];
      if (hit) {
        out += `\\${hit}`;
        i += hit.length - 1;
        continue;
      }
    }
    out += ch;
  }
  return out;
}
