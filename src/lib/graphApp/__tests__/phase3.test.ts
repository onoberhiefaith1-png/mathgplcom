import { describe, it, expect } from "vitest";
import { differentiate, integrate, matrixOperation, squareEquation, tangent, transformedSquare } from "../operations";
import { parseEquation } from "../math";
import { graphStorageKey, readGraphs, validateGraph, writeGraphs, type SavedGraph } from "../savedGraphs";
const a = [[1, 2], [3, 4]], identity = [[1, 0], [0, 1]];
const graph: SavedGraph = { version: 1, id: "g1", name: "Parabola", savedAt: "2026-10-11", snapshot: { equations: [{ src: "y = x^2", colour: "#2563eb", hidden: true }], mode: "2D", view: { cx: 2, cy: 3, scale: 40 }, grid: false, axes: true, labels: false, ndN: 4, ndAngle: 0.4, matrices: { a, b: identity }, calculus: { src: "y = x^2", x: 2, lower: 0, upper: 3 } } };
describe("Phase 3 matrices", () => {
 it("calculates determinant, transpose, inverse and product", () => {
  expect(matrixOperation(a, identity, "det")).toBe(-2);
  expect(matrixOperation(a, identity, "transpose")).toEqual([[1, 3], [2, 4]]);
  expect(matrixOperation(a, identity, "inverse")).toEqual([[-2, 1], [1.5, -0.5]]);
  expect(matrixOperation(a, identity, "multiply")).toEqual(a);
 });
 it("supports 3×3 determinant", () => expect(matrixOperation([[2, 0, 0], [0, 3, 0], [0, 0, 4]], identity, "det")).toBe(24));
 it("rejects singular matrices and incompatible dimensions", () => {
  expect(() => matrixOperation([[1, 2], [2, 4]], identity, "inverse")).toThrow(/singular/);
  expect(() => matrixOperation(a, [[1, 0, 0], [0, 1, 0], [0, 0, 1]], "multiply")).toThrow(/dimensions/);
 });
 it("transforms a square by scaling and shear", () => {
  const points = transformedSquare([[2, 1], [0, 3]]);
  expect(points).toEqual([[0, 0], [2, 0], [3, 3], [1, 3], [0, 0]]);
  const eq = parseEquation(squareEquation([[2, 1], [0, 3]]));
  expect(eq.kind).toBe("parametric");
  if (eq.kind === "parametric") { expect(eq.fx({ t: 2 })).toBe(3); expect(eq.fy({ t: 2 })).toBe(3); }
 });
});
describe("Phase 3 calculus", () => {
 it("symbolically differentiates cubic", () => { const eq = parseEquation(`y = ${differentiate("y = x^3")}`); if (eq.kind !== "curve2d") throw Error("invalid derivative"); expect(eq.f({ x: 2 })).toBe(12); });
 it("finds a tangent slope and point", () => { const t = tangent("y = x^2", 2); expect(t.slope).toBe(4); expect(t.value).toBe(4); });
 it("rejects undefined tangents and corners", () => { expect(() => tangent("y = abs(x)", 0)).toThrow(); expect(() => tangent("y = 1/x", 0)).toThrow(); });
 it("integrates x squared and reverses sign with bounds", () => { expect(integrate("y = x^2", 0, 3).value).toBeCloseTo(9, 8); expect(integrate("y = x^2", 3, 0).value).toBeCloseTo(-9, 8); });
 it("rejects an interval crossing a pole or invalid domain", () => { expect(() => integrate("y = 1/x", -1, 1)).toThrow(); expect(() => integrate("y = sqrt(x)", -1, 1)).toThrow(); });
});
describe("Phase 3 saved graphs", () => {
 it("round-trips complete graph settings", () => { const data = new Map<string, string>(); const store = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } }; writeGraphs(store, graphStorageKey("teacher1", "school1"), [graph]); expect(readGraphs(store, graphStorageKey("teacher1", "school1"))).toEqual([graph]); expect(readGraphs(store, graphStorageKey("teacher2", "school1"))).toEqual([]); expect(readGraphs(store, graphStorageKey("teacher1", "school2"))).toEqual([]); });
 it("rejects invalid imported equations and settings", () => { expect(() => validateGraph({ ...graph, snapshot: { ...graph.snapshot, equations: [{ src: "y = banana", colour: "#2563eb", hidden: false }] } })).toThrow(); expect(() => validateGraph({ ...graph, snapshot: { ...graph.snapshot, view: { cx: 0, cy: 0, scale: 0 } } })).toThrow(); });
});
