// Tests for the backend deterministic floating-number extractor and verifier.
// We import the edge-function modules directly — they are pure TS with no
// Deno-only APIs, so Vitest can run them as-is.
import { describe, it, expect } from "vitest";
import { extractLine } from "../../supabase/functions/notebook-ai/floatingExtractor.ts";
import { verifyLine } from "../../supabase/functions/notebook-ai/floatingVerifier.ts";

const run = (eq: string) => extractLine(eq);

const expectValid = (eq: string) => {
  const out = run(eq);
  const v = verifyLine({ fillers: out.fillers, containers: out.containers });
  if (!v.ok) {
    throw new Error(
      `verifier failed for "${eq}": ${JSON.stringify(v.failures)} fillers=${JSON.stringify(out.fillers)}`,
    );
  }
  return out;
};

describe("backend floating extractor — worked examples", () => {
  it("2x + 3y = 7", () => {
    const out = expectValid("2x + 3y = 7");
    expect(out.fillers).toEqual(["2x", "+3y", "=", "7"]);
  });

  it("3x − 2y = 0 keeps coefficient attached", () => {
    const out = expectValid("3x − 2y = 0");
    expect(out.fillers).toEqual(["3x", "−2y", "=", "0"]);
  });

  it("ax² + bx + c = 0", () => {
    const out = expectValid("ax² + bx + c = 0");
    expect(out.fillers).toEqual(["ax²", "+bx", "+c", "=", "0"]);
    expect(out.containers).toContain("power");
  });

  it("2x + 3(x+1) = 7 opens the bracket", () => {
    const out = expectValid("2x + 3(x+1) = 7");
    expect(out.fillers).toEqual(["2x", "+3", "()", "x", "+1", "=", "7"]);
    expect(out.containers).toContain("bracket");
  });

  it("√(b²−4ac) opens radical", () => {
    const out = expectValid("√(b²−4ac)");
    expect(out.fillers).toEqual(["√()", "b²", "−4ac"]);
    expect(out.containers).toContain("radical");
  });

  it("log₂(xy) stays glued inside the log shell", () => {
    const out = expectValid("log₂(xy)");
    expect(out.fillers).toEqual(["log₂(xy)"]);
    expect(out.containers).toContain("log");
  });

  it("log₂(x+y) opens the log argument", () => {
    const out = expectValid("log₂(x+y)");
    expect(out.fillers).toEqual(["log₂()", "x", "+y"]);
    expect(out.containers).toContain("log");
  });

  it("5/(3n) opens to shell + numerator + denominator", () => {
    const out = expectValid("5/(3n)");
    expect(out.fillers).toEqual(["□/□", "5", "3n"]);
    expect(out.containers).toContain("fraction");
  });

  it("−23/(4(n+2)) opens denominator bracket", () => {
    const out = expectValid("−23/(4(n+2))");
    expect(out.fillers).toEqual(["−□/□", "23", "4", "()", "n", "+2"]);
    expect(out.containers).toContain("fraction");
    expect(out.containers).toContain("bracket");
  });

  it("−3n²(2x)^(n−4) opens exponent", () => {
    const out = expectValid("−3n²(2x)^(n−4)");
    expect(out.fillers).toEqual(["−3n²", "()^()", "2x", "n", "−4"]);
    expect(out.containers).toContain("power");
    expect(out.containers).toContain("bracket");
  });

  it("u^(-2+1) keeps the empty exponent box as a true superscript shell", () => {
    const out = expectValid("u^(-2+1)");
    expect(out.fillers).toEqual(["u^{□}", "−2", "+1"]);
    expect(out.fillers[0]).not.toBe("u□");
    expect(out.containers).toContain("power");
  });

  it("splits coefficient times integral terms so denominator signs do not loop recovery", () => {
    const out = expectValid("\\frac{1}{2} \\int \\frac{1}{x} dx + 2 \\int \\frac{1}{x - 1} dx - \\frac{1}{2} \\int \\frac{1}{x + 2} dx");
    expect(out.fillers).toContain("∫()dx");
    expect(out.fillers).toContain("−1");
    expect(out.fillers).toContain("+2");
    expect(out.containers).toContain("integral");
    expect(out.containers).toContain("fraction");
  });
});

describe("backend floating extractor — user's screenshot equation", () => {
  // (x²+2x+1)/((x²+1)(x+1)) = A/(x+1) + (Bx+C)/(x²+1)
  it("partial-fraction setup never emits raw / ( ) chips", () => {
    const out = expectValid("(x²+2x+1)/((x²+1)(x+1)) = A/(x+1) + (Bx+C)/(x²+1)");
    // Every chip must be a non-empty Unicode chip and never a raw operator/bracket.
    for (const chip of out.fillers) {
      expect(chip.length).toBeGreaterThan(0);
      expect(["+", "−", "×", "÷", "/", "*", "(", ")", "[", "]", "{", "}"]).not.toContain(chip);
    }
    // Must contain a fraction shell and at least two bracket opens.
    expect(out.fillers.filter((c) => c === "□/□" || c === "+□/□" || c === "−□/□").length).toBeGreaterThanOrEqual(2);
    expect(out.fillers.filter((c) => c === "()" || c === "+()" || c === "−()").length).toBeGreaterThanOrEqual(1);
    expect(out.containers).toContain("fraction");
    expect(out.containers).toContain("bracket");
  });
});

describe("backend floating verifier", () => {
  it("flags raw bracket chips", () => {
    const v = verifyLine({ fillers: ["x", "(", "x", "+1", ")"], containers: ["bracket"] });
    expect(v.ok).toBe(false);
    expect(v.failures.some((f) => f.code === "NoRawBracketChip")).toBe(true);
  });

  it("flags raw operator chips", () => {
    const v = verifyLine({ fillers: ["x", "+", "y"], containers: [] });
    expect(v.failures.some((f) => f.code === "NoRawOperatorChip")).toBe(true);
  });

  it("flags synthetic leading +", () => {
    const v = verifyLine({ fillers: ["+x", "+y"], containers: [] });
    expect(v.failures.some((f) => f.code === "NoSyntheticLeadingPlus")).toBe(true);
  });

  it("flags hidden sign inside chip", () => {
    const v = verifyLine({ fillers: ["4(n+2)"], containers: ["bracket"] });
    expect(v.failures.some((f) => f.code === "NoHiddenSign")).toBe(true);
  });

  it("flags duplicate container kinds", () => {
    const v = verifyLine({ fillers: ["x"], containers: ["bracket", "bracket"] });
    expect(v.failures.some((f) => f.code === "ContainerDedup")).toBe(true);
  });

  it("flags disallowed container kinds", () => {
    const v = verifyLine({ fillers: ["x"], containers: ["nonsense"] });
    expect(v.failures.some((f) => f.code === "ContainerAllowed")).toBe(true);
  });

  it("passes a clean canonical line", () => {
    const v = verifyLine({ fillers: ["2x", "+3y", "=", "7"], containers: [] });
    expect(v.ok).toBe(true);
  });
});
