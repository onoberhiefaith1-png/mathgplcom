// Spec tests for the Teacher Highlight Mode engine.
// Rule: whatever the teacher selects becomes ONE Floating Number per Apply.

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

const parsePair = (equation: string, lineId: string) => {
  const tree = parseNodes(equation, lineId);
  const atoms = flattenAtoms(tree);
  return { tree, atoms };
};

describe("highlightEngine — One Apply = One Chip", () => {
  it("single variable → 1 chip", () => {
    const { tree, atoms } = parsePair("x+y", "L1");
    const sel = new Set(idsByValues(atoms, ["x"]));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["x"]);
  });

  it("two variables skipping the operator → still ONE chip (teacher decides)", () => {
    const { tree, atoms } = parsePair("x+y", "L2");
    const sel = new Set(idsByValues(atoms, ["x", "y"]));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["xy"]);
  });

  it("connected expression x + y → 1 chip", () => {
    const { tree, atoms } = parsePair("x+y", "L3");
    const sel = new Set(atoms.map((a) => a.id));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["x+y"]);
  });

  it("exponent inclusion: Ax² selected → [Ax²]", () => {
    const { tree, atoms } = parsePair("Ax²+Bx", "L5");
    const sel = new Set(idsByValues(atoms, ["A", "x", "²"]));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["Ax²"]);
  });

  it("x²+4x+7 fully selected → ONE chip", () => {
    const { tree, atoms } = parsePair("x²+4x+7", "L_xy");
    const sel = new Set(atoms.map((a) => a.id));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["x²+4x+7"]);
  });

  it("disconnected pieces still collapse to ONE chip", () => {
    const { tree, atoms } = parsePair("Ax²+Bx+C", "L9");
    const sel = new Set([
      ...idsByValues(atoms, ["A", "x", "²"]),
      ...idsByValues(atoms, ["C"]),
    ]);
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["Ax²C"]);
  });
});

describe("highlightEngine — overlap replaces", () => {
  it("re-selecting atoms of an existing chip replaces that chip", () => {
    const { tree, atoms } = parsePair("Ax²", "L");
    const byId = new Map(atoms.map((a) => [a.id, a]));
    const existing: Chip[] = [buildChip(byId, atoms.map((a) => a.id))];
    const sel = new Set(idsByValues(atoms, ["A"]));
    const out = applySelection(tree, atoms, existing, sel);
    expect(valuesOf(out)).toEqual(["A"]);
  });

  it("non-overlapping prior chips survive", () => {
    const { tree, atoms } = parsePair("Ax²+Bx+C", "L17");
    const byId = new Map(atoms.map((a) => [a.id, a]));
    const C = idsByValues(atoms, ["C"]);
    const existing: Chip[] = [buildChip(byId, C)];
    const sel = new Set(idsByValues(atoms, ["A", "x", "²"]));
    const out = applySelection(tree, atoms, existing, sel);
    expect(valuesOf(out).sort()).toEqual(["Ax²", "C"].sort());
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

describe("highlightEngine — Rule 2: structure reconstruction", () => {
  it("fraction bar only → 1 chip \\frac{□}{□}", () => {
    const { tree, atoms } = parsePair("\\frac{A}{B}", "Ls1");
    const bar = atoms.find((a) => a.kind === "fraction-bar")!;
    const out = applySelection(tree, atoms, [], new Set([bar.id]));
    expect(out).toHaveLength(1);
    expect(out[0].structure).toBeDefined();
    expect(out[0].value).toBe("\\frac{□}{□}");
    expect(out[0].atomIds).toEqual([bar.id]);
  });

  it("fraction bar + numerator + denominator → fully filled fraction", () => {
    const { tree, atoms } = parsePair("\\frac{A}{B}", "Ls2");
    const out = applySelection(tree, atoms, [], new Set(atoms.map((a) => a.id)));
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("\\frac{A}{B}");
  });

  it("only A and B selected (no bar) → ONE plain chip 'AB'", () => {
    const { tree, atoms } = parsePair("\\frac{A}{B}", "Ls3");
    const sel = new Set(idsByValues(atoms, ["A", "B"]));
    const out = applySelection(tree, atoms, [], sel);
    expect(valuesOf(out)).toEqual(["AB"]);
  });

  it("bracket pair only → 1 chip (□)", () => {
    const { tree, atoms } = parsePair("(x+2)", "Ls5");
    const open = atoms.find((a) => a.kind === "bracket-open")!;
    const close = atoms.find((a) => a.kind === "bracket-close")!;
    const out = applySelection(tree, atoms, [], new Set([open.id]));
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("(□)");
    expect(out[0].atomIds).toEqual([open.id, close.id]);
  });

  it("nested √ + fraction bar → √(□/□)", () => {
    const { tree, atoms } = parsePair("\\sqrt{\\frac{A}{B}}", "Ls6");
    const sign = atoms.find((a) => a.kind === "root-sign")!;
    const bar = atoms.find((a) => a.kind === "fraction-bar")!;
    const out = applySelection(tree, atoms, [], new Set([sign.id, bar.id]));
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("\\sqrt{\\frac{□}{□}}");
  });

  it("fraction bar + x outside → ONE combined structural chip", () => {
    const { tree, atoms } = parsePair("\\frac{A}{B}+x", "Ls7");
    const bar = atoms.find((a) => a.kind === "fraction-bar")!;
    const x = atoms.find((a) => a.value === "x" && a.kind === "variable")!;
    const out = applySelection(tree, atoms, [], new Set([bar.id, x.id]));
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("\\frac{□}{□}x");
  });

  it("fraction-bar alone never produces / as the chip text", () => {
    const { tree, atoms } = parsePair("\\frac{A}{B}", "Ls8");
    const bar = atoms.find((a) => a.kind === "fraction-bar")!;
    const out = applySelection(tree, atoms, [], new Set([bar.id]));
    expect(out[0].value).not.toBe("/");
    expect(out[0].structure).toBeDefined();
  });
});
