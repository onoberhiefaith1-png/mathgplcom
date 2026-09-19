import { describe, expect, it } from "vitest";
import { GAME_WRITING_WIDTH, buildLayout } from "../layout";
import type { Slot } from "../types";

const slot = (id: string, text: string): Slot => ({
  id,
  text,
  hiddenContent: "",
  contentState: "visible",
  rewards: [],
  scene: {},
});

describe("Game writing-surface layout", () => {
  it("reserves the 5% to 95% writing band", () => {
    expect(GAME_WRITING_WIDTH).toBeCloseTo(6.6 * 0.9);
  });

  it("moves following surfaces down while preserving their gap", () => {
    const spacing = 0.24;
    const layout = buildLayout(
      [slot("line-2", "subtract 7 from both sides"), slot("line-3", "x = 5")],
      96,
      spacing,
      { "line-2": 1.8, "line-3": 0.5 },
      GAME_WRITING_WIDTH,
    );
    const first = layout.regions[0];
    const second = layout.regions[1];
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    if (!first || !second) return;
    expect(second.top - (first.top + first.height)).toBeCloseTo(spacing);
  });
});