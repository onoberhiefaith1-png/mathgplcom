import { describe, expect, it } from "vitest";
import {
  emptyMatrixLatex,
  expandMatrixFillers,
  isEmptyMatrixLatex,
  isFilledMatrixChip,
  matrixLineChips,
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

describe("whole-line matrix chips (shell + cells + operators)", () => {
  const A = "\\begin{bmatrix}1 & 2\\\\3 & 4\\end{bmatrix}";
  const B = "\\begin{bmatrix}5\\\\6\\end{bmatrix}";
  const C = "\\begin{bmatrix}17\\\\39\\end{bmatrix}";

  it("a single matrix line → empty shell then row-major cells", () => {
    const chips = matrixLineChips(A)!;
    expect(chips).toEqual([emptyMatrixLatex(2, 2), "1", "2", "3", "4"]);
  });

  it("A × B = C → shell+cells, ×, shell+cells, =, shell+cells", () => {
    const chips = matrixLineChips(`${A} \\times ${B} = ${C}`)!;
    expect(chips).toEqual([
      emptyMatrixLatex(2, 2), "1", "2", "3", "4",
      "×",
      emptyMatrixLatex(2, 1), "5", "6",
      "=",
      emptyMatrixLatex(2, 1), "17", "39",
    ]);
    // No chip is ever a filled matrix blob.
    expect(chips.some(isFilledMatrixChip)).toBe(false);
  });

  it("keeps labels and braced exponents intact", () => {
    expect(matrixLineChips(`A^{-1} = ${A}`)!.slice(0, 3)).toEqual(["A^{-1}", "=", emptyMatrixLatex(2, 2)]);
  });

  it("returns null for non-matrix lines", () => {
    expect(matrixLineChips("2x + 1 = 0")).toBeNull();
  });

  it("expands legacy filled-matrix blobs in a saved filler row", () => {
    const res = expandMatrixFillers([A, "×", B])!;
    expect(res.fillers).toEqual([emptyMatrixLatex(2, 2), "1", "2", "3", "4", "×", emptyMatrixLatex(2, 1), "5", "6"]);
    expect(res.source).toEqual([0, 0, 0, 0, 0, 1, 2, 2, 2]);
  });

  it("leaves already-split rows (empty shells + values) untouched", () => {
    expect(expandMatrixFillers([emptyMatrixLatex(2, 2), "1", "2", "3", "4"])).toBeNull();
    expect(expandMatrixFillers(["2x", "+", "1"])).toBeNull();
  });
});
