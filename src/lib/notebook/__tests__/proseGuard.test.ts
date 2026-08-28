import { describe, it, expect } from "vitest";
import { looksLikeMathOnly } from "@/lib/notebook/proseGuard";
import { repairShiftedFloatingLines, chipsBelongToLine } from "@/lib/lessonnotes/floatingCompile";

describe("prose guard", () => {
  it("keeps prose that quotes math", () => {
    expect(looksLikeMathOnly("Compare with ax^{2} + bx + c = 0:")).toBe(false);
    expect(looksLikeMathOnly("Substitute:")).toBe(false);
    expect(looksLikeMathOnly("= 0")).toBe(true);
    expect(looksLikeMathOnly("2x^{2}+5x-3=0")).toBe(true);
    expect(looksLikeMathOnly("x = 2 sin θ")).toBe(true);
  });
});

describe("pairing repair", () => {
  it("moves chips back onto their own equation", () => {
    const lines = [
      { lineId: "1", equation: "2x^{2}+5x-3=0", fillers: ["a", "=2", "b", "=5"], containers: [], arrangement: [] },
      { lineId: "2", equation: "a=2,b=5,c=-3", fillers: ["x", "=", "-3"], containers: [], arrangement: [] },
      { lineId: "3", equation: "x=-3", fillers: [], containers: [], arrangement: [] },
    ];
    const fixed = repairShiftedFloatingLines(lines as any);
    expect(fixed[0].fillers).toEqual([]);
    expect(chipsBelongToLine(fixed[1] as any)).toBe(true);
    expect(fixed[2].fillers).toEqual(["x", "=", "-3"]);
  });
});
