// Equivalence engine — deterministic (symbolic + numeric) layer.
// The LLM fallback is not exercised here; every case below must be settled
// without any network call.
//
// The engine lives in the edge-function tree (Deno). It is loaded through a
// runtime dynamic import so the TypeScript app build never type-checks Deno
// globals, while Vitest resolves `npm:mathjs@12` via the config alias.

import { describe, it, expect, beforeAll } from "vitest";

type Verdict = "equal" | "not_equal" | "unknown";
let equivalent: (t: string, s: string) => Promise<Verdict>;

beforeAll(async () => {
  (globalThis as unknown as { Deno?: unknown }).Deno ??= { env: { get: () => undefined } };
  const modPath = "../../supabase/functions/_shared/mathEquivalence.ts";
  const mod = (await import(/* @vite-ignore */ modPath)) as {
    equivalent: (t: string, s: string) => Promise<Verdict>;
  };
  equivalent = mod.equivalent;
});

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
    it(`"${t}" == "${s}"`, async () => {
      expect(await equivalent(t, s)).toBe("equal");
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
    it(`"${t}" != "${s}"`, async () => {
      expect(await equivalent(t, s)).toBe("not_equal");
    });
  }
});

describe("mathEquivalence — guards", () => {
  it("empty input is unknown", async () => {
    expect(await equivalent("", "2x")).toBe("unknown");
    expect(await equivalent("2x", "")).toBe("unknown");
  });
});
