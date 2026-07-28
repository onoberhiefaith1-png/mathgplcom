import { describe, it, expect } from "vitest";
import {
  getGrid,
  clampRowSpacing,
  normalizeRowSpacing,
  BASE_FONT_PX,
} from "@/lib/smartboard/grid";

describe("Smartboard grid: Zoom / Text Size / Row Spacing are independent", () => {
  it("text size never changes row pitch", () => {
    const small = getGrid(1, 2, 0.8);
    const large = getGrid(1, 2, 1.8);
    expect(large.LINE_HEIGHT).toBe(small.LINE_HEIGHT);
    expect(large.FONT_PX).toBeGreaterThan(small.FONT_PX);
  });

  it("row spacing never changes font size", () => {
    const tight = getGrid(1, 1, 1);
    const loose = getGrid(1, 4, 1);
    expect(loose.FONT_PX).toBe(tight.FONT_PX);
    expect(loose.LINE_HEIGHT).toBeCloseTo(tight.LINE_HEIGHT * 4, 6);
  });

  it("row spacing n means exactly n cursor heights", () => {
    for (const n of [1, 2, 3, 4]) {
      const g = getGrid(1, n, 1.4);
      expect(g.LINE_HEIGHT).toBeCloseTo(g.CURSOR_HEIGHT * n, 6);
    }
  });

  it("cursor height depends on zoom only", () => {
    expect(getGrid(1, 3, 1.8).CURSOR_HEIGHT).toBe(getGrid(1, 1, 0.7).CURSOR_HEIGHT);
    expect(getGrid(2, 1, 1).CURSOR_HEIGHT).toBeCloseTo(getGrid(1, 1, 1).CURSOR_HEIGHT * 2, 6);
  });

  it("zoom scales both font and pitch together", () => {
    const a = getGrid(1, 2, 1);
    const b = getGrid(1.5, 2, 1);
    expect(b.FONT_PX).toBeCloseTo(a.FONT_PX * 1.5, 6);
    expect(b.LINE_HEIGHT).toBeCloseTo(a.LINE_HEIGHT * 1.5, 6);
    expect(a.FONT_PX).toBe(BASE_FONT_PX);
  });

  it("row spacing is a whole number, minimum 1", () => {
    expect(clampRowSpacing(0)).toBe(1);
    expect(clampRowSpacing(2.4)).toBe(2);
    expect(clampRowSpacing(99)).toBe(6);
  });

  it("legacy fractional row spacing migrates to 1", () => {
    expect(normalizeRowSpacing(0)).toBe(1);
    expect(normalizeRowSpacing(0.45)).toBe(1);
    expect(normalizeRowSpacing(3)).toBe(3);
  });
});
