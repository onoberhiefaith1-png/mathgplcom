// LaTeX symbol macros → the Unicode the board writes.
//
// A teacher's saved line can hold `\Sigma x = 30`, `\mu = 6\text{cm}` or
// `x-\bar{x}` while the student's board line reads `Σx = 30`, `μ = 6cm`,
// `x−x̄`. They are the same mathematics, so both sides are brought to the
// same symbols before any comparison. Only symbol spelling changes here;
// nothing is evaluated. (A copy lives in supabase/functions/_shared for the
// marking service; keep the two maps identical.)

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
  zeta: "ζ", eta: "η", theta: "θ", vartheta: "θ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", rho: "ρ", varrho: "ρ",
  sigma: "σ", varsigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ",
  chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  // A bare summation sign with no limits is written Σ on the board.
  sum: "Σ", prod: "Π",
};

const MACRON = "\u0304";

export const latexSymbolsToUnicode = (raw: string): string => {
  let s = String(raw ?? "");
  // Text / roman wrappers around units and words: \text{cm} → cm.
  s = s.replace(/\\(?:text|textrm|mathrm|mathit|operatorname|mbox)\s*\{([^{}]*)\}/g, "$1");
  // Bars: \bar{x}, \overline{x}, \bar x → x̄ (one decorated symbol).
  s = s.replace(/\\(?:bar|overline)\s*\{\s*([A-Za-z\u0370-\u03FF])\s*\}/g, `$1${MACRON}`);
  s = s.replace(/\\bar\s+([A-Za-z\u0370-\u03FF])/g, `$1${MACRON}`);
  // Greek letters and bare Σ / Π. `\pi` stays for the constant reader.
  s = s.replace(/\\([A-Za-z]+)(?![A-Za-z])\s*/g, (whole, name: string) => {
    const glyph = GREEK[name];
    return glyph ?? whole;
  });
  // Combined forms normalise to the composed character pair (x + macron).
  return s.normalize("NFD").replace(/[\u0305]/g, MACRON).normalize("NFC");
};
