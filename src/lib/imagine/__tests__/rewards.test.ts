import { describe, expect, it } from "vitest";
import { normalizeImagineGame, normalizeImagineReward } from "../rewards";
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