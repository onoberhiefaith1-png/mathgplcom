import { describe, expect, it } from "vitest";
import { MAX_LINE_SECONDS, clampMinuteSecond } from "../MinuteSecondInput";

describe("per-line time control", () => {
  it("keeps 00:00 as a real zero value", () => {
    expect(clampMinuteSecond(0, 0)).toBe(0);
  });

  it("combines minutes and seconds", () => {
    expect(clampMinuteSecond(2, 30)).toBe(150);
    expect(clampMinuteSecond(0, 30)).toBe(30);
    expect(clampMinuteSecond(5, 30)).toBe(330);
  });

  it("never produces more than exactly sixty minutes", () => {
    expect(clampMinuteSecond(60, 0)).toBe(MAX_LINE_SECONDS);
    expect(clampMinuteSecond(60, 1)).toBe(MAX_LINE_SECONDS);
    expect(clampMinuteSecond(60, 60)).toBe(MAX_LINE_SECONDS);
    expect(clampMinuteSecond(99, 59)).toBe(MAX_LINE_SECONDS);
  });

  it("rejects negative or broken input", () => {
    expect(clampMinuteSecond(-3, -9)).toBe(0);
    expect(clampMinuteSecond(Number.NaN, Number.NaN)).toBe(0);
  });
});
