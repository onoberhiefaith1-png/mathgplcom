import { describe, expect, it } from "vitest";
import { isWorldInteractionEligible, rewardMayFire } from "../rewards";

describe("reward gate", () => {
  it("refuses a reward whose line has not been marked", () => {
    expect(rewardMayFire({ line: 2, rewardId: "premium-chain-bomb-1", completedLines: [1] })).toBe(false);
  });

  it("allows a reward once its own line is marked correct", () => {
    expect(rewardMayFire({ line: 2, rewardId: "premium-chain-bomb-1", completedLines: [1, 2] })).toBe(true);
  });

  it("allows a Vault opened by the student's own working", () => {
    expect(rewardMayFire({ line: 4, rewardId: "vault-a", completedLines: [] })).toBe(true);
  });

  it("keeps hourglass, coin and vault out of bomb and collector chains", () => {
    expect(isWorldInteractionEligible("time-shard")).toBe(false);
    expect(isWorldInteractionEligible("mark-seal")).toBe(false);
    expect(isWorldInteractionEligible("math-vault")).toBe(false);
    expect(isWorldInteractionEligible("premium-chain-bomb")).toBe(true);
    expect(isWorldInteractionEligible("retry-heart")).toBe(true);
  });
});
