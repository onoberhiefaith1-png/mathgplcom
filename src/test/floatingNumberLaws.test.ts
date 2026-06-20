import { describe, expect, it } from "vitest";
import { extractTermsFromAscii } from "@/lib/smartboard/floatingExtractor";

const bodies = (src: string) => extractTermsFromAscii(src).map((t) => t.ascii);

describe("floating number laws from teacher examples", () => {
  it("splits on top-level plus while keeping signs attached", () => {
    // Leading "+" is implicit in the source ⇒ no sign on chip.
    expect(bodies("x+1")).toEqual(["x", "+1"]);
    expect(bodies("-2+4")).toEqual(["-2", "+4"]);
  });

  it("keeps a simple fraction as one floating number", () => {
    expect(bodies("\\frac{x}{y}")).toEqual(["\\frac{x}{y}"]);
  });

  it("splits a complex fraction into shell contents", () => {
    expect(bodies("\\frac{x+1}{y-2}")).toEqual(["x", "+1", "y", "-2"]);
  });

  it("keeps a simple radical whole and splits a complex radical", () => {
    expect(bodies("√5")).toEqual(["√5"]);
    expect(bodies("√(x+1)")).toEqual(["√()", "x", "+1"]);
  });

  it("keeps simple logs whole and opens complex arguments", () => {
    expect(bodies("log₂b")).toEqual(["log₂b"]);
    expect(bodies("log₂(x+1)")).toEqual(["log₂()", "x", "+1"]);
  });

  it("keeps simple exponents attached and shells complex exponents", () => {
    expect(bodies("x^3")).toEqual(["x^3"]);
    expect(bodies("(x+1)^3")).toEqual(["()^3", "x", "+1"]);
    expect(bodies("(x+1)^(n+2)")).toEqual(["()^()", "x", "+1", "n", "+2"]);
  });

  it("keeps function names attached and opens complex arguments", () => {
    expect(bodies("sinx+cosy")).toEqual(["sinx", "+cosy"]);
    expect(bodies("sin(x+1)+cos(y-2)")).toEqual(["sin()", "x", "+1", "+cos()", "y", "-2"]);
  });

  it("keeps derivative shells attached to their bodies", () => {
    expect(bodies("d/dx(x^2+3x)")).toEqual(["d/dx()", "x^2", "+3x"]);
  });

  it("splits implicit multiplication when any factor carries a power or subscript", () => {
    // simple multiplicative runs stay whole, with no synthetic "+"
    expect(bodies("xsinx")).toEqual(["xsinx"]);
    expect(bodies("xsin2y")).toEqual(["xsin2y"]);
    expect(bodies("2xy")).toEqual(["2xy"]);
    // a factor with a power forces a split at factor boundaries
    expect(bodies("3x²sinx")).toEqual(["3x²", "sinx"]);
    expect(bodies("3x²sin2x")).toEqual(["3x²", "sin2x"]);
    // power inside a log argument opens the log shell
    expect(bodies("log_a(x²y)")).toEqual(["log_a()", "x²", "y"]);
    expect(bodies("log_a(xy)")).toEqual(["log_a(xy)"]);
  });

  it("explodes any bracket whose interior hides an arithmetic sign", () => {
    // 4(n+2) → coefficient stays, bracket opens, sign appears as its own chip
    expect(bodies("4(n+2)")).toEqual(["4", "()", "n", "+2"]);
    // fraction denominator with a hidden-sign bracket opens the fraction
    expect(bodies("\\frac{23}{4(n+2)}")).toEqual(["□/□", "23", "4", "()", "n", "+2"]);
    // simple coefficient×variable denominator (no hidden sign) stays whole
    expect(bodies("\\frac{5}{3n}")).toEqual(["\\frac{5}{3n}"]);
  });
});
