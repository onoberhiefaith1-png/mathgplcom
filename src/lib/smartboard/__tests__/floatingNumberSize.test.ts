import { describe, expect, it } from "vitest";
import {
  FLOATING_SIZE_DEFAULT,
  FLOATING_SIZE_MIN,
  FLOATING_SIZE_STEPS,
  GAME_CHIP_METRICS,
  clampFloatingSize,
  floatingChipPx,
  floatingSizeLabel,
  maxFloatingSizeFor,
  stepFloatingSize,
} from "../floatingNumberSize";

describe("Floating Number Size", () => {
  it("defaults to the game's chip size", () => {
    expect(FLOATING_SIZE_DEFAULT).toBe(1);
    expect(FLOATING_SIZE_STEPS).toContain(1);
    expect(clampFloatingSize(undefined)).toBe(1);
    expect(clampFloatingSize(null)).toBe(1);
    expect(clampFloatingSize("garbage")).toBe(1);
    expect(floatingChipPx(FLOATING_SIZE_DEFAULT)).toBe(GAME_CHIP_METRICS.minPx);
  });

  it("steps bigger then bigger again, and smaller the other way", () => {
    expect(stepFloatingSize(1, 1)).toBe(1.15);
    expect(stepFloatingSize(1.15, 1)).toBe(1.3);
    expect(stepFloatingSize(1, -1)).toBe(0.85);
    expect(stepFloatingSize(FLOATING_SIZE_MIN, -1)).toBe(FLOATING_SIZE_MIN);
  });

  it("caps a chip at one third of the screen's shorter side", () => {
    // 1920×1080 board: ⅓ of 1080 = 360px → 360 / 40 = 9×
    expect(maxFloatingSizeFor(1920, 1080)).toBe(9);
    expect(floatingChipPx(maxFloatingSizeFor(1920, 1080))).toBeCloseTo(
      1080 / 3,
    );
    // 390×844 portrait phone: ⅓ of 390 = 130px → 3.25×
    expect(maxFloatingSizeFor(390, 844)).toBe(3.25);
    // orientation does not matter
    expect(maxFloatingSizeFor(844, 390)).toBe(3.25);
  });

  it("never grows past the cap, and the last + lands exactly on it", () => {
    const phone = maxFloatingSizeFor(390, 844);
    const board = maxFloatingSizeFor(1920, 1080);
    expect(phone).toBeLessThan(board);
    let s = 1;
    for (let i = 0; i < 40; i++) s = stepFloatingSize(s, 1, phone);
    expect(s).toBe(phone);
    expect(floatingChipPx(s)).toBeLessThanOrEqual(390 / 3 + 1e-6);
    expect(stepFloatingSize(phone, 1, phone)).toBe(phone);
    expect(stepFloatingSize(phone, -1, phone)).toBe(3);
    expect(clampFloatingSize(9, phone)).toBe(phone);
  });

  it("never caps below the default on tiny screens", () => {
    expect(maxFloatingSizeFor(90, 90)).toBe(1);
  });

  it("keeps stored values (within bounds) so reloads restore them", () => {
    expect(clampFloatingSize("3.25")).toBe(3.25);
    expect(clampFloatingSize(0.1)).toBe(FLOATING_SIZE_MIN);
    expect(stepFloatingSize(1.12, 1)).toBe(1.15);
    expect(floatingSizeLabel(1.15)).toBe("115%");
  });
});
