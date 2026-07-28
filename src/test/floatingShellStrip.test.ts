import { describe, it, expect } from "vitest";
import { stripStructureShells } from "@/components/smartboard/FloatingNumberPanel";

describe("floating chips carry numbers, never placeholder scaffolding", () => {
  it("drops fraction / radical / power shells", () => {
    expect(stripStructureShells("x=\\frac{□}{□}")).toBe("x=");
    expect(stripStructureShells("\\frac{\\,□\\,}{\\,□\\,}")).toBe("");
    expect(stripStructureShells("±\\sqrt{□}")).toBe("±");
    expect(stripStructureShells("□^{□}")).toBe("");
    expect(stripStructureShells("( □ )")).toBe("");
  });
  it("leaves real numbers untouched", () => {
    expect(stripStructureShells("−5")).toBe("−5");
    expect(stripStructureShells("b^{2}")).toBe("b^{2}");
    expect(stripStructureShells("\\frac{5}{2}")).toBe("\\frac{5}{2}");
    expect(stripStructureShells("2a")).toBe("2a");
  });
});
