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
