import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUESTIONS_PER_SEGMENT,
  findQuestionStarts,
  segmentInstruction,
  splitIntoQuestionUnits,
  splitTestSegments,
  stripEchoedSource,
} from "../splitTestSegments";

const numbered = (n: number) =>
  Array.from(
    { length: n },
    (_, i) =>
      `${i + 1}. Solve ${i + 1}x + 3 = ${i + 10}\n(a) show working\nx = ${i}`,
  ).join("\n\n");

describe("splitTestSegments", () => {
  it("defaults to 10 questions per segment", () => {
    expect(DEFAULT_QUESTIONS_PER_SEGMENT).toBe(10);
  });

  it("ends segment 1 at question 10 and starts segment 2 at question 11", () => {
    const segs = splitTestSegments(numbered(25));
    expect(segs.map((s) => s.questionCount)).toEqual([10, 10, 5]);
    expect(segs[0].text.trim().endsWith("x = 9")).toBe(true);
    expect(segs[1].text.startsWith("11. Solve")).toBe(true);
    expect(segs[1]).toMatchObject({ firstQuestion: 11, lastQuestion: 20 });
    expect(segs[2]).toMatchObject({ firstQuestion: 21, lastQuestion: 25 });
  });

  it("never cuts a question: sub-parts and solutions stay with their question", () => {
    const text = [
      "Question 1",
      "Solve x + 1 = 3",
      "Solution",
      "1. x = 3 - 1",
      "2. x = 2",
      "",
      "Question 2",
      "Solve 2x = 8",
      "Solution: x = 4",
      "",
      "Question 3",
      "Factorise x^2 - 1",
    ].join("\n");
    const segs = splitTestSegments(text, { questionsPerSegment: 2 });
    expect(segs).toHaveLength(2);
    expect(segs[0].text).toContain("2. x = 2");
    expect(segs[0].text).toContain("Solution: x = 4");
    expect(segs[1].text.startsWith("Question 3")).toBe(true);
  });

  it("ignores out-of-sequence numbered lines inside a question", () => {
    const lines = [
      "1. Expand (x+1)(x+2)",
      "3. note inside working",
      "2. Simplify 4/8",
    ];
    expect(findQuestionStarts(lines)).toEqual([0, 2]);
  });

  it("keeps the preamble with segment 1 and moves group headings to their questions", () => {
    const text = [
      "Algebra Test — answer all questions",
      "",
      "Section A",
      "1. a",
      "2. b",
      "",
      "Section B",
      "1. c",
      "2. d",
    ].join("\n");
    const units = splitIntoQuestionUnits(text);
    expect(units).toHaveLength(4);
    expect(units[0].startsWith("Algebra Test")).toBe(true);
    expect(units[2].startsWith("Section B")).toBe(true);
    const segs = splitTestSegments(text, { questionsPerSegment: 2 });
    expect(segs[1].text.startsWith("Section B\n1. c")).toBe(true);
    expect(segs[0].text).not.toContain("Section B");
  });

  it("falls back to paragraphs when no question markers exist", () => {
    const text = "Para one line.\nmore.\n\nPara two.\n\nPara three.";
    const segs = splitTestSegments(text, { questionsPerSegment: 2 });
    expect(segs.map((s) => s.questionCount)).toEqual([2, 1]);
    expect(segs[1].text).toBe("Para three.");
  });

  it("respects the character ceiling but keeps an oversized question whole", () => {
    const big = `1. ${"x".repeat(500)}\n\n2. short\n\n3. short`;
    const segs = splitTestSegments(big, {
      questionsPerSegment: 10,
      maxChars: 300,
    });
    expect(segs[0].questionCount).toBe(1);
    expect(segs[0].text.length).toBeGreaterThan(300);
    expect(segs[1].questionCount).toBe(2);
  });

  it("handles labelled and markdown-wrapped markers", () => {
    const text = "**Q1.** one\n**Q2.** two\n### Question 3\nthree";
    expect(splitIntoQuestionUnits(text)).toHaveLength(3);
  });

  it("keeps numbered solution steps inside an unlabelled numbered question", () => {
    const text = [
      "1. Solve 2x = 4",
      "Solution",
      "1. x = 4/2",
      "2. x = 2",
      "",
      "2. Solve 3x = 9",
      "Answer: x = 3",
    ].join("\n");
    expect(splitIntoQuestionUnits(text)).toHaveLength(2);
  });

  it("returns nothing for an empty paste", () => {
    expect(splitTestSegments("   \n ")).toEqual([]);
  });
});

describe("segmentInstruction", () => {
  it("is short and only names the current segment", () => {
    const [seg] = splitTestSegments(numbered(3));
    const pos = { ...seg, total: 4 };
    const out = segmentInstruction("", pos);
    expect(out).toContain("Segment 1 of 4");
    expect(out).toContain("questions 1–3");
    expect(out.length).toBeLessThan(200);
    expect(
      segmentInstruction("Make it tidy", pos).startsWith("Make it tidy\n"),
    ).toBe(true);
  });
});

describe("stripEchoedSource", () => {
  const src = "1. Solve 2x + 3 = 7\n2. Solve x - 4 = 1";
  it("drops a proposal that is only the script echoed back", () => {
    expect(stripEchoedSource(src, ` ${src}\n`)).toBe("");
  });
  it("removes a leading verbatim echo and keeps the new output", () => {
    expect(stripEchoedSource(src, `${src}\n\n## Exercise\nQuestion 1`)).toBe(
      "## Exercise\nQuestion 1",
    );
  });
  it("leaves a genuine rewrite alone", () => {
    const out = "## Exercise\n2x + 3 = 7\nx = 2";
    expect(stripEchoedSource(src, out)).toBe(out);
  });
});
