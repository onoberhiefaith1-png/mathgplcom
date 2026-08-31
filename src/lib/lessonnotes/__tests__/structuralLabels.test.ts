import { describe, expect, it } from "vitest";
import { aiTextToNodes, aiTextToSolutionRows, structuralLabelLine } from "@/lib/lessonnotes/aiToNodes";

const textOf = (n: any): string =>
  (n?.content ?? []).map((c: any) => (c.type === "text" ? c.text : textOf(c))).join("");

describe("structural label lines", () => {
  it("recognises numbered and bare labels", () => {
    expect(structuralLabelLine("Solution")).toBe("Solution");
    expect(structuralLabelLine("Solution 2")).toBe("Solution 2");
    expect(structuralLabelLine("  example 3: ")).toBe("Example 3");
    expect(structuralLabelLine("Classwork 1)")).toBe("Classwork 1");
  });

  it("leaves ordinary content alone", () => {
    expect(structuralLabelLine("Solution: x = 4")).toBeNull();
    expect(structuralLabelLine("Test the value of x")).toBeNull();
    expect(structuralLabelLine("x = 2")).toBeNull();
  });

  it("emits an intact heading, never a split math run", () => {
    const nodes = aiTextToNodes("Solution 2\nx = 4");
    const heading = nodes.find((n: any) => n.type === "heading");
    expect(heading).toBeTruthy();
    expect(textOf(heading)).toBe("Solution 2");
  });

  it("keeps the label out of the solution-row explanation column", () => {
    const rows = aiTextToSolutionRows("Solution 2\nx = 4");
    const packed = JSON.stringify(rows);
    expect(packed).not.toContain("Solution 2");
  });
});
