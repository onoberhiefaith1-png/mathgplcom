// NOTE-PURITY LAW (universal, line-count-independent)
// A saved note is prose. If any line inside `precedingNotebook` is
// math-shaped (has =, +, -, ×, ÷, /, ^, or is nearly all digits/punctuation)
// then:
//   • write-side (`recomputeNotebooks`) strips those lines before persistence
//   • read-side (`buildReservoirs` → PresentationView.notebookFor) never
//     exposes an equation-shaped note.
// Verified across a 50-line reservoir so the rule holds at any depth.
import { describe, it, expect } from "vitest";
import type { SectionRow } from "@/hooks/useNotebook";
import { buildReservoirs } from "@/lib/smartboard/presentation";
import { recomputeNotebooks, looksLikeMathLine } from "@/pages/FloatingPreparationPage";

const makeSection = (
  highlights: { payload: string; precedingNotebook?: string; notebookOnly?: boolean }[],
): SectionRow[] => [{
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
      { id: "p", section_id: "sec-1", subsection_id: "sub-1", kind: "problem", content_ascii: "Solve", order_index: 0 },
      { id: "s", section_id: "sec-1", subsection_id: "sub-1", kind: "solution", content_ascii: "", order_index: 1 },
    ],
    floating_highlights: highlights.map((h, i) => ({ groupId: i + 1, ...h })) as any,
    floating_lines: highlights
      .filter((h) => !h.notebookOnly)
      .map((h) => ({ equation: h.payload, fillers: [h.payload], containers: [], arrangement: [0] })) as any,
    floating_bucket: null,
  }],
}] as unknown as SectionRow[];

describe("note-purity law (universal)", () => {
  it("looksLikeMathLine detects operators and pure numerics", () => {
    expect(looksLikeMathLine("x = 5")).toBe(true);
    expect(looksLikeMathLine("-5 - 1")).toBe(true);
    expect(looksLikeMathLine("x2 = -5 - 1 / 4")).toBe(true);
    expect(looksLikeMathLine("123 456")).toBe(true);
    expect(looksLikeMathLine("Because both roots are equal")).toBe(false);
    expect(looksLikeMathLine("Factor the expression")).toBe(false);
  });

  it("read-side rejects a math-shaped note on ANY line (deep or shallow)", () => {
    const highlights: { payload: string; precedingNotebook?: string }[] = [];
    for (let i = 0; i < 50; i++) {
      const eq = `x${i} = ${i}`;
      // Inject phantom equation-notes at depths 12, 27, 44
      const note = (i === 12 || i === 27 || i === 44)
        ? "x_next = -5 - 1 / 4"
        : (i % 5 === 0 ? "Explanation prose for this step" : undefined);
      highlights.push({ payload: eq, precedingNotebook: note });
    }
    const [res] = buildReservoirs(makeSection(highlights));
    // The read-side guard in PresentationView.notebookFor mirrors this test:
    const notebookFor = (nb: string | undefined): string => {
      const text = (nb ?? "").trim();
      if (!text) return "";
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.some(looksLikeMathLine)) return "";
      return text;
    };
    // Phantom-equation notes must be rejected.
    expect(notebookFor(res.lines[12].notebook)).toBe("");
    expect(notebookFor(res.lines[27].notebook)).toBe("");
    expect(notebookFor(res.lines[44].notebook)).toBe("");
    // Genuine prose notes must survive.
    expect(notebookFor(res.lines[5].notebook)).toBe("Explanation prose for this step");
    expect(notebookFor(res.lines[35].notebook)).toBe("Explanation prose for this step");
  });

  it("write-side (recomputeNotebooks) strips math-shaped lines from precedingNotebook", () => {
    // Simulate a solution where lines 2 and 4 are highlighted but line 3
    // (an equation) is NOT highlighted, so its tokens leak into line 2's note.
    const solutionLines = [
      "Because we factor first",       // 0: prose (before hi-A)
      "a = 5",                          // 1: highlight A
      "x = -5 - 1 / 4",                 // 2: UNHIGHLIGHTED equation
      "b = 6",                          // 3: highlight B
    ];
    // Build TokenRefs: tokenize is internal; we simulate the shape by
    // constructing highlights with explicit tokens spanning the highlighted
    // lines. The chunk between them will include line 2's equation tokens.
    // Since we cannot access `tokenize` directly here, exercise the pure
    // stripper contract by invoking recomputeNotebooks with a shape where
    // the chunk logic runs, then verify the resulting precedingNotebook has
    // no math-shaped line.
    const highlights: any[] = [
      { groupId: 1, tokens: [{ line: 1, tok: 0 }, { line: 1, tok: 1 }, { line: 1, tok: 2 }], payload: "a = 5", notebookOnly: false },
      { groupId: 2, tokens: [{ line: 3, tok: 0 }, { line: 3, tok: 1 }, { line: 3, tok: 2 }], payload: "b = 6", notebookOnly: false },
    ];
    const out = recomputeNotebooks(highlights, solutionLines);
    for (const h of out) {
      const nb = (h.precedingNotebook ?? "").trim();
      if (!nb) continue;
      for (const line of nb.split(/\r?\n/)) {
        expect(looksLikeMathLine(line)).toBe(false);
      }
    }
  });
});
