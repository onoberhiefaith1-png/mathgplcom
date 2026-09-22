import { describe, expect, it } from "vitest";
import { buildInstantAward, awardProofExpression } from "../instantAward";

describe("instant award payload", () => {
  it("names the line, the marks and the exact working that earned them", () => {
    const award = buildInstantAward({
      questionId: "q1",
      lineId: "l1",
      marks: 6,
      ascii: " x + 7 = 12 ",
    });
    expect(award).toMatchObject({
      questionId: "q1",
      lineId: "l1",
      correct: true,
      verdict: "equal",
      marks: 6,
    });
    expect(award.diagnosis.code).toBe("predictive_equal");
    expect(award.studentAscii).toBe(" x + 7 = 12 ");
  });

  it("proves the award with the trimmed working the Game gate compares", () => {
    expect(awardProofExpression(" x + 7 = 12 ")).toBe("x + 7 = 12");
  });

  it("never invents marks", () => {
    expect(buildInstantAward({ questionId: "q", lineId: "l", marks: Number.NaN, ascii: "x" }).marks).toBe(0);
  });
});
