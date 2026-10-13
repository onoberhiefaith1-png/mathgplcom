import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { legacyNotebookDocument } from "../legacyDocument";
import { parseDocumentToSections } from "../syncDocumentToNotebook";
import { buildLessonOutline, nodeText } from "../lessonOutline";

const question = "Rationalise \\frac{1}{3 + \\sqrt{2}}";
const solution = [question, "\\frac{3 − \\sqrt{2}}{9 − 2}", "\\frac{3 − \\sqrt{2}}{7}"];
const sub = (id: string) => ({ id, blocks: [
  { kind: "problem", content_ascii: question },
  ...solution.map(content_ascii => ({ kind: "solution", content_ascii })),
  { kind: "reasoning", content_ascii: "" },
] });

describe("legacy lesson import retains activity sources", () => {
  it("round-trips a question and all separately stored steps into the correct fields", () => {
    const doc = legacyNotebookDocument([{ id: "section-a", kind: "example", loose: [], subsections: [sub("question-a")] }]);
    const outline = buildLessonOutline(doc);
    expect(outline.map(s => s.kind)).toEqual(["example", "solution"]);
    expect(outline[1].ownerQuestionId).toBe("question-a");
    expect(doc.content.map(nodeText).some(t => /^(Problem|Solution):/.test(t))).toBe(false);
    const parsed = parseDocumentToSections(doc);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].subsections[0]).toMatchObject({ problem: question, solution: solution.join("\n") });
  });
  it("keeps multiple questions separate and pairs their solutions even after reordering", () => {
    const doc = legacyNotebookDocument([{ id: "section-a", kind: "classwork", loose: [], subsections: [sub("question-a"), sub("question-b")] }]);
    const headings = doc.content.filter(n => n.type === "heading");
    expect(headings.map(nodeText)).toEqual(["Classwork 1", "Solution 1", "Classwork 2", "Solution 2"]);
    const segments = buildLessonOutline(doc);
    const moved = { type: "doc", content: [
      headings[0], ...segments[0].nodes, headings[2], ...segments[2].nodes,
      headings[1], ...segments[1].nodes, headings[3], ...segments[3].nodes,
    ] };
    const parsed = parseDocumentToSections(moved);
    expect(parsed).toHaveLength(2);
    expect(parsed.every(s => s.subsections[0].solution === solution.join("\n"))).toBe(true);
  });
  it("preserves descriptive titles as structural sessions and imports empty notes", () => {
    const doc = legacyNotebookDocument([{ id: "explain-a", kind: "explanation", title: "Conjugate pairs", loose: [{ kind: "text", content_ascii: "Change the connecting sign." }], subsections: [] }]);
    expect(buildLessonOutline(doc)[0]).toMatchObject({ kind: "explanation", sectionId: "explain-a" });
    expect(legacyNotebookDocument([])).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
});
