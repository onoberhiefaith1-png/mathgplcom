import { describe, expect, it } from "vitest";
import { fasterTime, getQuestionWindow, resetAttemptMarkers } from "../touchUi";

describe("phone Smartboard question window", () => {
  it("keeps the first three stable at the start", () => {
    expect(getQuestionWindow(6, 0)).toEqual([0, 1, 2]);
    expect(getQuestionWindow(6, 1)).toEqual([0, 1, 2]);
  });

  it("centres middle questions and keeps the final three visible", () => {
    expect(getQuestionWindow(6, 2)).toEqual([1, 2, 3]);
    expect(getQuestionWindow(6, 4)).toEqual([3, 4, 5]);
    expect(getQuestionWindow(6, 5)).toEqual([3, 4, 5]);
  });

  it("pads boards with fewer than three questions", () => {
    expect(getQuestionWindow(1, 0)).toEqual([0, null, null]);
    expect(getQuestionWindow(2, 1)).toEqual([0, 1, null]);
  });
});

describe("timer attempt state", () => {
  it("resets attempt marks without removing permanent completion", () => {
    expect(resetAttemptMarkers({ q1: { permanent: true, attempt: true } })).toEqual({
      q1: { permanent: true, attempt: false },
    });
  });

  it("never replaces a faster best time with a slower one", () => {
    expect(fasterTime(135_000, 160_000)).toBe(135_000);
    expect(fasterTime(135_000, 120_000)).toBe(120_000);
  });
});