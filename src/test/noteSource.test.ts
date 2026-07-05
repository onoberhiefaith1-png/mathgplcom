// NOTE SOURCE regression tests — the single law for teaching notes.
//
// Bug history: a line whose highlight saved NO note used to show a
// phantom notebook icon on the Floating Number panel, because the icon
// fell back to the line's `explanation` (parsed solution prose — often
// the ENTIRE solution tail). Clicking it wrote every remaining solution
// line onto the board and dropped the sensor a huge gap below.
//
// The law now: no saved note ⇒ empty string ⇒ no icon, nothing to
// write. Ever. And notes are prose only (purity check).

import { describe, expect, it } from "vitest";
import { noteForLine } from "@/lib/smartboard/boardWriter/noteSource";
import { buildReservoirs } from "@/lib/smartboard/presentation";

describe("noteForLine — single note source", () => {
  it("returns the line's own saved note verbatim", () => {
    expect(noteForLine({ notebook: "Identify a, b, and c from the equation:" }))
      .toBe("Identify a, b, and c from the equation:");
  });

  it("returns empty for a line with no saved note — never a fallback", () => {
    expect(noteForLine({ notebook: "" })).toBe("");
    expect(noteForLine({ notebook: "   " })).toBe("");
    expect(noteForLine({})).toBe("");
    expect(noteForLine(undefined)).toBe("");
    expect(noteForLine(null)).toBe("");
  });

  it("rejects math-shaped notes entirely (purity law)", () => {
    // A whole-solution tail must never render as a note.
    const tail = "b = 5\nc = -3\nx = (-b ± √(b² - 4ac)) / 2a";
    expect(noteForLine({ notebook: tail })).toBe("");
    expect(noteForLine({ notebook: "42" })).toBe("");
    expect(noteForLine({ notebook: "3.14, (2)" })).toBe("");
  });

  it("rejects a mixed note when ANY row is math-shaped", () => {
    expect(noteForLine({ notebook: "Now substitute:\nb = 5" })).toBe("");
  });
});

describe("buildReservoirs — no positional explanation leakage", () => {
  const mkSections = (highlights: any[], solution: string) =>
    [
      {
        id: "sec1",
        kind: "example",
        order_index: 0,
        subsections: [
          {
            id: "sub1",
            order_index: 0,
            floating_highlights: highlights,
            floating_lines: null,
            floating_bucket: null,
            blocks: [
              { kind: "problem", order_index: 0, content_ascii: "Solve x² + 5x - 3 = 0" },
              { kind: "solution", order_index: 1, content_ascii: solution },
            ],
          },
        ],
      },
    ] as any;

  it("a highlight with an empty note yields a line with NO note", () => {
    const solution = [
      "a = 1",
      "Substitute the values into the formula.",
      "b = 5",
      "c = -3",
      "x = 1",
    ].join("\n");
    const highlights = [
      { payload: "a = 1", precedingNotebook: "Identify a first:" },
      { payload: "b = 5", precedingNotebook: "" }, // ← line 4-style: no note
      { payload: "c = -3", precedingNotebook: "" },
    ];
    const [res] = buildReservoirs(mkSections(highlights, solution));
    expect(res.lines).toHaveLength(3);
    expect(noteForLine(res.lines[0])).toBe("Identify a first:");
    // The no-note lines must read as empty through the single source —
    // no explanation text, no solution tail, nothing.
    expect(noteForLine(res.lines[1])).toBe("");
    expect(noteForLine(res.lines[2])).toBe("");
  });

  it("explanation only attaches by exact equation match — never by position", () => {
    const solution = [
      "a = 1",
      "This prose belongs to a = 1 only.",
      "b = 5",
    ].join("\n");
    const highlights = [
      { payload: "z = 9", precedingNotebook: "" }, // no exact match in solution
      { payload: "b = 5", precedingNotebook: "" },
    ];
    const [res] = buildReservoirs(mkSections(highlights, solution));
    // z = 9 has no matching solution equation → it must NOT inherit the
    // prose parked at its position index.
    expect(res.lines[0].explanation ?? "").toBe("");
  });
});
