import type { Game, RewardInstance } from "@/lib/slate/types";

export const IMAGINE_RETIRED_BOMB_TYPES = new Set(["math-core", "premium-chain-bomb"]);

export const normalizeImagineReward = (reward: RewardInstance): RewardInstance =>
  IMAGINE_RETIRED_BOMB_TYPES.has(reward.type)
    ? { ...reward, type: "imagine-energy-ball" }
    : reward;

/** Imagine reads shared Game data without changing the original 3D Game. */
export const normalizeImagineGame = (game: Game): Game => ({
  ...game,
  slots: game.slots.map((slot) => ({
    ...slot,
    rewards: slot.rewards.map(normalizeImagineReward),
  })),
});

export const isImagineRewardChoice = (type: string): boolean =>
  !IMAGINE_RETIRED_BOMB_TYPES.has(type);