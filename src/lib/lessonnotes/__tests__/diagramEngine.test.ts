import { describe, expect, it } from "vitest";
import {
  buildFlowModel, buildTreeModel, buildVennModel, classifyDiagram, regionsForOperation,
  solveTwoSetVenn, treeOutcomes,
} from "@/lib/lessonnotes/ai/diagramSpec";
import { materializeDirective } from "@/lib/lessonnotes/ai/materializeDirectives";
import { searchAssets } from "@/lib/lessonnotes/assets/registry";

const visual = (n: any) => n?.content?.[0]?.attrs;

describe("AI Mathematical Diagram Engine", () => {
  it("solves the class-of-40 Venn: 15 / 10 / 8 / 7", () => {
    expect(solveTwoSetVenn({ total: "40", A: "25", B: "18", AB: "10" })).toEqual({ A: 15, AB: 10, B: 8, "": 7 });
  });

  it("builds a labelled, completed Venn for the solution and a blank one for the question", () => {
    const p = { sets: "Mathematics,Science", total: "40", A: "25", B: "18", AB: "10" };
    const sol = buildVennModel({ ...p, stage: "solution" });
    expect(sol.sets.map((s) => s.label)).toEqual(["Mathematics", "Science"]);
    expect(Object.fromEntries(sol.regions.map((r) => [r.key, r.text]))).toEqual({ A: "15", AB: "10", B: "8", "": "7" });
    const q = buildVennModel({ ...p, stage: "question" });
    expect(q.regions.every((r) => !r.text)).toBe(true);
  });

  it("shades only the region the operation asks for", () => {
    expect(regionsForOperation("A∩B", 2)).toEqual(["AB"]);
    expect(regionsForOperation("A∪B", 2).sort()).toEqual(["A", "AB", "B"]);
    expect(regionsForOperation("A'", 2).sort()).toEqual(["", "B"]);
    expect(regionsForOperation("A-B", 2)).toEqual(["A"]);
  });

  it("creates semantic teaching focus without changing set colours", () => {
    const focused = buildVennModel({ sets: "Mathematics,Science,C", focus: "A∩B" });
    expect(focused.focusExpression).toBe("inter:AB");
    expect(focused.sets.map((set) => set.colour)).toEqual(["#3B82F6", "#F97316", "#22C55E"]);
    expect(buildVennModel({ sets: "A,B", focus: "clear" }).focusExpression).toBeUndefined();
  });

  it("keeps disjoint sets apart", () => {
    expect(buildVennModel({ sets: "Cats,Dogs", relation: "disjoint" }).relations.AB).toBe(false);
  });

  it("two coin tosses give four outcomes", () => {
    expect(treeOutcomes(buildTreeModel({ stages: "H,T;H,T" }))).toEqual(["HH", "HT", "TH", "TT"]);
  });

  it("even-number flowchart has one decision with Yes/No branches", () => {
    const m = buildFlowModel({ steps: "Start; Input n; ?Is n even?|Print Even|Print Odd; End" });
    expect(m.nodes.filter((n) => n.kind === "decision")).toHaveLength(1);
    expect(m.edges.map((e) => e.label)).toContain("Yes");
    expect(m.nodes.at(-1)?.kind).toBe("end");
  });

  it("routes intents to the right engine", () => {
    expect(classifyDiagram("venn")).toBe("venn");
    expect(classifyDiagram("tree diagram")).toBe("tree");
    expect(classifyDiagram("flowchart")).toBe("flowchart");
    expect(classifyDiagram("cuboid")).toBe("solid");
    expect(classifyDiagram("equilateral triangle")).toBe("geometry");
  });

  it("a Venn directive becomes the native Venn engine, never an asset tile", () => {
    const n = materializeDirective({ tool: "diagram", params: { type: "venn", sets: "A,B", total: "40", A: "25", B: "18", AB: "10" } } as any);
    expect(visual(n)?.family).toBe("vennEngine");
    expect(visual(n)?.attrs.model.presetId).toBe("generated");
  });

  it("the Asset Library no longer offers mathematical diagrams", () => {
    for (const q of ["venn", "tree diagram", "flowchart", "cuboid", "triangle"]) {
      expect(searchAssets(q).some((a) => a.category === "Diagrams")).toBe(false);
    }
  });
});
