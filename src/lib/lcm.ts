// LCM Ladder engine.

export type LcmDifficulty = "easy" | "medium" | "hard";

export const LCM_TIMERS: Record<LcmDifficulty, number> = {
  easy: 240,
  medium: 300,
  hard: 360,
};

export const isPrime = (n: number): boolean => {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
};

export const lcmOf = (nums: number[]): number => {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  return nums.reduce((acc, n) => (acc * n) / gcd(acc, n), 1);
};

const SMALL_PRIMES = [2, 3, 5, 7, 11, 13];

/** Returns the prime divisor sequence to fully reduce `nums` to all-1s. */
export const primeDivisorSequence = (nums: number[]): number[] => {
  const out: number[] = [];
  let cur = nums.slice();
  while (cur.some((x) => x > 1)) {
    let chosen: number | null = null;
    for (const p of SMALL_PRIMES) {
      if (cur.some((x) => x % p === 0 && x > 1)) { chosen = p; break; }
    }
    if (chosen == null) {
      // fallback: smallest prime factor of any > 1
      const target = cur.find((x) => x > 1)!;
      for (let p = 2; p <= target; p++) if (target % p === 0 && isPrime(p)) { chosen = p; break; }
    }
    if (chosen == null) break;
    out.push(chosen);
    cur = cur.map((x) => (x % chosen! === 0 ? x / chosen! : x));
  }
  return out;
};

export const applyDivisor = (row: number[], d: number): number[] =>
  row.map((x) => (x > 0 && x % d === 0 ? x / d : x));

/** Whether `d` divides at least one entry > 1 in row. */
export const divisorHelps = (row: number[], d: number): boolean =>
  row.some((x) => x > 1 && x % d === 0);

export const pickLcmProblem = (diff: LcmDifficulty): number[] => {
  const ri = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
  for (let attempt = 0; attempt < 80; attempt++) {
    let nums: number[];
    if (diff === "easy") nums = [ri(4, 18), ri(4, 18)];
    else if (diff === "medium") nums = [ri(6, 30), ri(6, 30), ri(6, 30)];
    else nums = [ri(10, 60), ri(10, 60), ri(10, 60)];
    // dedupe trivial
    if (new Set(nums).size < 2) continue;
    if (nums.some((n) => n < 2)) continue;
    const seq = primeDivisorSequence(nums);
    if (seq.length >= 2 && seq.length <= 8) return nums;
  }
  return diff === "easy" ? [12, 18] : [12, 15, 18];
};
