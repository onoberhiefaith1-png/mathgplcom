import { describe, expect, it } from "vitest";
import { breakRowSeparators } from "@/lib/lessonnotes/rowSeparators";
import { aiTextToNodes } from "@/lib/lessonnotes/aiToNodes";
import { analyzeProblem } from "@/lib/lessonnotes/problemDetect";

const textOf = (nodes: any[]): string =>
  JSON.stringify(nodes)
    .match(/"text":"(.*?)"/g)
    ?.join(" ") ?? "";

describe("row separators outside matrices", () => {
  it("turns \\\\ into real lines", () => {
    const out = breakRowSeparators(
      "Given sets A and B, shade: \\\\ a) A' \\\\ b) (A ∪ B)' \\\\ c) A ∩ B'",
    );
    expect(out.split("\n").map((l) => l.trim()).filter(Boolean)).toEqual([
      "Given sets A and B, shade:",
      "a) A'",
      "b) (A ∪ B)'",
      "c) A ∩ B'",
    ]);
  });

  it("leaves matrix row separators untouched", () => {
    const src = "A = \\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}";
    expect(breakRowSeparators(src)).toBe(src);
  });

  it("never leaves \\\\ visible in converted nodes", () => {
    const nodes = aiTextToNodes("Shade the region: \\\\ a) A' \\\\ b) (A ∪ B)'");
    expect(textOf(nodes)).not.toContain("\\\\");
  });

  it("detects the parts of a multi-part question", () => {
    const report = analyzeProblem(
      "Given two sets A and B within a universal set U, shade the region representing: \\\\ a) A' \\\\ b) (A ∪ B)' \\\\ c) A ∩ B'",
    );
    expect(report.status).not.toBe("incomplete");
    expect(report.problem).toContain("\n");
  });
});
