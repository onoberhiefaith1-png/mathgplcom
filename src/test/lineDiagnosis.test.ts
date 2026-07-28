import { describe, it, expect } from "vitest";
import { diagnoseLine } from "../../supabase/functions/_shared/lineDiagnosis";

const code = (t: string, s: string, v: "equal" | "not_equal" | "parse_error" | "unknown" | "not_in_floating_set" = "not_equal") =>
  diagnoseLine(t, s, v as never).code;

describe("line diagnosis", () => {
  it("reports equivalence", () => {
    expect(code("2x = 10", "x*2 = 10", "equal")).toBe("equivalent");
  });

  it("flags tokens outside the floating set", () => {
    expect(code("2x = 10", "3x = 10", "not_in_floating_set")).toBe("not_in_floating_set");
  });

  it("flags a line that stops on an operator", () => {
    expect(code("2x = 10", "2x +")).toBe("incomplete_line");
  });

  it("flags an equation with an empty right-hand side", () => {
    expect(code("2x = 10", "2x =")).toBe("incomplete_equation");
  });

  it("flags a missing equals sign", () => {
    expect(code("2x = 10", "2x 10")).toBe("missing_equals_sign");
  });

  it("flags an unbalanced bracket", () => {
    expect(code("y = (x+2)(x-1)", "y = (x+2)(x-1")).toBe("missing_bracket");
  });

  it("flags a purely arithmetic slip", () => {
    expect(code("2 + 3 = 5", "2 + 3 = 6")).toBe("incorrect_calculation");
  });

  it("never returns a bare 'incorrect' code", () => {
    const d = diagnoseLine("2x + 3 = 11", "2x + 4 = 11", "not_equal");
    expect(d.code).not.toBe("incorrect");
    expect(d.label.split(/\s+/).length).toBeLessThanOrEqual(3);
  });

  it("keeps every label to at most three words and never leaks the answer", () => {
    const cases: Array<[string, string]> = [
      ["2x = 10", "x = 6"],
      ["y = x^2 + 5x", "y = x^2"],
      ["3(x+2) = 12", "3x + 2 = 12"],
      ["x = -4", "x = 4"],
      ["2x = 10", "2x ="],
    ];
    for (const [t, s] of cases) {
      const d = diagnoseLine(t, s, "not_equal");
      expect(d.label.split(/\s+/).length).toBeLessThanOrEqual(3);
      expect(d.detail.includes(t)).toBe(false);
    }
  });
});
