import { describe, expect, it } from "vitest";
import {
  arrangePuzzleTray, buildDiagramPuzzle, gradeDiagramPuzzle, puzzleChoices, puzzleSelection, puzzleTrayOrder,
  snapPlacement, snapRotation, transform, withPuzzleSelection, withPuzzleGroups, puzzleGroups, puzzleJointMarks, scorePuzzleJoints,
  diagramProgressSteps, evaluatePuzzleJoints, puzzleFrame, snapAuthoredPlacement,
  type Placement, type PuzzlePiece,
} from "../diagramPuzzle";
import type { GeometryScene } from "../scene";

const scene: GeometryScene = {
  bounds: { width: 320, height: 250 },
  meta: { caption: "A triangle" },
  objects: [
    { id: "a", type: "point", x: 40, y: 40, hidden: true },
    { id: "b", type: "point", x: 140, y: 40, hidden: true },
    { id: "c", type: "point", x: 140, y: 100, hidden: true },
    { id: "ab", type: "segment", a: "a", b: "b", distance: "45 cm" },
    { id: "bc", type: "segment", a: "b", b: "c" },
    { id: "ac", type: "segment", a: "a", b: "c" },
    { id: "right", type: "angle", a: "a", vertex: "b", b: "c", marker: "right" },
    { id: "fill", type: "region", boundary: ["a", "b", "c"], fill: "#7583aa" },
    { id: "label", type: "label", ownerId: "bc", x: 150, y: 70, text: "y" },
  ],
};
const choices = puzzleChoices(scene);
const everyChoice = choices.map((choice) => choice.id);
const solution = (pieces: PuzzlePiece[], pose: Placement = { x: 0, y: 0, angle: 0 }) =>
  new Map(pieces.map((piece) => [
    piece.id, { ...transform(piece.origin, { x: 0, y: 0 }, pose), angle: pose.angle },
  ]));

describe("Diagram Puzzle", () => {
  it("persists the selection and extracts values and attached labels from the right figure", () => {
    const saved = withPuzzleSelection(scene, everyChoice);
    expect(saved.meta?.caption).toBe("A triangle");
    expect(puzzleSelection(saved)).toEqual(everyChoice);
    expect(puzzleSelection(scene)).toEqual([]);
    const { pieces, scaffoldIds, textSockets } = buildDiagramPuzzle(saved, puzzleSelection(saved));
    expect(scaffoldIds).toEqual([]);
    const line = pieces.find((piece) => piece.visible.includes("ab"));
    expect(line?.scene.objects.find((object) => object.id === "ab")).toMatchObject({ distance: undefined });
    const value = pieces.find((piece) => piece.name === "45 cm");
    expect(value?.isText).toBe(true);
    expect(textSockets.map((socket) => socket.ownerId).sort()).toEqual(["ab", "bc"]);
    const attached = buildDiagramPuzzle(scene, [JSON.stringify(["ab"]), JSON.stringify(["bc"])]);
    expect(attached.pieces[0].scene.objects.find((object) => object.id === "ab")).toMatchObject({ distance: "45 cm" });
    expect(attached.pieces[1].visible).toEqual(["bc", "label"]);
    expect(attached.scaffoldIds).toEqual(["ac", "right", "fill"]);
  });

  it("accepts a translated and rotated reconstruction and rejects detached or missing objects", () => {
    const { pieces } = buildDiagramPuzzle(scene, everyChoice);
    const placements = solution(pieces, { x: 210, y: 30, angle: Math.PI / 3 });
    expect(gradeDiagramPuzzle(pieces, placements, false)).toBe(true);
    const text = pieces.find((piece) => piece.name === "45 cm")!;
    const previous = placements.get(text.id)!;
    placements.set(text.id, { ...previous, y: previous.y + 30 });
    expect(gradeDiagramPuzzle(pieces, placements, false)).toBe(false);
    placements.delete(text.id);
    expect(gradeDiagramPuzzle(pieces, placements, false)).toBe(false);
  });

  it("accepts exchange and endpoint reversal of indistinguishable segments", () => {
    const equivalent: GeometryScene = {
      ...scene,
      objects: [
        ...scene.objects.slice(0, 3),
        { id: "d", type: "point", x: 40, y: 100, hidden: true },
        { id: "ab", type: "segment", a: "a", b: "b" },
        { id: "dc", type: "segment", a: "d", b: "c" },
      ],
    };
    const { pieces } = buildDiagramPuzzle(equivalent, puzzleChoices(equivalent).map((choice) => choice.id));
    const placements = new Map([
      [pieces[0].id, { ...pieces[1].origin, angle: Math.PI }],
      [pieces[1].id, { ...pieces[0].origin, angle: Math.PI }],
    ]);
    expect(gradeDiagramPuzzle(pieces, placements, true)).toBe(true);
  });

  it("requires placement relative to the parts the teacher left on the board", () => {
    const { pieces } = buildDiagramPuzzle(scene, [JSON.stringify(["right"])]);
    expect(gradeDiagramPuzzle(pieces, solution(pieces), true)).toBe(true);
    expect(gradeDiagramPuzzle(pieces, solution(pieces, { x: 20, y: 0, angle: 0 }), true)).toBe(false);
    const placements = solution(pieces);
    placements.set(pieces[0].id, { ...pieces[0].origin, angle: Math.PI / 2 });
    expect(gradeDiagramPuzzle(pieces, placements, true)).toBe(false);
  });

  it("snaps to nearby vertices and rotates around an already connected endpoint", () => {
    const { pieces: [piece] } = buildDiagramPuzzle(scene, [JSON.stringify(["ab"])]);
    const pivot = { x: 40, y: 40 };
    expect(snapPlacement(piece, { x: 92, y: 42, angle: 0 }, [pivot], 8)).toEqual({ x: 90, y: 40, angle: 0 });
    const angle = 0.05;
    const moved = transform(piece.origin, pivot, { ...pivot, angle });
    const snapped = snapRotation(piece, { ...moved, angle }, pivot, [{ x: 140, y: 40 }], 8);
    expect(snapped.x).toBeCloseTo(90);
    expect(snapped.y).toBeCloseTo(40);
    expect(snapped.angle).toBeCloseTo(0);
  });
});

it("restores the teacher's shuffled order across attempts", () => {
  const pieceIds = everyChoice.slice(0, 3);
  const order = [pieceIds[2], pieceIds[0], pieceIds[1]];
  const saved = withPuzzleSelection(scene, pieceIds, order);
  const { pieces } = buildDiagramPuzzle(saved, puzzleSelection(saved));
  expect(arrangePuzzleTray(pieces, puzzleTrayOrder(saved)).map(({ id }) => id)).toEqual(order);
});

it("extracts an authored line and value as one rigid tray piece", () => {
  const line = JSON.stringify(["ab"]);
  const value = JSON.stringify(["ab", "distance"]);
  const saved = withPuzzleGroups(scene, [[line, value], [JSON.stringify(["bc"])]], 4);
  const { pieces, scaffoldIds } = buildDiagramPuzzle(saved, puzzleSelection(saved));
  expect(puzzleGroups(saved)).toEqual([[line, value], [JSON.stringify(["bc"])]]);
  expect(pieces).toHaveLength(2);
  expect(pieces[0].visible).toContain(value);
  expect(scaffoldIds).not.toContain("ab");
  expect(puzzleJointMarks(saved)).toBe(4);
});

it("scores authored joints live without counting them twice and accepts rotation", () => {
  const ids = ["ab", "bc", "ac"].map((id) => JSON.stringify([id]));
  const saved = withPuzzleGroups(scene, ids.map((id) => [id]), 2);
  const { pieces } = buildDiagramPuzzle(saved, puzzleSelection(saved));
  const placed = solution(pieces, { x: 250, y: 190, angle: Math.PI });
  placed.delete(ids[2]);
  expect(scorePuzzleJoints(pieces, placed, 2)).toEqual({ correct: 1, total: 3, earned: 2, available: 6 });
  const completed = solution(pieces, { x: 250, y: 190, angle: Math.PI });
  expect(scorePuzzleJoints(pieces, completed, 2)).toEqual({ correct: 3, total: 3, earned: 6, available: 6 });
});

it("expands the workspace on both axes for placed geometry and restores it after removal", () => {
  const ids = ["ab", "bc"].map((id) => JSON.stringify([id]));
  const saved = withPuzzleGroups(scene, ids.map((id) => [id]), 3);
  const puzzle = buildDiagramPuzzle(saved, puzzleSelection(saved));
  const placements = new Map<string, Placement>();
  const original = puzzleFrame(saved, puzzle, placements);
  placements.set(ids[0], { x: original.left - 100, y: original.top - 70, angle: 0 });
  const expanded = puzzleFrame(saved, puzzle, placements);
  expect(expanded.left).toBeLessThan(original.left);
  expect(expanded.top).toBeLessThan(original.top);
  expect(expanded.width).toBeGreaterThan(original.width);
  expect(expanded.height).toBeGreaterThan(original.height);
  placements.delete(ids[0]);
  expect(puzzleFrame(saved, puzzle, placements)).toEqual(original);
});

it("snaps an authored triangle joint by translation and keeps the saved orientation", () => {
  const ids = ["ab", "bc", "ac"].map((id) => JSON.stringify([id]));
  const saved = withPuzzleGroups(scene, ids.map((id) => [id]), 2);
  const { pieces } = buildDiagramPuzzle(saved, puzzleSelection(saved));
  const placements = solution(pieces);
  const first = placements.get(ids[0])!;
  placements.delete(ids[0]);
  expect(snapAuthoredPlacement(pieces[0], pieces, placements, { ...first, x: first.x + 4 }, [], 12))
    .toEqual(first);
  expect(evaluatePuzzleJoints(pieces, placements).filter((joint) => joint.correct)).toHaveLength(1);
  placements.set(ids[0], first);
  expect(evaluatePuzzleJoints(pieces, placements).every((joint) => joint.correct)).toBe(true);
});

it("counts three diagram joints as three steps after ten equation lines", () => {
  const lines = [...Array.from({ length: 10 }, () => ({ notebookOnly: false })), { notebookOnly: true }];
  const progress = diagramProgressSteps(lines, [{ row: 10, joints: ["A", "B", "C"] }]);
  expect(progress).toHaveLength(13);
  expect(progress.slice(10)).toEqual(["A", "B", "C"].map((joint) => ({ row: 10, joint })));
});
