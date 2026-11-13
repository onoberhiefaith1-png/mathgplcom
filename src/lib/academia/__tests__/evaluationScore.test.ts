import { describe, expect, it } from "vitest";
import { performanceScore, practiceMarks, type MarkedWork } from "../evaluationScore";

const work: MarkedWork[] = [
  { tier: "beginner", earned: 3, possible: 10 },
  { tier: "intermediate", earned: 4, possible: 10 },
  { tier: "expert", earned: 7, possible: 20 },
  { tier: null, earned: 5, possible: 10 },
];

describe("per-tier evaluation scores", () => {
  it("shows each tier on its own and never mixes them", () => {
    expect(performanceScore(work, "beginner")).toMatchObject({ earned: 3, possible: 10, percent: 30 });
    expect(performanceScore(work, "intermediate")).toMatchObject({ earned: 4, possible: 10, percent: 40 });
    expect(performanceScore(work, "expert")).toMatchObject({ earned: 7, possible: 20, percent: 35 });
  });

  it("leaves a tier the student has not started empty, not 0%", () => {
    expect(performanceScore(work.filter((w) => w.tier !== "expert"), "expert")).toEqual({
      view: "expert", earned: 0, possible: 0, percent: null,
    });
  });

  it("does not let a new Beginner mark change Intermediate", () => {
    const more = [...work, { tier: "beginner" as const, earned: 10, possible: 10 }];
    expect(performanceScore(more, "beginner").percent).toBe(65);
    expect(performanceScore(more, "intermediate")).toEqual(performanceScore(work, "intermediate"));
    expect(performanceScore(more, "expert")).toEqual(performanceScore(work, "expert"));
  });

  it("counts untiered work only in Overall, weighted by marks", () => {
    expect(performanceScore(work, "beginner").earned).toBe(3);
    // (3+4+7+5) / (10+10+20+10) = 19/50. An average of the tier percents would be different.
    expect(performanceScore(work, "overall")).toMatchObject({ earned: 19, possible: 50, percent: 38 });
    const tiersOnly = work.filter((w) => w.tier);
    expect(performanceScore(tiersOnly, "overall")).toMatchObject({ earned: 14, possible: 40, percent: 35 });
  });

  it("reads connected practice rows and drops a missing tier out of every tier tab", () => {
    const marks = practiceMarks([
      { mode: "practice", tier: "beginner", best_score: 3, max_score: 10 },
      { mode: "practice", tier: "intermediate", best_score: 8, max_score: 10 },
      { mode: "play", tier: "beginner", best_score: 100, max_score: 100 },
      { mode: "practice", tier: null, best_score: 1, max_score: 2 },
      { mode: "practice", tier: "mystery", best_score: 9, max_score: 9 },
    ]);
    expect(performanceScore(marks, "beginner")).toMatchObject({ earned: 3, possible: 10, percent: 30 });
    expect(performanceScore(marks, "intermediate").percent).toBe(80);
    expect(performanceScore(marks, "expert").percent).toBeNull();
    // Play's 100 is left out. The unknown tier (9/9) and the null tier (1/2) count only in Overall.
    expect(performanceScore(marks, "overall")).toMatchObject({ earned: 21, possible: 31 });
  });
});
