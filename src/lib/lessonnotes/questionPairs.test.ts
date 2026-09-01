import { describe, expect, it } from "vitest";
import { enforceQuestionSolutionPairs, type PairNode } from "./questionPairs";

const h = (level: number, text: string, attrs: Record<string, unknown> = {}): PairNode => ({
  type: "heading",
  attrs: { level, ...attrs },
  content: [{ type: "text", text }],
});
const p = (text = ""): PairNode => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const doc = (content: PairNode[]) => ({ type: "doc", content });

const headings = (out: any) =>
  (out.content as PairNode[])
    .filter((n) => n.type === "heading")
    .map((n) => (n.content ?? []).map((c) => c.text).join(""));

describe("enforceQuestionSolutionPairs", () => {
  it("keeps a correctly paired question and solution untouched", () => {
    const d = doc([
      h(2, "Example 1", { sectionId: "q1" }),
      p("Solve 2x + 5 = 15."),
      h(3, "Solution", { ownerQuestionId: "q1" }),
      p("x = 5"),
    ]);
    const out = enforceQuestionSolutionPairs(d);
    expect(out.changed).toBe(false);
  });

  it("removes a solution whose question was deleted, with its body", () => {
    const d = doc([
      h(2, "Example 1", { sectionId: "q1" }),
      p("Question one."),
      h(3, "Solution", { ownerQuestionId: "q1" }),
      p("x = 5"),
      h(3, "Solution", { ownerQuestionId: "gone" }),
      p("orphan working"),
    ]);
    const out = enforceQuestionSolutionPairs(d);
    expect(out.changed).toBe(true);
    expect(headings(out.doc)).toEqual(["Example 1", "Solution"]);
    const texts = (out.doc.content as PairNode[]).map((n) => (n.content ?? []).map((c) => c.text).join(""));
    expect(texts).not.toContain("orphan working");
  });

  it("moves a drifted solution back into its own question", () => {
    const d = doc([
      h(2, "Example 1", { sectionId: "q1" }),
      p("Question one."),
      h(2, "Example 2", { sectionId: "q2" }),
      p("Question two."),
      h(3, "Solution", { ownerQuestionId: "q1" }),
      p("x = 5"),
    ]);
    const out = enforceQuestionSolutionPairs(d);
    expect(out.changed).toBe(true);
    expect(headings(out.doc)).toEqual(["Example 1", "Solution", "Example 2"]);
  });

  it("adopts a legacy solution that has no owner", () => {
    const d = doc([h(2, "Exercise 1"), p("Question."), h(3, "Solution"), p("working")]);
    const out = enforceQuestionSolutionPairs(d);
    expect(out.changed).toBe(true);
    const top = out.doc.content as PairNode[];
    const q = top[0].attrs as any;
    const s = top[2].attrs as any;
    expect(q.sectionId).toBeTruthy();
    expect(s.ownerQuestionId).toBe(q.sectionId);
  });
});
