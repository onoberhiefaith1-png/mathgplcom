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
describe("AI matrices stay on the same line and stay editable", () => {
  const matrixOf = (node: any) =>
    (node?.content ?? []).find((c: any) => c.type === "mathStructure");

  it("keeps `A =` and the matrix in ONE paragraph", () => {
    const nodes = aiTextToNodes("A = \\begin{bmatrix}3 & 2 \\\\ 5 & 4\\end{bmatrix}");
    expect(nodes.length).toBe(1);
    expect(nodes[0].type).toBe("paragraph");
    expect(nodes.some((n: any) => n.type === "mathBlock")).toBe(false);
    const matrix = matrixOf(nodes[0]);
    expect(matrix.attrs).toEqual({ kind: "matrix", attrs: { rows: 2, cols: 2, br: "[" } });
    expect(matrix.content.length).toBe(4);
    // Something (the `A =` run) precedes the matrix in the same paragraph.
    expect(nodes[0].content.indexOf(matrix)).toBeGreaterThan(0);
  });

  it("keeps trailing prose in the same paragraph as the matrix", () => {
    const nodes = aiTextToNodes("B = \\begin{bmatrix}1 & 5 \\\\ 2 & 3\\end{bmatrix} is singular");
    expect(nodes.length).toBe(1);
    const para = nodes[0];
    const idx = para.content.findIndex((c: any) => c.type === "mathStructure");
    expect(idx).toBeGreaterThan(0);
    expect(para.content.length).toBeGreaterThan(idx + 1);
  });

  it("preserves dimensions and row-major values for 2x3, 3x2 and 3x3", () => {
    const cases: Array<[string, number, number, string[]]> = [
      ["\\begin{pmatrix}1 & 2 & 3 \\\\ 4 & 5 & 6\\end{pmatrix}", 2, 3, ["1", "2", "3", "4", "5", "6"]],
      ["\\begin{bmatrix}1 & 2 \\\\ 3 & 4 \\\\ 5 & 6\\end{bmatrix}", 3, 2, ["1", "2", "3", "4", "5", "6"]],
      ["\\begin{bmatrix}1 & 2 & 3 \\\\ 4 & 5 & 6 \\\\ 7 & 8 & 9\\end{bmatrix}", 3, 3,
        ["1", "2", "3", "4", "5", "6", "7", "8", "9"]],
    ];
    for (const [src, rows, cols, cells] of cases) {
      const matrix = matrixOf(aiTextToNodes(`M = ${src}`)[0]);
      expect(matrix.attrs.attrs.rows).toBe(rows);
      expect(matrix.attrs.attrs.cols).toBe(cols);
      expect(matrix.content.map((s: any) => s.content?.[0]?.text)).toEqual(cells);
    }
  });

  it("gives each matrix line its own self-contained paragraph", () => {
    const nodes = aiTextToNodes(
      "A = \\begin{bmatrix}3 & 2 \\\\ 5 & 4\\end{bmatrix}\nB = \\begin{bmatrix}1 & 5 \\\\ 2 & 3\\end{bmatrix}",
    );
    expect(nodes.length).toBe(2);
    for (const n of nodes) {
      expect(n.type).toBe("paragraph");
      expect(matrixOf(n)).toBeTruthy();
    }
  });

  it("survives a matrix written across several source lines", () => {
    const nodes = aiTextToNodes("A =\n\\begin{bmatrix}\n3 & 2 \\\\\n5 & 4\n\\end{bmatrix}");
    const matrices = nodes.map(matrixOf).filter(Boolean);
    expect(matrices.length).toBe(1);
    expect(matrices[0].attrs.attrs).toEqual({ rows: 2, cols: 2, br: "[" });
  });

  it("leaves ordinary determinant arithmetic as editable math", () => {
    const nodes = aiTextToNodes("det(A) = (3)(4) - (2)(5)");
    expect(nodes.length).toBe(1);
    expect(nodes.some((n: any) => n.type === "mathStructure")).toBe(false);
  });
});
