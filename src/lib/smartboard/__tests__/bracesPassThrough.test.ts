import { describe, expect, it } from "vitest";
import { mirrorLessonNoteRow } from "@/lib/smartboard/mirrorFromLessonNote";
import { rowToAscii } from "@/lib/smartboard/rowAscii";
import { leaksSyntax } from "@/components/gameslate/ReadableMath";

const shown = (src: string) => rowToAscii(mirrorLessonNoteRow(src).row);

describe("curly brackets are real symbols", () => {
  it("keeps typed set braces", () => {
    expect(shown("A = {1,2,3}")).toContain("{");
    expect(shown("A = {1,2,3}")).toContain("}");
    expect(shown("{}")).toBe("{}");
  });
  it("keeps escaped braces", () => {
    expect(shown("P ∪ Q = \\{a, b\\}")).toMatch(/\{a, ?b\}/);
  });
  it("still treats fraction groups as structure", () => {
    expect(shown("\\frac{1}{2}")).not.toContain("{");
  });
  it("braces are not flagged as leaked code", () => {
    expect(leaksSyntax("A = {1,2,3}")).toBe(false);
  });
});
