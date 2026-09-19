import { describe, expect, it } from "vitest";
import { GAME_WRITING_WIDTH, buildLayout, gameSurfaceWidth, gameWritingWidth } from "../layout";
import { makeSlot } from "../defaults";
import type { Slot } from "../types";

const slot = (id: string, text: string): Slot => ({ ...makeSlot(), id, text });

describe("Game writing-surface layout", () => {
  it("reserves the 5% to 95% writing band", () => {
    expect(GAME_WRITING_WIDTH).toBeCloseTo(6.6 * 0.9);
    expect(gameWritingWidth(4)).toBeCloseTo(3.6);
    expect(gameWritingWidth(20)).toBeCloseTo(18);
  });

  it("grows every surface with its own content up to the writing-band maximum", () => {
    expect(gameSurfaceWidth(12, 3)).toBe(3);
    expect(gameSurfaceWidth(12, 8)).toBe(8);
    expect(gameSurfaceWidth(7, 9)).toBe(7);
  });

  it("starts every unmeasured Play surface at its own minimum height", () => {
    const layout = buildLayout(
      [slot("short", "x = 5"), slot("long", "Subtract 7 from both sides and simplify carefully")],
      96, 0.2, {}, GAME_WRITING_WIDTH, false,
    );
    expect(layout.regions[0]?.height).toBeCloseTo(layout.regions[1]?.height ?? 0);
  });

  it("grows only the surface whose rendered content is taller", () => {
    const layout = buildLayout(
      [slot("short-1", "x = 5"), slot("long", "long"), slot("short-2", "y = 2")],
      96, 0.2, { "short-1": 0.45, long: 1.8, "short-2": 0.42 }, GAME_WRITING_WIDTH, false,
    );
    expect(layout.regions[1]?.height).toBeGreaterThan(layout.regions[0]?.height ?? Infinity);
    expect(layout.regions[2]?.height).toBeLessThan(layout.regions[1]?.height ?? 0);
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