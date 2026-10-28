import { describe, it, expect } from "vitest";
import { enforceQuestionSolutionPairs } from "@/lib/lessonnotes/questionPairs";
import { detectSectionKind } from "@/lib/lessonnotes/sectionKinds";

const h = (text: string, level: number, attrs: Record<string, unknown> = {}) => ({
  type: "heading", attrs: { level, ...attrs }, content: [{ type: "text", text }],
});
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

describe("Solutions never disappear", () => {
  it("keeps a Solution whose owner id is stale and re-attaches it", () => {
    const doc = { type: "doc", content: [
      h("Example 1", 2, { sectionId: "q_new" }), p("Solve x+1=2"),
      h("Solution 1", 3, { ownerQuestionId: "q_old" }), p("x = 1"),
    ] };
    const out = enforceQuestionSolutionPairs(doc).doc;
    const texts = JSON.stringify(out);
    expect(texts).toContain("x = 1");
    expect((out.content[2] as any).attrs.ownerQuestionId).toBe("q_new");
  });

  it("AI Edit same-level Solution is demoted under its question", () => {
    const doc = { type: "doc", content: [
      h("Example 1", 2), p("Q"), h("Solution 1", 2), p("A"),
    ] };
    const out = enforceQuestionSolutionPairs(doc).doc as any;
    expect(out.content[2].attrs.level).toBe(3);
    expect(out.content[2].attrs.ownerQuestionId).toBe(out.content[0].attrs.sectionId);
    expect(JSON.stringify(out)).toContain('"A"');
  });

  it("a question below level 2 still owns its Solution", () => {
    const doc = { type: "doc", content: [
      h("Classwork 1", 3, { sectionId: "q1" }), p("Q"),
      h("Solution 1", 4, { ownerQuestionId: "q1" }), p("A"),
    ] };
    const out = enforceQuestionSolutionPairs(doc).doc;
    expect(JSON.stringify(out)).toContain('"A"');
  });

  it("'Solution to Example 1' is a Solution, not an Example", () => {
    expect(detectSectionKind("Solution to Example 1")).toBe("solution");
    expect(detectSectionKind("Example 1")).toBe("example");
  });
});
