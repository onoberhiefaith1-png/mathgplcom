import { describe, expect, it } from "vitest";
import {
  reconcileSolutionOwnership,
  solutionSectionEnd,
  type DocNode,
} from "../solutionPairing";

const q = (id: string, text: string): DocNode => ({
  type: "heading",
  attrs: { level: 2, sectionId: id, ownerQuestionId: null },
  content: [{ type: "text", text }],
});
const p = (text: string): DocNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const solutionFrame = (owner: string, spacerId: string | null = null): DocNode => ({
  type: "canvasFrame",
  attrs: { objectKind: "solution", ownerQuestionId: owner, spacerId, x: 0, y: 300, w: 592 },
  content: [p("solution body")],
});

describe("Example ↔ Solution partnership", () => {
  it("moves a drifted solution back into its own question", () => {
    const doc = {
      type: "doc",
      content: [
        q("q1", "Example 1"),
        p("3+3+8"),
        { type: "sessionSpacer", attrs: { h: 116, spacerId: "sp1" } },
        q("q2", "Example 2"),
        p("2+4+7"),
        q("q3", "Example 3"),
        p("4+8+9"),
        solutionFrame("q1", "sp1"),
      ],
    };
    const { doc: out, changed } = reconcileSolutionOwnership(doc);
    expect(changed).toBe(true);
    const types = out.content.map((n: DocNode) => n.type);
    const frameIdx = types.indexOf("canvasFrame");
    const q2Idx = out.content.findIndex((n: DocNode) => n.attrs?.sectionId === "q2");
    expect(frameIdx).toBeGreaterThan(0);
    expect(frameIdx).toBeLessThan(q2Idx);
    // the stale flow spacer is gone
    expect(types).not.toContain("sessionSpacer");
  });

  it("leaves a correctly placed solution untouched", () => {
    const doc = {
      type: "doc",
      content: [q("q1", "Example 1"), p("3+3+8"), solutionFrame("q1"), q("q2", "Example 2")],
    };
    expect(reconcileSolutionOwnership(doc).changed).toBe(false);
  });

  it("computes a question's section end", () => {
    const top = [q("q1", "Example 1"), p("a"), q("q2", "Example 2"), p("b")];
    expect(solutionSectionEnd(top, "q1")).toBe(2);
    expect(solutionSectionEnd(top, "q2")).toBe(4);
    expect(solutionSectionEnd(top, "nope")).toBe(-1);
  });
});
