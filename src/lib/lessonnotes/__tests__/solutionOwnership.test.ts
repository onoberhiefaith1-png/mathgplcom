// The Question → Solution pipeline: a Solution belongs to the question that
// OWNS it, even when the teacher drags it out of the flow into a floating
// frame at the very end of the document (the real bug that made Example 5's
// Floating page show Example 2's / Example 4's working).

import { describe, expect, it } from "vitest";
import {
  buildLessonOutline,
  ownerQuestionSegment,
  questionKeyForSectionId,
  segmentKey,
} from "@/lib/lessonnotes/lessonOutline";
import { parseDocumentToSections } from "@/lib/lessonnotes/syncDocumentToNotebook";

const heading = (text: string, level: number, attrs: Record<string, unknown> = {}) => ({
  type: "heading",
  attrs: { level, sectionId: null, ownerQuestionId: null, ...attrs },
  content: [{ type: "text", text }],
});
const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const frame = (owner: string, nodes: any[]) => ({
  type: "canvasFrame",
  attrs: { objectKind: "solution", ownerQuestionId: owner },
  content: nodes,
});

/** The teacher's note: five examples, two solutions dragged into frames. */
const doc = () => ({
  type: "doc",
  content: [
    heading("Example 1", 2, { sectionId: "q1" }),
    para("QUESTION 1 — ALGEBRA"),
    heading("Solution 1", 3, { ownerQuestionId: "q1" }),
    para("x^2-5x+6=(x-2)(x-3)"),

    heading("Example 2", 2, { sectionId: "q2" }),
    para("QUESTION 2 — MATRIX"),

    heading("Example 3", 2, { sectionId: "q3" }),
    para("QUESTION 3 — STATISTICS"),
    heading("Solution 3", 3, { ownerQuestionId: "q3" }),
    para("Mean = 12"),

    heading("Example 4", 2, { sectionId: "q4" }),
    para("QUESTION 4 — STATISTICAL TABLE"),

    heading("Example 5", 2, { sectionId: "q5" }),
    para("QUESTION 5 — SOHCAHTOA"),
    heading("Solution 5", 3, { ownerQuestionId: "q5" }),
    para("sin 30 = x/10"),

    // Detached, out of flow, physically AFTER Example 5.
    frame("q4", [heading("Solution 5", 3, { ownerQuestionId: "q4" }), para("The completed table")]),
    frame("q2", [heading("Solution 5", 3, { ownerQuestionId: "q2" }), para("Topic: Matrix Operations")]),
  ],
});

const subsectionFor = (question: string) => {
  const parsed = parseDocumentToSections(doc());
  const section = parsed.find((s) => s.subsections[0]?.problem.includes(question));
  return section?.subsections[0] ?? null;
};

describe("solution ownership", () => {
  it("routes a detached solution to its own question, not the last one in the flow", () => {
    expect(subsectionFor("QUESTION 2")?.solution).toContain("Matrix Operations");
    expect(subsectionFor("QUESTION 4")?.solution).toContain("completed table");
    expect(subsectionFor("QUESTION 5")?.solution).toContain("sin 30");
  });

  it("never leaks another question's working into a question", () => {
    expect(subsectionFor("QUESTION 5")?.solution).not.toContain("Matrix");
    expect(subsectionFor("QUESTION 5")?.solution).not.toContain("completed table");
    expect(subsectionFor("QUESTION 2")?.solution).not.toContain("sin 30");
  });

  it("gives every question exactly one subsection and no orphan sections", () => {
    const parsed = parseDocumentToSections(doc());
    const questions = parsed.filter((s) => s.subsections.length > 0);
    expect(questions).toHaveLength(5);
    expect(parsed.filter((s) => s.kind === "explanation" && s.loose.length > 0)).toHaveLength(0);
  });

  it("numbers a solution from its owner, wherever it sits", () => {
    const segments = buildLessonOutline(doc());
    const solutions = segments.filter((s) => s.isSolution);
    const labels = solutions.map((s) => {
      const owner = ownerQuestionSegment(segments, s);
      return `${s.label}/${owner?.ordinal}`;
    });
    expect(labels.sort()).toEqual(
      ["Solution 1/1", "Solution 2/2", "Solution 3/3", "Solution 4/4", "Solution 5/5"].sort(),
    );
  });

  it("resolves the Floating target key from the owner question id", () => {
    const d = doc();
    const segments = buildLessonOutline(d);
    for (const q of ["q1", "q2", "q3", "q4", "q5"]) {
      const seg = segments.find((s) => s.sectionId === q)!;
      expect(questionKeyForSectionId(d, q)).toBe(segmentKey(seg));
    }
  });

  it("falls back to the question above for legacy owner-less solutions", () => {
    const legacy = {
      type: "doc",
      content: [
        heading("Example 1", 2),
        para("Q1"),
        heading("Solution 1", 3),
        para("working one"),
        heading("Example 2", 2),
        para("Q2"),
        heading("Solution 2", 3),
        para("working two"),
      ],
    };
    const parsed = parseDocumentToSections(legacy);
    expect(parsed[0].subsections[0].solution).toBe("working one");
    expect(parsed[1].subsections[0].solution).toBe("working two");
  });
});
