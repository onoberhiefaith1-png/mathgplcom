import { describe, it, expect } from "vitest";
import { windowRange, canWindowBack, canWindowForward, clampWindowOffset } from "../floatingWindow";

describe("floating number five-tile window", () => {
  it("shows fewer than five naturally", () => {
    expect(windowRange(0, 3)).toEqual({ start: 0, end: 3 });
    expect(canWindowForward(0, 3)).toBe(false);
  });
  it("shows exactly five of eight", () => {
    const r = windowRange(0, 8);
    expect(r.end - r.start).toBe(5);
  });
  it("disables left at start and right at end", () => {
    expect(canWindowBack(0)).toBe(false);
    expect(canWindowForward(3, 8)).toBe(false);
    expect(clampWindowOffset(10, 8)).toBe(3);
  });
  it("every item is reachable", () => {
    const seen = new Set<number>();
    for (let o = 0; o <= 3; o++) { const r = windowRange(o, 8); for (let i = r.start; i < r.end; i++) seen.add(i); }
    expect(seen.size).toBe(8);
  });
});
