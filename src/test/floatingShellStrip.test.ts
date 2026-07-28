// Floating numbers are EXTRACTED, never rebuilt. A token leaving Present
// Preview (Normal Mode) must reach the Floating Number Display unchanged —
// structures and their placeholder slots included.
import { describe, it, expect } from "vitest";
import {
  structureSignature,
  validateFloatingToken,
} from "@/components/smartboard/FloatingNumberPanel";

describe("floating token fidelity", () => {
  it("passes structures through untouched", () => {
    for (const t of ["x=\\frac{□}{□}", "±\\sqrt{□}", "b^{2}", "\\frac{5}{2}", "2a", "−5"]) {
      expect(validateFloatingToken(t, t)).toBe(t);
    }
  });

  it("rejects a generated token that altered the structure", () => {
    expect(validateFloatingToken("x=\\frac{□}{□}", "x=")).toBe("x=\\frac{□}{□}");
    expect(validateFloatingToken("±\\sqrt{□}", "±")).toBe("±\\sqrt{□}");
  });

  it("signature counts fractions, roots, scripts, brackets and slots", () => {
    expect(structureSignature("\\frac{□}{□}")).not.toBe(structureSignature(""));
    expect(structureSignature("\\frac{a}{b}")).toBe(structureSignature("\\frac{x}{y}"));
  });
});
