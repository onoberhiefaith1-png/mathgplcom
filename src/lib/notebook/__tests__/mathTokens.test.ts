import { describe, it, expect } from "vitest";
import { tokenizeMath } from "@/lib/notebook/mathTokens";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";
import { gridFromMatrixLatex } from "@/lib/floating/tableGrid";
import { buildTableGroups, lessonSteps, tagForLine, mainTagForStep } from "@/lib/smartboard/tableActivity";

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

describe("floating matrices — matrix stays a grid", () => {
  it("promotes a LaTeX bmatrix to a 2×2 matrix grid", () => {
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

  it("numbers matrix branches with M-tags without consuming L-numbers", () => {
    const matrix = gridFromMatrixLatex("\\begin{bmatrix}a & b \\\\ c & d\\end{bmatrix}");
    expect(matrix).not.toBeNull();
    if (!matrix) return;
    const lines = [
      { equation: "x=1", fillers: [], containers: [], fragmentStart: 0, fragmentEnd: 0 },
      { equation: "a b", fillers: ["a", "b"], containers: [], fragmentStart: 0, fragmentEnd: 0, table: { objId: matrix.objId, orientation: "row" as const, cellKeys: ["0:0", "0:1"], grid: matrix } },
      { equation: "c d", fillers: ["c", "d"], containers: [], fragmentStart: 0, fragmentEnd: 0, table: { objId: matrix.objId, orientation: "row" as const, cellKeys: ["1:0", "1:1"], grid: matrix } },
      { equation: "y=2", fillers: [], containers: [], fragmentStart: 0, fragmentEnd: 0 },
    ];
    const groups = buildTableGroups(lines);
    const steps = lessonSteps(lines.length, groups);
    expect(mainTagForStep(steps, 0)).toBe("L1");
    expect(mainTagForStep(steps, 1)).toBe("M1");
    expect(tagForLine(steps, groups, 1)).toBe("M1.1");
    expect(tagForLine(steps, groups, 2)).toBe("M1.2");
    expect(mainTagForStep(steps, 2)).toBe("L2");
  });
});
