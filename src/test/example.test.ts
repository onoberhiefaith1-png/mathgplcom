import { describe, it, expect } from "vitest";
import { dropContextualLeadingPlus, expandTransitionLine } from "@/lib/smartboard/floatingExtractor";
import { equationsEquivalent, equationsMatch } from "@/lib/smartboard/rowAscii";

describe("expandTransitionLine keeps coefficients attached", () => {
  it("does not split −2y when prev line contains y", () => {
    const { fillers } = expandTransitionLine(
      ["2x", "+y", "=", "7"],
      ["3x", "−2y", "=", "0"],
      new Set(),
    );
    expect(fillers).toEqual(["3x", "−2y", "=", "0"]);
  });
});

describe("smartboard equation comparison", () => {
  it("accepts a written stacked fraction when the lesson note stores LaTeX fraction syntax", () => {
    expect(equationsMatch("y=(-16)/(-7)", "y=\\frac{-16}{-7}")).toBe(true);
    expect(equationsEquivalent("y=(-16)/(-7)", "y=\\frac{-16}{-7}")).toBe(true);
  });
});

describe("dropContextualLeadingPlus", () => {
  it("drops leading + on the first chip and after =", () => {
    expect(dropContextualLeadingPlus(["+2x", "+3y", "=", "+7"])).toEqual([
      "2x",
      "+3y",
      "=",
      "7",
    ]);
  });

  it("keeps non-+ signs intact", () => {
    expect(dropContextualLeadingPlus(["+ax²", "+bx", "+c", "=", "+0"])).toEqual([
      "ax²",
      "+bx",
      "+c",
      "=",
      "0",
    ]);
  });

  it("handles bracket-expanded streams from 2x + 3(x+1) = 7", () => {
    expect(
      dropContextualLeadingPlus(["+2x", "+3", "+x", "+1", "=", "+7"]),
    ).toEqual(["2x", "+3", "+x", "+1", "=", "7"]);
  });

  it("leaves chips with leading − or × alone", () => {
    expect(dropContextualLeadingPlus(["−4ac", "+b²"])).toEqual(["−4ac", "+b²"]);
  });

  it("is a no-op when already normalised", () => {
    expect(dropContextualLeadingPlus(["2x", "+3y", "=", "7"])).toEqual([
      "2x",
      "+3y",
      "=",
      "7",
    ]);
  });
});
