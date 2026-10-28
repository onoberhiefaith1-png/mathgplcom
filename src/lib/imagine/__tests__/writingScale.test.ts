import { describe, expect, it } from "vitest";
import { clampWritingScale, stepWritingScale } from "../writingScale";

describe("writing size", () => {
  it("never goes below the current size (100%)", () => {
    expect(stepWritingScale(1, -1)).toBe(1);
    expect(clampWritingScale(0.5)).toBe(1);
  });
  it("never goes above 200%", () => {
    expect(stepWritingScale(2, 1)).toBe(2);
    expect(clampWritingScale(3)).toBe(2);
  });
  it("moves in 10% steps", () => {
    expect(stepWritingScale(1, 1)).toBe(1.1);
    expect(stepWritingScale(1.5, -1)).toBe(1.4);
  });
});
