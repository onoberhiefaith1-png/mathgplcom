import { describe, expect, it } from "vitest";

import { checkSolution, retryInstruction } from "../solutionContract";

const Q = "Solve x^2 + 5x + 6 = 0";

describe("checkSolution", () => {
  it("accepts a board solution: question restated, one micro-step per line", () => {
    expect(
      checkSolution(Q, ["Solve x^2 + 5x + 6 = 0", "x^2 + 5x + 6 = 0", "(x + 2)(x + 3) = 0", "x = -2", "x = -3"]),
    ).toBeNull();
  });

  it("rejects a solution that does not restate the question first", () => {
    const fault = checkSolution(Q, ["(x + 2)(x + 3) = 0", "x = -2"]);
    expect(fault?.reason).toContain("line one");
  });

  it("rejects an equation split across two lines", () => {
    const fault = checkSolution(Q, ["Solve x^2 + 5x + 6 = 0", "x^2 + 5x +", "6 = 0"]);
    expect(fault?.reason).toContain("cut off mid-equation");
  });

  it("rejects two equations merged onto one line", () => {
    const fault = checkSolution(Q, ["Solve x^2 + 5x + 6 = 0", "(x + 2)(x + 3) = 0 x = -2 x = -3"]);
    expect(fault?.reason).toContain("more than one equation");
  });

  it("rejects a question with no working under it", () => {
    expect(checkSolution(Q, ["Solve x^2 + 5x + 6 = 0"])?.reason).toContain("no working");
  });

  it("rejects an empty solution", () => {
    expect(checkSolution(Q, ["", "  "])?.reason).toContain("empty");
  });

  it("ignores spacing and LaTeX wrappers when matching the question", () => {
    expect(
      checkSolution("Solve 2x + 7 = 12", ["Solve $2x+7=12$", "2x = 5", "x = 2.5"]),
    ).toBeNull();
  });

  it("writes a correction the generator can act on", () => {
    expect(retryInstruction({ reason: "line one was missing" })).toContain("line one restates the question");
  });
});


describe("structured mathematics in the save contract", () => {
  const a = '[[tool:structure kind="matrix" rows="2" cols="2" slots="1 | 2 | 3 | 4"]]';
  const b = '[[tool:structure kind="matrix" rows="2" cols="2" slots="5 | 6 | 7 | 8"]]';
  const work = '[[tool:structure kind="matrix" rows="2" cols="2" slots="1×5+2×7 | 1×6+2×8 | 3×5+4×7 | 3×6+4×8"]]';
  const result = '[[tool:structure kind="matrix" rows="2" cols="2" slots="19 | 22 | 43 | 50"]]';
  it("accepts a complete matrix product without counting directive attributes", () => {
    const question = `Find AB.\nA =\n${a}\nB =\n${b}`;
    expect(checkSolution(question, [...question.split("\n"), "Use row times column.", "AB =", work, "=", result])).toBeNull();
  });
  it("does not hide a changed matrix entry in the restatement", () => {
    const question = `Find A squared.\n${a}`;
    expect(checkSolution(question, ["Find A squared.", a.replace('1 | 2', '9 | 2'), "A² =", result])?.reason).toContain("line one");
  });
  it("does not use a correct question repeated later to excuse a wrong opener", () => {
    expect(checkSolution("Find AB.", ["Find BA.", "Find AB.", result])?.reason).toContain("line one");
  });
  it("still refuses ordinary detached algebra and a trailing matrix introducer", () => {
    expect(checkSolution("Find AB.", ["Find AB.", "x =", "5"])?.reason).toContain("cut off");
    expect(checkSolution("Find AB.", ["Find AB.", "AB ="])?.reason).toContain("cut off");
  });
  it("accepts a monotone bound in a sequence limit proof", () => {
    expect(checkSolution("Show 1/n tends to 0.", ["Show 1/n tends to 0.", "Choose N greater than 1/ε.", "|1/n − 0| = 1/n ≤ 1/N < ε"])).toBeNull();
  });
  it("still refuses unrelated equations and contradictory bound directions", () => {
    expect(checkSolution("Find x.", ["Find x.", "x = 2 and y = 3"])?.reason).toContain("more than one equation");
    expect(checkSolution("Find x.", ["Find x.", "x < 2 > 3"])?.reason).toContain("more than one equation");
  });
  it("does not count a sum's index as a second equation", () => {
    expect(checkSolution("Find S.", ["Find S.", String.raw`S = \sum_{k=1}^{n} k`])).toBeNull();
  });
});

  it("retains inequality direction when matching the original question", () => {
    expect(checkSolution("Solve x < 3.", ["Solve x > 3.", "x > 3"])?.reason).toContain("line one");
  });

  it("matches equivalent superscript notation without losing Greek variable identity", () => {
    expect(checkSolution("Solve x^2 = 4.", ["Solve x² = 4.", "x = 2", "x = -2"])).toBeNull();
    expect(checkSolution("Find θ.", ["Find φ.", "φ = 30°"])?.reason).toContain("line one");
  });
