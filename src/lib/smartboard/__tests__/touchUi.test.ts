import { describe, expect, it } from "vitest";
import { clampQuestionWindowStart, fasterTime, getQuestionWindow, lineCarriesMarkState, questionTabState, questionWindowStart, resetAttemptMarkers } from "../touchUi";

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

  it("lets a swipe preview earlier or later lines and then snap back to the current centre", () => {
    expect(questionWindowStart(10, 6)).toBe(5);
    expect(getQuestionWindow(10, 6)).toEqual([5, 6, 7]);
    expect(getQuestionWindow(10, 6, 0)).toEqual([0, 1, 2]);
    expect(getQuestionWindow(10, 6, 7)).toEqual([7, 8, 9]);
    expect(clampQuestionWindowStart(10, -4)).toBe(0);
    expect(clampQuestionWindowStart(10, 99)).toBe(7);
    expect(getQuestionWindow(10, 6, null)).toEqual([5, 6, 7]);
  });
});

describe("timer attempt state", () => {
  it("resets attempt marks without removing permanent completion", () => {
    expect(resetAttemptMarkers({ q1: { permanent: true, attempt: true } })).toEqual({
      q1: { permanent: true, attempt: false },
    });
  });

  it("shows only permanent achievement when the timer is off", () => {
    expect(questionTabState({ carries: true, marked: true, confirmedNow: true, timerActive: false })).toBe("blue");
  });

  it("overlays the current attempt only while the timer is active", () => {
    expect(questionTabState({ carries: true, marked: true, confirmedNow: true, timerActive: true })).toBe("brown");
    expect(questionTabState({ carries: true, marked: true, confirmedNow: false, timerActive: true })).toBe("blue");
  });

  it("never replaces a faster best time with a slower one", () => {
    expect(fasterTime(135_000, 160_000)).toBe(135_000);
    expect(fasterTime(135_000, 120_000)).toBe(120_000);
  });
});
describe("lineCarriesMarkState", () => {
  it("keeps note-only lines neutral", () => {
    expect(lineCarriesMarkState({ notebookOnly: true, equation: "x = 1" })).toBe(false);
    expect(lineCarriesMarkState(null)).toBe(false);
    expect(lineCarriesMarkState({ equation: "   " })).toBe(false);
  });
  it("marks real floating-number lines", () => {
    expect(lineCarriesMarkState({ equation: "x = 1" })).toBe(true);
    expect(lineCarriesMarkState({ fragmentStart: 0, fragmentEnd: 3 })).toBe(true);
    expect(lineCarriesMarkState({ table: {} })).toBe(true);
  });
});
