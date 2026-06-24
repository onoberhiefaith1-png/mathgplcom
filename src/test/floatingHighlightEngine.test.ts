// Spec tests for the Floating Number Highlight Generation engine.
// Each test maps to a numbered example in the specification.

import { describe, it, expect } from "vitest";
import { parseAtoms } from "@/lib/floating/atoms";
import { applySelection, buildChip, type Chip } from "@/lib/floating/highlightEngine";

const idsByValues = (atoms: ReturnType<typeof parseAtoms>, values: string[]) => {
  // Pick the first un-used atom matching each value in order.
  const used = new Set<number>();
  const out: string[] = [];
  for (const v of values) {
    const idx = atoms.findIndex((a, i) => !used.has(i) && a.value === v);
    if (idx >= 0) { used.add(idx); out.push(atoms[idx].id); }
  }
  return out;
};

const valuesOf = (chips: Chip[]) => chips.map((c) => c.value);

describe("highlightEngine — manual generation (Workflow 1)", () => {
  it("Ex 1: single variable", () => {
    const atoms = parseAtoms("x+y", "L1");
    const sel = new Set(idsByValues(atoms, ["x"]));
    const out = applySelection(atoms, [], sel);
    expect(valuesOf(out)).toEqual(["x"]);
  });

  it("Ex 2: two separate variables (gap → two chips)", () => {
    const atoms = parseAtoms("x+y", "L2");
    const sel = new Set(idsByValues(atoms, ["x", "y"]));
    const out = applySelection(atoms, [], sel);
    expect(valuesOf(out)).toEqual(["x", "y"]);
  });

  it("Ex 3: connected expression x + y", () => {
    const atoms = parseAtoms("x+y", "L3");
    const sel = new Set(atoms.map((a) => a.id));
    const out = applySelection(atoms, [], sel);
    expect(valuesOf(out)).toEqual(["x+y"]);
  });

  it("Ex 5: exponent structure Ax²", () => {
    const atoms = parseAtoms("Ax²+Bx", "L5");
    const sel = new Set(idsByValues(atoms, ["A", "x", "²"]));
    const out = applySelection(atoms, [], sel);
    expect(valuesOf(out)).toEqual(["Ax²"]);
  });
});

describe("highlightEngine — split / merge (Workflow 2)", () => {
  it("Ex 6: split [Ax²] by selecting only A → [A] + [x²]", () => {
    const atoms = parseAtoms("Ax²", "L6");
    const existing: Chip[] = [buildChip(new Map(atoms.map((a) => [a.id, a])), atoms.map((a) => a.id))];
    const sel = new Set(idsByValues(atoms, ["A"]));
    const out = applySelection(atoms, existing, sel);
    expect(valuesOf(out)).toEqual(["A", "x²"]);
  });

  it("Ex 7: split by selecting x and ² → [A] + [x²]", () => {
    const atoms = parseAtoms("Ax²", "L7");
    const byId = new Map(atoms.map((a) => [a.id, a]));
    const existing: Chip[] = [buildChip(byId, atoms.map((a) => a.id))];
    const sel = new Set(idsByValues(atoms, ["x", "²"]));
    const out = applySelection(atoms, existing, sel);
    expect(valuesOf(out)).toEqual(["A", "x²"]);
  });

  it("Ex 17: AI correction collapses [A][x][²] into [Ax²] without duplicates", () => {
    const atoms = parseAtoms("Ax²+Bx+C", "L17");
    const byId = new Map(atoms.map((a) => [a.id, a]));
    // Simulate AI-generated chips: [A] [x] [²] [+Bx] [+C]
    const A = idsByValues(atoms, ["A"]);
    const x1 = idsByValues(atoms, ["x"]);
    const sup = idsByValues(atoms, ["²"]);
    const plusBx = atoms.filter((a) => ["+", "B", "x"].includes(a.value) && !x1.includes(a.id)).slice(0, 3).map((a) => a.id);
    const plusC = atoms.slice(atoms.findIndex((a) => a.value === "C") - 1).slice(0, 2).map((a) => a.id);
    const existing: Chip[] = [
      buildChip(byId, A),
      buildChip(byId, x1),
      buildChip(byId, sup),
      buildChip(byId, plusBx),
      buildChip(byId, plusC),
    ];
    // Teacher selects A, x, ² in the equation and presses Enter.
    const sel = new Set([...A, ...x1, ...sup]);
    const out = applySelection(atoms, existing, sel);
    expect(valuesOf(out)).toEqual(["Ax²", "+Bx", "+C"]);
  });

  it("Ex 8: Ax² + Bx connected via plus → one chip", () => {
    const atoms = parseAtoms("Ax²+Bx+C", "L8");
    const ids = atoms
      .filter((a, i) => i <= atoms.findIndex((x) => x.value === "B") + 1)
      .map((a) => a.id);
    const sel = new Set(ids);
    const out = applySelection(atoms, [], sel);
    expect(valuesOf(out)).toEqual(["Ax²+Bx"]);
  });

  it("Ex 9: disconnected selection → two chips", () => {
    const atoms = parseAtoms("Ax²+Bx+C", "L9");
    const Ax2 = atoms.slice(0, 3).map((a) => a.id);
    const C = atoms.filter((a) => a.value === "C").map((a) => a.id);
    const sel = new Set([...Ax2, ...C]);
    const out = applySelection(atoms, [], sel);
    expect(valuesOf(out)).toEqual(["Ax²", "C"]);
  });
});

describe("highlightEngine — no duplicates rule", () => {
  it("re-applying the same selection on an existing chip is a no-op", () => {
    const atoms = parseAtoms("Ax²", "L");
    const byId = new Map(atoms.map((a) => [a.id, a]));
    const existing: Chip[] = [buildChip(byId, atoms.map((a) => a.id))];
    const sel = new Set(atoms.map((a) => a.id));
    const out = applySelection(atoms, existing, sel);
    expect(valuesOf(out)).toEqual(["Ax²"]);
    expect(out).toHaveLength(1);
  });
});
