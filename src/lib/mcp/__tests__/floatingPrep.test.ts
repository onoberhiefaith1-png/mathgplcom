import { describe, expect, it } from "vitest";
import { buildHighlights, reconstructs, unhighlightedNotes, validateQuestion, PrepError } from "../floatingPrep";

let n = 0;
const uid = () => `u${++n}`;
const SOL = ["x^2 + 5x + 6 = 0", "(x + 2)(x + 3) = 0", "x + 2 = 0 or x + 3 = 0"];

describe("buildHighlights", () => {
  it("highlights a whole line", () => {
    const [h] = buildHighlights(SOL, [{ solutionLine: 2 }], uid);
    expect(h!.payload).toBe("(x + 2)(x + 3) = 0");
    expect(h!.groupId).toBe(1);
  });
  it("splits one line into two numbered selections and keeps order", () => {
    const hs = buildHighlights(SOL, [{ solutionLine: 3, start: 0, end: 9 }, { solutionLine: 3, start: 13 }], uid);
    expect(hs.map((h) => h.payload)).toEqual(["x + 2 = 0", "x + 3 = 0"]);
    expect(hs.map((h) => h.groupId)).toEqual([1, 2]);
  });
  it("keeps unhighlighted text as Notes", () => {
    const hs = buildHighlights(SOL, [{ solutionLine: 3, start: 0, end: 9 }, { solutionLine: 3, start: 13 }], uid);
    expect(unhighlightedNotes(SOL, hs)).toEqual([
      { solutionLine: 1, text: SOL[0] },
      { solutionLine: 2, text: SOL[1] },
      { solutionLine: 3, text: "or" },
    ]);
  });
  it("rejects a range cutting through a piece", () => {
    expect(() => buildHighlights(SOL, [{ solutionLine: 1, start: 1 }], uid)).toThrow(PrepError);
  });
  it("rejects a missing line", () => {
    expect(() => buildHighlights(SOL, [{ solutionLine: 9 }], uid)).toThrow(/does not exist/);
  });
});

describe("reconstructs", () => {
  it("accepts single-token, symbol and grouped tokens", () => {
    expect(reconstructs("x + 2 = 0", ["x + 2 = 0"])).toBe(true);
    expect(reconstructs("x + 2 = 0", ["x", "+", "2", "=", "0"])).toBe(true);
    expect(reconstructs("\\frac{1}{2} + \\sqrt{9}", ["\\frac{1}{2}", "+ \\sqrt{9}"])).toBe(true);
  });
  it("rejects wrong order or changed content", () => {
    expect(reconstructs("x + 2 = 0", ["2", "+", "x", "=", "0"])).toBe(false);
    expect(reconstructs("x^2 = 4", ["x^3", "=", "4"])).toBe(false);
  });
});

describe("validateQuestion", () => {
  const hs = buildHighlights(SOL, [{ solutionLine: 1 }, { solutionLine: 2 }], uid);
  it("passes when every line reconstructs", () => {
    const r = validateQuestion({ solution: SOL, highlights: hs, floatingLines: hs.map((h) => ({ sourceUid: h.uid, fillers: [h.payload] })) });
    expect(r.issues).toEqual([]);
    expect(r.lines.every((l) => l.reconstructs)).toBe(true);
  });
  it("reports missing lines, mismatches and broken fractions", () => {
    const r = validateQuestion({ solution: SOL, highlights: hs, floatingLines: [{ sourceUid: hs[0]!.uid, fillers: ["\\frac{1", "}"] }] });
    expect(r.lines[0]!.reconstructs).toBe(false);
    expect(r.lines[0]!.issues.join()).toMatch(/unbalanced braces/);
    expect(r.lines[1]!.issues).toContain("no Floating Numbers saved for this line");
  });
  it("reports duplicate highlights", () => {
    const dup = buildHighlights(SOL, [{ solutionLine: 1 }, { solutionLine: 1 }], uid);
    expect(validateQuestion({ solution: SOL, highlights: dup, floatingLines: [] }).issues.join()).toMatch(/duplicated/);
  });
});
