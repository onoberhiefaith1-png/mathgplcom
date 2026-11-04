import { describe, expect, it } from "vitest";
import { UPSCALING_STANDARD } from "../../../../supabase/functions/notebook-ai/upscalingStandard";
import { BENCHMARK_STANDARD } from "../../../../supabase/functions/notebook-ai/benchmarkStandard";
import {
  buildPreserveEditPrompt,
  PRESERVE_CONTENT_STANDARD,
} from "../../../../supabase/functions/notebook-ai/preserveContentStandard";
import {
  preserveContentCorrection,
  verifyPreserveContent,
} from "../../../../supabase/functions/notebook-ai/preserveContentVerifier";

const pasted = `1. Solve 2x + 3 = 7
x = 2
2. Solve x + 1 = 4
x = 3`;

const arranged = `Exercise 1
Solve 2x + 3 = 7
Solution 1
x = 2
Exercise 2
Solve x + 1 = 4
Solution 2
x = 3`;

describe("preserve content prompt", () => {
  it("asks for verbatim substance and session structure only", () => {
    const { system, user } = buildPreserveEditPrompt({
      selection: pasted,
      instruction: "make these harder",
      subject: "Mathematics",
    });
    expect(system).toContain(PRESERVE_CONTENT_STANDARD);
    expect(system).toContain("Do not upgrade difficulty");
    expect(system).toContain("Do not write a solution that the paste does not already contain");
    expect(system).toContain("Exercise N");
    expect(system).not.toContain("EDUCATIONAL UPSCALING");
    expect(system).not.toContain("UPSKILL");
    expect(system).not.toContain(UPSCALING_STANDARD.slice(0, 80));
    expect(system).not.toContain(BENCHMARK_STANDARD.slice(0, 40));
    expect(user).toContain(pasted);
    expect(user).toContain("make these harder");
    expect(user).toContain("ignore any request to change, complete, or upgrade");
  });
});

describe("preserve content verifier", () => {
  it("accepts a faithful session arrangement, including a one-line solution", () => {
    expect(verifyPreserveContent(pasted, arranged)).toEqual([]);
    expect(verifyPreserveContent(pasted, arranged).join("\n")).not.toContain("complete solution");
  });

  it("rejects dropped or invented problems", () => {
    const dropped = verifyPreserveContent(pasted, "Exercise 1\nSolve 2x + 3 = 7\nSolution 1\nx = 2");
    expect(dropped.some((d) => d.includes("Do not drop"))).toBe(true);
    const invented = verifyPreserveContent(pasted, `${arranged}\nExercise 3\nSolve x + 9 = 10\nSolution 3\nx = 1`);
    expect(invented.some((d) => d.includes("Do not invent"))).toBe(true);
  });

  it("rejects an unarranged paste and a replaced method", () => {
    expect(verifyPreserveContent(pasted, pasted).some((d) => d.includes("lesson-note sessions"))).toBe(true);
    const src = "1. Solve 3x^2 + 4x + 5 = 0 using the quadratic formula\nx = -2";
    const out = "Exercise 1\nSolve 3x^2 + 4x + 5 = 0\nSolution 1\nFactorise\nx = -2";
    const defects = verifyPreserveContent(src, out);
    expect(defects.some((d) => d.includes("quadratic formula"))).toBe(true);
    expect(preserveContentCorrection(defects).toLowerCase()).toContain("do not write a solution that was not in the paste");
  });

  it("does not treat numbered working steps as extra problems", () => {
    const src = "Example 1\nSolve 2x + 3 = 7\n1. Subtract 3\n2. Divide by 2\nx = 2";
    const out = "Example 1\nSolve 2x + 3 = 7\nSolution 1\n1. Subtract 3\n2. Divide by 2\nx = 2";
    expect(verifyPreserveContent(src, out)).toEqual([]);
  });
});
