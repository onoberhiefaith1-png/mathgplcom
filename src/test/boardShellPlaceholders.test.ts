// A floating chip carrying a structure shell (`x=\frac{□}{□}`) used to land on
// the board as frac[ box(empty) ][ box(empty) ] — the slot's own placeholder
// PLUS a literal box, i.e. four visible squares instead of two.
import { describe, it, expect } from "vitest";
import { mirrorLessonNoteRow } from "@/lib/smartboard/mirrorFromLessonNote";
import type { Node, Row } from "@/lib/smartboard/mathTree";

const countBoxes = (row: Row): number =>
  row.reduce((n, node) => {
    if (node.kind === "char") return n;
    const subs = (node as Extract<Node, { rows: Row[] }>).rows ?? [];
    return n + (node.kind === "box" ? 1 : 0) + subs.reduce((m, r) => m + countBoxes(r), 0);
  }, 0);

describe("structure shell chips on the board", () => {
  it("x=\\frac{□}{□} becomes one fraction with two empty slots", () => {
    const { row } = mirrorLessonNoteRow("x=\\frac{□}{□}");
    const frac = row.find((n) => n.kind === "frac") as Extract<Node, { rows: Row[] }>;
    expect(frac).toBeTruthy();
    expect(frac.rows.map((r) => r.length)).toEqual([0, 0]);
    expect(countBoxes(row)).toBe(0);
  });

  it("±\\sqrt{□} keeps a single empty radicand", () => {
    const { row } = mirrorLessonNoteRow("±\\sqrt{□}");
    expect(countBoxes(row)).toBe(0);
  });
});
