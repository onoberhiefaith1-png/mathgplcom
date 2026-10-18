import { describe, expect, it } from "vitest";
import { docToLines, parseMcq, markPaper } from "../core";

const p = (...content: any[]) => ({ type: "paragraph", content });
const t = (text: string) => ({ type: "text", text });
const br = { type: "hardBreak" };
const ol = (start: number, text: string) => ({ type: "orderedList", attrs: { start }, content: [{ type: "listItem", content: [p(t(text))] }] });

const doc = {
  type: "doc",
  content: [
    p(t("GENERAL MATHEMATICS — MULTIPLE-CHOICE EXAMINATION")),
    ol(1, "What is the value of x in the equation 3x + 7 = 22?"),
    p(t("A. 3"), br, t("B. 4"), br, t("C. 5"), br, t("D. 6")),
    p(t("Correct Answer: C")),
    ol(2, "Simplify the expression 4(a + 3b)."),
    p(t("A. 4a + 3b"), br, t("B. 4a + 12b"), br, t("C. 7ab"), br, t("D. 12ab")),
    p(t("Correct Answer: B")),
    ol(3, "Evaluate"), 
    p({ type: "mathInline", attrs: { value: "3/4 + 2/3" } }),
    p(t("A. 5/7"), br, t("B. 13/12"), br, t("C. 17/12"), br, t("D. 7/12")),
    p(t("Answer: C")),
  ],
};

describe("scanner on the real note shape", () => {
  const { questions, issues } = parseMcq(docToLines(doc));
  it("finds every question with options and answers", () => {
    expect(questions).toHaveLength(3);
    expect(issues).toEqual([]);
    expect(questions[0]).toMatchObject({ n: 1, text: "What is the value of x in the equation 3x + 7 = 22?", answer: "C" });
    expect(questions[0].options.map((o) => o.label)).toEqual(["A", "B", "C", "D"]);
    expect(questions[1].answer).toBe("B");
  });
  it("keeps inline maths in the question text", () => {
    expect(questions[2].text).toContain("3/4 + 2/3");
  });
  it("marks an attempt", () => {
    const r = markPaper(questions, { 1: "C", 2: "A" });
    expect(r).toMatchObject({ correct: 1, incorrect: 1, unanswered: 1, total: 3 });
  });
});
