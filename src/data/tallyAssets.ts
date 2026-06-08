import bombHorizontal from "@/assets/tally/bomb_horizontal.png";
import bombVertical from "@/assets/tally/bomb_vertical.png";
import bombDiagonal from "@/assets/tally/bomb_diagonal.png";
import bombArea from "@/assets/tally/bomb_area.png";

export type RewardKind =
  | "coin"
  | "heart"
  | "diamond"
  | "star"
  | "key"
  | "energy"
  | "crown"
  | "potion"
  | "scroll"
  | "gem";

export type BombKind = "horizontal" | "vertical" | "diagonal" | "area";

export interface RewardDef {
  kind: RewardKind;
  label: string;
  src: string;
}

export const REWARDS: Record<RewardKind, RewardDef> = {
  coin: { kind: "coin", label: "Coin", src: "/assets/rewards/coin/gold_coin.png" },
  heart: { kind: "heart", label: "Heart", src: "/assets/ui/icons/heart.png" },
  diamond: { kind: "diamond", label: "Diamond", src: "/assets/rewards/diamond/diamond_big.png" },
  star: { kind: "star", label: "Star", src: "/assets/rewards/stars/gold_star.png" },
  key: { kind: "key", label: "Key", src: "/assets/ui/icons/key.png" },
  energy: { kind: "energy", label: "Energy", src: "/assets/rewards/energy/energy_orb.png" },
  crown: { kind: "crown", label: "Crown", src: "/assets/ui/icons/crown.png" },
  potion: { kind: "potion", label: "Potion", src: "/assets/ui/icons/purple_potion.png" },
  scroll: { kind: "scroll", label: "Scroll", src: "/assets/ui/icons/scroll.png" },
  gem: { kind: "gem", label: "Gem", src: "/assets/ui/icons/blue_diamond.png" },
};

export const BOMBS: Record<BombKind, { label: string; src: string }> = {
  horizontal: { label: "Row Bomb", src: bombHorizontal },
  vertical: { label: "Column Bomb", src: bombVertical },
  diagonal: { label: "Diagonal Bomb", src: bombDiagonal },
  area: { label: "Area Bomb", src: bombArea },
};

export const EXPLOSION_SRC = "/assets/effects/explosion/fireball_explosion.png";

export const SPEED_OPTIONS: { label: string; seconds: number }[] = [
  { label: "30s", seconds: 30 },
  { label: "1:00", seconds: 60 },
  { label: "1:30", seconds: 90 },
  { label: "2:00", seconds: 120 },
  { label: "2:30", seconds: 150 },
  { label: "3:00", seconds: 180 },
];
