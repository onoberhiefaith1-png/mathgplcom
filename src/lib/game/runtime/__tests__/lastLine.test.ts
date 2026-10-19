import { describe, expect, it } from "vitest";
import { allRequiredLinesAwarded } from "../completion";
import { hasPassed } from "@/lib/academia/adventurePlay";

const q = { questionRowId: "q", lineIds: ["l1", "l2", "l3"], lineMarks: [4, 4, 4], lineHasFloatingNumbers: [false, false, false] };

describe("last line rule", () => {
  it("solving lines 1 and 2 does not finish a 3-line question", () => {
    expect(allRequiredLinesAwarded(q, ["q:l1", "q:l2"])).toBe(false);
    expect(allRequiredLinesAwarded(q, ["q:l1", "q:l2", "q:l3"])).toBe(true);
  });
  it("default pass mark needs every mark", () => {
    expect(hasPassed(8, 12, null)).toBe(false);
  });
  it("70% is of the learning point total: 30+30+10 of 100 passes", () => {
    expect(hasPassed(30 + 30 + 10, 100, 70)).toBe(true);
    expect(hasPassed(20 + 30 + 10, 100, 70)).toBe(false);
  });
});
