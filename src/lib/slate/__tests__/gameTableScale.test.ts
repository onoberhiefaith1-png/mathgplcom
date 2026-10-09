import { describe, expect, it } from "vitest";
import {
  GAME_TABLE_SCALE_MAX,
  GAME_TABLE_SCALE_MIN,
  clampGameTableScale,
  stepGameTableScale,
} from "../gameTableScale";

describe("Game table sizing", () => {
  it("uses full-width scale by default", () => {
    expect(clampGameTableScale(undefined)).toBe(1);
  });

  it("keeps minus and plus within safe limits", () => {
    expect(stepGameTableScale(GAME_TABLE_SCALE_MIN, -1)).toBe(GAME_TABLE_SCALE_MIN);
    expect(stepGameTableScale(GAME_TABLE_SCALE_MAX, 1)).toBe(GAME_TABLE_SCALE_MAX);
    expect(stepGameTableScale(1, 1)).toBe(1.1);
    expect(stepGameTableScale(1, -1)).toBe(0.9);
  });
});
