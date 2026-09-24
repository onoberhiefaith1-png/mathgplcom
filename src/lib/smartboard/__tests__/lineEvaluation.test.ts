import { describe, it, expect } from "vitest";
import { mergeLineCheck, deriveLineStatus } from "../lineEvaluation";
import { predict, routeMapFor } from "@/lib/predictive/predictiveLine";

const eq = { questionId: "q", lineId: "l1", correct: true, verdict: "equal", studentAscii: "5x^2-2x-4=0" };
const err = { questionId: "q", lineId: "l1", correct: false, verdict: "error", studentAscii: "5x^2-2x-4=0" };

describe("line evaluation", () => {
  it("an error after an equal result keeps Equivalent", () => {
    const s = mergeLineCheck(mergeLineCheck({}, eq), err);
    expect(deriveLineStatus({ awardedMarks: 0, check: s["q:l1"], studentAscii: eq.studentAscii })).toBe("equivalent");
  });
  it("an awarded line is Equivalent even with no check (reload)", () => {
    expect(deriveLineStatus({ awardedMarks: 2, check: null, studentAscii: "x" })).toBe("equivalent");
    expect(deriveLineStatus({ awardedMarks: 2, check: err, studentAscii: "x" })).toBe("equivalent");
  });
  it("changing the line resets to pending", () => {
    expect(deriveLineStatus({ awardedMarks: 0, check: eq, studentAscii: "5x^2" })).toBe("pending");
  });
  it("earlier line result survives the next line", () => {
    let s = mergeLineCheck({}, eq);
    s = mergeLineCheck(s, { ...err, lineId: "l2" });
    expect(s["q:l1"].correct).toBe(true);
  });
  it("predicts from the expected line", () => {
    const map = routeMapFor({ expectedAscii: "3x/3 = 15/3", atoms: [] });
    expect(predict({ routeMap: map, studentAscii: "" }).predictive).toContain("15");
    expect(predict({ routeMap: map, studentAscii: "3x/3 = 15/3" }).complete).toBe(true);
  });
});
