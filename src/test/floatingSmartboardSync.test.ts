import { describe, it, expect } from "vitest";
import type { SectionRow } from "@/hooks/useNotebook";
import { buildReservoirs, findVerifiedFloatingLine } from "@/lib/smartboard/presentation";
import { exitCompletedScriptCursor, insertChar, mkChar, type Node, type Row } from "@/lib/smartboard/mathTree";
import { recomputeNotebooks, restorePersistedHighlights } from "@/pages/FloatingPreparationPage";

describe("Floating Prep → Smartboard middleman", () => {
  it("keeps notebook-only highlights when restoring saved preparation state", () => {
    const restored = restorePersistedHighlights([
      { groupId: -1, tokens: [], payload: "", precedingNotebook: "Lead note", notebookOnly: true },
      { groupId: 2, tokens: [{ line: 1, tok: 0 }], payload: "x²" },
    ] as any);

    expect(restored.highlights).toHaveLength(2);
    expect(restored.highlights[0]).toMatchObject({ notebookOnly: true, precedingNotebook: "Lead note" });
    expect(restored.highlights[1]).toMatchObject({ groupId: 1, payload: "x²" });
    expect(restored.nextId).toBe(2);
  });

  it("pairs unhighlighted text between two highlights with the highlight above it", () => {
    const out = recomputeNotebooks([
      { groupId: 1, tokens: [{ line: 0, tok: 0 }], payload: "x²" },
      { groupId: 2, tokens: [{ line: 2, tok: 0 }], payload: "+12x" },
    ] as any, ["x²", "Substitute into the formula", "+12x"]);

    expect(out[0].payload).toBe("x²");
    expect(out[0].precedingNotebook).toBe("Substitute into the formula");
    expect(out[1].payload).toBe("+12x");
    expect(out[1].precedingNotebook).toBe("");
  });

  it("does not match floating lines by stale array index when the payload is different", () => {
    const matched = findVerifiedFloatingLine("x²", [
      { equation: "wrong equation", fillers: ["WRONG"] },
      { equation: "+12x", fillers: ["+12x"] },
    ]);

    expect(matched).toBeUndefined();
  });

  it("rebuilds a mismatched reservoir line from the saved highlight payload", () => {
    const sections: SectionRow[] = [{
      id: "sec-1",
      notebook_id: "nb-1",
      kind: "example",
      title: null,
      order_index: 0,
      loose: [],
      subsections: [{
        id: "sub-1",
        section_id: "sec-1",
        order_index: 0,
        blocks: [
          { id: "p", section_id: "sec-1", subsection_id: "sub-1", kind: "problem", content_ascii: "Solve x² + 12x + 36 = 0", order_index: 0 },
          { id: "s", section_id: "sec-1", subsection_id: "sub-1", kind: "solution", content_ascii: "x²\nSubstitute into the formula\n+12x", order_index: 1 },
        ],
        floating_highlights: [
          { groupId: 1, payload: "x²", precedingNotebook: "Substitute into the formula" },
          { groupId: 2, payload: "+12x", precedingNotebook: "" },
        ],
        floating_lines: [
          { equation: "wrong equation", fillers: ["WRONG"], containers: [], arrangement: [0] },
          { equation: "+12x", fillers: ["+12x"], containers: [], arrangement: [0] },
        ],
        floating_bucket: null,
      }],
    }];

    const [reservoir] = buildReservoirs(sections);

    expect(reservoir.lines[0]).toMatchObject({ equation: "x²", fillers: ["x²"], notebook: "Substitute into the formula" });
    expect(reservoir.lines[0].fillers).not.toContain("WRONG");
    expect(reservoir.lines[1]).toMatchObject({ equation: "+12x", fillers: ["+12x"] });
  });
});

describe("Smartboard cursor after superscript", () => {
  it("normal typing after a filled exponent exits the exponent and lands after x²", () => {
    const sup: Node = { kind: "sup", rows: [[mkChar("2")]] };
    const row: Row = [mkChar("x"), sup];
    const cursorInsideExponent = { path: [1, 0], index: 1 };

    const safeCursor = exitCompletedScriptCursor(row, cursorInsideExponent);
    const out = insertChar(row, safeCursor, "+");

    expect(safeCursor).toEqual({ path: [], index: 2 });
    expect(out.root).toEqual([mkChar("x"), sup, mkChar("+")]);
  });
});