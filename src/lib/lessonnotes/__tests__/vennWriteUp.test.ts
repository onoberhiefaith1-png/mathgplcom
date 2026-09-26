import { describe, it, expect } from "vitest";
import { buildVennPreset } from "@/components/lessonnotes/extensions/visuals/vennEngine/presets";
import {
  generateExpressions, displayLabel, expressionRegions, writeValue, readValue, semanticKeyToRowId, isEmptyInLayout, semanticExpressionToRowId,
} from "@/components/lessonnotes/extensions/visuals/vennEngine/expressions";
import { layoutWriteUp } from "@/components/lessonnotes/extensions/visuals/vennEngine/placement";
import { solveLayout } from "@/components/lessonnotes/extensions/visuals/vennEngine/solver";
import { buildVennModel } from "@/lib/lessonnotes/ai/diagramSpec";
import type { UCEVennModel, VennSet } from "@/components/lessonnotes/extensions/visuals/vennEngine/types";

const solved = (m: UCEVennModel) => {
  const p = solveLayout(m) as unknown as Record<string, VennSet | undefined>;
  return m.sets.map((s) => p[s.id] ?? s);
};

describe("Venn write-up", () => {
  it("two sets generate the short list", () => {
    const m = { ...buildVennPreset("venn2"), universe: { ...buildVennPreset("venn2").universe, show: true } };
    expect(generateExpressions(m).map((r) => displayLabel(r, m))).toEqual([
      "A only", "B only", "A ∪ B", "A ∩ B", "A′", "B′", "(A ∪ B)′", "(A ∩ B)′",
      "Outside all sets", "U", "A − B", "B − A",
    ]);
  });

  it("three sets have no duplicates and use labels", () => {
    const m = buildVennPreset("venn3");
    m.sets = m.sets.map((s, i) => ({ ...s, label: ["Mathematics", "Science", "Chemistry"][i] }));
    const labels = generateExpressions(m).map((r) => displayLabel(r, m));
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain("Mathematics ∪ Science ∪ Chemistry");
    expect(labels).toContain("Mathematics ∩ Science only");
    expect(labels.some((l) => /A ∩ A|Mathematics ∩ Mathematics/.test(l))).toBe(false);
  });

  it("union maps to many regions; A∩B differs from A∩B only", () => {
    const m = buildVennPreset("venn3");
    const rows = generateExpressions(m);
    const union = rows.find((r) => r.id === "union:AB")!;
    expect(expressionRegions(union, 3).sort()).toEqual(["A", "AB", "ABC", "AC", "B", "BC"].sort());
    const inter = rows.find((r) => r.id === "inter:AB")!;
    expect(expressionRegions(inter, 3).sort()).toEqual(["AB", "ABC"]);
    expect(rows.find((r) => r.id === "AB")!.physical).toBe(true);
  });

  it("empty rows render nothing, values render in place", () => {
    let m = buildVennPreset("venn2");
    m = writeValue(m, generateExpressions(m)[0], "15");
    const lay = layoutWriteUp(m, solved(m));
    expect(lay.values.map((v) => v.text)).toEqual(["15"]);
    expect(lay.notes).toHaveLength(0);
  });

  it("union values go to notes and long text grows the diagram", () => {
    let m = buildVennPreset("venn2");
    const union = generateExpressions(m).find((r) => r.kind === "union")!;
    m = writeValue(m, union, "Mathematics ∪ Science ∪ a very long explanatory expression here");
    expect(readValue(m, union)).toContain("very long");
    const lay = layoutWriteUp(m, solved(m));
    expect(lay.notes).toHaveLength(1);
    expect(lay.height).toBeGreaterThan(m.height);
    expect(lay.width).toBeGreaterThanOrEqual(m.width);
  });

  it("semantic keys parse and the AI directive fills them", () => {
    expect(semanticKeyToRowId("A_only", 3)).toBe("A");
    expect(semanticKeyToRowId("A∩B", 3)).toBe("inter:AB");
    expect(semanticKeyToRowId("A∩B", 2)).toBe("AB");
    expect(semanticKeyToRowId("B∪A", 2)).toBe("union:AB");
    const m = buildVennModel({ sets: "Maths,Science", write: "A_only:15;A∩B:8;A∪B:35;U:50" });
    expect(m.regions.find((r) => r.key === "A")?.text).toBe("15");
    expect(m.regions.find((r) => r.key === "AB")?.text).toBe("8");
    expect(m.expressions?.["union:AB"]).toBe("35");
    expect(m.expressions?.universe).toBe("50");
  });

  it("old models without expressions still load", () => {
    const m = buildVennPreset("venn3");
    delete (m as Partial<UCEVennModel>).expressions;
    expect(() => layoutWriteUp(m, solved(m))).not.toThrow();
  });

  it("maps complements, differences and outside to physical regions", () => {
    const m = { ...buildVennPreset("venn3"), universe: { ...buildVennPreset("venn3").universe, show: true } };
    const rows = generateExpressions(m);
    const aComplement = rows.find((r) => r.id === "complement:A");
    const unionComplement = rows.find((r) => r.id === "complement:union:AB");
    const interComplement = rows.find((r) => r.id === "complement:inter:AB");
    const difference = rows.find((r) => r.id === "difference:AB");
    const outside = rows.find((r) => r.id === "outside");
    expect(aComplement && expressionRegions(aComplement, m).sort()).toEqual(["", "B", "BC", "C"].sort());
    expect(unionComplement && expressionRegions(unionComplement, m).sort()).toEqual(["", "C"].sort());
    expect(interComplement && expressionRegions(interComplement, m).sort()).toEqual(["", "A", "AC", "B", "BC", "C"].sort());
    expect(difference && expressionRegions(difference, m).sort()).toEqual(["A", "AC"].sort());
    expect(outside && expressionRegions(outside, m)).toEqual([""]);
  });

  it("returns no focus region for a disjoint intersection", () => {
    const m = buildVennPreset("vennDisjoint");
    const intersection = generateExpressions(m).find((r) => r.kind === "inter");
    expect(intersection && expressionRegions(intersection, m)).toEqual([]);
    expect(intersection && isEmptyInLayout(intersection, m)).toBe(true);
  });

  it("parses semantic teaching expressions", () => {
    expect(semanticKeyToRowId("A'", 3)).toBe("complement:A");
    expect(semanticKeyToRowId("(A ∪ B)'", 3)).toBe("complement:union:AB");
    expect(semanticKeyToRowId("(A ∩ B)'", 3)).toBe("complement:inter:AB");
    expect(semanticKeyToRowId("A-B", 3)).toBe("difference:AB");
    expect(semanticKeyToRowId("outside", 3)).toBe("outside");
    const named = buildVennPreset("venn3");
    named.sets = named.sets.map((set, index) => ({ ...set, label: ["Mathematics", "Science", "C"][index] }));
    expect(semanticExpressionToRowId("Mathematics only", named)).toBe("A");
    expect(semanticExpressionToRowId("intersection of Mathematics and Science", named)).toBe("inter:AB");
  });

  it("keeps teaching focus independent from values and identity colours", () => {
    const original = buildVennPreset("venn3");
    const focused = { ...original, focusExpression: "inter:AB" };
    expect(focused.sets).toEqual(original.sets);
    expect(focused.regions).toEqual(original.regions);
    expect({ ...focused, focusExpression: null }.sets).toEqual(original.sets);
  });
});
