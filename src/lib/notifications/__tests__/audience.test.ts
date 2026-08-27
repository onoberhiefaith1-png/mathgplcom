import { describe, expect, it } from "vitest";
import {
  applyAudienceEdits,
  canAskQuestion,
  canFilterByRegion,
  canSendNotifications,
  canUseAudience,
} from "../audience";

describe("notification permissions", () => {
  it("lets the administrator reach every audience", () => {
    for (const kind of ["everyone", "schools", "teachers", "students", "parents", "individuals"] as const) {
      expect(canUseAudience("platform_owner", kind)).toBe(true);
    }
  });

  it("never lets a student start a notification", () => {
    expect(canSendNotifications("student")).toBe(false);
    expect(canUseAudience("student", "students")).toBe(false);
    expect(canUseAudience("student", "individuals")).toBe(false);
  });

  it("only a student may ask a question", () => {
    expect(canAskQuestion("student")).toBe(true);
    expect(canAskQuestion("teacher")).toBe(false);
    expect(canAskQuestion(null)).toBe(false);
  });

  it("keeps a school inside its own structure", () => {
    expect(canUseAudience("school", "teachers")).toBe(true);
    expect(canUseAudience("school", "students")).toBe(true);
    expect(canUseAudience("school", "parents")).toBe(true);
    expect(canUseAudience("school", "everyone")).toBe(false);
    expect(canUseAudience("school", "schools")).toBe(false);
  });

  it("keeps a teacher to their own students", () => {
    expect(canUseAudience("teacher", "students")).toBe(true);
    expect(canUseAudience("teacher", "teachers")).toBe(false);
    expect(canUseAudience("teacher", "everyone")).toBe(false);
  });

  it("keeps a parent to the school/teacher relationship", () => {
    expect(canUseAudience("parent", "schools")).toBe(true);
    expect(canUseAudience("parent", "teachers")).toBe(true);
    expect(canUseAudience("parent", "students")).toBe(false);
    expect(canUseAudience("parent", "everyone")).toBe(false);
  });

  it("offers a region filter to the administrator only", () => {
    expect(canFilterByRegion("platform_owner")).toBe(true);
    expect(canFilterByRegion("co_admin")).toBe(true);
    expect(canFilterByRegion("school")).toBe(false);
    expect(canFilterByRegion("teacher")).toBe(false);
  });
});

describe("audience add and remove", () => {
  it("adds and removes people on top of a resolved audience", () => {
    const result = applyAudienceEdits(["a", "b", "c"], ["d"], ["b"]);
    expect(result.sort()).toEqual(["a", "c", "d"]);
  });

  it("never sends to the sender and never duplicates", () => {
    const result = applyAudienceEdits(["a", "a", "me"], ["a", "b"], [], "me");
    expect(result.sort()).toEqual(["a", "b"]);
  });

  it("a removal wins over an addition", () => {
    expect(applyAudienceEdits(["a"], ["b"], ["b"])).toEqual(["a"]);
  });
});
