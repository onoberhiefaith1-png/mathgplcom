import { describe, expect, it } from "vitest";
import {
  chooseDim, dimState, emptySelection, opState,
  quickMatrixSpec, specialState, toggleOp, toggleSpecial,
} from "../matrixQuick";

const sel = (rows: number, cols: number) => chooseDim(emptySelection(), { rows, cols });

describe("matrix quick access", () => {
  it("keeps 2×3 and 3×2 distinct", () => {
    expect(quickMatrixSpec(sel(2, 3))).toMatchObject({ rows: 2, cols: 3 });
    expect(quickMatrixSpec(sel(3, 2))).toMatchObject({ rows: 3, cols: 2 });
  });

  it("maps operations onto real matrix notation functions", () => {
    expect(quickMatrixSpec(toggleOp(sel(3, 3), "inverse")).fns).toContain("inverse");
    expect(quickMatrixSpec(toggleOp(sel(3, 3), "transpose")).fns).toContain("transpose");
    expect(quickMatrixSpec(toggleOp(sel(3, 3), "determinant")).fns).toContain("determinant");
    expect(quickMatrixSpec(toggleOp(sel(3, 3), "adjoint")).fns).toContain("adjoint");
  });

  it("inserts a bracketed matrix, never a code string", () => {
    const spec = quickMatrixSpec(sel(2, 2));
    expect(spec.br).toBe("(");
    expect(spec.template).toBeUndefined();
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

  it("carries identity and zero as matrix templates", () => {
    expect(quickMatrixSpec(toggleSpecial(sel(2, 2), "identity")).template).toBe("identity");
    expect(quickMatrixSpec(toggleSpecial(sel(2, 2), "zero")).template).toBe("zero");
  });

  it("combines a special type with a compatible operation", () => {
    const s = toggleOp(toggleSpecial(sel(4, 4), "diagonal"), "inverse");
    const spec = quickMatrixSpec(s);
    expect(spec.template).toBe("diagonal");
    expect(spec.fns).toContain("inverse");
    expect(spec.rows).toBe(4);
  });
});
