import { describe, expect, it } from "vitest";
import { buildDiagramPuzzle, gradeDiagramPuzzle, puzzleChoices, withPuzzleGroups } from "@/lib/geometry/diagramPuzzle";
import { toData } from "./digitalView";
import { graphPuzzleFrame, readPuzzleScene, tableGraphSnapshot } from "./graphPuzzle";

describe("lesson-note graph puzzles", () => {
  it("preserves table data, axis labels and the graph's world coordinates", () => {
    const graph = tableGraphSnapshot([{ x: 2, y: 7 }, { x: 4, y: -3 }], "time", "velocity", "smooth");
    expect(graph.points).toEqual([{ x: 2, y: 7 }, { x: 4, y: -3 }]);
    expect([graph.xLabel, graph.yLabel, graph.connect]).toEqual(["time", "velocity", "smooth"]);
    const attrs = { ...graph, shapes: [{ id: "tangent", kind: "line", pts: [{ x: 2, y: 7 }, { x: 4, y: -3 }] }] };
    const frame = graphPuzzleFrame(attrs);
    const scene = readPuzzleScene("smartGraph", attrs)!;
    const point = scene.objects.find((object) => object.type === "point");
    if (point?.type !== "point") throw new Error("Missing anchor");
    const world = toData(point.x, point.y, frame.view, frame.width, frame.height);
    expect(world.x).toBeCloseTo(2);
    expect(world.y).toBeCloseTo(7);
    expect(puzzleChoices(scene).map(({ objectId }) => objectId)).toEqual(["graph-shape:tangent"]);
  });

  it("keeps a tangent and a gradient triangle separate and grades them in graph coordinates", () => {
    const attrs = { ...tableGraphSnapshot([{ x: 0, y: 0 }], "x", "y", "straight"), shapes: [
      { id: "tangent", kind: "line", pts: [{ x: 1, y: 1 }, { x: 4, y: 4 }] },
      { id: "triangle", kind: "polygon", pts: [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }] },
    ] };
    const draft = readPuzzleScene("smartGraph", attrs)!;
    const ids = puzzleChoices(draft).map(({ id }) => id);
    const saved = withPuzzleGroups(draft, ids.map((id) => [id]), 2);
    const scene = readPuzzleScene("smartGraph", { ...attrs, scene: saved })!;
    const puzzle = buildDiagramPuzzle(scene, ids);
    expect(puzzle.pieces).toHaveLength(2);
    expect(puzzle.scaffoldIds).toEqual([]);
    const atReference = new Map(puzzle.pieces.map((piece) => [piece.id, { ...piece.origin, angle: 0 }]));
    expect(gradeDiagramPuzzle(puzzle.pieces, atReference, true)).toBe(true);
    const elsewhere = new Map(puzzle.pieces.map((piece) => [piece.id, { x: piece.origin.x + 30, y: piece.origin.y, angle: 0 }]));
    expect(gradeDiagramPuzzle(puzzle.pieces, elsewhere, true)).toBe(false);
  });
});
