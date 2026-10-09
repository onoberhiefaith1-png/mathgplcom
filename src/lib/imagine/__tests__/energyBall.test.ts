import { describe, expect, it } from "vitest";
import {
  imagineEnergyBallTargets,
  isEnergyBallTargetEligible,
  isImagineEnergyBall,
  type ImagineRewardTarget,
} from "../energyBall";
import type { RewardInstance } from "@/lib/slate/types";

const target = (
  id: string,
  type: string,
  overrides: Partial<RewardInstance> & { visible?: boolean } = {},
): ImagineRewardTarget => ({
  slotId: `slot-${id}`,
  visible: overrides.visible ?? true,
  reward: {
    id,
    type,
    state: overrides.state ?? "dormant",
    hidden: overrides.hidden ?? false,
    x: 50,
    y: 50,
  },
});

describe("Imagine Energy Ball activation", () => {
  it("recognises the Energy Ball type", () => {
    expect(isImagineEnergyBall("imagine-energy-ball")).toBe(true);
    expect(isImagineEnergyBall("math-core")).toBe(false);
  });

  it("excludes exactly the Hourglass and the Completion coin", () => {
    expect(isEnergyBallTargetEligible("time-shard")).toBe(false);
    expect(isEnergyBallTargetEligible("mark-seal")).toBe(false);
    expect(isEnergyBallTargetEligible("math-vault")).toBe(true);
    expect(isEnergyBallTargetEligible("retry-heart")).toBe(true);
    expect(isEnergyBallTargetEligible("horizontal-collector")).toBe(true);
    expect(isEnergyBallTargetEligible("vertical-collector")).toBe(true);
    expect(isEnergyBallTargetEligible("imagine-energy-ball")).toBe(true);
    expect(isEnergyBallTargetEligible("imagine-calculator")).toBe(true);
  });

  it("targets the Vault, Life, collectors, another Energy Ball and Calculator", () => {
    const targets = [
      target("vault", "math-vault"),
      target("life", "retry-heart"),
      target("h-collector", "horizontal-collector"),
      target("v-collector", "vertical-collector"),
      target("energy", "imagine-energy-ball"),
      target("calc", "imagine-calculator"),
    ];
    expect(imagineEnergyBallTargets("source", targets, new Set())
      .map(({ reward }) => reward.id))
      .toEqual(["vault", "life", "h-collector", "v-collector", "energy", "calc"]);
  });

  it("never targets the Hourglass or Completion, and skips hidden, active, visited and off-screen rewards", () => {
    const targets = [
      target("timer", "time-shard"),
      target("completion", "mark-seal"),
      target("hidden", "retry-heart", { hidden: true }),
      target("active", "retry-heart", { state: "active" }),
      target("visited", "imagine-energy-ball"),
      target("offscreen", "math-vault", { visible: false }),
      target("eligible", "imagine-calculator"),
    ];
    expect(imagineEnergyBallTargets("source", targets, new Set(["visited"]))
      .map(({ reward }) => reward.id)).toEqual(["eligible"]);
  });

  it("fires each reward once, so a chain through another Energy Ball terminates", () => {
    const visited = new Set(["source"]);
    const first = imagineEnergyBallTargets("source", [
      target("energy", "imagine-energy-ball"),
      target("vault", "math-vault"),
    ], visited);
    first.forEach(({ reward }) => visited.add(reward.id));
    const second = imagineEnergyBallTargets("energy", [
      target("energy", "imagine-energy-ball"),
      target("vault", "math-vault"),
      target("source", "imagine-energy-ball"),
    ], visited);
    expect(first.map(({ reward }) => reward.id)).toEqual(["energy", "vault"]);
    expect(second).toEqual([]);
  });
});
