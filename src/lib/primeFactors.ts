export type PFDifficulty = "easy" | "medium" | "hard";

export const PF_RANGES: Record<PFDifficulty, [number, number]> = {
  easy: [20, 200],
  medium: [200, 2000],
  hard: [2000, 100000],
};

export const PF_TIMERS: Record<PFDifficulty, number> = {
  easy: 240,
  medium: 300,
  hard: 360,
};

export const PF_LIVES: Record<PFDifficulty, number> = {
  easy: 5,
  medium: 5,
  hard: 4,
};

export const PF_MAX_PRIME: Record<PFDifficulty, number> = {
  easy: 13,
  medium: 19,
  hard: 31,
};

export const PRIME_HINTS = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31];

export const isPrime = (n: number): boolean => {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  const r = Math.floor(Math.sqrt(n));
  for (let i = 3; i <= r; i += 2) if (n % i === 0) return false;
  return true;
};

export const getPrimeFactors = (n: number): number[] => {
  const f: number[] = [];
  let x = n;
  let p = 2;
  while (x > 1) {
    while (x % p === 0) { f.push(p); x = x / p; }
    p++;
    if (p * p > x && x > 1) { f.push(x); break; }
  }
  return f;
};

export const toIndexNotation = (factors: number[]): { prime: number; power: number }[] => {
  const map = new Map<number, number>();
  for (const p of factors) map.set(p, (map.get(p) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([prime, power]) => ({ prime, power }));
};

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

export const pickFactorizable = (diff: PFDifficulty): number => {
  const [lo, hi] = PF_RANGES[diff];
  const maxPrime = PF_MAX_PRIME[diff];
  for (let i = 0; i < 800; i++) {
    const n = rand(lo, hi);
    if (isPrime(n)) continue;
    const f = getPrimeFactors(n);
    if (f.length < 2) continue;
    if (Math.max(...f) > maxPrime) continue;
    return n;
  }
  return diff === "easy" ? 60 : diff === "medium" ? 360 : 2160;
};

const SUPER: Record<string, string> = { "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹" };
export const toSuperscript = (n: number): string => String(n).split("").map((c) => SUPER[c] ?? c).join("");
