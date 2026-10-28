import { describe, expect, it } from "vitest";
import {
  MOBILE_MARGIN_MIN_FRACTION,
  mobileLabelScale,
  mobileMarginFromPointer,
  mobileReservedFraction,
} from "../mobileMargin";

describe("Imagine mobile content margin", () => {
  it("uses exactly 5% of the writing surface at the minimum", () => {
    expect(mobileReservedFraction(0)).toBe(MOBILE_MARGIN_MIN_FRACTION);
  });

  it("turns reclaimed screen width into a smaller saved margin", () => {
    expect(mobileMarginFromPointer(105, 100, 100)).toBe(0);
    expect(mobileMarginFromPointer(150, 100, 100)).toBe(0.5);
    expect(mobileMarginFromPointer(110, 100, 100)).toBeCloseTo(0.0556, 3);
  });

  it("keeps the number label readable at the smallest strip", () => {
    expect(mobileLabelScale(0)).toBe(0.72);
    expect(mobileLabelScale(0.5)).toBe(1);
  });
});