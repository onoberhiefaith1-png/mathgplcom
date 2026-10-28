import { describe, expect, it } from "vitest";
import {
  DEFAULT_CURRENT_ATTEMPT_COLOR,
  DEFAULT_PERMANENT_ACHIEVEMENT_COLOR,
  resolveProgressColors,
} from "../progressColors";

describe("Smartboard progress colours", () => {
  it("uses the required blue and brown defaults", () => {
    expect(resolveProgressColors()).toEqual({
      permanentAchievementColor: DEFAULT_PERMANENT_ACHIEVEMENT_COLOR,
      currentAttemptColor: DEFAULT_CURRENT_ATTEMPT_COLOR,
    });
  });

  it("accepts custom and identical colours", () => {
    expect(resolveProgressColors({ permanentAchievementColor: "#22AA44", currentAttemptColor: "#22AA44" }))
      .toEqual({ permanentAchievementColor: "#22aa44", currentAttemptColor: "#22aa44" });
  });

  it("falls back independently for invalid legacy values", () => {
    expect(resolveProgressColors({ permanentAchievementColor: "blue", currentAttemptColor: null }))
      .toEqual({
        permanentAchievementColor: DEFAULT_PERMANENT_ACHIEVEMENT_COLOR,
        currentAttemptColor: DEFAULT_CURRENT_ATTEMPT_COLOR,
      });
  });
});