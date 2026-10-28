import { describe, expect, it } from "vitest";
import { applyRestructurePlan, validateSessionPairs } from "../sessionPairs";

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (text: string, level = 2, attrs: Record<string, unknown> = {}) => ({
  type: "heading", attrs: { level, ...attrs }, content: [{ type: "text", text }],
});
const texts = (doc: any) => doc.content.map((n: any) => (n.content ?? []).map((c: any) => c.text ?? "").join(""));

describe("validateSessionPairs", () => {
  it("rejects all questions followed by all solutions", () => {
    const doc = { type: "doc", content: [
      h("Classwork 1"), p("Q1"), h("Classwork 2"), p("Q2"),
      h("Solution 1", 3), p("S1"), h("Solution 2", 3), p("S2"),
    ] };
    const r = validateSessionPairs(doc);
    expect(r.ok).toBe(false);
    expect(r.problems.some((x) => x.label === "Classwork 1")).toBe(true);
  });
  it("flags a question with no Solution session", () => {
    const r = validateSessionPairs({ type: "doc", content: [h("Homework 1"), p("Solve 2x = 4")] });
    expect(r.problems[0].code).toBe("missing_solution");
  });
  it("accepts proper pairs and explanation-only content", () => {
    const r = validateSessionPairs({ type: "doc", content: [
      h("Explanation"), p("A frequency table…"),
      h("Classwork 1", 2, { sectionId: "q1" }), p("Q1"), h("Solution 1", 3, { ownerQuestionId: "q1" }), p("S1"),
    ] });
    expect(r.ok).toBe(true);
  });
});

describe("applyRestructurePlan", () => {
  it("rebuilds a heading-less note into question → solution pairs", () => {
    const doc = { type: "doc", content: [
      p("A frequency distribution shows how often values occur."),
      p("Calculate the mean of 5, 8, 10, 12."),
      p("Calculate the range of 3, 9."),
      p("5 + 8 + 10 + 12 = 35, 35 ÷ 4 = 8.75"),
    ] };
    const { doc: out, report } = applyRestructurePlan(doc, { segments: [
      { kind: "explanation", role: "content", blocks: [0] },
      { kind: "classwork", role: "question", blocks: [1] },
      { kind: "classwork", role: "question", blocks: [2] },
      { kind: "classwork", role: "solution", blocks: [3], pairsWith: 1 },
    ] });
    expect(texts(out)).toEqual([
      "Explanation", "A frequency distribution shows how often values occur.",
      "Classwork 1", "Calculate the mean of 5, 8, 10, 12.",
      "Solution 1", "5 + 8 + 10 + 12 = 35, 35 ÷ 4 = 8.75",
      "Classwork 2", "Calculate the range of 3, 9.",
      "Solution 2", "",
    ]);
    expect(report.movedSolutions).toBe(1);
    expect(report.needsSolution.map((n) => n.label)).toEqual(["Classwork 2"]);
    expect(validateSessionPairs(out).ok).toBe(true);
  });
  it("never drops blocks the plan forgot and refuses tidy that changes numbers", () => {
    const doc = { type: "doc", content: [p("Calculate mean these numbers 5 8"), p("stray")] };
    const { doc: out } = applyRestructurePlan(doc, { segments: [
      { kind: "classwork", role: "question", blocks: [0], tidied: { "0": "Calculate the mean of 5 and 9." } },
    ] });
    const t = texts(out);
    expect(t).toContain("Calculate mean these numbers 5 8");
    expect(t).toContain("stray");
  });
});
