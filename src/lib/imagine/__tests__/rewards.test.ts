import { describe, expect, it } from "vitest";
import { editorPatternSlotId, normalizeImagineGame, normalizeImagineReward, removeEditorReward } from "../rewards";
import type { Game, RewardInstance } from "@/lib/slate/types";

const reward = (type: string): RewardInstance => ({
  id: `reward-${type}`,
  type,
  state: "dormant",
  hidden: false,
  x: 25,
  y: 40,
  scale: 1.4,
});

describe("Imagine reward replacement", () => {
  it.each(["math-core", "premium-chain-bomb"])("replaces %s with Energy Ball while preserving placement", (type) => {
    expect(normalizeImagineReward(reward(type))).toEqual({
      ...reward(type),
      type: "imagine-energy-ball",
    });
  });

  it("does not mutate the shared Game object used by the original 3D Game", () => {
    const original = {
      slots: [{ rewards: [reward("math-core")] }],
    } as unknown as Game;
    const imagine = normalizeImagineGame(original);
    expect(imagine.slots[0]?.rewards[0]?.type).toBe("imagine-energy-ball");
    expect(original.slots[0]?.rewards[0]?.type).toBe("math-core");
  });
});

describe("editor reward removal", () => {
  const game = { patternLength: 2, slots: [
    { id: "first", rewards: [reward("crown"), reward("heart")] },
    { id: "second", rewards: [reward("crown")] },
  ] } as unknown as Game;

  it("removes only the selected reward from its own surface", () => {
    const next = removeEditorReward(game, "first", "reward-crown");
    expect(next.slots[0]?.rewards.map((r) => r.id)).toEqual(["reward-heart"]);
    expect(next.slots[1]?.rewards.map((r) => r.id)).toEqual(["reward-crown"]);
    expect(game.slots[0]?.rewards).toHaveLength(2);
  });

  it("removes from the saved repeating pattern when selecting a preview line", () => {
    expect(editorPatternSlotId(game, "preview-4")).toBe("second");
    const next = removeEditorReward(game, "preview-4", "reward-crown");
    expect(next.slots[1]?.rewards).toEqual([]);
    expect(next.slots[0]?.rewards).toHaveLength(2);
  });

  it("ignores unknown surfaces rather than deleting from a fallback surface", () => {
    expect(removeEditorReward(game, "line-1", "reward-crown")).toBe(game);
    expect(editorPatternSlotId(game, "preview-0")).toBeNull();
  });
});