// Expected Line provenance: the answer key must come from the teacher's
// equation (the orange line), and the student chip set must be lossless.

import { describe, it, expect } from "vitest";
import { buildAssessmentBoardSource } from "@/lib/assessments/assessmentBoardSource";

describe("expected line vs floating numbers", () => {
  it("keeps the teacher equation on the board source reservoir line", () => {
    const src = buildAssessmentBoardSource({
      id: "a1",
      title: "T",
      questions: [
        {
          id: "q1",
          questionText: "Solve",
          lines: [{ lineId: "l1", chips: ["2x", "=", "10"], marks: 1, equation: "2x = 10" }],
        },
      ],
    });
    expect(src.reservoirs[0].lines[0].equation).toBe("2x = 10");
  });

  it("passes every chip through to the student, one for one", () => {
    const chips = ["\\frac{1}{2}", "x", "=", "10"];
    const src = buildAssessmentBoardSource({
      id: "a1",
      title: "T",
      questions: [{ id: "q1", questionText: "", lines: [{ lineId: "l1", chips, marks: 1 }] }],
    });
    expect(src.reservoirs[0].lines[0].fillers).toHaveLength(chips.length);
  });
});
