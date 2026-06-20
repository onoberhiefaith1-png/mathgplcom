import { describe, expect, it } from "vitest";
import { extractTermsFromAscii } from "@/lib/smartboard/floatingExtractor";

const bodies = (src: string) => extractTermsFromAscii(src).map((t) => t.ascii);

describe("floating number laws from teacher examples", () => {
  it("splits on top-level plus while keeping signs attached", () => {
    expect(bodies("x+1")).toEqual(["+x", "+1"]);
    expect(bodies("-2+4")).toEqual(["-2", "+4"]);
  });

  it("keeps a simple fraction as one floating number", () => {
    expect(bodies("\\frac{x}{y}")).toEqual(["+\\frac{x}{y}"]);
  });

  it("splits a complex fraction into shell contents", () => {
    expect(bodies("\\frac{x+1}{y-2}")).toEqual(["+x", "+1", "+y", "-2"]);
  });

  it("keeps a simple radical whole and splits a complex radical", () => {
    expect(bodies("√5")).toEqual(["+√5"]);
    expect(bodies("√(x+1)")).toEqual(["+√()", "+x", "+1"]);
  });

  it("keeps simple logs whole and opens complex arguments", () => {
    expect(bodies("log₂b")).toEqual(["+log₂b"]);
    expect(bodies("log₂(x+1)")).toEqual(["+log₂()", "+x", "+1"]);
  });

  it("keeps simple exponents attached and shells complex exponents", () => {
    expect(bodies("x^3")).toEqual(["+x^3"]);
    expect(bodies("(x+1)^3")).toEqual(["+()^3", "+x", "+1"]);
    expect(bodies("(x+1)^(n+2)")).toEqual(["+()^()", "+x", "+1", "+n", "+2"]);
  });

  it("keeps function names attached and opens complex arguments", () => {
    expect(bodies("sinx+cosy")).toEqual(["+sinx", "+cosy"]);
    expect(bodies("sin(x+1)+cos(y-2)")).toEqual(["+sin()", "+x", "+1", "+cos()", "+y", "-2"]);
  });

  it("keeps derivative and integral shells attached to their bodies", () => {
    expect(bodies("d/dx(x^2+3x)")).toEqual(["+d/dx()", "+x^2", "+3x"]);
    expect(bodies("∫_0^1(x^2+1)dx")).toEqual(["+∫_0^1()dx", "+x^2", "+1"]);
  });
});