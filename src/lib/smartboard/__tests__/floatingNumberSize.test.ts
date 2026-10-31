import { describe, expect, it } from "vitest";
import {
  FLOATING_SIZE_DEFAULT,
  FLOATING_SIZE_STEPS,
  clampFloatingSize,
  floatingSizeLabel,
  maxFloatingSizeFor,
  stepFloatingSize,
} from "../floatingNumberSize";

describe("Floating Number Size", () => {
  it("defaults to today's size", () => {
    expect(FLOATING_SIZE_DEFAULT).toBe(1);
    expect(FLOATING_SIZE_STEPS).toContain(1);
    expect(clampFloatingSize(undefined)).toBe(1);
    expect(clampFloatingSize("garbage")).toBe(1);
  });
  it("steps bigger then bigger again, and smaller the other way", () => {
    expect(stepFloatingSize(1, 1)).toBe(1.15);
    expect(stepFloatingSize(1.15, 1)).toBe(1.3);
    expect(stepFloatingSize(1, -1)).toBe(0.85);
    expect(stepFloatingSize(0.7, -1)).toBe(0.7);
  });
  it("never grows past what the screen allows", () => {
    const phone = maxFloatingSizeFor(360);
    const board = maxFloatingSizeFor(1920);
    expect(phone).toBeLessThan(board);
    let s = 1;
    for (let i = 0; i < 20; i++) s = stepFloatingSize(s, 1, phone);
    expect(s).toBeLessThanOrEqual(phone);
    expect(clampFloatingSize(2.5, phone)).toBeLessThanOrEqual(phone);
  });
  it("snaps stored values to a real step", () => {
    expect(clampFloatingSize(1.12)).toBe(1.15);
    expect(floatingSizeLabel(1.15)).toBe("115%");
  });
});
