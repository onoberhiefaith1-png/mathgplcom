import { describe, expect, it } from "vitest";
import {
  emptyMatrixLatex,
  isEmptyMatrixLatex,
  matrixShellFromLatex,
  splitMatrixChip,
} from "@/lib/floating/matrixChips";

describe("matrix chips = structure + cells", () => {
  it("builds an EMPTY structure for every supported dimension", () => {
    for (const [r, c] of [[2, 2], [2, 3], [3, 2], [3, 3], [4, 4], [1, 5]] as const) {
      const latex = emptyMatrixLatex(r, c);
      const shell = matrixShellFromLatex(latex);
      expect(shell?.rows).toBe(r);
      expect(shell?.cols).toBe(c);
      expect(isEmptyMatrixLatex(latex)).toBe(true);
      // Never hard-codes any value.
      expect(/[0-9]/.test(latex)).toBe(false);
    }
  });

  it("splits a highlighted 2x2 matrix into an empty shell plus row-major values", () => {
    const split = splitMatrixChip("\\begin{bmatrix}2 & 1\\\\3 & 4\\end{bmatrix}");
    expect(split).not.toBeNull();
    expect(split!.values).toEqual(["2", "1", "3", "4"]);
    expect(isEmptyMatrixLatex(split!.shell)).toBe(true);
    expect(split!.shell).not.toMatch(/[0-9]/);
  });

  it("keeps the source bracket style on the shell", () => {
    const p = matrixShellFromLatex("\\begin{pmatrix}1 & 2\\\\3 & 4\\end{pmatrix}");
    expect(p?.left).toBe("(");
    expect(p?.right).toBe(")");
    const b = matrixShellFromLatex("\\begin{bmatrix}1\\\\2\\end{bmatrix}");
    expect(b?.left).toBe("[");
    expect(b?.rows).toBe(2);
    expect(b?.cols).toBe(1);
  });

  it("handles non-square matrices row-major", () => {
    const split = splitMatrixChip("\\begin{bmatrix}1 & 2 & 3\\\\4 & 5 & 6\\end{bmatrix}");
    expect(split!.values).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(matrixShellFromLatex(split!.shell)!.cols).toBe(3);
  });

  it("reports an already-empty chip as empty and non-matrix text as null", () => {
    expect(isEmptyMatrixLatex(emptyMatrixLatex(3, 3))).toBe(true);
    expect(splitMatrixChip("2x + 1 = 0")).toBeNull();
    expect(matrixShellFromLatex("")).toBeNull();
  });
});
