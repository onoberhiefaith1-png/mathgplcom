import { describe, expect, it } from "vitest";
import { assertDisplaySafe } from "@/lib/notebook/mathDisplayGate";

const safe = (s: string) => assertDisplaySafe(s).cleaned;

describe("braceless structural macros", () => {
  it("reads single-token fraction arguments", () => {
    expect(safe("\\frac12")).toContain("\\frac{1}{2}");
    expect(safe("\\frac ab")).toContain("\\frac{a}{b}");
  });

  it("reads a symbol glyph as one argument", () => {
    expect(safe("\\fracπ2")).toContain("\\frac{π}{2}");
  });

  it("reads braceless roots", () => {
    expect(safe("\\sqrt2")).toContain("\\sqrt{2}");
  });

  it("never leaks an operand beside an empty slot", () => {
    const out = safe("\\frac1");
    expect(out).not.toMatch(/\\sl\{\}\}1/);
  });
});
