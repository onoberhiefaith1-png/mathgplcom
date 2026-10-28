export type RewardKind = "coin" | "crown" | "heart" | "diamond" | "star" | "key";

export const REWARD_KINDS: RewardKind[] = ["coin", "crown", "heart", "diamond", "star", "key"];

export const REWARD_META: Record<RewardKind, { src: string; label: string; color: string }> = {
  coin:    { src: "/__l5e/assets-v1/26b4d3d5-f2a5-494a-a9e3-0fa684d8531e/gold_coin.png",          label: "Coins",    color: "text-amber-400" },
  crown:   { src: "/__l5e/assets-v1/02b6087b-0fdc-4346-b4d2-040b9dc72d5e/crown.png",                  label: "Crowns",   color: "text-yellow-400" },
  heart:   { src: "/__l5e/assets-v1/c18328de-ad76-4c8b-a8d4-e86c0deabf0b/heart.png",                  label: "Hearts",   color: "text-rose-400" },
  diamond: { src: "/__l5e/assets-v1/07faa783-e557-42f3-84e8-b7a5d2fd8ae5/diamond_big.png",     label: "Diamonds", color: "text-sky-400" },
  star:    { src: "/__l5e/assets-v1/768ead1c-0498-4d8a-be85-e7d622d189d6/gold_star.png",         label: "Stars",    color: "text-violet-400" },
  key:     { src: "/__l5e/assets-v1/c7d74874-0ba7-4ab0-9d7d-a28a25dacc46/key.png",                    label: "Keys",     color: "text-emerald-400" },
};

export type RewardWeights = Record<RewardKind, number>;

// 80% coin, 20% objective rewards (split across crown/heart/diamond).
export const DEFAULT_WEIGHTS: RewardWeights = {
  coin: 0.8, crown: 0.07, heart: 0.07, diamond: 0.06, star: 0, key: 0,
};

export const pickRewardWeighted = (w: RewardWeights): RewardKind => {
  const total = REWARD_KINDS.reduce((s, k) => s + (w[k] || 0), 0) || 1;
  let r = Math.random() * total;
  for (const k of REWARD_KINDS) {
    r -= w[k] || 0;
    if (r <= 0) return k;
  }
  return "coin";
};
