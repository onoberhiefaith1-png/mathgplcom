// Powers and empty exponent placeholders must survive the trip from a Lesson
// Note onto the Smartboard. Regression cover for the "properties of powers"
// note, where `a^{m}` (structural) and `aⁿ` (look-alike glyph) appear on the
// SAME line and used to render at different heights, and where `a^□` lost its
// placeholder entirely.

import { describe, expect, it } from "vitest";
import { mirrorLessonNoteRow, liftUnicodeScripts } from "@/lib/smartboard/mirrorFromLessonNote";
import { rowToAscii } from "@/lib/smartboard/rowAscii";
import type { Node, Row } from "@/lib/smartboard/mathTree";

const ascii = (src: string) => rowToAscii(mirrorLessonNoteRow(src).row);
const kinds = (src: string) => mirrorLessonNoteRow(src).row.map((n) => n.kind);

describe("unicode script re-lift", () => {
  it("turns look-alike glyphs into real script syntax", () => {
    expect(liftUnicodeScripts("aⁿ")).toBe("a^{n}");
    expect(liftUnicodeScripts("x⁵⁺³")).toBe("x^{5+3}");
    expect(liftUnicodeScripts("x⁻²")).toBe("x^{-2}");
    expect(liftUnicodeScripts("H₂O")).toBe("H_{2}O");
  });

  it("leaves a leading superscript run for the radical parser", () => {
    expect(liftUnicodeScripts("⁵√(32)")).toBe("⁵√(32)");
  });
});

describe("mirrorLessonNoteRow — powers", () => {
  it("gives structural and look-alike powers the same shape", () => {
    expect(kinds("a^{m}")).toEqual(["subsup"]);
    expect(kinds("aⁿ")).toEqual(["subsup"]);
    expect(ascii("aⁿ")).toBe(ascii("a^{m}").replace("m", "n"));
  });

  it("mirrors the note's Recall line as three powers", () => {
    const row = mirrorLessonNoteRow("a^{m} × aⁿ = a^{m+n}").row;
    expect(row.filter((n) => n.kind === "subsup")).toHaveLength(3);
  });

  it("keeps powers inside fractions and brackets", () => {
    expect(kinds("\\frac{a^{m}}{aⁿ}")).toEqual(["frac"]);
    expect(ascii("\\frac{x⁵}{x²}")).toBe("((x)^(5))/((x)^(2))");
  });

  it("keeps a subscript a subscript", () => {
    expect(ascii("H₂O")).toBe("(H)_(2)O");
  });

  it("does not let a radical swallow a preceding square", () => {
    expect(kinds("x²√(9)")).toEqual(["subsup", "sqrt"]);
    expect(ascii("⁵√(32)")).toBe("root(5,32)");
  });
});

const supRowOf = (row: Row): Row => {
  const node = row.find((n) => n.kind === "subsup") as Extract<Node, { kind: "subsup" }>;
  return node.rows[2];
};

describe("mirrorLessonNoteRow — empty exponent placeholder", () => {
  it("keeps the writable box in an empty exponent", () => {
    const sup = supRowOf(mirrorLessonNoteRow("a^{□}").row);
    expect(sup).toHaveLength(1);
    expect(sup[0].kind).toBe("box");
  });

  it("keeps the placeholder inside a fraction too", () => {
    const row = mirrorLessonNoteRow("\\frac{a^{□}}{b}").row;
    const frac = row[0] as Extract<Node, { kind: "frac" }>;
    expect(supRowOf(frac.rows[0])[0].kind).toBe("box");
  });
});
