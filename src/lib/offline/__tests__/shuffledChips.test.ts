import { describe, expect, it } from "vitest";
import { shuffledChips } from "../academiaPack";
import { allRequiredLinesAwarded } from "@/lib/game/runtime/completion";

describe("saved shuffle", () => {
  it("shows chips in the teacher's saved order", () => {
    expect(shuffledChips({ fillers: ["a", "b", "c", "d"], arrangement: [1, 3, 0, 2] })).toEqual(["b", "d", "a", "c"]);
  });
  it("keeps the original order when there is no valid shuffle", () => {
    expect(shuffledChips({ fillers: ["a", "b"] })).toEqual(["a", "b"]);
    expect(shuffledChips({ fillers: ["a", "b"], arrangement: [0, 0] })).toEqual(["a", "b"]);
  });
});

describe("question completion", () => {
  const q = { questionRowId: "q", lineIds: ["1", "2", "3", "4", "5"] };
  it("is not complete after four of five lines", () => {
    expect(allRequiredLinesAwarded(q, ["q:1", "q:2", "q:3", "q:4"])).toBe(false);
  });
  it("is complete once the final line is awarded", () => {
    expect(allRequiredLinesAwarded(q, ["q:1", "q:2", "q:3", "q:4", "q:5"])).toBe(true);
  });
});
