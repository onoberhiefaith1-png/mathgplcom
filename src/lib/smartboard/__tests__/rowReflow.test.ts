import { describe, expect, it } from "vitest";
import { rowOverflowShift } from "../rowReflow";

describe("Smartboard caption and writing reflow", () => {
  it("moves the first writing row below a wrapped question and diagram", () => {
    const rowHeight = 40;
    const captionRows = 4;
    const measuredCaption = 541;
    const overflow = measuredCaption - captionRows * rowHeight;
    expect(captionRows * rowHeight + rowOverflowShift(4, [[4, overflow, true]]))
      .toBe(measuredCaption);
    expect(rowOverflowShift(0, [[4, overflow, true]])).toBe(0);
  });
  it("does not move handwritten content by its own measured overflow", () => {
    expect(rowOverflowShift(4, [[4, 80]])).toBe(0);
    expect(rowOverflowShift(5, [[4, 80]])).toBe(80);
  });
  it("combines caption and ink overflow without moving the caption itself", () => {
    const entries = [[4, 381, true], [4, 45], [20, 300, true]] as const;
    expect(rowOverflowShift(4, entries)).toBe(381);
    expect(rowOverflowShift(5, entries)).toBe(426);
    expect(rowOverflowShift(20, entries)).toBe(726);
  });
  it("releases space when a resized caption becomes shorter", () => {
    expect(rowOverflowShift(4, [[4, 0, true]])).toBe(0);
    expect(rowOverflowShift(4, [[4, -20, true]])).toBe(0);
  });
});
