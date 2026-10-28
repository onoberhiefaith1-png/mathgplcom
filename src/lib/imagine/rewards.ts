import type { Game, RewardInstance } from "@/lib/slate/types";
import { patternLengthOf, patternSlotIndex } from "@/lib/slate/pattern";

/** Preview lines borrow rewards from saved pattern slots. */
export function editorPatternSlotId(game: Game, renderedSlotId: string): string | null {
  const saved = game.slots.find((slot) => slot.id === renderedSlotId);
  if (saved) return saved.id;
  const preview = /^preview-(\d+)$/.exec(renderedSlotId);
  if (!preview) return null;
  const index = patternSlotIndex(Number(preview[1]), patternLengthOf(game));
  return game.slots[index]?.id ?? null;
}

export function removeEditorReward(game: Game, renderedSlotId: string, rewardId: string): Game {
  const slotId = editorPatternSlotId(game, renderedSlotId);
  if (!slotId) return game;
  return { ...game, slots: game.slots.map((slot) => slot.id === slotId
    ? { ...slot, rewards: slot.rewards.filter((reward) => reward.id !== rewardId) }
    : slot) };
}

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