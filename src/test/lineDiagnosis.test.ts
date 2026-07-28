// Diagnostic validator for Check Line.
// The engine lives in the edge-function tree (Deno), so it is loaded through a
// runtime dynamic import — the app build never type-checks Deno globals.

import { describe, it, expect, beforeAll } from "vitest";

type Diagnosis = { code: string; label: string; detail: string };
let diagnoseLine: (t: string, s: string, v: string, allowed?: string[]) => Diagnosis;

beforeAll(async () => {
  (globalThis as unknown as { Deno?: unknown }).Deno ??= { env: { get: () => undefined } };
  const modPath = "../../supabase/functions/_shared/lineDiagnosis.ts";
  const mod = (await import(/* @vite-ignore */ modPath)) as {
    diagnoseLine: (t: string, s: string, v: string, allowed?: string[]) => Diagnosis;
  };
  diagnoseLine = mod.diagnoseLine;
});

const code = (t: string, s: string, v = "not_equal") => diagnoseLine(t, s, v).code;

describe("line diagnosis", () => {
  it("reports equivalence", () => {
    expect(code("2x = 10", "x*2 = 10", "equal")).toBe("equivalent");
  });

  it("flags a number that was not supplied for this line", () => {
    expect(code("2x = 10", "3x = 10", "not_in_floating_set")).toBe("number_not_given");
  });

  it("flags a symbol the student introduced", () => {
    expect(diagnoseLine("2x = 10", "2x + c = 10", "not_in_floating_set", ["2", "x", "10"]).code)
      .toBe("symbol_not_supplied");
  });

  it("cannot evaluate an empty line", () => {
    expect(code("2x = 10", "")).toBe("cannot_evaluate_yet");
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

  it("never falls back to a bare 'incorrect' code", () => {
    const d = diagnoseLine("2x + 3 = 11", "2x + 4 = 11", "not_equal");
    expect(d.code).not.toBe("incorrect");
  });

  it("keeps every label short and never leaks the expected line", () => {
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
