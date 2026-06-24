// Spec tests for the Floating Number Highlight Generation engine.
// Each test maps to a numbered example in the specification.

import { describe, it, expect } from "vitest";
import { parseAtoms, parseNodes, flattenAtoms, type Atom } from "@/lib/floating/atoms";
import { applySelection, buildChip, type Chip } from "@/lib/floating/highlightEngine";

const idsByValues = (atoms: Atom[], values: string[]) => {
  const used = new Set<number>();
  const out: string[] = [];
  for (const v of values) {
    const idx = atoms.findIndex((a, i) => !used.has(i) && a.value === v);
    if (idx >= 0) { used.add(idx); out.push(atoms[idx].id); }
  }
  return out;
};

const valuesOf = (chips: Chip[]) => chips.map((c) => c.value);

// parseAtoms() and parseNodes() each create their own Parser, so atom ids
// don't match. Use the same tree's flat atoms for both selection and engine.
const parsePair = (equation: string, lineId: string) => {
  const tree = parseNodes(equation, lineId);
  const atoms = flattenAtoms(tree);
  return { tree, atoms };
};


describe("highlightEngine — manual generation (Workflow 1)", () => {
  it("Ex 1: single variable", () => {
    const { tree, atoms } = parsePair("x+y", "L1");
    const sel = new Set(idsByValues(atoms, ["x"]));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["x"]);
  });

  it("Ex 2: two separate variables (gap → two chips)", () => {
    const { tree, atoms } = parsePair("x+y", "L2");
    const sel = new Set(idsByValues(atoms, ["x", "y"]));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["x", "y"]);
  });

  it("Ex 3: connected expression x + y", () => {
    const { tree, atoms } = parsePair("x+y", "L3");
    const sel = new Set(atoms.map((a) => a.id));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["x+y"]);
  });

  it("Ex 5: exponent structure Ax²", () => {
    const { tree, atoms } = parsePair("Ax²+Bx", "L5");
    const sel = new Set(idsByValues(atoms, ["A", "x", "²"]));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["Ax²"]);
  });
});

describe("highlightEngine — split / merge (Workflow 2)", () => {
  it("Ex 6: split [Ax²] by selecting only A → [A] + [x²]", () => {
    const { tree, atoms } = parsePair("Ax²", "L6");
    const existing: Chip[] = [buildChip(new Map(atoms.map((a) => [a.id, a])), atoms.map((a) => a.id))];
    const sel = new Set(idsByValues(atoms, ["A"]));
    const out = applySelection(tree, atoms, existing, sel);
    expect(valuesOf(out)).toEqual(["A", "x²"]);
  });

  it("Ex 7: split by selecting x and ² → [A] + [x²]", () => {
    const { tree, atoms } = parsePair("Ax²", "L7");
    const byId = new Map(atoms.map((a) => [a.id, a]));
    const existing: Chip[] = [buildChip(byId, atoms.map((a) => a.id))];
    const sel = new Set(idsByValues(atoms, ["x", "²"]));
    const out = applySelection(tree, atoms, existing, sel);
    expect(valuesOf(out)).toEqual(["A", "x²"]);
  });

  it("Ex 17: AI correction collapses [A][x][²] into [Ax²] without duplicates", () => {
    const { tree, atoms } = parsePair("Ax²+Bx+C", "L17");
    const byId = new Map(atoms.map((a) => [a.id, a]));
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
    const sel = new Set([...A, ...x1, ...sup]);
    const out = applySelection(tree, atoms, existing, sel);
    expect(valuesOf(out)).toEqual(["Ax²", "+Bx", "+C"]);
  });

  it("Ex 8: Ax² + Bx connected via plus → one chip", () => {
    const { tree, atoms } = parsePair("Ax²+Bx+C", "L8");
    const ids = atoms
      .filter((a, i) => i <= atoms.findIndex((x) => x.value === "B") + 1)
      .map((a) => a.id);
    const sel = new Set(ids);
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["Ax²+Bx"]);
  });

  it("Ex 9: disconnected selection → two chips", () => {
    const { tree, atoms } = parsePair("Ax²+Bx+C", "L9");
    const Ax2 = atoms.slice(0, 3).map((a) => a.id);
    const C = atoms.filter((a) => a.value === "C").map((a) => a.id);
    const sel = new Set([...Ax2, ...C]);
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["Ax²", "C"]);
  });
});

describe("highlightEngine — no duplicates rule", () => {
  it("re-applying the same selection on an existing chip is a no-op", () => {
    const { tree, atoms } = parsePair("Ax²", "L");
    const byId = new Map(atoms.map((a) => [a.id, a]));
    const existing: Chip[] = [buildChip(byId, atoms.map((a) => a.id))];
    const sel = new Set(atoms.map((a) => a.id));
    const out = applySelection(tree, atoms, existing, sel);
    expect(valuesOf(out)).toEqual(["Ax²"]);
    expect(out).toHaveLength(1);
  });
});

describe("atoms parser — LaTeX rendering regression", () => {
  it("never leaks raw LaTeX commands as atom values", () => {
    const atoms = parseAtoms("\\frac{x+2}{x^{2}(x^{2}+4)}", "Lfrac");
    const values = atoms.map((a) => a.value).join("");
    expect(values).not.toMatch(/\\/);
    expect(values).not.toMatch(/\^/);
    expect(values).not.toMatch(/frac/);
    expect(atoms.some((a) => a.kind === "fraction-bar")).toBe(true);
  });

  it("converts ^{2} into a single ² exponent atom", () => {
    const atoms = parseAtoms("Ax^{2}+Bx+C", "Lexp");
    const sup = atoms.filter((a) => a.kind === "exponent");
    expect(sup).toHaveLength(1);
    expect(sup[0].value).toBe("²");
    expect(sup[0].attachment).toBe(true);
  });

  it("Ax^{2}+Bx+C: selecting A, x, ² collapses to [Ax²]", () => {
    const { tree, atoms } = parsePair("Ax^{2}+Bx+C", "Lcollapse");
    const sel = new Set(idsByValues(atoms, ["A", "x", "²"]));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["Ax²"]);
  });

  it("Ax^{2}+Bx+C: disconnected Ax² + C → two chips", () => {
    const { tree, atoms } = parsePair("Ax^{2}+Bx+C", "Ldisc");
    const sel = new Set([
      ...idsByValues(atoms, ["A", "x", "²"]),
      ...idsByValues(atoms, ["C"]),
    ]);
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["Ax²", "C"]);
  });

  it("\\frac numerator atoms only → chip value is the numerator", () => {
    const { tree, atoms } = parsePair("\\frac{x+2}{x^{2}(x^{2}+4)}", "Lnum");
    const sel = new Set(atoms.slice(0, 3).map((a) => a.id));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["x+2"]);
  });

  it("\\sqrt and greek/cdot commands never leak as text", () => {
    const atoms = parseAtoms("\\sqrt{x}+\\pi\\cdot r^{2}", "Lmix");
    const values = atoms.map((a) => a.value);
    expect(values).toContain("√");
    expect(values).toContain("π");
    expect(values).toContain("·");
    expect(values).toContain("²");
    expect(values.join("")).not.toMatch(/\\|sqrt|cdot|pi/);
  });
});

describe("highlightEngine — Rule 1: connectivity for variables/operators", () => {
  it("A + B, selecting A and B only (no +) → two chips", () => {
    const { tree, atoms } = parsePair("A+B", "Lc1");
    const sel = new Set(idsByValues(atoms, ["A", "B"]));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["A", "B"]);
  });

  it("A + B, selecting A, +, B → one chip [A+B]", () => {
    const { tree, atoms } = parsePair("A+B", "Lc2");
    const sel = new Set(atoms.map((a) => a.id));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["A+B"]);
  });

  it("Ax²+Bx+C, selecting Ax² and Bx with middle + → one connected chip", () => {
    const { tree, atoms } = parsePair("Ax²+Bx+C", "Lc3");
    const sel = new Set(idsByValues(atoms, ["A", "x", "²", "+", "B", "x"]));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["Ax²+Bx"]);
  });

  it("Ax²+Bx+C=0, selecting everything → one chip", () => {
    const { tree, atoms } = parsePair("Ax²+Bx+C=0", "Lc5");
    const sel = new Set(atoms.map((a) => a.id));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["Ax²+Bx+C=0"]);
  });

  it("Ax²+Bx+C=0, selecting Ax² and 0 only → two chips (no bridging)", () => {
    const { tree, atoms } = parsePair("Ax²+Bx+C=0", "Lc6");
    const sel = new Set([
      ...idsByValues(atoms, ["A", "x", "²"]),
      ...idsByValues(atoms, ["0"]),
    ]);
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["Ax²", "0"]);
  });

  it("x², selecting ² only → single [²] attachment chip", () => {
    const { tree, atoms } = parsePair("x²", "Lc10");
    const sel = new Set(idsByValues(atoms, ["²"]));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["²"]);
  });
});

describe("highlightEngine — Rule 2: structure reconstruction", () => {
  it("\\frac{A}{B}, selecting bar only → 1 chip □/□ with structure", () => {
    const { tree, atoms } = parsePair("\\frac{A}{B}", "Ls1");
    const bar = atoms.find((a) => a.kind === "fraction-bar")!;
    const out = applySelection(tree, atoms, [], new Set([bar.id]));
    expect(out).toHaveLength(1);
    expect(out[0].structure).toBeDefined();
    expect(out[0].value).toBe("\\frac{□}{□}");
    // Bar is the only consumed atom.
    expect(out[0].atomIds).toEqual([bar.id]);
  });

  it("\\frac{A}{B}, selecting bar + A + B → 1 chip with both filled", () => {
    const { tree, atoms } = parsePair("\\frac{A}{B}", "Ls2");
    const out = applySelection(tree, atoms, [], new Set(atoms.map((a) => a.id)));
    expect(out).toHaveLength(1);
    expect(out[0].atomIds).toHaveLength(3);
    expect(out[0].value).toBe("\\frac{A}{B}");
  });

  it("\\frac{A}{B}, selecting A and B only (no bar) → two variable chips", () => {
    const { tree, atoms } = parsePair("\\frac{A}{B}", "Ls3");
    const sel = new Set(idsByValues(atoms, ["A", "B"]));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["A", "B"]);
  });

  it("\\frac{A}{(B+C)}, selecting bar, (, ) → 1 chip □/(□)", () => {
    const { tree, atoms } = parsePair("\\frac{A}{(B+C)}", "Ls4");
    const bar = atoms.find((a) => a.kind === "fraction-bar")!;
    const open = atoms.find((a) => a.kind === "bracket-open")!;
    const close = atoms.find((a) => a.kind === "bracket-close")!;
    const out = applySelection(tree, atoms, [], new Set([bar.id, open.id, close.id]));
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("\\frac{□}{(□)}");
  });

  it("(x+2), selecting ( only → 1 chip (□) — pair implied", () => {
    const { tree, atoms } = parsePair("(x+2)", "Ls5");
    const open = atoms.find((a) => a.kind === "bracket-open")!;
    const close = atoms.find((a) => a.kind === "bracket-close")!;
    const out = applySelection(tree, atoms, [], new Set([open.id]));
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("(□)");
    expect(out[0].atomIds).toEqual([open.id, close.id]);
  });

  it("\\sqrt{\\frac{A}{B}}, selecting √ and bar → 1 chip √(□/□)", () => {
    const { tree, atoms } = parsePair("\\sqrt{\\frac{A}{B}}", "Ls6");
    const sign = atoms.find((a) => a.kind === "root-sign")!;
    const bar = atoms.find((a) => a.kind === "fraction-bar")!;
    const out = applySelection(tree, atoms, [], new Set([sign.id, bar.id]));
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("\\sqrt{\\frac{□}{□}}");
  });

  it("\\frac{A}{B}+x, selecting bar + x → 2 chips: [□/□] + [x]", () => {
    const { tree, atoms } = parsePair("\\frac{A}{B}+x", "Ls7");
    const bar = atoms.find((a) => a.kind === "fraction-bar")!;
    const x = atoms.find((a) => a.value === "x" && a.kind === "variable")!;
    const out = applySelection(tree, atoms, [], new Set([bar.id, x.id]));
    expect(out).toHaveLength(2);
    expect(out[0].value).toBe("\\frac{□}{□}");
    expect(out[1].value).toBe("x");
  });

  it("fraction-bar alone never produces / as the chip text", () => {
    const { tree, atoms } = parsePair("\\frac{A}{B}", "Ls8");
    const bar = atoms.find((a) => a.kind === "fraction-bar")!;
    const out = applySelection(tree, atoms, [], new Set([bar.id]));
    expect(out[0].value).not.toBe("/");
    expect(out[0].structure).toBeDefined();
  });

  it("no-limit selection: 8+ atoms in Ax^{2}+Bx+C=0 → single connected chip", () => {
    const { tree, atoms } = parsePair("Ax^{2}+Bx+C=0", "Ls9");
    const sel = new Set(atoms.map((a) => a.id));
    const out = applySelection(tree, atoms, [], sel);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("Ax²+Bx+C=0");
  });
});
