import { describe, it, expect } from "vitest";
import { enforceQuestionSolutionPairs, stripChipWords } from "../questionPairs";
import { structuralHeadingKind } from "../sectionKinds";

const h = (level: number, text: string, attrs: Record<string, unknown> = {}) =>
  ({ type: "heading", attrs: { level, ...attrs }, content: [{ type: "text", text }] });

describe("deep Solutions", () => {
  it("strips leaked button words", () => {
    expect(stripChipWords("Solution 1 ai assign floating")).toBe("Solution 1");
    expect(stripChipWords("Solution 2")).toBe("Solution 2");
  });
  it("recognises level-4 Solutions only", () => {
    expect(structuralHeadingKind("Solution 1", 4)?.kind).toBe("solution");
    expect(structuralHeadingKind("Example 1", 4)).toBeNull();
  });
  it("cleans and caps Solution headings on open", () => {
    const doc = { type: "doc", content: [
      h(3, "Example 1", { sectionId: "q1" }),
      h(4, "Solution 1 ai assign floating", { ownerQuestionId: "q1" }),
      h(3, "Example 2", { sectionId: "q2" }),
      h(6, "Solution 2", { ownerQuestionId: "q2" }),
    ] };
    const out = enforceQuestionSolutionPairs(doc as any).doc as any;
    expect(out.content[1].content[0].text).toBe("Solution 1");
    expect(out.content[3].attrs.level).toBe(4);
    expect(out.content[3].attrs.ownerQuestionId).toBe("q2");
  });
});
