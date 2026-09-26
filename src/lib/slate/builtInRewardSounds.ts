import bombImpact from "@/assets/sounds/rewards/premium-bomb-impact-a.mp3.asset.json";
import bombPlasma from "@/assets/sounds/rewards/premium-bomb-plasma-b.mp3.asset.json";
import collectorCascade from "@/assets/sounds/rewards/premium-collector-cascade-b.mp3.asset.json";
import collectorMagnet from "@/assets/sounds/rewards/premium-collector-magnet-a.mp3.asset.json";
import completionBadge from "@/assets/sounds/rewards/premium-completion-badge-b.mp3.asset.json";
import completionCoin from "@/assets/sounds/rewards/premium-completion-coin-a.mp3.asset.json";
import hourglassTime from "@/assets/sounds/rewards/premium-hourglass-time-a.mp3.asset.json";
import hourglassWarp from "@/assets/sounds/rewards/premium-hourglass-warp-b.mp3.asset.json";
import lifeEnergy from "@/assets/sounds/rewards/premium-life-energy-b.mp3.asset.json";
import lifeHeart from "@/assets/sounds/rewards/premium-life-heart-a.mp3.asset.json";
import vaultArcane from "@/assets/sounds/rewards/premium-vault-arcane-a.mp3.asset.json";
import vaultCrystal from "@/assets/sounds/rewards/premium-vault-crystal-b.mp3.asset.json";
import type { RewardSoundKey } from "./types";

interface AssetPointer {
  url: string;
}

export interface BuiltInRewardSound {
  id: string;
  key: RewardSoundKey;
  title: string;
  description: string;
  path: string;
}

const url = (asset: AssetPointer) => asset.url;

export const BUILT_IN_REWARD_SOUNDS: Record<RewardSoundKey, BuiltInRewardSound[]> = {
  bomb: [
    {
      id: "premium-bomb-impact-a",
      key: "bomb",
      title: "Impact Blast",
      description: "Deep cinematic hit with crisp debris sparkle.",
      path: url(bombImpact),
    },
    {
      id: "premium-bomb-plasma-b",
      key: "bomb",
      title: "Plasma Burst",
      description: "Fast energy crack followed by a compact shock thump.",
      path: url(bombPlasma),
    },
  ],
  vault: [
    {
      id: "premium-vault-arcane-a",
      key: "vault",
      title: "Arcane Unlock",
      description: "Magical lock turn with a bright reveal chime.",
      path: url(vaultArcane),
    },
    {
      id: "premium-vault-crystal-b",
      key: "vault",
      title: "Crystal Reveal",
      description: "Two polished crystal clicks into a shimmering bloom.",
      path: url(vaultCrystal),
    },
  ],
  life: [
    {
      id: "premium-life-heart-a",
      key: "life",
      title: "Heart Lift",
      description: "Warm rising reward pulse with soft magic dust.",
      path: url(lifeHeart),
    },
    {
      id: "premium-life-energy-b",
      key: "life",
      title: "Energy Bloom",
      description: "Glowing power-up swell with a clear magical finish.",
      path: url(lifeEnergy),
    },
  ],
  hourglass: [
    {
      id: "premium-hourglass-time-a",
      key: "hourglass",
      title: "Time Spark",
      description: "Precise clock ticks with a polished sparkle activation.",
      path: url(hourglassTime),
    },
    {
      id: "premium-hourglass-warp-b",
      key: "hourglass",
      title: "Time Warp",
      description: "Quick reverse-time whoosh resolving into a magic bell.",
      path: url(hourglassWarp),
    },
  ],
  completion: [
    {
      id: "premium-completion-coin-a",
      key: "completion",
      title: "Coin Pop",
      description: "Bright achievement coin pickup with a satisfying top note.",
      path: url(completionCoin),
    },
    {
      id: "premium-completion-badge-b",
      key: "completion",
      title: "Badge Shimmer",
      description: "Layered badge sparkle with a richer celebration tail.",
      path: url(completionBadge),
    },
  ],
  collector: [
    {
      id: "premium-collector-magnet-a",
      key: "collector",
      title: "Magnet Sweep",
      description: "Fast magnetic pull ending in a clean collection snap.",
      path: url(collectorMagnet),
    },
    {
      id: "premium-collector-cascade-b",
      key: "collector",
      title: "Pickup Cascade",
      description: "Rapid multi-pickup run with a crisp final sparkle.",
      path: url(collectorCascade),
    },
  ],
};

export const builtInRewardSoundsFor = (key: RewardSoundKey): BuiltInRewardSound[] =>
  BUILT_IN_REWARD_SOUNDS[key];