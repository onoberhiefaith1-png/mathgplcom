export type PrimeDifficulty = "easy" | "medium" | "hard";

export const PRIME_RANGES: Record<PrimeDifficulty, [number, number]> = {
  easy: [2, 20],
  medium: [21, 40],
  hard: [41, 2000],
};

export const PRIME_TIMERS: Record<PrimeDifficulty, number> = {
  easy: 120,
  medium: 150,
  hard: 240,
};

export const PRIME_COUNTS: Record<PrimeDifficulty, number> = {
  easy: 10,
  medium: 12,
  hard: 9,
};

export const isPrime = (n: number): boolean => {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  const r = Math.floor(Math.sqrt(n));
  for (let i = 3; i <= r; i += 2) if (n % i === 0) return false;
  return true;
};

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

export const pickRoundNumbers = (diff: PrimeDifficulty): number[] => {
  const [lo, hi] = PRIME_RANGES[diff];
  const count = PRIME_COUNTS[diff];
  const minPrimes = diff === "hard" ? 2 : 3;
  const set = new Set<number>();
  let attempts = 0;
  // Bias hard mode to smaller numbers (≤ ~300) for tractability
  const effHi = diff === "hard" ? Math.min(hi, 300) : hi;
  while (set.size < count && attempts++ < 800) {
    set.add(rand(lo, effHi));
  }
  let arr = [...set];
  const primesIn = arr.filter(isPrime);
  if (primesIn.length < minPrimes) {
    // inject some primes from a small known list overlapping the range
    const candidates: number[] = [];
    for (let n = lo; n <= effHi && candidates.length < 60; n++) if (isPrime(n)) candidates.push(n);
    while (primesIn.length < minPrimes && candidates.length) {
      const p = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
      if (!set.has(p)) {
        // replace a non-prime
        const compIdx = arr.findIndex((x) => !isPrime(x));
        if (compIdx >= 0) {
          set.delete(arr[compIdx]);
          set.add(p);
          arr = [...set];
          primesIn.push(p);
        } else break;
      }
    }
  }
  return [...set].sort((a, b) => a - b);
};
