export type RewardKind = "coin" | "crown" | "heart" | "diamond" | "star" | "key";

export const REWARD_KINDS: RewardKind[] = ["coin", "crown", "heart", "diamond", "star", "key"];

export const REWARD_META: Record<RewardKind, { src: string; label: string; color: string }> = {
  coin:    { src: "/assets/rewards/coin/gold_coin.png",          label: "Coins",    color: "text-amber-400" },
  crown:   { src: "/assets/ui/icons/crown.png",                  label: "Crowns",   color: "text-yellow-400" },
  heart:   { src: "/assets/ui/icons/heart.png",                  label: "Hearts",   color: "text-rose-400" },
  diamond: { src: "/assets/rewards/diamond/diamond_big.png",     label: "Diamonds", color: "text-sky-400" },
  star:    { src: "/assets/rewards/stars/gold_star.png",         label: "Stars",    color: "text-violet-400" },
  key:     { src: "/assets/ui/icons/key.png",                    label: "Keys",     color: "text-emerald-400" },
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
