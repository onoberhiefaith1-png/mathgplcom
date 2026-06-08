// Reward set for the BIDMAS / Order of Operations game.
export type BidmasRewardKind = "coin" | "diamond" | "heart" | "crown" | "star" | "gem" | "energy" | "key";

export const BIDMAS_REWARD_KINDS: BidmasRewardKind[] = [
  "coin", "diamond", "heart", "crown", "star", "gem", "energy", "key",
];

export const BIDMAS_REWARD_META: Record<BidmasRewardKind, { src: string; label: string; tint: string }> = {
  coin:    { src: "/assets/rewards/coin/gold_coin.png",      label: "Coins",    tint: "text-amber-400" },
  diamond: { src: "/assets/rewards/diamond/diamond_big.png", label: "Diamonds", tint: "text-sky-300" },
  heart:   { src: "/assets/ui/icons/heart.png",              label: "Hearts",   tint: "text-rose-400" },
  crown:   { src: "/assets/ui/icons/crown.png",              label: "Crowns",   tint: "text-yellow-300" },
  star:    { src: "/assets/rewards/stars/gold_star.png",     label: "Stars",    tint: "text-yellow-200" },
  gem:     { src: "/assets/rewards/coin/gem_coin.png",       label: "Gems",     tint: "text-fuchsia-300" },
  energy:  { src: "/assets/rewards/energy/energy_orb.png",   label: "Energy",   tint: "text-violet-300" },
  key:     { src: "/assets/ui/icons/key.png",                label: "Keys",     tint: "text-emerald-300" },
};

const WEIGHTS: Record<BidmasRewardKind, number> = {
  coin: 0.55, star: 0.10, diamond: 0.09, heart: 0.08, crown: 0.07, gem: 0.05, energy: 0.04, key: 0.02,
};

export const pickBidmasReward = (): BidmasRewardKind => {
  let r = Math.random();
  for (const k of BIDMAS_REWARD_KINDS) {
    r -= WEIGHTS[k];
    if (r <= 0) return k;
  }
  return "coin";
};
