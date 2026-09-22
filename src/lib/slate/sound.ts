// Game Sound configuration.
//
// Two completely separate systems:
//   • one persistent Game Background Sound, owned by the Game session
//   • one independent event sound per reward type
//
// This module only describes and normalises the teacher's choices. Playback
// lives in `gameSound.ts`; nothing here ever touches mathematics or rewards.

import type { GameSoundSettings, RewardSoundKey, SoundSlot } from "./types";

/** Every reward family that can carry its own sound. */
export const REWARD_SOUND_KEYS: RewardSoundKey[] = [
  "vault",
  "bomb",
  "life",
  "hourglass",
  "collector",
  "completion",
];

export const REWARD_SOUND_LABEL: Record<RewardSoundKey, string> = {
  vault: "Vault",
  bomb: "Bomb",
  life: "Life",
  hourglass: "Hourglass",
  collector: "Collector",
  completion: "Completion Coin",
};

/** Which sound a placed reward type belongs to. */
export const rewardSoundKeyForType = (type: string): RewardSoundKey | null => {
  switch (type) {
    case "math-vault":
      return "vault";
    case "math-core":
    case "premium-chain-bomb":
      return "bomb";
    case "retry-heart":
      return "life";
    case "time-shard":
      return "hourglass";
    case "horizontal-collector":
    case "vertical-collector":
      return "collector";
    case "mark-seal":
      return "completion";
    default:
      return null;
  }
};

const clampVolume = (value: unknown, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
};

const normalizeSlot = (slot: unknown, fallbackVolume: number): SoundSlot => {
  const raw = (slot ?? {}) as Partial<SoundSlot>;
  const source = raw.ref?.source === "builtin" || raw.ref?.source === "official" ? raw.ref.source : "user";
  const ref = raw.ref && typeof raw.ref.path === "string" && raw.ref.path
    ? {
        source,
        path: raw.ref.path,
        ...(raw.ref.title ? { title: raw.ref.title } : {}),
      }
    : null;
  return { ref, volume: clampVolume(raw.volume, fallbackVolume) };
};

/** Silence everywhere: an existing Game keeps playing exactly as before. */
export const defaultSoundSettings = (): GameSoundSettings => ({
  background: { ref: null, volume: 0.4, enabled: true },
  rewards: Object.fromEntries(
    REWARD_SOUND_KEYS.map((key) => [key, { ref: null, volume: 0.8 }]),
  ) as Record<RewardSoundKey, SoundSlot>,
});

/** Fills in anything a saved Game is missing, without dropping a choice. */
export const normalizeSoundSettings = (saved: unknown): GameSoundSettings => {
  const base = defaultSoundSettings();
  const raw = (saved ?? {}) as Partial<GameSoundSettings>;
  const background = normalizeSlot(raw.background, base.background.volume);
  return {
    background: {
      ...background,
      enabled: (raw.background as { enabled?: boolean } | undefined)?.enabled !== false,
    },
    rewards: Object.fromEntries(
      REWARD_SOUND_KEYS.map((key) => [
        key,
        normalizeSlot(raw.rewards?.[key], base.rewards[key]!.volume),
      ]),
    ) as Record<RewardSoundKey, SoundSlot>,
  };
};

/** A readable name for a chosen sound. */
export const soundName = (slot: SoundSlot | null | undefined): string =>
  slot?.ref?.title?.trim() || slot?.ref?.path?.split("/").pop() || "";
