import { describe, expect, it } from "vitest";
import { isLoopLap, narrationRegions, regionAt } from "@/lib/games/narration";
import type { Scene } from "@/lib/games/types";

const scene = (id: string, loopStart: number, loopEnd: number) =>
  ({ id, title: id, elements: [], loopStart, loopEnd }) as unknown as Scene;

describe("narration regions", () => {
  it("lists loop regions in timeline order", () => {
    const regions = narrationRegions([scene("b", 30, 40), scene("a", 5, 12)]);
    expect(regions).toEqual([
      { start: 5, end: 12 },
      { start: 30, end: 40 },
    ]);
  });

  it("ignores scenes without a loop", () => {
    expect(narrationRegions([{ id: "x", elements: [] } as unknown as Scene])).toEqual([]);
  });
});

describe("regionAt", () => {
  const regions = [
    { start: 10, end: 20 },
    { start: 40, end: 50 },
  ];

  it("finds the loop the playhead sits in", () => {
    expect(regionAt(12, regions)).toEqual({ start: 10, end: 20 });
  });

  it("is null outside every loop", () => {
    expect(regionAt(30, regions)).toBeNull();
    expect(regionAt(60, regions)).toBeNull();
  });
});

describe("isLoopLap", () => {
  const regions = [{ start: 10, end: 20 }];

  it("treats a wrap inside the loop as another lap", () => {
    expect(isLoopLap(20, 10, regions)).toBe(true);
    expect(isLoopLap(19.8, 10.1, regions)).toBe(true);
  });

  it("is false for forward playback", () => {
    expect(isLoopLap(12, 13, regions)).toBe(false);
    expect(isLoopLap(20, 21, regions)).toBe(false);
  });

  it("is false for a jump backwards from outside the loop", () => {
    expect(isLoopLap(35, 5, regions)).toBe(false);
  });

  it("is false for a jump out of the loop to an earlier point", () => {
    expect(isLoopLap(15, 2, regions)).toBe(false);
  });

  it("is false when the adventure has no loops", () => {
    expect(isLoopLap(20, 10, [])).toBe(false);
  });
});
