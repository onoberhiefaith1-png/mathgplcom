import { describe, expect, it } from "vitest";
import { aiTextToNodes } from "@/lib/lessonnotes/aiToNodes";
import {
  placeComputedDiagram,
  validateDiagramScene,
} from "@/lib/lessonnotes/ai/aiEditDiagrams";

const diagramsIn = (text: string) =>
  aiTextToNodes(text).filter((node) => node.type === "geometryDiagram");

const BEARINGS = `A ship sails 12 km from A to B on a bearing of 045°, then 9 km from B to C on a bearing of 135°. Find the distance AC and the bearing of AC.

Solution
Draw the north lines and the path.`;

describe("section generation and pasted diagrams", () => {
  it("keeps a solution construction out of a generated question", () => {
    const question = "A ship sails 12 km from A to B on a bearing of 045°, then 9 km from B to C on a bearing of 135°. Find AC.";
    const placed = placeComputedDiagram({ source: question, section: "question" });
    expect(placed?.withheld).toBe(true);
    expect(placed?.category).toBe("solution");
    expect(placed?.valid).toBe(true);
    expect(placed?.text).not.toContain("[[tool:");
    expect(placed?.text).not.toContain("15 km");
    expect(placed?.questionView).not.toContain("082");
    expect(validateDiagramScene(placed!.scene!, "Bearings journey").ok).toBe(true);
  });

  it("puts the same construction inside a generated solution, at the step that uses it", () => {
    const placed = placeComputedDiagram({
      source: BEARINGS,
      section: "solution",
      body: "Draw the north lines and the path.\nCalculate AC.",
    });
    expect(placed?.category).toBe("solution");
    expect(placed?.valid).toBe(true);
    expect(placed?.text.startsWith("Solution")).toBe(false);
    const lines = placed!.text.split("\n");
    const draw = lines.findIndex((line) => line.includes("Draw the north lines"));
    const diagram = lines.findIndex((line) => line.startsWith("[[tool:"));
    expect(diagram).toBeGreaterThan(draw);
    expect(placed?.text).toContain("15 km");
    expect(placed?.text).toContain("082");
    expect(diagramsIn(placed!.text)).toHaveLength(1);
    expect(validateDiagramScene(placed!.scene!, placed!.category).ok).toBe(true);
  });

  it("reconstructs a pasted bearings note inside the Solution and flags a figure with no measurements", () => {
    const pasted = placeComputedDiagram({ source: BEARINGS, section: "document" });
    expect(pasted?.valid).toBe(true);
    const lines = pasted!.text.split("\n");
    const solution = lines.findIndex((line) => line.trim() === "Solution");
    const diagram = lines.findIndex((line) => line.startsWith("[[tool:"));
    expect(diagram).toBeGreaterThan(solution);
    expect(pasted?.questionView).not.toContain("[[tool:");
    expect(pasted?.questionView).not.toContain("15 km");
    expect(diagramsIn(pasted!.questionView)).toHaveLength(0);
    expect(diagramsIn(pasted!.text)).toHaveLength(1);

    const missing = placeComputedDiagram({
      source: "In the diagram, triangle ABC. Find x.",
      section: "document",
    });
    expect(missing?.valid).toBe(false);
    expect(missing?.scene).toBeNull();
    expect(missing?.flag).toMatch(/not (drawn|reconstructed)/i);
    expect(missing?.text).not.toContain("[[tool:");
  });

  it("moves a figure the model left above the Solution back into the Solution", () => {
    const pasted = placeComputedDiagram({
      source: `[[tool:geometry points="A 0 0; B 1 0; C 1 1"]]\n${BEARINGS}`,
      section: "document",
    });
    const lines = pasted!.text.split("\n");
    const solution = lines.findIndex((line) => line.trim() === "Solution");
    const diagram = lines.findIndex((line) => line.startsWith("[[tool:"));
    expect(diagram).toBeGreaterThan(solution);
    expect(lines.slice(0, solution).join("\n")).not.toContain("[[tool:");
    expect(pasted?.text.match(/\[\[tool:/g)).toHaveLength(1);
  });

  it("keeps a teaching diagram with the explanation", () => {
    const placed = placeComputedDiagram({
      source: "The angle of elevation of the top of a tower from a point on the ground is 30°.",
      section: "teaching",
    });
    expect(placed?.category).toBe("teaching");
    expect(placed?.valid).toBe(true);
    expect(placed?.text).not.toMatch(/^Solution$/m);
    expect(placed?.scene?.objects.some((object) => object.id === "horizontal")).toBe(true);
    expect(validateDiagramScene(placed!.scene!, "elevation").ok).toBe(true);
    expect(diagramsIn(placed!.text)).toHaveLength(1);
  });

  it("validates a question tangent before it is inserted", () => {
    const placed = placeComputedDiagram({
      source: "A tangent touches a circle with centre O at T. The radius is drawn.",
      section: "question",
    });
    expect(placed?.category).toBe("question");
    expect(placed?.withheld).toBe(false);
    expect(placed?.valid).toBe(true);
    expect(validateDiagramScene(placed!.scene!, "tangent").ok).toBe(true);
    expect(placed?.questionView).toContain("[[tool:");
  });
});
