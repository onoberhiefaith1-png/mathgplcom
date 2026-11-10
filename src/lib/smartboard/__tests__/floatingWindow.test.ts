import { describe, it, expect } from "vitest";
import { buildFiveChipStrip, windowRange, canWindowBack, canWindowForward, clampWindowOffset } from "../floatingWindow";

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


const chip = (token: string, absIdx: number) => ({ token, absIdx });

describe("buildFiveChipStrip", () => {
  it("always shows five chips, repeating a short pool", () => {
    const remaining = [chip("2", 0), chip("7", 1)];
    expect(buildFiveChipStrip({
      remaining, usedNewestFirst: [], usedOldestFirst: [], allSlots: remaining,
    }).map((s) => s.token)).toEqual(["2", "7", "2", "7", "2"]);
  });

  it("repeats a single number five times so it can be stacked", () => {
    const remaining = [chip("2", 0)];
    expect(buildFiveChipStrip({
      remaining, usedNewestFirst: [], usedOldestFirst: [], allSlots: remaining,
    }).map((s) => s.token)).toEqual(["2", "2", "2", "2", "2"]);
  });

  it("shows the first five of a longer unused queue; extras sit to the right", () => {
    const remaining = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => chip(String(i), i));
    expect(buildFiveChipStrip({
      remaining, usedNewestFirst: [], usedOldestFirst: [], allSlots: remaining, unusedOffset: 0,
    }).map((s) => s.token)).toEqual(["0", "1", "2", "3", "4"]);
    expect(buildFiveChipStrip({
      remaining, usedNewestFirst: [], usedOldestFirst: [], allSlots: remaining, unusedOffset: 1,
    }).map((s) => s.token)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("shifts unused chips left when the first visible chip is used, and recycles oldest used to fill", () => {
    const remaining = [chip("7", 1), chip("3", 2)];
    const used = [chip("−", 0)];
    expect(buildFiveChipStrip({
      remaining, usedNewestFirst: used, usedOldestFirst: used, allSlots: [...used, ...remaining],
    }).map((s) => s.token)).toEqual(["7", "3", "−", "7", "3"]);
  });

  it("reveals used history on the left when the student scrolls back, still totalling five", () => {
    const remaining = [chip("7", 1), chip("3", 2), chip("9", 3)];
    const used = [chip("−", 0)];
    const strip = buildFiveChipStrip({
      remaining,
      usedNewestFirst: used,
      usedOldestFirst: used,
      allSlots: [...used, ...remaining],
      reveal: 1,
    });
    expect(strip).toHaveLength(5);
    expect(strip[0]).toMatchObject({ token: "−", used: true });
    expect(strip.slice(1).map((s) => s.token)).toEqual(["7", "3", "9", "−"]);
    expect(strip[4]?.used).toBe(false);
  });

  it("returns no chips when the line has no numbers", () => {
    expect(buildFiveChipStrip({
      remaining: [], usedNewestFirst: [], usedOldestFirst: [], allSlots: [],
    })).toEqual([]);
  });
});
