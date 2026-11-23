import { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { assignmentEndpoints } from "../assignmentEndpoints";
import { normalizeInlineMcqDocument } from "../normalizeInlineMcq";

const schema = new Schema({ nodes: {
  doc: { content: "block+" },
  text: { group: "inline" },
  paragraph: { group: "block", content: "inline*" },
  heading: { group: "block", content: "inline*", attrs: {
    level: { default: 2 }, sectionId: { default: null }, ownerQuestionId: { default: null },
  } },
  hardBreak: { group: "inline", inline: true },
  canvasFrame: { group: "block", content: "block+", attrs: { ownerQuestionId: { default: null } } },
} });
const heading = (text: string, level = 2, extra: object = {}) => ({
  type: "heading", attrs: { level, ...extra }, content: [{ type: "text", text }],
});
const p = (...rows: string[]) => ({ type: "paragraph", content: rows.flatMap((text, i) =>
  [...(i ? [{ type: "hardBreak" }] : []), { type: "text", text }]) });
const question = p("Which number is even?", "A. 1", "B. 2", "C. 3", "Correct answer: B");
const worked = [heading("Exercise 2", 2, { sectionId: "q2" }), p("Solve x + 1 = 5"),
  heading("Solution", 4, { ownerQuestionId: "q2" }), p("Subtract 1"), p("x = 4")];

describe("lesson Assign placement", () => {
  it("finds every complete MCQ and worked solution in a mixed generated document", () => {
    const document = schema.nodeFromJSON({ type: "doc", content: [
      heading("Question 1"), question, ...worked, heading("Question 3"), question,
    ] });
    const targets = assignmentEndpoints(document);
    expect(targets.map(({ kind }) => kind)).toEqual(["mcq", "mcq", "worked"]);
    const workedTarget = targets.find(({ kind }) => kind === "worked")!;
    expect(document.resolve(workedTarget.at).nodeBefore?.textContent).toBe("x = 4");
    expect(document.resolve(workedTarget.at).nodeAfter?.textContent).toBe("Question 3");
    expect(targets.filter(({ kind }) => kind === "mcq").every(({ questionText }) => questionText.includes("Correct answer: B"))).toBe(true);
  });

  it("does not add a second Assign to an MCQ that also has working", () => {
    const document = schema.nodeFromJSON({ type: "doc", content: [
      heading("Example 1"), question, heading("Solution", 4), p("This is the explanation."),
    ] });
    expect(assignmentEndpoints(document).map(({ kind }) => kind)).toEqual(["mcq"]);
  });

  it("adds a loose question heading without changing existing options or its declared answer", () => {
    const original = { type: "doc", content: [question] };
    const normalized = normalizeInlineMcqDocument(original);
    expect(normalized.changed).toBe(true);
    expect(normalized.doc.content[1]).toEqual(question);
    expect(assignmentEndpoints(schema.nodeFromJSON(normalized.doc))).toHaveLength(1);
    expect(normalizeInlineMcqDocument(normalized.doc).changed).toBe(false);
  });

  it("recognises AI working written under a plain label and preserves the working rows", () => {
    const working = [p("Working:"), p("3 + 2 = 5"), p("The answer is 5")];
    const normalized = normalizeInlineMcqDocument({ type: "doc", content: [
      heading("Example 1"), p("Find 3 + 2"), ...working,
    ] });
    expect(normalized.doc.content.slice(-3)).toEqual(working);
    expect(assignmentEndpoints(schema.nodeFromJSON(normalized.doc)).map(({ kind }) => kind)).toEqual(["worked"]);
  });

  it("keeps a detached worked solution linked to its authored question", () => {
    const document = schema.nodeFromJSON({ type: "doc", content: [
      ...worked.slice(0, 2), heading("Question 3"), question,
      { type: "canvasFrame", attrs: { ownerQuestionId: "q2" }, content: worked.slice(2) },
    ] });
    const endpoint = assignmentEndpoints(document).find(({ kind }) => kind === "worked")!;
    expect(endpoint.questionHeading).toBe(0);
    expect(endpoint.questionText).toBe("Solve x + 1 = 5");
  });
});

describe("pasted assignment recovery", () => {
  it("recognises consecutive numbered MCQs beneath a Practice heading", () => {
    const first = p("1\\. What is 12 × 8?", "A. 86", "B. 96", "C. 108", "Correct Option: B");
    const second = p("2. Simplify 3x + 5x.", "A. 15x", "B. 2x", "C. 8x", "Correct Option: C");
    const original = [heading("Practice"), first, second];
    const normalized = normalizeInlineMcqDocument({ type: "doc", content: original });
    expect(normalized.doc.content.filter((node) => node.type === "paragraph")).toEqual([first, second]);
    expect(assignmentEndpoints(schema.nodeFromJSON(normalized.doc)).map((target) => target.kind)).toEqual(["mcq", "mcq"]);
    expect(normalizeInlineMcqDocument(normalized.doc).changed).toBe(false);
  });

  it("clears an incomplete MCQ warning after the declared answer is repaired", () => {
    const before = schema.nodeFromJSON({ type: "doc", content: [
      heading("Question 1"), p("Which is even?", "A. 1", "B. 2", "Correct Option: D"),
    ] });
    expect(assignmentEndpoints(before).map((target) => target.kind)).toEqual(["incomplete-mcq"]);
    const repaired = schema.nodeFromJSON({ type: "doc", content: [heading("Question 1"), question] });
    expect(assignmentEndpoints(repaired).map((target) => target.kind)).toEqual(["mcq"]);
  });
});

it("restores Assign for the reported standalone title between worked and choice questions", () => {
  const title = p("Question 10");
  const choice = [p("For A = {x :"), p("x is an integer between 2 and 6}. Assess whether 3 ∈ A and 8 ∈ A."),
    p("A. 2 ∈ A is false and 7 ∈ A is false."), p("B. 2 ∈ A is true and 7 ∈ A is true."),
    p("C. 2 ∈ A is true and 7 ∈ A is false."), p("D. 2 ∈ A is false and 7 ∈ A is true."),
    p("Correct Answer: C")];
  const content = [...worked, title, ...choice, heading("Question 11"), question];
  const original = { type: "doc", content };
  const before = assignmentEndpoints(schema.nodeFromJSON(original));
  expect(before.filter((endpoint) => endpoint.kind === "mcq")).toHaveLength(1);
  const normalized = normalizeInlineMcqDocument(original);
  const normalizedDoc = schema.nodeFromJSON(normalized.doc);
  const after = assignmentEndpoints(normalizedDoc);
  const repaired = after.filter((endpoint) => endpoint.kind === "mcq").find((endpoint) => endpoint.questionText.includes("integer"));
  expect(repaired?.questionText).toContain("Correct Answer: C");
  expect(repaired && normalizedDoc.nodeAt(repaired.heading)?.textContent).toBe("Question 10");
  expect(normalized.doc.content.slice(worked.length + 1, worked.length + 7)).toEqual(choice.slice(0, 6));
  expect(normalizeInlineMcqDocument(normalized.doc).changed).toBe(false);
});

it("recognises a compact heading even when the stem ends in a set name", () => {
  const doc = schema.nodeFromJSON({ type: "doc", content: [
    heading("Question10", 3), p("Compare the two members of set A."),
    p("A. First choice"), p("B. Second choice"), p("C. Third choice"), p("Correct Answer: B"),
  ] });
  expect(assignmentEndpoints(doc).map(({ kind }) => kind)).toEqual(["mcq"]);
});
