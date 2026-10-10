import { describe, expect, it } from "vitest";
import { completionOutcome, defaultGameCompletionFlow, visibleRewardRows } from "@/lib/imagine/gameCompletion";

describe("Game question completion", () => {
  it("uses final victory on the last question", () => {
    expect(completionOutcome({ final: true, marks: 3, totalMarks: 3, availableRewards: 1, collectedRewards: 1 })).toBe("victory");
  });

  it("uses perfect only when full marks and every reward were earned", () => {
    expect(completionOutcome({ marks: 3, totalMarks: 3, availableRewards: 2, collectedRewards: 2 })).toBe("perfect");
    expect(completionOutcome({ marks: 3, totalMarks: 3, availableRewards: 2, collectedRewards: 1 })).toBe("complete");
  });

  it("keeps failure and early exit distinct", () => {
    expect(completionOutcome({ failed: true, marks: 0, totalMarks: 3, availableRewards: 0, collectedRewards: 0 })).toBe("failed");
    expect(completionOutcome({ left: true, marks: 0, totalMarks: 3, availableRewards: 0, collectedRewards: 0 })).toBe("left");
  });

  it("hides reward rows whose value is zero", () => {
    expect(visibleRewardRows({ marks: 2, totalMarks: 3, completionCoins: 1, vaultReward: 0, vaultsOpened: 0, timeEarnedSeconds: 0, livesDelta: 0 }).map((row) => row.key)).toEqual(["marks", "completion"]);
  });

  it("starts the emotion control in the requested lower-left completion area", () => {
    expect(defaultGameCompletionFlow().position.emotionBar).toEqual({ x: 0.17, y: 0.74, scale: 1 });
  });
});