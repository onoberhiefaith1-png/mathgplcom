import { describe, expect, it } from "vitest";
import { seedGameLineOwners } from "../gameLineOwnership";

describe("Game writing-surface ownership", () => {
  it("keeps three complete solution steps on three respective surfaces", () => {
    expect(seedGameLineOwners(
      [
        { row: 2, ascii: "x + 7 = 15" },
        { row: 3, ascii: "x + 7 - 7 = 15 - 7" },
        { row: 4, ascii: "x = 8" },
      ],
      [
        { index: 0, equation: "x + 7 = 15" },
        { index: 1, equation: "x + 7 - 7 = 15 - 7" },
        { index: 2, equation: "x = 8" },
      ],
    )).toEqual({ 2: 0, 3: 1, 4: 2 });
  });

  it("keeps an unmatched continuation row with its current solution line", () => {
    expect(seedGameLineOwners(
      [
        { row: 2, ascii: "(x + 1)/(2)" },
        { row: 3, ascii: "= 4" },
        { row: 4, ascii: "x = 7" },
      ],
      [
        { index: 0, equation: "(x + 1)/(2) = 4" },
        { index: 1, equation: "x = 7" },
      ],
    )).toEqual({ 2: 0, 3: 0, 4: 1 });
  });

  it("keeps an unmatched step written on Line 2 on Line 2, never inside Line 1", () => {
    expect(seedGameLineOwners(
      [
        { row: 2, ascii: "3y - 5 + 5 = 10 + 5" },
        { row: 3, ascii: "3y - 5 = 10" },
      ],
      [
        { index: 0, equation: "3y - 5 + 5 = 10 + 5" },
        { index: 1, equation: "3y = 15" },
        { index: 2, equation: "y = 5" },
      ],
    )).toEqual({ 2: 0, 3: 1 });
  });

  it("gives two unmatched rows in a row their own lines", () => {
    expect(seedGameLineOwners(
      [
        { row: 2, ascii: "3y = 10" },
        { row: 3, ascii: "y = 2" },
      ],
      [
        { index: 0, equation: "3y - 5 + 5 = 10 + 5" },
        { index: 1, equation: "3y = 15" },
        { index: 2, equation: "y = 5" },
      ],
    )).toEqual({ 2: 0, 3: 1 });
  });
});
