import { describe, expect, it } from "vitest";
import { interpret } from "../interpret";
import { parseSolid, solidMeasures, validSolid, type Solid } from "../solids";
import { validateGraph, type SavedGraph } from "../savedGraphs";
function solid(s: string): Solid { const result = parseSolid(s); if (!result) throw Error("Not a solid"); return result; }
const measure = (s: Solid, label: string) => solidMeasures(s).find(m => m.label === label)?.value;
describe("Stage 16 solids", () => {
  it("builds the requested cube with side 5 cm", () => {
    const s = solid("cube with side 5 cm");
    expect(s.dimensions).toEqual([5]); expect(s.unit).toBe("cm");
    expect(measure(s,"Volume")).toBe(125); expect(measure(s,"Surface area")).toBe(150);
    expect(measure(s,"Space diagonal")).toBeCloseTo(5*Math.sqrt(3),12);
    expect(measure(s,"Base face diagonal")).toBeCloseTo(5*Math.sqrt(2),12);
    expect(interpret("cube with side 5 cm")).toEqual({ kind: "solid", solid: s });
  });
  it("retains proportions for a cuboid and reordered labels", () => {
    const s = solid("cuboid width 4 cm height 5 cm length 3 cm");
    expect(s.dimensions).toEqual([3,4,5]); expect(measure(s,"Volume")).toBe(60);
    expect(measure(s,"Surface area")).toBe(94); expect(measure(s,"Space diagonal")).toBeCloseTo(Math.sqrt(50),12);
    expect(solid("rectangular prism 3 × 4 × 5 cm").dimensions).toEqual([3,4,5]);
  });
  it("converts mixed units before calculating", () => {
    const s = solid("cuboid length 5 cm width 20 mm height 0.1 m");
    expect(s.dimensions).toEqual([5,2,10]); expect(measure(s,"Volume")).toBe(100);
  });
  it("calculates spheres from radius or diameter", () => {
    const s = solid("sphere diameter 6 cm"); expect(s.dimensions).toEqual([3]);
    expect(measure(s,"Volume")).toBeCloseTo(36*Math.PI,12); expect(measure(s,"Surface area")).toBeCloseTo(36*Math.PI,12);
    expect(measure(s,"Diameter")).toBe(6); expect(measure(s,"Space diagonal")).toBeUndefined();
  });
  it("includes both cylinder bases and the axial section diagonal", () => {
    const s = solid("cylinder radius 3 cm height 8 cm");
    expect(measure(s,"Volume")).toBeCloseTo(72*Math.PI,12); expect(measure(s,"Surface area")).toBeCloseTo(66*Math.PI,12);
    expect(measure(s,"Axial-section diagonal")).toBe(10);
  });
  it("calculates a cone slant before surface area", () => {
    const s = solid("cone radius 3 cm height 4 cm");
    expect(measure(s,"Slant height")).toBe(5); expect(measure(s,"Volume")).toBeCloseTo(12*Math.PI,12); expect(measure(s,"Surface area")).toBeCloseTo(24*Math.PI,12);
  });
  it.each(["cube side 0 cm", "cube side -5 cm", "cuboid 3 4 cm", "cube side 5 inches", "cube side 5 cm side 6 cm", "sphere radius 3 cm diameter 6 cm", "cone height 4 cm height 3 cm", "cube side 5 cm height 8 cm"])("rejects invalid or ambiguous dimensions: %s", input => expect(() => parseSolid(input)).toThrow());
  it("does not intercept equations or concept entry", () => { expect(parseSolid("y = x^3")).toBeNull(); expect(interpret("eigenvalues").kind).toBe("concept"); expect(interpret("cube").kind).toBe("error"); });
  it("accepts valid saved solids and rejects malformed ones", () => {
    const s = solid("cube side 5 cm");
    const g: SavedGraph = { version:1,id:"solid",name:"Cube",savedAt:"2026-10-12",snapshot:{ equations:[],mode:"3D",view:{cx:0,cy:0,scale:40},grid:true,axes:true,labels:true,ndN:4,ndAngle:0,matrices:{a:[[1,0],[0,1]],b:[[1,0],[0,1]]},calculus:{src:"y = x^2",x:0,lower:0,upper:1},solid:s } };
    expect(validateGraph(JSON.parse(JSON.stringify(g))).snapshot.solid).toEqual(s);
    expect(() => validateGraph({...g,snapshot:{...g.snapshot,solid:{...s,dimensions:[0]}}})).toThrow();
    expect(validSolid({...s,unit:"inches"})).toBe(false);
  });
});