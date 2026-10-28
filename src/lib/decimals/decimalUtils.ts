// Decimal ⇄ Fraction utilities for the Decimals subtopic.
// Pure functions, no React deps.

export interface Frac { n: number; d: number }

const gcd = (a: number, b: number): number => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};

export const reduce = (f: Frac): Frac => {
  if (f.d === 0) return f;
  if (f.d < 0) f = { n: -f.n, d: -f.d };
  const g = gcd(Math.abs(f.n), f.d);
  return { n: f.n / g, d: f.d / g };
};

/** "0.75" → {n: 3, d: 4}. Accepts negative. */
export const decimalStringToFrac = (s: string): Frac | null => {
  s = s.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const sign = s.startsWith("-") ? -1 : 1;
  if (sign < 0) s = s.slice(1);
  const dot = s.indexOf(".");
  if (dot < 0) return reduce({ n: sign * Number(s), d: 1 });
  const intPart = s.slice(0, dot);
  const fracPart = s.slice(dot + 1);
  const den = Math.pow(10, fracPart.length);
  const n = sign * (Number(intPart) * den + Number(fracPart));
  return reduce({ n, d: den });
};

/**
 * Convert n/d to its decimal expansion. Detects a repeating block via
 * remainder cycle. Returns the integer part, non-repeating fractional digits,
 * and (if repeating) the repetend.
 */
export interface DecimalExpansion {
  sign: 1 | -1;
  intPart: string;       // "3"
  nonRepeat: string;     // ""    — digits between point and repetend
  repetend: string;      // "3"   — empty if terminating
}

export const expandDecimal = (n: number, d: number, maxDigits = 60): DecimalExpansion => {
  const sign: 1 | -1 = (n < 0) !== (d < 0) ? -1 : 1;
  n = Math.abs(n); d = Math.abs(d);
  const intPart = String(Math.floor(n / d));
  let rem = n % d;
  if (rem === 0) return { sign, intPart, nonRepeat: "", repetend: "" };

  const seen = new Map<number, number>(); // remainder → digit index
  const digits: string[] = [];
  while (rem !== 0 && !seen.has(rem) && digits.length < maxDigits) {
    seen.set(rem, digits.length);
    rem *= 10;
    digits.push(String(Math.floor(rem / d)));
    rem = rem % d;
  }
  if (rem === 0) return { sign, intPart, nonRepeat: digits.join(""), repetend: "" };
  if (seen.has(rem)) {
    const start = seen.get(rem)!;
    return {
      sign,
      intPart,
      nonRepeat: digits.slice(0, start).join(""),
      repetend: digits.slice(start).join(""),
    };
  }
  // Hit max digits without finding cycle — treat what we have as terminating.
  return { sign, intPart, nonRepeat: digits.join(""), repetend: "" };
};

/** Format a decimal expansion as a plain string with the repetend shown N times. */
export const formatExpansion = (e: DecimalExpansion, repeats = 4): string => {
  const sign = e.sign < 0 ? "-" : "";
  if (!e.repetend && !e.nonRepeat) return sign + e.intPart;
  let frac = e.nonRepeat;
  if (e.repetend) frac += e.repetend.repeat(repeats);
  return `${sign}${e.intPart}.${frac}`;
};

/**
 * Check whether a student-typed decimal string matches the fraction n/d.
 * - Terminating: exact match (after trimming trailing zeros).
 * - Repeating: the typed digits after the decimal point must START with
 *   nonRepeat and then repeat the repetend at least `minRepeats` times.
 */
export const decimalMatchesFraction = (
  input: string,
  n: number,
  d: number,
  minRepeats = 4,
): boolean => {
  if (!/^-?\d+(\.\d+)?$/.test(input.trim())) return false;
  const f = decimalStringToFrac(input);
  if (!f) return false;
  const expansion = expandDecimal(n, d);

  const sign = expansion.sign;
  if (sign < 0 !== input.trim().startsWith("-")) return false;

  const cleanInput = input.trim().replace(/^-/, "");
  const dot = cleanInput.indexOf(".");
  const intStr = dot < 0 ? cleanInput : cleanInput.slice(0, dot);
  const fracStr = dot < 0 ? "" : cleanInput.slice(dot + 1);

  if (intStr.replace(/^0+/, "") !== expansion.intPart.replace(/^0+/, "") &&
      !(intStr === "" && expansion.intPart === "0") &&
      Number(intStr) !== Number(expansion.intPart)) return false;

  // Terminating: input fractional must equal expansion.nonRepeat (ignoring trailing zeros).
  if (!expansion.repetend) {
    return fracStr.replace(/0+$/, "") === expansion.nonRepeat.replace(/0+$/, "");
  }

  // Repeating: fracStr must start with nonRepeat
  if (!fracStr.startsWith(expansion.nonRepeat)) return false;
  const tail = fracStr.slice(expansion.nonRepeat.length);
  if (tail.length === 0) return false;
  // tail must consist of repeated copies of expansion.repetend, with at least minRepeats full copies
  const rep = expansion.repetend;
  if (tail.length < rep.length * minRepeats) return false;
  for (let i = 0; i < tail.length; i++) {
    if (tail[i] !== rep[i % rep.length]) return false;
  }
  // Also require it to end on a full repetend boundary OR be exactly N full copies.
  const fullCopies = Math.floor(tail.length / rep.length);
  return fullCopies >= minRepeats;
};

export { gcd };
