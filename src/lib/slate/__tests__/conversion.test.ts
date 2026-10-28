import { describe, expect, it } from "vitest";
import {
  clampConversion, convertUnitsToLives, defaultConversion, normalizeConversion,
} from "../conversion";

describe("reward conversion", () => {
  it("keeps every factor inside 0.1x-10x", () => {
    expect(clampConversion(0.05, 1)).toBe(0.1);
    expect(clampConversion(99, 1)).toBe(10);
    expect(clampConversion(Number.NaN, 1)).toBe(1);
  });

  it("defaults to 1x time and 0.1x life", () => {
    expect(defaultConversion()).toEqual({
      hourglassToTime: 1, lifeToTime: 1, vaultToLife: 0.1, completionToLife: 0.1,
    });
  });

  it("reads the older Life time value", () => {
    expect(normalizeConversion(undefined, 2).lifeToTime).toBe(2);
  });

  it("gives exactly one Life for ten units at 0.1x, with no drift", () => {
    let pending = 0;
    let lives = 0;
    for (let i = 0; i < 10; i += 1) {
      const out = convertUnitsToLives(pending, 1, 0.1);
      pending = out.pending;
      lives += out.lives;
    }
    expect(lives).toBe(1);
    expect(pending).toBeCloseTo(0, 6);
  });

  it("gives whole Lives immediately above 1x", () => {
    expect(convertUnitsToLives(0, 1, 2).lives).toBe(2);
  });
});
