import { describe, expect, it } from "vitest";
import { validateStructuredLesson, notationFault } from "../guide/lessonValidator";
import { GUIDE_VERSION, OPERATING_GUIDE, lessonStandardsText } from "../guide/operatingGuide";
import { lessonNoteTrainingBlocks } from "@/lib/agent/lessonKnowledge";
import saveTool from "../tools/save-structured-lesson";

const q = "Rationalise \\frac{1}{3 + √2}";
const good = [
  q,
  "Multiply top and bottom by the conjugate 3 − √2",
  "Denominator becomes 9 − 2",
  "Denominator simplifies to 7",
  "Answer: \\frac{3 − √2}{7}",
];

describe("structured lesson validation", () => {
  it("accepts a compliant lesson", () => {
    expect(
      validateStructuredLesson([
        { kind: "introduction", lines: ["A conjugate changes the sign between two terms."] },
        { kind: "example", questions: [{ question: q, solution: good }] },
      ]),
    ).toEqual([]);
  });
  it("rejects a solution whose first line does not restate the question", () => {
    const p = validateStructuredLesson([{ kind: "example", questions: [{ question: q, solution: good.slice(1) }] }]);
    expect(p[0].issue).toMatch(/restate the question/);
  });
  it("rejects two equations merged on one line", () => {
    const p = validateStructuredLesson([
      { kind: "classwork", questions: [{ question: "Solve 2x = 6", solution: ["Solve 2x = 6", "x = 6/2 = 3"] }] },
    ]);
    expect(p.some((x) => /more than one equation/.test(x.issue))).toBe(true);
  });
  it("rejects an equation split across lines", () => {
    const p = validateStructuredLesson([
      { kind: "homework", questions: [{ question: "Solve 2x = 6", solution: ["Solve 2x = 6", "x =", "3"] }] },
    ]);
    expect(p.some((x) => /cut off/.test(x.issue))).toBe(true);
  });
  it("rejects a question with no solution", () => {
    const p = validateStructuredLesson([{ kind: "exercise", questions: [{ question: q, solution: [] }] }]);
    expect(p[0].issue).toMatch(/own worked solution/);
  });
  it("rejects calculator syntax", () => {
    expect(notationFault("x**2")).not.toBeNull();
    expect(notationFault("2 * 3")).not.toBeNull();
    expect(notationFault("sqrt(2)")).not.toBeNull();
    expect(notationFault("2 × 3 = 6")).toBeNull();
  });
});

describe("operating guide", () => {
  it("includes the existing Co-Pilot standards without rewriting them", () => {
    for (const block of lessonNoteTrainingBlocks()) expect(lessonStandardsText()).toContain(block);
    expect(OPERATING_GUIDE).toContain(GUIDE_VERSION);
  });
  it("refuses a stale guide version before touching anything", async () => {
    const handler = (saveTool as unknown as { handler: (i: unknown, c: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }> }).handler;
    const r = await handler(
      { guideVersion: "old", subject: "Mathematics", subtopic: "", sections: [{ kind: "summary", lines: ["x"] }] },
      { isAuthenticated: () => { throw new Error("must not reach auth"); } },
    );
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/out of date/);
  });
  it("saves nothing when validation fails", async () => {
    const handler = (saveTool as unknown as { handler: (i: unknown, c: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }> }).handler;
    const r = await handler(
      { guideVersion: GUIDE_VERSION, title: "T", subject: "Mathematics", subtopic: "", sections: [{ kind: "example", questions: [{ question: q, solution: ["x =", "3"] }] }] },
      { isAuthenticated: () => { throw new Error("must not reach auth"); } },
    );
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/Nothing was saved/);
  });
});
