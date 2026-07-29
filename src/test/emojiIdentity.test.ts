import { describe, it, expect } from "vitest";
import { graphemes, isEmoji, stripBrokenGlyphs } from "@/lib/text/graphemes";
import { latexToTree } from "@/lib/smartboard/mathTreeLatex";

describe("emoji identity", () => {
  it("keeps a surrogate-pair emoji whole", () => {
    expect(graphemes("2🐿️+3")).toEqual(["2", "🐿️", "+", "3"]);
  });

  it("keeps ZWJ family sequences whole", () => {
    expect(graphemes("👩‍🏫").length).toBe(1);
  });

  it("detects emoji and not maths characters", () => {
    expect(isEmoji("🐿️")).toBe(true);
    expect(isEmoji("x")).toBe(false);
    expect(isEmoji("√")).toBe(false);
  });

  it("removes broken glyphs", () => {
    expect(stripBrokenGlyphs("a\uFFFDb")).toBe("ab");
    expect(stripBrokenGlyphs("a\uD83D")).toBe("a");
  });

  it("parses an emoji into exactly one char node", () => {
    const row = latexToTree("2🐿️");
    expect(row.length).toBe(2);
    expect(row[1]).toMatchObject({ kind: "char", ch: "🐿️" });
  });
});
