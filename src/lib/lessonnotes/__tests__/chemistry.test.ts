import { describe, expect, it } from "vitest";
import { checkEquation, molarMass, parseSpecies, findChemistryProblems } from "../../../../supabase/functions/notebook-ai/chemistryValidator.ts";
import { CHEMISTRY_BENCHMARKS } from "../../../../supabase/functions/notebook-ai/chemistryBenchmarks.ts";
import { isChemistrySubject } from "../../../../supabase/functions/notebook-ai/chemistryStandard.ts";
import { subjectKnowledgeBlocks } from "../../../../supabase/functions/notebook-ai/sharedKnowledge.ts";
import { chemFormulaAt } from "@/lib/floating/atoms";

describe("chemistry validator", () => {
  it("balances neutralisation without spaces", () => expect(checkEquation("HCl+NaOH→NaCl+H₂O")?.ok).toBe(true));
  it("catches an unbalanced equation", () => {
    const r = checkEquation("H₂ + O₂ → H₂O")!;
    expect(r.balancedAtoms).toBe(false);
    expect(r.problems.join()).toContain("O: 2 on the left, 1 on the right");
  });
  it("handles polyatomic ions in brackets", () => expect(checkEquation("Ca(OH)₂ + 2HCl → CaCl₂ + 2H₂O")?.ok).toBe(true));
  it("checks ionic charge", () => {
    expect(checkEquation("H⁺(aq) + OH⁻(aq) → H₂O(l)")?.ok).toBe(true);
    expect(checkEquation("Ag⁺ + Cl⁻ → AgCl")?.ok).toBe(true);
    expect(checkEquation("Fe³⁺ + e⁻ → Fe")?.balancedCharge).toBe(false);
  });
  it("checks half-equations with electrons", () => expect(checkEquation("Cu²⁺(aq) + 2e⁻ → Cu(s)")?.ok).toBe(true));
  it("reads sulfate charge", () => expect(parseSpecies("SO₄²⁻")).toMatchObject({ counts: { S: 1, O: 4 }, charge: -2 }));
  it("rejects an invented element", () => expect(checkEquation("Xq + O₂ → XqO₂")?.unknownElements).toEqual(["Xq"]));
  it("computes molar masses for mole calculations", () => {
    expect(molarMass("CaCO₃")).toBe(100);
    expect(molarMass("H₂SO₄")).toBe(98);
  });
  it("every reference lesson equation and molar mass is correct", () => {
    expect(CHEMISTRY_BENCHMARKS).toHaveLength(6);
    for (const b of CHEMISTRY_BENCHMARKS) {
      for (const eq of b.equations) expect(checkEquation(eq)?.ok, `${b.id}: ${eq}`).toBe(true);
      for (const [f, m] of b.molarMasses ?? []) expect(molarMass(f), f).toBe(m);
      expect(findChemistryProblems(b.note), b.id).toEqual([]);
    }
  });
});

describe("subject gating", () => {
  it("adds the Chemistry standard only for Chemistry", () => {
    expect(isChemistrySubject("Chemistry")).toBe(true);
    expect(subjectKnowledgeBlocks("Chemistry").join("\n")).toContain("CHEMISTRY TEACHING STANDARD");
    expect(subjectKnowledgeBlocks("Mathematics")).toEqual([]);
    expect(subjectKnowledgeBlocks("Physics").join("\n")).not.toContain("CHEMISTRY");
  });
});

describe("floating numbers keep formulas whole", () => {
  const whole = (s: string) => chemFormulaAt(s, 0) === s.length;
  it("groups real formulas and ions", () => {
    for (const f of ["H₂O", "SO₄²⁻", "Na⁺", "Ca(OH)₂", "NH₄⁺(aq)", "CO₂"]) expect(whole(f), f).toBe(true);
  });
  it("never groups maths", () => {
    for (const f of ["x₂", "A₁", "B₁", "Ax", "(x+1)", "H", "AB"]) expect(chemFormulaAt(f, 0), f).toBe(-1);
  });
});
