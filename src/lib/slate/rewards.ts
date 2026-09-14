// Reward registry. Rewards are purely visual objects at this stage.

import markSeal from "@/assets/slate/rewards/mark-seal.png";
import retryHeart from "@/assets/slate/rewards/retry-heart.png";
import timeShard from "@/assets/slate/rewards/time-shard.png";
import mathCoin from "@/assets/slate/rewards/math-coin.png";
import mathCore from "@/assets/slate/rewards/math-core.png";
import horizontalCollector from "@/assets/slate/rewards/horizontal-collector.png";
import verticalCollector from "@/assets/slate/rewards/vertical-collector.png";

/** Activation profile names are consumed by the VFX engine (phase two). */
export type ActivationProfile =
  | "seal"
  | "heart"
  | "shard"
  | "coin"
  | "core"
  | "sweep-horizontal"
  | "sweep-vertical";

export interface RewardDef {
  id: string;
  label: string;
  art: string;
  /** Ambient colour used for dormant tint and activation glow. */
  glow: string;
  profile: ActivationProfile;
  /** Natural aspect ratio of the art, width / height. */
  ratio: number;
}

export const REWARDS: RewardDef[] = [
  { id: "mark-seal", label: "Mark Seal", art: markSeal, glow: "#ffc857", profile: "seal", ratio: 1 },
  { id: "retry-heart", label: "Retry Heart", art: retryHeart, glow: "#ff5470", profile: "heart", ratio: 1 },
  { id: "time-shard", label: "Time Shard", art: timeShard, glow: "#54d8ff", profile: "shard", ratio: 1 },
  { id: "math-coin", label: "Math Coin", art: mathCoin, glow: "#ffd33d", profile: "coin", ratio: 1 },
  { id: "math-core", label: "Math Core / Bomb", art: mathCore, glow: "#ff7a18", profile: "core", ratio: 1 },
  {
    id: "horizontal-collector",
    label: "Horizontal Collector",
    art: horizontalCollector,
    glow: "#ffab3d",
    profile: "sweep-horizontal",
    ratio: 1,
  },
  {
    id: "vertical-collector",
    label: "Vertical Collector",
    art: verticalCollector,
    glow: "#2fe0c0",
    profile: "sweep-vertical",
    ratio: 1,
  },
];

export const getReward = (id: string): RewardDef =>
  REWARDS.find((r) => r.id === id) ?? {
    id: "mark-seal", label: "Mark Seal", art: markSeal, glow: "#ffc857", profile: "seal", ratio: 1,
  };
