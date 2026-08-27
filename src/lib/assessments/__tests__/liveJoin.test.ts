import { describe, expect, it } from "vitest";
import { resolveLiveAssessmentId } from "../liveJoin";

describe("resolveLiveAssessmentId", () => {
  const ids = ["a1", "a2", "a3"];

  it("joins the assessment the student is present on, not the first one", () => {
    const presence = { a1: ["other"], a2: ["stu"], a3: [] };
    expect(resolveLiveAssessmentId("stu", presence, ids, "a1")).toBe("a2");
  });

  it("accepts a Map of Sets (dashboard shape)", () => {
    const presence = new Map([["a3", new Set(["stu"])]]);
    expect(resolveLiveAssessmentId("stu", presence, ids, "a1")).toBe("a3");
  });

  it("falls back when the student is nowhere", () => {
    expect(resolveLiveAssessmentId("stu", {}, ids, "a1")).toBe("a1");
  });

  it("uses presence outside the ordered list rather than nothing", () => {
    expect(resolveLiveAssessmentId("stu", { zz: ["stu"] }, ids, null)).toBe("zz");
  });
});
