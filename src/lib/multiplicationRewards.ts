// Reward set for the Long Multiplication Builder.
// Mirrors src/lib/subtractionRewards.ts.

export type MulRewardKind = "coin" | "crown" | "heart" | "diamond" | "energy" | "gem" | "key" | "star";

export const MUL_REWARD_KINDS: MulRewardKind[] = [
  "coin", "crown", "heart", "diamond", "energy", "gem", "key", "star",
];

export const MUL_REWARD_META: Record<MulRewardKind, { src: string; label: string; tint: string }> = {
  coin:    { src: "/assets/rewards/coin/gold_coin.png",        label: "Coins",    tint: "text-amber-400" },
  crown:   { src: "/assets/ui/icons/crown.png",                label: "Crowns",   tint: "text-yellow-300" },
  heart:   { src: "/assets/ui/icons/heart.png",                label: "Hearts",   tint: "text-rose-400" },
  diamond: { src: "/assets/rewards/diamond/diamond_big.png",   label: "Diamonds", tint: "text-sky-300" },
  energy:  { src: "/assets/rewards/energy/energy_orb.png",     label: "Energy",   tint: "text-violet-300" },
  gem:     { src: "/assets/rewards/coin/gem_coin.png",         label: "Gems",     tint: "text-fuchsia-300" },
  key:     { src: "/assets/ui/icons/key.png",                  label: "Keys",     tint: "text-emerald-300" },
  star:    { src: "/assets/rewards/stars/gold_star.png",       label: "Stars",    tint: "text-yellow-200" },
};

const WEIGHTS: Record<MulRewardKind, number> = {
  coin: 0.55, star: 0.12, crown: 0.08, diamond: 0.07,
  heart: 0.06, energy: 0.05, gem: 0.04, key: 0.03,
};

export const pickMulReward = (): MulRewardKind => {
  const total = MUL_REWARD_KINDS.reduce((s, k) => s + WEIGHTS[k], 0);
  let r = Math.random() * total;
  for (const k of MUL_REWARD_KINDS) {
    r -= WEIGHTS[k];
    if (r <= 0) return k;
  }
  return "coin";
};
