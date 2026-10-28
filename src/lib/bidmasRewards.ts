// Reward set for the BIDMAS / Order of Operations game.
export type BidmasRewardKind = "coin" | "diamond" | "heart" | "crown" | "star" | "gem" | "energy" | "key";

export const BIDMAS_REWARD_KINDS: BidmasRewardKind[] = [
  "coin", "diamond", "heart", "crown", "star", "gem", "energy", "key",
];

export const BIDMAS_REWARD_META: Record<BidmasRewardKind, { src: string; label: string; tint: string }> = {
  coin:    { src: "/__l5e/assets-v1/26b4d3d5-f2a5-494a-a9e3-0fa684d8531e/gold_coin.png",      label: "Coins",    tint: "text-amber-400" },
  diamond: { src: "/__l5e/assets-v1/07faa783-e557-42f3-84e8-b7a5d2fd8ae5/diamond_big.png", label: "Diamonds", tint: "text-sky-300" },
  heart:   { src: "/__l5e/assets-v1/c18328de-ad76-4c8b-a8d4-e86c0deabf0b/heart.png",              label: "Hearts",   tint: "text-rose-400" },
  crown:   { src: "/__l5e/assets-v1/02b6087b-0fdc-4346-b4d2-040b9dc72d5e/crown.png",              label: "Crowns",   tint: "text-yellow-300" },
  star:    { src: "/__l5e/assets-v1/768ead1c-0498-4d8a-be85-e7d622d189d6/gold_star.png",     label: "Stars",    tint: "text-yellow-200" },
  gem:     { src: "/__l5e/assets-v1/3c48127b-cb09-4d1c-8a46-4eb1d7f3929f/gem_coin.png",       label: "Gems",     tint: "text-fuchsia-300" },
  energy:  { src: "/__l5e/assets-v1/617e761d-1ba3-4d60-bd0c-74a31002ea0b/energy_orb.png",   label: "Energy",   tint: "text-violet-300" },
  key:     { src: "/__l5e/assets-v1/c7d74874-0ba7-4ab0-9d7d-a28a25dacc46/key.png",                label: "Keys",     tint: "text-emerald-300" },
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
