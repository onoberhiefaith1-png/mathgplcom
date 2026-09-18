// Reward registry. Rewards are purely visual objects at this stage.

import markSeal from "@/assets/slate/rewards/mark-seal.png";
import retryHeart from "@/assets/slate/rewards/retry-heart.png";
import timeShard from "@/assets/slate/rewards/time-shard.png";
import mathVault from "@/assets/slate/rewards/math-vault.png";
import mathVaultOpen from "@/assets/slate/rewards/math-vault-open.png";
import mathCore from "@/assets/slate/rewards/math-core.png";
import horizontalCollector from "@/assets/slate/rewards/horizontal-collector.png";
import verticalCollector from "@/assets/slate/rewards/vertical-collector.png";
import premiumChainBomb from "@/assets/slate/rewards/premium-chain-bomb.png";

/** Activation profile names are consumed by the VFX engine (phase two). */
export type ActivationProfile =
  | "seal"
  | "heart"
  | "shard"
  | "vault"
  | "core"
  | "chain-bomb"
  | "sweep-horizontal"
  | "sweep-vertical";

export interface RewardDef {
  id: string;
  label: string;
  art: string;
  /** Optional second presentation used once the object has opened. */
  openArt?: string;
  /** Ambient colour used for dormant tint and activation glow. */
  glow: string;
  profile: ActivationProfile;
  /** Natural aspect ratio of the art, width / height. */
  ratio: number;
  /**
   * Can the teacher place this object by hand? The Hourglass and the Vault are
   * DERIVED from the attached Floating Numbers line (its own timer, its own
   * expected method), so they are never placed from the generic palette.
   */
  placeable?: boolean;
}

export const REWARDS: RewardDef[] = [
  { id: "mark-seal", label: "Mark Seal", art: markSeal, glow: "#ffc857", profile: "seal", ratio: 1 },
  { id: "retry-heart", label: "Retry Heart", art: retryHeart, glow: "#ff5470", profile: "heart", ratio: 1 },
  // Derived from the Floating Numbers line timer — never placed by hand.
  {
    id: "time-shard",
    label: "Hourglass (line timer)",
    art: timeShard,
    glow: "#54d8ff",
    profile: "shard",
    ratio: 1,
    placeable: false,
  },
  {
    id: "math-vault",
    label: "Math Vault",
    art: mathVault,
    openArt: mathVaultOpen,
    glow: "#4ea8ff",
    profile: "vault",
    ratio: 2.25,
    // Derived from the line's own Vault expression — never placed by hand.
    placeable: false,
  },
  { id: "math-core", label: "Math Core / Bomb", art: mathCore, glow: "#ff7a18", profile: "core", ratio: 1 },
  {
    id: "premium-chain-bomb",
    label: "Premium Spherical Chain Bomb",
    art: premiumChainBomb,
    glow: "#ffe56b",
    profile: "chain-bomb",
    ratio: 1,
  },
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

/** Objects the teacher places by hand in the Game editor. */
export const PLACEABLE_REWARDS: RewardDef[] = REWARDS.filter((r) => r.placeable !== false);

export const getReward = (id: string): RewardDef =>
  REWARDS.find((r) => r.id === id) ?? {
    id: "mark-seal", label: "Mark Seal", art: markSeal, glow: "#ffc857", profile: "seal", ratio: 1,
  };
