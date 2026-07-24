// Equivalence engine — deterministic (symbolic + numeric) layer.
// The LLM fallback is not exercised here; every case below must be settled
// without any network call.

import { describe, it, expect } from "vitest";
import { equivalent } from "../../supabase/functions/_shared/mathEquivalence";

const eq = (t: string, s: string) => equivalent(t, s);

describe("mathEquivalence — equivalent forms", () => {
  const cases: Array<[string, string]> = [
    ["3(x + 2)", "3x + 6"],
    ["2(x + y)", "2x + 2y"],
    ["x^2 - 9", "(x + 3)(x - 3)"],
    ["5a + 2b − 7", "2b + 5a − 7"],
    ["3(x + 4) - 2", "3x + 10"],
    ["(a + b)^2", "a^2 + 2ab + b^2"],
    ["2 + 2 + 4", "8"],
    ["2x = 10", "10 = 2x"],
  ];
  for (const [t, s] of cases) {
    it(`"${t}" ≡ "${s}"`, async () => {
      expect(await eq(t, s)).toBe("equal");
    });
  }
});

describe("mathEquivalence — non-equivalent forms", () => {
  const cases: Array<[string, string]> = [
    ["3(x + 2)", "3x + 2"],
    ["2 + 2 + 4", "9"],
    ["x^2 - 9", "(x - 3)(x - 3)"],
    ["5a + 2b - 7", "5a + 2b + 7"],
  ];
  for (const [t, s] of cases) {
    it(`"${t}" ≢ "${s}"`, async () => {
      expect(await eq(t, s)).toBe("not_equal");
    });
  }
});

describe("mathEquivalence — guards", () => {
  it("empty input is unknown", async () => {
    expect(await eq("", "2x")).toBe("unknown");
    expect(await eq("2x", "")).toBe("unknown");
  });
});
