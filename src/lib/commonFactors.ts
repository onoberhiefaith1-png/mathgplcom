import { computeFactors } from "./factors";

export type CFDifficulty = "easy" | "medium" | "hard";

export const CF_RANGES: Record<CFDifficulty, [number, number]> = {
  easy: [6, 24],
  medium: [12, 60],
  hard: [12, 80],
};

export const CF_TIMERS: Record<CFDifficulty, number> = {
  easy: 240,
  medium: 300,
  hard: 360,
};

export const CF_LIVES: Record<CFDifficulty, number> = {
  easy: 5,
  medium: 5,
  hard: 4,
};

export const CF_COUNT: Record<CFDifficulty, number> = {
  easy: 2,
  medium: 2,
  hard: 3,
};

export const commonFactorsOf = (nums: number[]): number[] => {
  if (!nums.length) return [];
  let acc = computeFactors(nums[0]);
  for (let i = 1; i < nums.length; i++) {
    const f = new Set(computeFactors(nums[i]));
    acc = acc.filter((x) => f.has(x));
  }
  return acc;
};

export const hcfOf = (nums: number[]): number => {
  const c = commonFactorsOf(nums);
  return c.length ? Math.max(...c) : 1;
};

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

export const pickRound = (diff: CFDifficulty): number[] => {
  const [lo, hi] = CF_RANGES[diff];
  const k = CF_COUNT[diff];
  const minHcf = diff === "hard" ? 3 : 2;
  for (let i = 0; i < 800; i++) {
    const nums: number[] = [];
    for (let j = 0; j < k; j++) nums.push(rand(lo, hi));
    if (new Set(nums).size !== k) continue;
    const c = commonFactorsOf(nums);
    if (c.length < 3) continue;
    if (Math.max(...c) < minHcf) continue;
    return nums;
  }
  // fallback
  return diff === "hard" ? [12, 24, 36] : [24, 36];
};
