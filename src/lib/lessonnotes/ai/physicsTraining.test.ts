import { describe, expect, it } from "vitest";
import { parseAtoms } from "@/lib/floating/atoms";
import { buildPhysicsDiagram, classifyPhysicsDiagram, validateCircuit } from "./physicsDiagram";
import { diagramNode } from "./materializeDirectives";
import { classifyDiagram } from "./diagramSpec";
import { deriveSubcells } from "./deriveSubcells";

const values = (s: string) => parseAtoms(s, "L").map((a) => a.value);

describe("Physics symbols through Floating Numbers", () => {
  it("keeps compound units as one chip after a number", () => {
    expect(values("a = 9.8 m/s²")).toEqual(["a", "=", "9.8", "m/s²"]);
    expect(values("c = 4200 J/(kg·K)")).toContain("J/(kg·K)");
    expect(values("ρ = 1000 kg/m³")).toEqual(["ρ", "=", "1000", "kg/m³"]);
  });
  it("leaves algebra between variables unchanged", () => {
    expect(values("v = m/s")).toEqual(["v", "=", "m", "/", "s"]);
  });
  it("keeps subscripted quantities and Greek letters whole", () => {
    expect(values("Eₖ = 12 J")).toEqual(["E", "ₖ", "=", "12", "J"]);
    expect(values("λ = 2 m")[0]).toBe("λ");
  });
});

describe("Physics diagrams", () => {
  it("builds each kind natively", () => {
    for (const t of ["freeBody", "circuit", "refraction", "wave", "fieldLines"]) {
      const n = diagramNode({ type: t }) as { content: { attrs: { family: string } }[] };
      expect(n.content[0].attrs.family).toBe("physicsEngine");
    }
  });
  it("keeps a plain geometry ray as geometry", () => {
    expect(classifyPhysicsDiagram("ray")).toBeNull();
    expect(classifyDiagram("ray")).toBe("geometry");
  });
  it("reads forces with directions", () => {
    const m = buildPhysicsDiagram({ type: "freeBody", forces: "Weight 20 N:down;Push 5 N:right" })!;
    expect(m.items.map((f) => f.dir)).toEqual(["down", "right"]);
  });
  it("accepts a correctly wired circuit", () => {
    const m = buildPhysicsDiagram({ type: "circuit", components: "cell:6 V;resistor:R;ammeter:A", parallel: "voltmeter:V:resistor" })!;
    expect(validateCircuit(m)).toEqual([]);
  });
  it("rejects an ammeter in parallel and a voltmeter in series", () => {
    const m = buildPhysicsDiagram({ type: "circuit", components: "cell:6 V;resistor:R;voltmeter:V", parallel: "ammeter:A:resistor" })!;
    const errs = validateCircuit(m);
    expect(errs.some((e) => /ammeter/i.test(e))).toBe(true);
    expect(errs.some((e) => /voltmeter/i.test(e))).toBe(true);
  });
  it("rejects a circuit with no cell", () => {
    const m = buildPhysicsDiagram({ type: "circuit", components: "resistor:R;lamp:L" })!;
    expect(validateCircuit(m).length).toBeGreaterThan(0);
  });
});

describe("Physics tables with Subcells", () => {
  it("derives working for a formula column with units in headings", () => {
    const sub = deriveSubcells(["V (V)", "I (A)", "R = V/I (Ω)"], [["6", "2", "3"], ["12", "3", "4"]]);
    expect(sub["0:2"]?.expr).toBe("6 ÷ 2");
    expect(sub["1:2"]?.expr).toBe("12 ÷ 3");
  });
  it("adds no working when the answer is wrong", () => {
    const sub = deriveSubcells(["V (V)", "I (A)", "R = V/I (Ω)"], [["6", "2", "5"]]);
    expect(sub["0:2"]).toBeUndefined();
  });
});
