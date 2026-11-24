import { describe, expect, it } from "vitest";
import {
  forcedAssignFrame,
  forcedAssignPhase,
  forcedMcqHeadingLabel,
  forcedMcqToQuestion,
  formatForcedMcqText,
  hasConfirmedAnswer,
  highlightedLines,
  normalAssignCoversRange,
  parseForcedMcq,
} from "../forcedAssign";
import type { AssignmentEndpoint } from "../assignmentEndpoints";

const ep = (over: Partial<AssignmentEndpoint>): AssignmentEndpoint => ({
  kind: "mcq", heading: 0, at: 40, questionHeading: 0, questionText: "", from: 0, ...over,
});

describe("forced Assign from a highlight", () => {
  it("uses only the highlighted lines and starts at a bare number like 10", () => {
    const mcq = parseForcedMcq("10\nWhich number is even?\nA. 1\nB. 2\nC. 3");
    expect(mcq.number).toBe(10);
    expect(mcq.stem).toBe("Which number is even?");
    expect(mcq.options.map((o) => o.label)).toEqual(["A", "B", "C"]);
    expect(mcq.answer).toBeNull();
    expect(formatForcedMcqText(mcq)).toBe("Question 10\nWhich number is even?");
    expect(forcedMcqHeadingLabel(mcq)).toBe("Question 10");
  });

  it("starts straight from the question when no number was highlighted", () => {
    const mcq = parseForcedMcq("Which number is even?\nA. 1\nB. 2");
    expect(mcq.number).toBeNull();
    expect(formatForcedMcqText(mcq)).toBe("Which number is even?");
    expect(forcedMcqHeadingLabel(mcq)).toBe("Question");
    expect(hasConfirmedAnswer(mcq)).toBe(false);
  });

  it("keeps a question-only highlight as a question-only item", () => {
    const mcq = parseForcedMcq("10.\nSolve 2x + 1 = 5.");
    expect(mcq).toEqual({ number: 10, stem: "Solve 2x + 1 = 5.", options: [], answer: null });
    expect(forcedMcqToQuestion(mcq).options).toEqual([]);
    expect(forcedMcqToQuestion(mcq).answer).toBeNull();
  });

  it("keeps exactly the highlighted options, even when some letters are missing", () => {
    const mcq = parseForcedMcq("Question 3\nPick one.\nA. red\nB. blue\nC. green");
    expect(mcq.number).toBe(3);
    expect(mcq.options).toEqual([
      { label: "A", text: "red" },
      { label: "B", text: "blue" },
      { label: "C", text: "green" },
    ]);
    expect(mcq.answer).toBeNull();
  });

  it("records a declared answer when the highlight includes one, and not otherwise", () => {
    const withAnswer = parseForcedMcq("What is 2 + 2?\nA. 3\nB. 4\nCorrect answer is B");
    expect(withAnswer.answer).toBe("B");
    expect(hasConfirmedAnswer(withAnswer)).toBe(true);
    const without = parseForcedMcq("What is 2 + 2?\nA. 3\nB. 4\nC. 5");
    expect(without.answer).toBeNull();
  });

  it("does not pull later un-highlighted lines, including a later answer", () => {
    const highlighted = highlightedLines("1. What is 12 × 8?\nA. 86\nB. 96").join("\n");
    const mcq = parseForcedMcq(highlighted);
    expect(mcq.stem).toBe("What is 12 × 8?");
    expect(mcq.options.map((o) => o.text)).toEqual(["86", "96"]);
    expect(mcq.answer).toBeNull();
  });

  it("reads inline options and spoken correct-answer forms", () => {
    const mcq = parseForcedMcq("Which is prime?\nA. 9   B. 15   C. 17   D. 21\nCorrect option is C");
    expect(mcq.options.map((o) => o.label)).toEqual(["A", "B", "C", "D"]);
    expect(mcq.answer).toBe("C");
  });
});

describe("forced Assign visibility", () => {
  it("follows the highlight, stays while text is highlighted, and hides only for AI Edit or no highlight", () => {
    expect(forcedAssignPhase({ highlighting: true, hasHighlight: true, normalAssignHere: false, aiEditOpen: false })).toBe("following");
    // A question that already has its own Assign must not make the marker vanish on release.
    expect(forcedAssignPhase({ highlighting: false, hasHighlight: true, normalAssignHere: true, aiEditOpen: false })).toBe("settled");
    expect(forcedAssignPhase({ highlighting: true, hasHighlight: false, normalAssignHere: false, aiEditOpen: false })).toBe("hidden");
    expect(forcedAssignPhase({ highlighting: false, hasHighlight: true, normalAssignHere: false, aiEditOpen: false })).toBe("settled");
    expect(forcedAssignPhase({ highlighting: false, hasHighlight: true, normalAssignHere: false, aiEditOpen: true })).toBe("hidden");
    expect(forcedAssignPhase({ highlighting: false, hasHighlight: false, normalAssignHere: false, aiEditOpen: false })).toBe("hidden");
    expect(forcedAssignPhase({ highlighting: false, hasHighlight: true, normalAssignHere: false, aiEditOpen: false, loading: true })).toBe("loading");
  });

  it("detects when a normal Assign already covers the highlighted range", () => {
    const endpoints = [ep({ kind: "mcq", from: 10, at: 40 })];
    expect(normalAssignCoversRange(endpoints, 12, 30)).toBe(true);
    expect(normalAssignCoversRange(endpoints, 40, 60)).toBe(false);
    expect(normalAssignCoversRange([ep({ kind: "incomplete-mcq", from: 10, at: 40 })], 12, 30)).toBe(false);
  });
});

describe("forced Assign stays inside the notes card", () => {
  it("insets the cluster from both edges, including a 390px phone card", () => {
    const frame = forcedAssignFrame({ left: 16, right: 374 });
    expect(frame.left).toBe(26);
    expect(frame.maxWidth).toBe(338);
    expect(frame.left + frame.maxWidth).toBe(364);
    expect(frame.left + frame.maxWidth).toBeLessThan(374);
  });

  it("never reports a width that would spill past the card", () => {
    const narrow = forcedAssignFrame({ left: 8, right: 200 }, 10);
    expect(narrow.left).toBe(18);
    expect(narrow.left + narrow.maxWidth).toBe(190);
    expect(forcedAssignFrame({ left: 0, right: 8 }, 10).maxWidth).toBe(0);
  });
});
