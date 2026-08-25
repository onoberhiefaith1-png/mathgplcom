import { describe, expect, it } from "vitest";
import {
  buildQuickMatrixLatex, chooseDim, dimState, emptySelection, opState,
  specialState, toggleOp, toggleSpecial,
} from "../matrixQuick";

const sel = (rows: number, cols: number) => chooseDim(emptySelection(), { rows, cols });

describe("matrix quick access", () => {
  it("keeps 2×3 and 3×2 distinct", () => {
    const a = buildQuickMatrixLatex(sel(2, 3));
    const b = buildQuickMatrixLatex(sel(3, 2));
    expect(a.split("\\\\").length).toBe(2);
    expect(a.split("\\\\")[0].split("&").length).toBe(3);
    expect(b.split("\\\\").length).toBe(3);
    expect(b.split("\\\\")[0].split("&").length).toBe(2);
  });

  it("wraps operations correctly", () => {
    expect(buildQuickMatrixLatex(toggleOp(sel(3, 3), "inverse"))).toContain("^{-1}");
    expect(buildQuickMatrixLatex(toggleOp(sel(3, 3), "transpose"))).toContain("^{T}");
    expect(buildQuickMatrixLatex(toggleOp(sel(3, 3), "determinant"))).toContain("vmatrix");
    expect(buildQuickMatrixLatex(toggleOp(sel(3, 3), "adjoint")).startsWith("adj ")).toBe(true);
  });

  it("disables square-only options on non-square dimensions", () => {
    const s = sel(2, 3);
    expect(opState(s, "inverse").enabled).toBe(false);
    expect(opState(s, "transpose").enabled).toBe(true);
    expect(specialState(s, "identity").enabled).toBe(false);
    expect(specialState(s, "zero").enabled).toBe(true);
  });

  it("row forces a single row and disables non-matching dimensions", () => {
    const s = toggleSpecial(sel(3, 3), "row");
    expect(s.dim).toEqual({ rows: 1, cols: 3 });
    expect(dimState(s, { rows: 3, cols: 3 }).enabled).toBe(false);
  });

  it("fills identity and zero matrices", () => {
    expect(buildQuickMatrixLatex(toggleSpecial(sel(2, 2), "identity")))
      .toBe("\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}");
    expect(buildQuickMatrixLatex(toggleSpecial(sel(2, 2), "zero")))
      .toBe("\\begin{pmatrix} 0 & 0 \\\\ 0 & 0 \\end{pmatrix}");
  });

  it("combines a special type with a compatible operation", () => {
    const s = toggleOp(toggleSpecial(sel(4, 4), "diagonal"), "inverse");
    const out = buildQuickMatrixLatex(s);
    expect(out).toContain("^{-1}");
    expect(out.split("\\\\").length).toBe(4);
  });
});
