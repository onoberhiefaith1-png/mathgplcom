import { describe, expect, it } from "vitest";
import { aiTextToNodes } from "@/lib/lessonnotes/aiToNodes";
import { geometryFromSpec, relationsHold } from "@/lib/lessonnotes/ai/geometryFromSpec";
import { duplicateProposal } from "@/lib/lessonnotes/ai/objectSource";

const geo = (nodes: any[]) => nodes.find((n) => n.type === "geometryDiagram");

describe("AI Edit rebuilds diagrams as native geometry", () => {
  it("triangle with labels, 60°, side length and unknown x", () => {
    const nodes = aiTextToNodes('[[tool:geometry points="A 0 4; B -3 0; C 3 0" segments="AB; BC; CA" angles="ABC 60°; BCA x" lengths="BC 6 cm" confidence="high"]]');
    const g = geo(nodes);
    expect(g).toBeTruthy();
    const objs = g.attrs.scene.objects;
    expect(objs.filter((o: any) => o.type === "point").map((o: any) => o.label)).toEqual(["A", "B", "C"]);
    expect(objs.filter((o: any) => o.type === "segment")).toHaveLength(3);
    expect(objs.find((o: any) => o.type === "segment" && o.distance === "6 cm")).toBeTruthy();
    expect(objs.filter((o: any) => o.type === "angle").map((o: any) => o.value)).toEqual(["60°", "x"]);
  });

  it("parallel lines and transversal stay parallel, also after duplication", () => {
    const text = '[[tool:geometry points="A 0 4; B 6 4.5; C 0 0; D 6 1; P 1 6; Q 5 -2" segments="AB; CD; PQ" parallel="AB CD" angles="BAQ x"]]';
    const g = geo(aiTextToNodes(text));
    expect(relationsHold(g.attrs.scene)).toBe(true);
    const copy = aiTextToNodes(duplicateProposal([g])!);
    expect(copy.filter((n) => n.type === "geometryDiagram")).toHaveLength(2);
    expect(relationsHold(copy[1].attrs.scene)).toBe(true);
    copy[1].attrs.scene.objects[0].x = 999;
    expect(copy[0].attrs.scene.objects[0].x).not.toBe(999);
  });

  it("content-first drawing plan creates a clean parallel-transversal diagram", () => {
    const nodes = aiTextToNodes('[[tool:drawingPlan kind="parallelTransversal" value="110°" unknown="x" confidence="high"]]');
    const g = geo(nodes);
    expect(g).toBeTruthy();
    expect(relationsHold(g.attrs.scene)).toBe(true);
    const objs = g.attrs.scene.objects;
    expect(objs.filter((o: any) => o.type === "segment")).toHaveLength(3);
    expect(objs.filter((o: any) => o.type === "angle").map((o: any) => o.value)).toEqual(["110°", "x"]);
  });

  it("normalises AI geometry aliases into native parallel-transversal geometry", () => {
    const nodes = aiTextToNodes('[[tool:geometry type="parallelLinesTransversal" angle1Label="110°" angle2Label="x" parallel="line1 line2" confidence="high"]]');
    const g = geo(nodes);
    expect(g).toBeTruthy();
    expect(relationsHold(g.attrs.scene)).toBe(true);
    const objs = g.attrs.scene.objects;
    expect(objs.filter((o: any) => o.type === "segment")).toHaveLength(3);
    expect(objs.filter((o: any) => o.type === "angle").map((o: any) => o.value)).toEqual(["110°", "x"]);
  });

  it("graph directives become editable graph objects", () => {
    const graph = aiTextToNodes('[[tool:drawingPlan kind="graph" equation="y = 2*x + 3" xMin="-2" xMax="2"]]')[0];
    expect(graph.type).toBe("smartGraph");
    expect(graph.attrs.connect).toBe("smooth");
    expect(graph.attrs.points.length).toBeGreaterThan(5);
  });

  it("flags unclear input instead of pretending certainty", () => {
    const r = geometryFromSpec({ points: "A; B; C", segments: "AB; BC; CA", unclear: "angle at C unreadable" })!;
    expect(r.review.confidence).toBe("medium");
    expect(r.review.unclear).toEqual(["angle at C unreadable"]);
  });

  it("duplicates a 4x4 table and a matrix as independent native objects", () => {
    const table = aiTextToNodes('[[tool:smartTable headers="a | b | c | d" rows="1 | 2 | 3 | 4 ; 5 | 6 | 7 | 8 ; 9 | 10 | 11 | 12"]]')[0];
    const out = aiTextToNodes(duplicateProposal([table])!);
    expect(out).toHaveLength(2);
    const cellsOf = (n: any) => n.content[0].attrs.attrs.cells;
    cellsOf(out[1])[0][0] = "changed";
    expect(cellsOf(out[0])[0][0]).toBe("1");

    const matrix = aiTextToNodes("\\begin{pmatrix}2 & 3 \\\\ 4 & 5\\end{pmatrix}")[0];
    const m = aiTextToNodes(duplicateProposal([matrix])!);
    const slot = (n: any) => n.content.find((c: any) => c.type === "mathStructure");
    expect(slot(m[1]).content.map((s: any) => s.content?.[0]?.text)).toEqual(["2", "3", "4", "5"]);
  });

  it("returns null for non-native selections", () => {
    expect(duplicateProposal([{ type: "paragraph", content: [{ type: "text", text: "hi" }] }])).toBeNull();
  });
});
