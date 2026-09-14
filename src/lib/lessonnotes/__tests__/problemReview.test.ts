import { describe, it, expect } from "vitest";
import {
  hasProblemContent, detectRequestedMethod, decisionDirective,
  type ProblemContext, type ReviewIssue,
} from "@/lib/lessonnotes/ai/problemReview";

const ctx = (p: Partial<ProblemContext> = {}): ProblemContext => ({
  heading: "", questionText: "", instruction: "", tables: "", diagramSummary: "",
  graphs: "", floatingLines: "", existingSolution: "", referenced: "",
  requestedMethod: "", sessionContext: "", ...p,
});

describe("problem referee context", () => {
  it("treats plain question text as content", () => {
    expect(hasProblemContent(ctx({ questionText: "Solve x + 3 = 7" }))).toBe(true);
  });

  it("treats table-only data as content", () => {
    expect(hasProblemContent(ctx({ tables: "x | f\n0 | 2" }))).toBe(true);
  });

  it("treats diagram-only data as content", () => {
    expect(hasProblemContent(ctx({ diagramSummary: "triangle ABC" }))).toBe(true);
  });

  it("treats graph-only data as content", () => {
    expect(hasProblemContent(ctx({ graphs: "functions: y = 2x" }))).toBe(true);
  });

  it("has nothing to review when the block is empty", () => {
    expect(hasProblemContent(ctx())).toBe(false);
  });
});

describe("requested method detection", () => {
  it("finds a named method", () => {
    expect(detectRequestedMethod("Solve by factorisation")).toMatch(/factoris/i);
  });
  it("returns nothing when no method is named", () => {
    expect(detectRequestedMethod("Solve x + 3 = 7")).toBe("");
  });
});

describe("teacher decision directives", () => {
  const issue: ReviewIssue = {
    type: "unsuitable_method",
    title: "This question cannot be solved by the named method",
    detail: "x² + x + 1 does not factorise over the integers.",
    affected: "Example 3",
    recommendation: "Use the quadratic formula.",
    actions: [
      { id: "use_correct_method", label: "Use the correct method" },
      { id: "cancel", label: "Cancel" },
    ],
  };

  it("produces a directive for a chosen action", () => {
    expect(decisionDirective(issue, "use_correct_method")).not.toBe("");
  });

  it("produces nothing for an unknown action", () => {
    expect(decisionDirective(issue, "not_an_action")).toBe("");
  });
});
