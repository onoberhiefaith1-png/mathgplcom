// NOTE-ATTACHMENT CONSISTENCY LAW
// A Lesson Line owns a note if and only if its own highlight authored one
// (via `precedingNotebook`). No equation-match fallback, no prose spill-over
// from parsed solution ASCII, no cross-line inheritance.
import { describe, it, expect } from "vitest";
import type { SectionRow } from "@/hooks/useNotebook";
import { buildReservoirs } from "@/lib/smartboard/presentation";

const makeSection = (
  highlights: { payload: string; precedingNotebook?: string; notebookOnly?: boolean }[],
  solutionAscii: string,
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
      { id: "s", section_id: "sec-1", subsection_id: "sub-1", kind: "solution", content_ascii: solutionAscii, order_index: 1 },
    ],
    floating_highlights: highlights.map((h, i) => ({ groupId: i + 1, ...h })) as any,
    floating_lines: highlights
      .filter((h) => !h.notebookOnly)
      .map((h) => ({ equation: h.payload, fillers: [h.payload], containers: [], arrangement: [0] })) as any,
    floating_bucket: null,
  }],
}] as unknown as SectionRow[];

describe("note-attachment consistency law", () => {
  it("only the highlight that authored a note carries one", () => {
    const [res] = buildReservoirs(makeSection(
      [
        { payload: "a = 5" },
        { payload: "b = 5", precedingNotebook: "Because both roots are equal" },
        { payload: "c = 1" },
      ],
      "a = 5\nb = 5\nc = 1",
    ));
    expect(res.lines[0].notebook).toBeUndefined();
    expect(res.lines[1].notebook).toBe("Because both roots are equal");
    expect(res.lines[2].notebook).toBeUndefined();
  });

  it("duplicate equation payload does not spill a note to a sibling line", () => {
    const [res] = buildReservoirs(makeSection(
      [
        { payload: "x = 1", precedingNotebook: "First root" },
        { payload: "x = 1" }, // same payload, no own note
      ],
      "x = 1\nx = 1",
    ));
    expect(res.lines[0].notebook).toBe("First root");
    expect(res.lines[1].notebook).toBeUndefined();
  });

  it("prose inside solution ASCII never leaks into a line's notebook", () => {
    // No highlights authored — the presence of prose between equations must
    // not create phantom notes on those lines.
    const [res] = buildReservoirs([{
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
          { id: "s", section_id: "sec-1", subsection_id: "sub-1", kind: "solution", content_ascii: "a = 5\nSubstitute into the formula\nb = 5\nc = 1", order_index: 1 },
        ],
        floating_highlights: null,
        floating_lines: null,
        floating_bucket: null,
      }],
    }] as unknown as SectionRow[]);
    for (const line of res.lines) {
      expect(line.notebook).toBeUndefined();
    }
  });
});
