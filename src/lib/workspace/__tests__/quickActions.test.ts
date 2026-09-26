import { describe, expect, it } from "vitest";
import { QUICK_ACTIONS, QUICK_ACTION_HOME } from "../quickActions";
import { DEFAULT_QUICK_PLACEMENT, clampQuickPlacement } from "../quickActionPlacement";

describe("quick actions", () => {
  it("offers exactly the six teacher destinations", () => {
    expect(QUICK_ACTIONS.map((a) => a.to)).toEqual([
      "/lesson-notes",
      "/smartboard",
      "/teaching-hub/classes",
      "/game",
      "/adventure",
      "/course-builder",
    ]);
  });

  it("treats the Teaching Hub as the page that already has the section", () => {
    expect(QUICK_ACTION_HOME).toBe("/teaching-hub");
  });
});

describe("quick action placement", () => {
  it("defaults to the bottom-left", () => {
    expect(DEFAULT_QUICK_PLACEMENT).toEqual({ xPct: 4, yPct: 92 });
  });

  it("keeps the button inside the screen", () => {
    expect(clampQuickPlacement({ xPct: -40, yPct: 180 })).toEqual({ xPct: 4, yPct: 96 });
    expect(clampQuickPlacement({ xPct: 50, yPct: 50 })).toEqual({ xPct: 50, yPct: 50 });
  });

  it("falls back when a stored value is unusable", () => {
    expect(clampQuickPlacement({ xPct: Number.NaN, yPct: Number.NaN })).toEqual(DEFAULT_QUICK_PLACEMENT);
  });
});
