import { describe, expect, it } from "vitest";
import {
  GAME_TABLE_SCALE_MAX,
  GAME_TABLE_SCALE_MIN,
  GAME_TABLE_SCALE_DEFAULT,
  clampGameTableScale,
  gameTableNaturalSize,
  gameTableSurfaceHeightPx,
  stepGameTableScale,
} from "../gameTableScale";

describe("Game table sizing", () => {
  it("starts large enough to read by default", () => {
    expect(clampGameTableScale(undefined)).toBe(GAME_TABLE_SCALE_DEFAULT);
  });

  it("preserves saved column proportions and includes Subcell working height", () => {
    const plain = gameTableNaturalSize({ rows: 2, cols: 3, headers: ["x", "x - μ", "(x - μ)²"], colWidths: [72, 96, 120] });
    const advanced = gameTableNaturalSize({
      rows: 2,
      cols: 3,
      headers: ["x", "x - μ", "(x - μ)²"],
      colWidths: [72, 96, 120],
      subcells: { "0:1": {}, "1:2": {} },
    });
    expect(plain.width).toBe(292);
    expect(advanced.height).toBeGreaterThan(plain.height);
  });

  it("keeps minus and plus within safe limits", () => {
    expect(stepGameTableScale(GAME_TABLE_SCALE_MIN, -1)).toBe(GAME_TABLE_SCALE_MIN);
    expect(stepGameTableScale(GAME_TABLE_SCALE_MAX, 1)).toBe(GAME_TABLE_SCALE_MAX);
    expect(stepGameTableScale(1, 1)).toBe(1.1);
    expect(stepGameTableScale(1, -1)).toBe(0.9);
  });

  it("ends the compact writing surface at the measured table", () => {
    expect(gameTableSurfaceHeightPx({ naturalHeightPx: 400, scale: 1.3, measuredHeightPx: 286 })).toBe(286);
    expect(gameTableSurfaceHeightPx({ naturalHeightPx: 200, scale: 1.3 })).toBe(260);
    expect(gameTableSurfaceHeightPx({ naturalHeightPx: 20, measuredHeightPx: 40 })).toBe(96);
  });
});
