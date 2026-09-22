import { describe, expect, it } from "vitest";
import {
  GAME_WRITING_WIDTH,
  buildLayout,
  gameEstimatedTextWidth,
  gameEstimatedTextHeight,
  gameBandPosition,
  gameBandTravel,
  gameInnerWritingWidth,
  gameSafeWritingWidth,
  gameSurfaceBox,
  gameSurfaceWidth,
  gameWritingWidth,
  gameWritingBand,
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

  it("uses the same pillar-safe writing span in Edit and Play", () => {
    expect(gameSafeWritingWidth(20)).toBeCloseTo(18);
    expect(gameSafeWritingWidth(20, 7.4)).toBeCloseTo(7.4);
  });

  it("uses one canonical 5%-95% band for every attached object", () => {
    const band = gameWritingBand(20);
    expect(band).toEqual({ width: 18, left: -9, right: 9, centre: 0 });
    expect(gameBandPosition(0, band, 1)).toBe(-8.5);
    expect(gameBandPosition(100, band, 1)).toBe(8.5);
    expect(gameBandPosition(50, band, 1)).toBe(0);
  });

  it("stops a moving reward before its visible edge leaves the band", () => {
    const band = gameWritingBand(10);
    const origin = gameBandPosition(20, band, 1);
    expect(gameBandTravel(origin, 1, band, 1)).toBeCloseTo(6.7);
    expect(origin + gameBandTravel(origin, 1, band, 1) + 0.5).toBeCloseTo(band.right);
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

  it("uses actual rendered surface height when preserving gaps", () => {
    const spacing = 0.24;
    const layout = buildLayout(
      [slot("line-2", "x = 5"), slot("line-3", "y = 2")],
      96,
      spacing,
      { "line-2": 0.2, "line-3": 0.2 },
      GAME_WRITING_WIDTH,
      true,
      1.25,
      { "line-2": 2.4, "line-3": 0.8 },
    );
    const first = layout.regions[0];
    const second = layout.regions[1];
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    if (!first || !second) return;
    expect(first.height).toBe(2.4);
    expect(second.top - (first.top + first.height)).toBeCloseTo(spacing);
  });

  it("calculates the same local writing box for rendering and layout", () => {
    const box = gameSurfaceBox({
      text: "a".repeat(180),
      fontSize: 96,
      writingWidth: 4,
      readOnlyWriting: true,
      inset: 0.4,
      measuredWidth: 4,
      measuredHeight: 1.7,
    });

    expect(box.surfaceWidth).toBeLessThanOrEqual(4);
    expect(box.innerWritingWidth).toBeLessThan(box.surfaceWidth);
    expect(box.surfaceHeight).toBeGreaterThan(1.7);
  });

  it("gives editable surfaces the same content-driven box as Play", () => {
    const input = {
      text: "A teacher-authored line that grows from the safe left edge",
      fontSize: 96,
      writingWidth: 4.8,
      inset: 0.4,
    };
    const playBox = gameSurfaceBox({ ...input, readOnlyWriting: true });
    const editBox = gameSurfaceBox({ ...input, readOnlyWriting: false });

    expect(editBox).toEqual(playBox);
    expect(editBox.surfaceWidth).toBeLessThanOrEqual(input.writingWidth);
  });
});