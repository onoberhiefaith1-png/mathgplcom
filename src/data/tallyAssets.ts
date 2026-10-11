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
  coin: { kind: "coin", label: "Coin", src: "/__l5e/assets-v1/26b4d3d5-f2a5-494a-a9e3-0fa684d8531e/gold_coin.png" },
  heart: { kind: "heart", label: "Heart", src: "/__l5e/assets-v1/c18328de-ad76-4c8b-a8d4-e86c0deabf0b/heart.png" },
  diamond: { kind: "diamond", label: "Diamond", src: "/__l5e/assets-v1/07faa783-e557-42f3-84e8-b7a5d2fd8ae5/diamond_big.png" },
  star: { kind: "star", label: "Star", src: "/__l5e/assets-v1/768ead1c-0498-4d8a-be85-e7d622d189d6/gold_star.png" },
  key: { kind: "key", label: "Key", src: "/__l5e/assets-v1/c7d74874-0ba7-4ab0-9d7d-a28a25dacc46/key.png" },
  energy: { kind: "energy", label: "Energy", src: "/__l5e/assets-v1/617e761d-1ba3-4d60-bd0c-74a31002ea0b/energy_orb.png" },
  crown: { kind: "crown", label: "Crown", src: "/__l5e/assets-v1/02b6087b-0fdc-4346-b4d2-040b9dc72d5e/crown.png" },
  potion: { kind: "potion", label: "Potion", src: "/__l5e/assets-v1/871c28a7-5f7b-4361-9191-a3731efcf998/purple_potion.png" },
  scroll: { kind: "scroll", label: "Scroll", src: "/__l5e/assets-v1/0c287396-635e-4566-ab11-ec9dfeff632b/scroll.png" },
  gem: { kind: "gem", label: "Gem", src: "/__l5e/assets-v1/4243c670-1184-498e-aa21-b838a01ac015/blue_diamond.png" },
};

export const BOMBS: Record<BombKind, { label: string; src: string }> = {
  horizontal: { label: "Row Bomb", src: bombHorizontal },
  vertical: { label: "Column Bomb", src: bombVertical },
  diagonal: { label: "Diagonal Bomb", src: bombDiagonal },
  area: { label: "Area Bomb", src: bombArea },
};

export const EXPLOSION_SRC = "/__l5e/assets-v1/c1e85a79-02ac-40e2-b039-010a3b888c09/fireball_explosion.png";

export const SPEED_OPTIONS: { label: string; seconds: number }[] = [
  { label: "30s", seconds: 30 },
  { label: "1:00", seconds: 60 },
  { label: "1:30", seconds: 90 },
  { label: "2:00", seconds: 120 },
  { label: "2:30", seconds: 150 },
  { label: "3:00", seconds: 180 },
];
