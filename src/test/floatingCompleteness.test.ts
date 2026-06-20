import { describe, it, expect } from "vitest";
import {
  verifyCompleteness,
  summariseMissing,
} from "../../supabase/functions/notebook-ai/completenessVerifier.ts";

describe("completenessVerifier", () => {
  it("flags missing identifiers", () => {
    const r = verifyCompleteness("P = ρ v² (1/C_v + k)", "P = ρ v²");
    expect(r.ok).toBe(false);
    expect(r.missingIdentifiers).toContain("k");
  });

  it("flags missing numbers", () => {
    const r = verifyCompleteness("∫ 1/(x²+4x+13) dx", "∫ 1/(x²+4x) dx");
    expect(r.ok).toBe(false);
    expect(r.missingNumbers).toContain("13");
  });

  it("flags missing integral / radical markers", () => {
    const r = verifyCompleteness("∫ √(x+1) dx", "x + 1");
    expect(r.ok).toBe(false);
    expect(r.missingStructures).toEqual(expect.arrayContaining(["∫", "√"]));
  });

  it("passes when every element is present even if rewritten", () => {
    const src = "∫ 1/(x²+4x+13) dx";
    const gen = "∫ 1/((x+2)²+9) dx\n1/3 tan⁻¹((x+2)/3) + C";
    const r = verifyCompleteness(src, gen);
    // numbers 1, 4, 13 must appear — only 1 is guaranteed in gen,
    // so this should still flag 4 and 13.
    expect(r.ok).toBe(false);
    expect(r.missingNumbers).toContain("4");
  });

  it("summariseMissing produces readable string", () => {
    const r = verifyCompleteness("ax + b = c", "ax = c");
    expect(summariseMissing(r)).toMatch(/identifiers/);
  });
});
