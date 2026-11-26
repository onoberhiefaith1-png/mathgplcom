import { describe, expect, it } from "vitest";
import { aiTextToNodes } from "@/lib/lessonnotes/aiToNodes";
import { geometryFromSpec } from "@/lib/lessonnotes/ai/geometryFromSpec";
import type { GeometryScene, GeoPoint } from "@/lib/geometry/scene";
import {
  applyDiagramRows,
  bearingArc,
  bearingTurnDegrees,
  circleLineIntersections,
  elevationReference,
  journeyDisplacement,
  perpendicularBisector,
  planAiEditDiagram,
  preserveUnrelatedLines,
  questionView,
  referenceSides,
  reflectInYAxis,
  relocateModelDiagram,
} from "@/lib/lessonnotes/ai/aiEditDiagrams";

const point = (scene: GeometryScene, label: string) =>
  scene.objects.find((object) => object.type === "point" && object.label === label) as GeoPoint;

const diagramsIn = (text: string) =>
  aiTextToNodes(text).filter((node) => node.type === "geometryDiagram");

const BEARINGS = `Question 1
A ship sails 12 km from A to B on a bearing of 045°, then 9 km from B to C on a bearing of 135°. Find the distance AC and the bearing of AC.

Solution
Draw the north lines and the path.
Assign`;

describe("AI Edit diagram mathematics", () => {
  it("resolves the 045° then 135° journey as 15 km on 082°, with two north lines and a right angle", () => {
    const journey = journeyDisplacement([
      { km: 12, bearing: 45 },
      { km: 9, bearing: 135 },
    ]);
    expect(journey.distanceKm).toBeCloseTo(15, 5);
    expect(journey.bearingLabel).toBe("082");
    expect(bearingTurnDegrees(45, 135)).toBe(90);
    expect(bearingTurnDegrees(30, 80)).toBe(130);

    const plan = planAiEditDiagram({
      instruction: "Visualise the solution and correct the diagram",
      selection: BEARINGS,
    });
    expect(plan?.handledLocally).toBe(true);
    expect(plan?.category).toBe("solution");
    const scene = plan!.scene!;
    const northLines = scene.objects.filter((object) => object.type === "segment" && object.id.startsWith("north_"));
    expect(northLines).toHaveLength(2);
    expect(scene.objects.some((object) => object.type === "ray")).toBe(false);
    const a = point(scene, "A");
    const b = point(scene, "B");
    const c = point(scene, "C");
    const n1 = point(scene, "N1");
    const n2 = point(scene, "N2");
    expect(n1.x).toBeCloseTo(a.x, 1);
    expect(n1.y).toBeLessThan(a.y);
    expect(n2.x).toBeCloseTo(b.x, 1);
    expect(n2.y).toBeLessThan(b.y);
    const ba = { x: a.x - b.x, y: a.y - b.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    const dot = ba.x * bc.x + ba.y * bc.y;
    const scale = Math.hypot(ba.x, ba.y) * Math.hypot(bc.x, bc.y);
    expect(Math.abs(dot) / scale).toBeLessThan(0.02);
    expect(scene.objects.find((object) => object.type === "angle" && object.marker === "right")).toBeTruthy();
    expect(scene.objects.find((object) => object.type === "segment" && object.distance === "15 km")).toBeTruthy();

    const lines = plan!.proposal.split("\n");
    const solution = lines.findIndex((line) => line.trim() === "Solution");
    const draw = lines.findIndex((line) => line.includes("Draw the north lines"));
    const diagram = lines.findIndex((line) => line.startsWith("[[tool:"));
    expect(solution).toBeGreaterThanOrEqual(0);
    expect(draw).toBeGreaterThan(solution);
    expect(diagram).toBeGreaterThan(draw);
    expect(plan!.questionView).not.toContain("15 km");
    expect(plan!.questionView).not.toContain("082");
    expect(plan!.questionView).not.toContain("[[tool:");
    expect(diagramsIn(plan!.questionView)).toHaveLength(0);
    expect(diagramsIn(plan!.proposal)).toHaveLength(1);
    expect(plan!.proposal).toContain("Question 1");
    expect(plan!.proposal).toContain("Assign");

    const oblique = planAiEditDiagram({
      instruction: "Draw the journey",
      selection: "A ship sails 12 km from A to B on a bearing of 030°, then 9 km from B to C on a bearing of 080°.",
    });
    expect(oblique!.scene!.objects.some((object) => object.type === "angle" && object.marker === "right")).toBe(false);
  });

  it("draws a 315° bearing as a clockwise reflex arc, not the minor arc", () => {
    const arc = bearingArc(315);
    expect(arc.clockwiseSweep).toBe(315);
    expect(arc.reflex).toBe(true);
    expect(arc.minor).toBe(45);
    expect(arc.large).toBe(1);
    expect(arc.sweep).toBe(1);
    const acute = bearingArc(45);
    expect(acute.reflex).toBe(false);
    expect(acute.large).toBe(0);
    expect(acute.sweep).toBe(1);

    const plan = planAiEditDiagram({
      instruction: "Draw the bearing arc",
      selection: "Show the bearing 315° from north.",
    });
    const angle = plan!.scene!.objects.find((object) => object.type === "angle");
    expect(angle && angle.type === "angle" && angle.reflex).toBe(true);
    expect(angle && angle.type === "angle" && angle.value).toBe("315°");
    expect(plan!.questionView).not.toContain("[[tool:");
  });

  it("swaps opposite and adjacent when the reference angle changes, and measures elevation from the horizontal", () => {
    expect(referenceSides("A")).toEqual({
      opposite: "BC", adjacent: "AC", hypotenuse: "AB", rightAngleAt: "C",
    });
    expect(referenceSides("B")).toEqual({
      opposite: "AC", adjacent: "BC", hypotenuse: "AB", rightAngleAt: "C",
    });
    expect(elevationReference()).toBe("horizontal");

    const atB = planAiEditDiagram({
      instruction: "Correct the diagram",
      selection: "Triangle ABC is right-angled at C. Mark the reference angle at B and name the opposite and adjacent sides.",
    });
    const scene = atB!.scene!;
    const right = scene.objects.find((object) => object.type === "angle" && object.marker === "right");
    expect(right && right.type === "angle" && right.vertex).toBe("p_C");
    expect(scene.objects.find((object) => object.type === "segment" && object.distance === "hypotenuse")?.id).toBe("seg_AB");
    expect(scene.objects.find((object) => object.id === "seg_CA" && object.type === "segment") &&
      (scene.objects.find((object) => object.id === "seg_CA") as { distance?: string }).distance).toBe("opposite");
    expect((scene.objects.find((object) => object.id === "seg_CB") as { distance?: string }).distance).toBe("adjacent");

    const elevation = planAiEditDiagram({
      instruction: "Draw the diagram",
      selection: "The angle of elevation of the top of a tower from a point on the ground is θ.",
    });
    expect(elevation!.category).toBe("question");
    expect(elevation!.scene!.objects.some((object) => object.id === "horizontal" && object.type === "ray")).toBe(true);
    expect(elevation!.scene!.objects.some((object) => object.type === "angle" && object.marker === "right")).toBe(false);
  });

  it("makes a tangent touch the circle at exactly one point", () => {
    expect(circleLineIntersections({ x: 0, y: 0 }, 5, { x: 5, y: 0 }, { x: 0, y: 1 })).toBe(1);
    expect(circleLineIntersections({ x: 0, y: 0 }, 5, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(2);
    const plan = planAiEditDiagram({
      instruction: "Correct the diagram",
      selection: "A tangent touches a circle with centre O at T. The radius is drawn.",
    });
    const scene = plan!.scene!;
    const centre = point(scene, "O");
    const touch = point(scene, "T");
    const circle = scene.objects.find((object) => object.type === "circle");
    expect(circle && circle.type === "circle" && circle.r).toBeCloseTo(Math.hypot(touch.x - centre.x, touch.y - centre.y), 1);
    const up = point(scene, "U");
    const radius = { x: touch.x - centre.x, y: touch.y - centre.y };
    const tangent = { x: up.x - touch.x, y: up.y - touch.y };
    expect(Math.abs(radius.x * tangent.x + radius.y * tangent.y)).toBeLessThan(0.05);
  });

  it("reflects in x = 0 by negating x only, and keeps the image out of the question view", () => {
    expect(reflectInYAxis({ x: 1, y: 2 })).toEqual({ x: -1, y: 2 });
    expect(reflectInYAxis({ x: 3, y: 2 })).toEqual({ x: -3, y: 2 });
    expect(reflectInYAxis({ x: 1, y: 4 })).toEqual({ x: -1, y: 4 });
    const plan = planAiEditDiagram({
      instruction: "Draw the image",
      selection: "Reflect triangle ABC in the line x = 0. A(1, 2), B(3, 2), C(1, 4).",
    });
    expect(plan!.category).toBe("solution");
    const scene = plan!.scene!;
    const axis = point(scene, "Axis1");
    for (const [label, image] of [["A", "A'"], ["B", "B'"], ["C", "C'"]] as const) {
      const from = point(scene, label);
      const to = point(scene, image);
      expect((from.x + to.x) / 2).toBeCloseTo(axis.x, 1);
      expect(from.y).toBeCloseTo(to.y, 1);
    }
    expect(plan!.questionView).not.toContain("A'");
    expect(plan!.questionView).not.toContain("(-1, 2)");
    expect(plan!.questionView).not.toContain("(-3, 2)");
    expect(plan!.questionView).not.toContain("[[tool:");
    expect(plan!.proposal).toContain("(-1, 2)");
    expect(diagramsIn(plan!.questionView)).toHaveLength(0);
    expect(diagramsIn(plan!.proposal)).toHaveLength(1);
  });

  it("keeps both equal compass arcs on a perpendicular bisector", () => {
    const facts = perpendicularBisector({ x: 0, y: 0 }, { x: 6, y: 0 });
    expect(facts.radius).toBeGreaterThan(facts.half);
    expect(facts.intersections).toHaveLength(2);
    expect(facts.perpendicular).toBe(true);
    expect(facts.arcsKept).toBe(true);
    const plan = planAiEditDiagram({
      instruction: "Draw the construction",
      selection: "Construct the perpendicular bisector of AB.",
    });
    const scene = plan!.scene!;
    const circles = scene.objects.filter((object) => object.type === "circle");
    expect(circles).toHaveLength(2);
    expect(circles.every((circle) => circle.type === "circle" && circle.dashed && circle.r > 0)).toBe(true);
    expect(circles[0].type === "circle" && circles[1].type === "circle" && circles[0].r).toBeCloseTo(
      circles[1].type === "circle" ? circles[1].r : 0,
      2,
    );
    const a = point(scene, "A");
    const b = point(scene, "B");
    const m = point(scene, "M");
    const p = point(scene, "P");
    const q = point(scene, "Q");
    const radius = circles[0].type === "circle" ? circles[0].r : 0;
    expect(radius).toBeGreaterThan(Math.hypot(b.x - a.x, b.y - a.y) / 2);
    const cross = (p.x - m.x) * (q.y - m.y) - (p.y - m.y) * (q.x - m.x);
    expect(Math.abs(cross)).toBeLessThan(1);
    const bisector = { x: q.x - p.x, y: q.y - p.y };
    const segment = { x: b.x - a.x, y: b.y - a.y };
    const denom = Math.hypot(bisector.x, bisector.y) * Math.hypot(segment.x, segment.y);
    expect(Math.abs(bisector.x * segment.x + bisector.y * segment.y) / denom).toBeLessThan(0.02);
    expect(plan!.proposal).toContain("Keep both arcs");
  });

  it("edits an existing diagram in place and keeps unrelated content", () => {
    const selection = `${BEARINGS}\n[[tool:geometry points="A 0 0; B 1 0; C 2 0"]]`;
    const plan = planAiEditDiagram({
      instruction: "Correct the diagram and add the missing north lines",
      selection,
      selectionJson: {
        type: "geometryDiagram",
        attrs: {
          diagramId: "diagram-kept",
          scene: {
            bounds: { width: 360, height: 260 },
            objects: [
              { id: "p_A", type: "point", x: 10, y: 10, label: "A" },
              { id: "keep", type: "label", x: 4, y: 4, text: "keep me" },
            ],
          },
        },
      },
    });
    const scene = plan!.scene!;
    expect(scene.objects.find((object) => object.type === "label" && object.text === "keep me")).toBeTruthy();
    expect(scene.objects.filter((object) => object.type === "segment" && object.id.startsWith("north_"))).toHaveLength(2);
    expect(point(scene, "A").x).not.toBe(10);
    expect(plan!.proposal.match(/\[\[tool:/g)).toHaveLength(1);
    expect(plan!.proposal).toContain("diagram-kept");
    expect(plan!.proposal).toContain("Assign");
    expect(plan!.proposal).toContain("Question 1");
    expect(diagramsIn(plan!.proposal)).toHaveLength(1);
  });

  it("does not invent a diagram when the measurements are missing", () => {
    const plan = planAiEditDiagram({
      instruction: "Draw the triangle",
      selection: "Draw triangle ABC.",
    });
    expect(plan?.blockModel).toBe(true);
    expect(plan?.proposal).not.toContain("[[tool:");
    expect(plan?.flag).toMatch(/not drawn/i);
  });

  it("moves a model solution figure under the Solution heading and keeps Assign", () => {
    const moved = relocateModelDiagram(
      "Given triangle ABC.\n[[tool:geometry points=\"A 0 0\"]]\nSolution\nDraw the altitude.",
      "draw the construction",
    );
    expect(moved.indexOf("Solution")).toBeLessThan(moved.indexOf("Draw the altitude"));
    expect(moved.indexOf("Draw the altitude")).toBeLessThan(moved.indexOf("[[tool:geometry"));
    expect(moved.slice(0, moved.indexOf("Solution"))).not.toContain("[[tool:");
    expect(questionView(moved)).not.toContain("[[tool:");

    const given = relocateModelDiagram(
      "[[tool:geometry points=\"A 0 0\"]]\nSolution\nWorking.",
      "draw the question diagram",
    );
    expect(given.startsWith("[[tool:")).toBe(true);

    const selection = "Question 1\nFind x.\nAssign";
    expect(preserveUnrelatedLines(selection, "x = 4")).toContain("Assign");
    expect(preserveUnrelatedLines(selection, "x = 4")).toContain("Question 1");
  });

  it("places a solution figure after the Solution heading even when the highlight has no solution yet", () => {
    const plan = planAiEditDiagram({
      instruction: "Visualise the solution",
      selection: "A ship sails 12 km from A to B on a bearing of 045°, then 9 km from B to C on a bearing of 135°.",
    });
    const rows = applyDiagramRows(
      [{ id: "q", kind: "text", text: "A ship sails 12 km from A to B on a bearing of 045°, then 9 km from B to C on a bearing of 135°." }],
      { category: "solution", scene: plan!.scene!, steps: plan!.steps },
    );
    const solution = rows.findIndex((row) => row.kind === "heading" && row.text === "Solution");
    expect(solution).toBeGreaterThanOrEqual(0);
    expect(rows.slice(0, solution).some((row) => row.kind === "diagram")).toBe(false);
    expect(rows.slice(solution).some((row) => row.kind === "diagram")).toBe(true);
    expect(rows.slice(0, solution).some((row) => row.text.includes("15 km"))).toBe(false);
  });

  it("keeps a reflex angle and a dashed construction circle editable geometry", () => {
    const reflex = geometryFromSpec({
      points: "A 0 0; N 0 4; D -2 2",
      rays: "AN; AD",
      angles: "NAD 315° reflex",
    });
    const angle = reflex!.scene.objects.find((object) => object.type === "angle");
    expect(angle && angle.type === "angle" && angle.reflex).toBe(true);
    const dashed = geometryFromSpec({ points: "O 0 0", circles: "O 3 dashed" });
    const circle = dashed!.scene.objects.find((object) => object.type === "circle");
    expect(circle && circle.type === "circle" && circle.dashed).toBe(true);
  });
});
