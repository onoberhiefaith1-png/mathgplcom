import { arrangePreservePaste } from "../../../../../supabase/functions/notebook-ai/preserveContentArrange";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractLessonMcqs } from "../extractLessonMcqs";
import { normalizeInlineMcqDocument } from "@/lib/lessonnotes/normalizeInlineMcq";
import { nodeText } from "@/lib/lessonnotes/lessonOutline";
import { arrangeLessonSessions, parseSessionBlocks } from "@/lib/lessonnotes/sessionArrange";
import { verifySessionStructure } from "../../../../../supabase/functions/notebook-ai/sessionStructureVerifier";
const fixture = readFileSync(new URL("./fixtures/mixed-inequalities.md", import.meta.url), "utf8");
const p = (text: string): { type: string; attrs?: { level: number }; content: { type: string; text: string }[] } => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (text: string, level = 3) => ({ ...p(text), type: "heading", attrs: { level } });
const docOf = (text: string) => ({ type: "doc", content: text.split("\n").map(p) });
const legacy = () => ({ type: "doc", content: parseSessionBlocks(fixture).flatMap(block => {
  if (!block.marker) return block.lines.map(p);
  if (block.marker.kind !== "question" || block.marker.n! > 3) return [h(block.marker.title, block.marker.kind === "solution" ? 4 : 3), ...block.lines.map(p)];
  const answer = block.lines.find(line => /^Correct Answer/.test(line))!;
  return [h(`Example ${block.marker.n}`), ...block.lines.filter(line => line !== answer).map(p), h(`Solution ${block.marker.n}`, 4), p(answer)];
}) });

describe("mixed inequalities lesson supplied by the teacher", () => {
  it("extracts exactly the three supplied MCQs, leaving Questions 4 and 5 untouched", () => {
    const doc = docOf(fixture), before = JSON.stringify(doc);
    const result = extractLessonMcqs(doc);
    expect(result.questions).toHaveLength(3);
    expect(result.questions.map(q => q.answer)).toEqual(["B", "A", "B"]);
    expect(result.skippedWorked).toBe(2);
    expect(result.issues).toEqual([]);
    expect(result.questions[0].text).toBe("Read x < 4 in words.");
    expect(result.questions[1].text).toBe("Does x = 3 satisfy x ≥ 3?");
    expect(result.questions[2].options[1].text).toBe("←────●═══════════════════○────→\n    −2                   3");
    expect(JSON.stringify(doc)).toBe(before);
  });
  it("reads the photographed legacy shape with correct answers below Solution headings", () => {
    const result = extractLessonMcqs(legacy());
    expect(result.questions.map(q => q.answer)).toEqual(["B", "A", "B"]);
    expect(result.issues).toEqual([]);
    expect(result.skippedWorked).toBe(2);
  });
  it("heals answer-only Solution sections and keeps both actual worked solutions verbatim", () => {
    const doc = legacy();
    const workedAt = doc.content.findIndex(n => nodeText(n) === "Question 4");
    const worked = doc.content.slice(workedAt);
    const fixed = normalizeInlineMcqDocument(doc);
    expect(fixed.changed).toBe(true);
    expect(fixed.doc.content.filter(n => /^Solution/.test(nodeText(n))).map(nodeText)).toEqual(["Solution", "Solution"]);
    expect(fixed.doc.content.filter(n => /^Correct Answer/.test(nodeText(n))).every(n => n.type === "heading" && n.attrs?.level === 4)).toBe(true);
    expect(fixed.doc.content.slice(fixed.doc.content.findIndex(n => nodeText(n) === "Question 4"))).toEqual(worked);
    expect(normalizeInlineMcqDocument(fixed.doc).changed).toBe(false);
  });
  it("does not discard a diagram when an answer shares a nonempty Solution", () => {
    const source = { type: "doc", content: [h("Example 1"), p("Choose"), p("A. one"), p("B. two"), h("Solution", 4), p("Correct Answer: A"), { type: "image", attrs: { src: "teacher-diagram" } }] };
    expect(normalizeInlineMcqDocument(source)).toEqual({ doc: source, changed: false });
  });
  it("recognises mixed bare-numbered MCQs and explicitly labelled worked questions during arrangement", () => {
    const arranged = arrangeLessonSessions(fixture);
    expect(parseSessionBlocks(arranged).filter(b => b.marker?.kind === "question").map(b => b.marker!.n)).toEqual([1, 2, 3, 4, 5]);
    expect(parseSessionBlocks(arranged).filter(b => b.marker?.kind === "solution")).toHaveLength(2);
    expect(arrangeLessonSessions(arranged)).toBe(arranged);
  });
  it("preserves an already complete mixed lesson without asking a model for solutions", () => {
    const output = arrangePreservePaste(fixture);
    expect(output).not.toBeNull();
    const parsed = extractLessonMcqs(docOf(output!));
    expect(parsed.questions).toHaveLength(3);
    expect(parsed.skippedWorked).toBe(2);
    expect(parsed.questions[2].options[1].text).toContain("\n    −2                   3");
  });
  it("keeps styled correct-answer rows and Answer: C inside the MCQ, not as Solution markers", () => {
    for (const answer of ["**Correct Answer: B**", "**Correct Answer:** B", "Answer: B"]) {
      const text = "Question 1\nChoose\nA. one\nB. two\n" + answer;
      expect(extractLessonMcqs(docOf(text)).questions[0]?.answer).toBe("B");
      expect(parseSessionBlocks(arrangeLessonSessions(text)).filter(b => b.marker?.kind === "solution")).toEqual([]);
    }
  });
  it("does not demand Solution sessions or misread option equations as working", () => {
    const text = "## Example 1\nSolve x + 1 = 3\nA. x = 1\nB. x = 2\nC. x = 3\nD. x = 4\nCorrect Answer: B\n## Question 2\nSolve x+1=2\n## Solution 2\nx+1=2\nx=1";
    expect(verifySessionStructure(text).defects).toEqual([]);
  });
});

describe("scattered MCQs and invalid supplied answers", () => {
  it("finds a bare-numbered MCQ after worked steps and imports only valid questions", () => {
    const text = "Question 1\nChoose one\nA. one\nB. two\nCorrect Answer: A\nQuestion 2\nSolve x+1=2\nSolution\n1. Subtract 1\nx=1\n6. Choose six\nA. six\nB. seven\nCorrect Answer: A\nQuestion 7\nFind x\nSolution\nx=2";
    const result = extractLessonMcqs(docOf(text));
    expect(result.questions.map(q => q.text)).toEqual(["Choose one", "Choose six"]);
    expect(result.questions.map(q => q.n)).toEqual([1, 2]);
    expect(result.skippedWorked).toBe(2);
    expect(result.issues).toEqual([]);
  });
  it.each(["", "Correct Answer: D", "Correct Answer: A\nCorrect Answer: B"])("flags an invalid MCQ without solving it or treating worked questions as errors", answer => {
    const text = `Question 1\nFind x\nSolution\nx=2\nQuestion 8\nChoose\nA. one\nB. two\n${answer}`;
    const result = extractLessonMcqs(docOf(text));
    expect(result.questions).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].n).toBe(8);
    expect(result.skippedWorked).toBe(1);
  });
});
