import { describe, expect, it } from "vitest";
import { normalizeInlineMcqDocument } from "../normalizeInlineMcq";
import { compileInlineMcq } from "../../assessments/compileInlineMcq";
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (text: string, level = 3) => ({ ...p(text), type: "heading", attrs: { level } });
const mcq = [p("What is the constant term in 4x + 7?"), p("A. −7"), p("B. 7"), p("C. 4x"), p("D. 4"), p("Correct Answer: B")];
describe("mixed lesson assignment", () => {
  it("keeps worked solutions, removes only an empty MCQ solution, and is idempotent", () => {
    const worked = [h("Example 1"), p("Solve x + 1 = 2"), h("Solution", 4), p("x = 1")];
    const source = { type: "doc", content: [...worked, h("Question 2"), ...mcq, h("Solution", 4), { type: "paragraph" }] };
    const result = normalizeInlineMcqDocument(source);
    expect(result.changed).toBe(true);
    expect(result.doc.content.slice(0, worked.length)).toEqual(worked);
    expect(result.doc.content.at(-1)).toMatchObject({ type: "heading", attrs: { level: 4 }, content: [{ text: "Correct Answer: B" }] });
    expect(normalizeInlineMcqDocument(result.doc).changed).toBe(false);
  });
  it("does not delete existing nonempty working", () => {
    const source = { type: "doc", content: [h("Question 1"), ...mcq, h("Solution", 4), p("Teacher explanation")] };
    expect(normalizeInlineMcqDocument(source).doc.content.at(-1)).toEqual(p("Teacher explanation"));
  });
  it("compiles a declared answer without floating numbers and preserves option order", () => {
    const result = compileInlineMcq(mcq.map(n => n.content[0].text).join("\n"), "q2")!;
    expect(result.total).toBe(1);
    expect(result.question.lines).toHaveLength(1);
    expect(result.question.mcq.options.map(o => o.label)).toEqual(["A", "B", "C", "D"]);
    expect(result.answerKey).toEqual({ questionId: "q2", lineId: "q2-choice", tokens: ["B"], equationAscii: "B" });
    expect(compileInlineMcq("Find x\nSolution\nx=1", "q1")).toBeNull();
  });
  it("accepts lower-case option labels without changing their values", () => {
    expect(compileInlineMcq("Question 1: Find x\na) 1\nb) 2\nCorrect answer is b", "q")?.question.mcq).toEqual({
      text: "Find x", options: [{ label: "A", text: "1" }, { label: "B", text: "2" }], answer: "B",
    });
  });
});
