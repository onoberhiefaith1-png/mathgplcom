import { describe, expect, it } from "vitest";
import {
  GAME_WRITING_WIDTH,
  buildLayout,
  gameEstimatedTextWidth,
  gameEstimatedTextHeight,
  gameInnerWritingWidth,
  gameSurfaceWidth,
  gameWritingWidth,
} from "../layout";
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

  it("keeps text inside the surface padding at the maximum width", () => {
    expect(gameInnerWritingWidth(9, 0.3)).toBeCloseTo(8.4);
    expect(gameInnerWritingWidth(0.4, 0.3)).toBe(0.2);
  });

  it("keeps empty, short, and long surfaces independently sized", () => {
    const minimum = 0.9;
    expect(gameSurfaceWidth(10, minimum)).toBe(minimum);
    expect(gameSurfaceWidth(10, 2.8)).toBe(2.8);
    expect(gameSurfaceWidth(10, 14)).toBe(10);
    expect(gameSurfaceWidth(10, minimum)).toBe(minimum);
  });

  it("lets live text grow a compact surface before wrapping at the safe edge", () => {
    expect(gameEstimatedTextWidth("x = 5", 96, 10)).toBeGreaterThan(1);
    expect(gameEstimatedTextWidth("", 96, 10)).toBe(0);
    expect(gameEstimatedTextWidth("a".repeat(200), 96, 7)).toBe(7);
  });

  it("uses text estimates before renderer measurement so lines never overlap", () => {
    const layout = buildLayout(
      [slot("short", "x = 5"), slot("long", "Subtract 7 from both sides and simplify carefully")],
      96, 0.2, {}, 1.2, true,
    );
    expect(layout.regions[1]?.height).toBeGreaterThan(layout.regions[0]?.height ?? Infinity);
  });

  it("estimates wrapped text height from the same writing width", () => {
    expect(gameEstimatedTextHeight("x = 5", 96, 4)).toBeGreaterThan(0);
    expect(gameEstimatedTextHeight("a".repeat(200), 96, 1.2)).toBeGreaterThan(
      gameEstimatedTextHeight("a".repeat(20), 96, 1.2),
    );
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