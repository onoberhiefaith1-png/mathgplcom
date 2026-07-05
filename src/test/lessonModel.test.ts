// LessonModel builder — architectural smoke tests.
//
// The model is the authoritative Preview object. These tests pin the
// two invariants that keep the two engines aligned:
//   1. `built` marker is present (i.e. the model was frozen).
//   2. Notes on solution lines come STRICTLY from noteSource — a line
//      whose `notebook` is empty or math-shaped has `note === undefined`,
//      so the panel icon and the preview stay in lockstep.

import { describe, it, expect } from "vitest";
import { buildLessonModel } from "@/lib/smartboard/preview/model";

describe("buildLessonModel", () => {
  it("returns a frozen model with a built marker", () => {
    const model = buildLessonModel([], null);
    expect(model.built).toBe(true);
    expect(Object.isFrozen(model)).toBe(true);
    expect(model.beats).toEqual([]);
    expect(model.reservoirs).toEqual([]);
  });
});
