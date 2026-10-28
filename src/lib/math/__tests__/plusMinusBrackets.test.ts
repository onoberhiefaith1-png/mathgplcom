import { describe, it, expect } from "vitest";
import { parseLine, structurallyEquivalent } from "@/lib/math/structure";

const student = "x = (-(-2) ± √((-2)^2 - 4(5)(-4)))/(2(5))";
const expected = "x=\\frac{-(-2)\\pm\\sqrt{(-2)^2-4(5)(-4)}}{2(5)}";

describe("± lines with extra brackets", () => {
  it("reads a fully closed line as valid", () => expect(parseLine(student).state).toBe("valid"));
  it("is equivalent to the expected line", () => expect(structurallyEquivalent(expected, student)).toBe(true));
  it("4(5) is multiplication, not 45", () => expect(structurallyEquivalent("4(5)", "20")).toBe(true));
  it("a genuinely open bracket still asks to close it", () =>
    expect(parseLine("x = (-(-2) ± √(4").missing).toBe("close the bracket"));
  it("a wrong sign is not equivalent", () =>
    expect(structurallyEquivalent(expected, "x = (-2 ± √((-2)^2 - 4(5)(-4)))/(2(5))")).toBe(false));
});
