import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { parseLine, structurallyEquivalent } from "@/lib/math/structure";
import { buildRouteMap, predict, provesEquivalent } from "../predictiveLine";
import { ReadableMath } from "@/components/gameslate/ReadableMath";

const visible = (src: string) =>
  renderToStaticMarkup(createElement(ReadableMath, { src })).replace(/<[^>]+>/g, "");

const CASES: Array<[string, string]> = [
  ["x + 3 = 9", "x = 6"],
  ["\\frac{3x}{3} = \\frac{15}{3}", "x = 5"],
  ["(2x + 3)/(x + 1) = 5", "2x + 3 = 5(x + 1)"],
  ["\\sqrt{x + 2} = 5", "√(x+2) = 5"],
  ["x² + 3x = 10", "x^2 + 3x - 10 = 0"],
  ["\\sqrt[3]{x + 1} = 3", "∛(x+1) = 3"],
  ["\\frac{x^{2} + 3}{2} = 7", "x^2 + 3 = 14"],
  ["2(x + 3) = 14", "2x + 6 = 14"],
  ["\\frac{3x}{2} > 6", "3x > 12"],
  ["3x/3 = 5", "x = 5"],
];

describe("structured predictive line", () => {
  it.each(CASES)("parses, validates and proves %s ≡ %s", (a, b) => {
    expect(parseLine(a).state).toBe("valid");
    expect(parseLine(b).state).toBe("valid");
    expect(structurallyEquivalent(a, b)).toBe(true);
  });

  it.each(CASES)("renders %s with no raw syntax", (a) => {
    expect(visible(a)).not.toMatch(/[\\{}]/);
  });

  it("rejects a wrong step", () => {
    expect(structurallyEquivalent("3x = 15", "x = 6")).toBe(false);
    expect(structurallyEquivalent("3x/2 > 6", "x < 4")).toBe(false);
  });

  it("an unfinished fraction is incomplete, not no-route", () => {
    expect(parseLine("\\frac{3x}{}").state).toBe("incomplete");
    const map = buildRouteMap({ expectedAscii: "\\frac{3x}{3} = \\frac{15}{3}", atoms: ["3x", "3", "=", "15", "3"] });
    const p = predict({ routeMap: map, studentAscii: "\\frac{3x}{" });
    expect(p.status).toBe("incomplete_structure");
  });

  it("builds a fraction route from separate Floating Numbers", () => {
    const map = buildRouteMap({ expectedAscii: "\\frac{3x}{3} = \\frac{15}{3}", atoms: ["3x", "3", "=", "15", "3"] });
    const p = predict({ routeMap: map, studentAscii: "\\frac{3x}{3}" });
    expect(p.status).toBe("incomplete");
    expect(provesEquivalent(map.expected, p.predictive)).toBe(true);
    expect(visible(p.predictive)).not.toMatch(/[\\{}]/);
  });

  it("proves a simplified line equivalent", () => {
    expect(provesEquivalent("\\frac{3x}{3} = \\frac{15}{3}", "x = 5")).toBe(true);
  });
});
