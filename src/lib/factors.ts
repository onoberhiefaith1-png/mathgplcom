export type FactorDifficulty = "easy" | "medium" | "hard";

export const FACTOR_RANGES: Record<FactorDifficulty, [number, number]> = {
  easy: [6, 20],
  medium: [21, 40],
  hard: [41, 100],
};

export const FACTOR_TIMERS: Record<FactorDifficulty, number> = {
  easy: 90,
  medium: 75,
  hard: 60,
};

export const computeFactors = (n: number): number[] => {
  const out: number[] = [];
  for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i);
  return out;
};

export const factorPairs = (n: number): Array<[number, number]> => {
  const f = computeFactors(n);
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (const a of f) {
    const b = n / a;
    if (!Number.isInteger(b)) continue;
    const key = a <= b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a <= b ? [a, b] : [b, a]);
  }
  return out;
};

export const pickTarget = (diff: FactorDifficulty): number => {
  const [lo, hi] = FACTOR_RANGES[diff];
  // Bias toward composite numbers (more factors → more interesting)
  for (let attempts = 0; attempts < 8; attempts++) {
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    if (computeFactors(n).length >= 4) return n;
  }
  return lo + Math.floor(Math.random() * (hi - lo + 1));
};
