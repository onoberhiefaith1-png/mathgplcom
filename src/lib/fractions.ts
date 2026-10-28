// Fraction problem generators & validators for the two Fractions games.

export type FractionDifficulty = "easy" | "medium" | "hard";

export interface ImproperFraction {
  num: number;
  den: number;
}

export interface MixedNumber {
  whole: number;
  num: number;
  den: number;
}

export const TIMERS: Record<FractionDifficulty, number> = {
  easy: 180,
  medium: 150,
  hard: 120,
};

export const MAX_LANES: Record<FractionDifficulty, number> = {
  easy: 5,
  medium: 5,
  hard: 5,
};

// How many lanes are active at the very start; ramps up over time.
export const INITIAL_LANES: Record<FractionDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

// How many seconds between activating an additional lane.
export const LANE_RAMP_SEC: Record<FractionDifficulty, number> = {
  easy: 18,
  medium: 14,
  hard: 9,
};

// Per-difficulty edge-to-edge time for capsules.
export const TRAVEL_SEC: Record<FractionDifficulty, number> = {
  easy: 28,
  medium: 22,
  hard: 16,
};

const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

export const pickImproper = (d: FractionDifficulty): ImproperFraction => {
  let den: number, whole: number, num: number;
  if (d === "easy") {
    den = rand(2, 5);
    whole = rand(1, 4);
  } else if (d === "medium") {
    den = rand(2, 9);
    whole = rand(2, 8);
  } else {
    den = rand(3, 12);
    whole = rand(3, 12);
  }
  num = rand(1, den - 1); // ensure not a whole number
  return { num: whole * den + num, den };
};

export const pickMixed = (d: FractionDifficulty): MixedNumber => {
  let den: number, whole: number;
  if (d === "easy") {
    den = rand(2, 5);
    whole = rand(1, 4);
  } else if (d === "medium") {
    den = rand(2, 9);
    whole = rand(2, 8);
  } else {
    den = rand(3, 12);
    whole = rand(3, 12);
  }
  const num = rand(1, den - 1);
  return { whole, num, den };
};

/** Reduce a fraction to simplest form (used only for equivalence checks). */
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export const validateImproperToMixed = (
  f: ImproperFraction,
  ans: MixedNumber,
): boolean => {
  if (ans.den <= 0 || ans.num < 0 || ans.whole < 0) return false;
  if (ans.num >= ans.den) return false;
  // ans.whole + ans.num/ans.den must equal f.num/f.den
  const lhsNum = ans.whole * ans.den + ans.num;
  // lhsNum / ans.den === f.num / f.den
  return lhsNum * f.den === f.num * ans.den;
};

export const validateMixedToImproper = (
  m: MixedNumber,
  ans: ImproperFraction,
): boolean => {
  if (ans.den <= 0 || ans.num <= 0) return false;
  const lhsNum = m.whole * m.den + m.num;
  // ans.num / ans.den === lhsNum / m.den (allow equivalent forms)
  return ans.num * m.den === lhsNum * ans.den;
};

export const correctMixed = (f: ImproperFraction): MixedNumber => ({
  whole: Math.floor(f.num / f.den),
  num: f.num % f.den,
  den: f.den,
});

export const correctImproper = (m: MixedNumber): ImproperFraction => ({
  num: m.whole * m.den + m.num,
  den: m.den,
});
