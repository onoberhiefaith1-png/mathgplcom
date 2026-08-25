import { describe, expect, it } from "vitest";
import { aiTextToNodes, hasStructuredAiContent } from "@/lib/lessonnotes/aiToNodes";

describe("structure-aware AI Edit materialization", () => {
  it("turns a raw 2x2 bmatrix into an editable matrix node", () => {
    const nodes = aiTextToNodes("AB =\n\\begin{bmatrix}7 & 7 \\\\ 23 & 18\\end{bmatrix}");
    const matrix = nodes.flatMap((node) => node.content ?? []).find((node) => node.type === "mathStructure");
    expect(matrix?.attrs).toEqual({ kind: "matrix", attrs: { rows: 2, cols: 2, br: "[" } });
    expect(matrix?.content.map((slot: any) => slot.content?.[0]?.text)).toEqual(["7", "7", "23", "18"]);
  });

  it("materializes a rectangular matrix directive with row-major cells", () => {
    const text = '[[tool:structure kind="matrix" rows="2" cols="3" bracket="round" slots="a | b | c | d | e | f"]]';
    const matrix = aiTextToNodes(text)[0].content[0];
    expect(matrix.attrs.attrs).toEqual({ rows: 2, cols: 3, br: "(" });
    expect(matrix.content.map((slot: any) => slot.content?.[0]?.text)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("preserves a statistical table as one Smart Table with coordinates", () => {
    const text = '[[tool:smartTable headers="Score | Frequency" rows="1 | 3 ; 2 | 5"]]';
    const table = aiTextToNodes(text)[0].content[0];
    expect(table.attrs.family).toBe("smarttable");
    expect(table.attrs.attrs.headers).toEqual(["Score", "Frequency"]);
    expect(table.attrs.attrs.cells).toEqual([["1", "3"], ["2", "5"]]);
  });

  it("keeps prose around structured objects", () => {
    const text = 'Use the data below.\n[[tool:smartTable headers="x | f" rows="1 | 2"]]\nFind the mean.';
    const nodes = aiTextToNodes(text);
    expect(nodes.some((node) => node.content?.[0]?.attrs?.family === "smarttable")).toBe(true);
    expect(nodes.length).toBe(3);
    expect(hasStructuredAiContent(text)).toBe(true);
  });

  it("leaves ordinary inline edits unstructured", () => {
    expect(hasStructuredAiContent("Simplify x + x = 2x")).toBe(false);
  });
});