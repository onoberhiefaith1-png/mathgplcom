import { describe, it, expect } from "vitest";
import { validateMathOutput, runValidationPipeline, firstFailingStage, hardStripMath } from "../../supabase/functions/notebook-ai/validator.ts";
import { assertDisplaySafe } from "@/lib/notebook/mathDisplayGate";

describe("MathGPL validator", () => {
  it("passes a clean solution", () => {
    const text = ["2x = 4", "2x ÷ 2 = 4 ÷ 2", "x = 2"].join("\n");
    expect(validateMathOutput(text, "solution").ok).toBe(true);
  });

  it("flags hidden division step", () => {
    const text = ["2x = 4", "x = 2"].join("\n");
    const r = validateMathOutput(text, "solution");
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.rule === "missing-division-step")).toBe(true);
  });

  it("flags raw latex commands", () => {
    const r = validateMathOutput("x = \\alpha + \\beta", "text");
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.rule === "no-latex-commands")).toBe(true);
  });

  it("accepts \\frac and \\sqrt templates", () => {
    const r = validateMathOutput("x = \\frac{1}{2}\ny = \\sqrt{16}", "text");
    expect(r.ok).toBe(true);
  });

  it("flags missing bracket expansion", () => {
    const text = ["(x + 2)(x + 2)", "x² + 4x + 4"].join("\n");
    const r = validateMathOutput(text, "solution");
    expect(r.violations.some((v) => v.rule === "missing-bracket-expansion")).toBe(true);
  });

  it("flags prefix labels", () => {
    const r = validateMathOutput("Solution: x = 2", "text");
    expect(r.violations.some((v) => v.rule === "no-prefix-labels")).toBe(true);
  });

  it("rejects unbalanced \\frac (the screenshot leak)", () => {
    const r = validateMathOutput("\\frac{2(√()} - 1)}{3 - 1}", "text");
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.rule === "unbalanced-template" || v.rule === "no-latex-commands",
      ),
    ).toBe(true);
  });

  it("flags slash fractions in a text block", () => {
    const r = validateMathOutput("answer is 27/7 today", "text");
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.rule === "fractions-must-be-stacked")).toBe(true);
  });

  it("flags parenthesised slash fraction in a problem (the screenshot leak)", () => {
    const r = validateMathOutput("Integrate (x²+1)/(x-2) dx", "problem");
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.rule === "fractions-must-be-stacked")).toBe(true);
  });

  it("flags truncated \\frac in a problem", () => {
    const r = validateMathOutput("Integrate \\frac{3x+2}{ dx", "problem");
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.rule === "unbalanced-template" || v.rule === "no-latex-commands",
      ),
    ).toBe(true);
  });

  it("flags slash fractions in a question/text block", () => {
    const r = validateMathOutput("Solve 27/7 + x = 0", "text");
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.rule === "fractions-must-be-stacked")).toBe(true);
  });

  it("flags complex exponents that should become shells", () => {
    const r = validateMathOutput("x^{2+1}", "floating");
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.rule === "complex-exponent-must-be-shell")).toBe(true);
  });

  it("flags complex subscripts that should become shells", () => {
    const r = validateMathOutput("a_{n+2}", "floating");
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.rule === "complex-subscript-must-be-shell")).toBe(true);
  });
});

describe("MathGPL hard-strip", () => {
  it("converts slash fractions to \\frac", () => {
    expect(hardStripMath("answer 27/7")).toContain("\\frac{27}{7}");
    expect(hardStripMath("(x+1)/(x-2)")).toContain("\\frac{x+1}{x-2}");
  });

  it("repairs truncated \\frac into safe empty-slot template", () => {
    const out = hardStripMath("Integrate \\frac{3x+2}{ dx");
    expect(out).not.toMatch(/\\frac\{3x\+2\}\{\s*dx/);
    expect(out).toContain("\\frac{\\sl{}}{\\sl{}}");
  });

  it("strips unknown LaTeX commands and is idempotent", () => {
    const once = hardStripMath("x = \\alpha + \\beta + \\frac{1}{2}");
    expect(once).not.toMatch(/\\alpha|\\beta/);
    expect(once).toContain("\\frac{1}{2}");
    expect(hardStripMath(once)).toBe(once);
  });
});

describe("MathGPL display gate", () => {
  it("repairs the screenshot leak into safe empty slots", () => {
    const r = assertDisplaySafe("\\frac{2(√()} - 1)}{3 - 1}");
    // Either the gate stripped the broken template into a safe \frac{\sl{}}{\sl{}}
    // shape OR it flagged unsafe — in NEITHER case may raw text reach the DOM.
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.cleaned).not.toMatch(/\\frac\{2\(/);
  });

  it("rewrites inline slash fractions into \\frac", () => {
    const r = assertDisplaySafe("the answer is 27/7");
    expect(r.cleaned).toContain("\\frac{27}{7}");
    expect(r.safe).toBe(true);
  });

  it("passes clean classroom math untouched", () => {
    const r = assertDisplaySafe("x = \\frac{1}{2} + \\sqrt{16}");
    expect(r.safe).toBe(true);
    expect(r.cleaned).toBe("x = \\frac{1}{2} + \\sqrt{16}");
  });

  it("strips leftover unknown LaTeX commands and flags unsafe", () => {
    const r = assertDisplaySafe("x = \\foo + \\bar{y}");
    expect(r.safe).toBe(false);
    expect(r.cleaned).not.toContain("\\foo");
  });
});
