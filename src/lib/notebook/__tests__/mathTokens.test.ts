import { describe, it, expect } from "vitest";
import { tokenizeMath } from "@/lib/notebook/mathTokens";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";
import { gridFromMatrixLatex } from "@/lib/floating/tableGrid";
import { latexToTree } from "@/lib/smartboard/mathTreeLatex";

describe("tokenizeMath — structures are atomic", () => {
  it("keeps a bmatrix as one token", () => {
    const src = "A = \\begin{bmatrix}2 & 1 \\\\ 3 & 4\\end{bmatrix}";
    const t = tokenizeMath(src);
    expect(t).toEqual(["A", "=", "\\begin{bmatrix}2 & 1 \\\\ 3 & 4\\end{bmatrix}"]);
  });

  it("keeps a summation with bounds as one token", () => {
    const t = tokenizeMath("S = \\sum_{i = 1}^{n} i^{2}");
    expect(t[2]).toBe("\\sum_{i = 1}^{n}");
    expect(t.length).toBe(4);
  });

  it("keeps an integral with limits as one token", () => {
    const t = tokenizeMath("\\int_{0}^{1} x dx");
    expect(t[0]).toBe("\\int_{0}^{1}");
  });

  it("keeps a fraction nested inside a matrix cell", () => {
    const src = "\\begin{pmatrix}\\frac{1}{2} & 0\\end{pmatrix}";
    expect(tokenizeMath(src)).toEqual([src]);
  });

  it("keeps a \\left…\\right group together", () => {
    const t = tokenizeMath("\\left( a + b \\right) = c");
    expect(t[0]).toBe("\\left( a + b \\right)");
  });
});

describe("unicodeMath — structures survive normalisation", () => {
  it("does not strip the braces of a matrix environment", () => {
    const out = toUnicodeMath("\\begin{bmatrix}2 & 1 \\\\ 3 & 4\\end{bmatrix}");
    expect(out).toContain("\\begin{bmatrix}");
    expect(out).toContain("\\end{bmatrix}");
    expect(out).not.toContain("\\beginbmatrix");
  });

  it("treats a complete matrix / summation as clean classroom math", () => {
    expect(isStillDirty(toUnicodeMath("\\begin{bmatrix}1 & 2\\end{bmatrix}"))).toBe(false);
    expect(isStillDirty(toUnicodeMath("\\sum_{i=1}^{n}"))).toBe(false);
  });
});

describe("floating matrices — matrix stays atomic", () => {
  it("can read a LaTeX bmatrix as a 2×2 matrix payload", () => {
    const grid = gridFromMatrixLatex("\\begin{bmatrix}2 + 1 & 1 + 2 \\\\ 3 + 5 & 4 + 3\\end{bmatrix}");
    expect(grid).toMatchObject({
      isMatrix: true,
      rows: 2,
      cols: 2,
      matrixEnv: "bmatrix",
      matrixBrackets: { left: "[", right: "]" },
    });
    expect(grid?.cells).toEqual([["2 + 1", "1 + 2"], ["3 + 5", "4 + 3"]]);
  });

  it("expands one matrix chip into one pre-filled editable matrix node", () => {
    const row = latexToTree("\\begin{bmatrix}2 + 1 & 1 + 2 \\\\ 3 + 5 & 4 + 3\\end{bmatrix}");
    expect(row).toHaveLength(1);
    const matrix = row[0];
    expect(matrix.kind).toBe("matrix");
    if (matrix.kind !== "matrix") return;
    expect(matrix.nRows).toBe(2);
    expect(matrix.nCols).toBe(2);
    expect(matrix.left).toBe("[");
    expect(matrix.right).toBe("]");
    expect(matrix.rows).toHaveLength(4);
  });
});
