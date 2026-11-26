import { describe, expect, it } from "vitest";
import { aiTextToNodes } from "@/lib/lessonnotes/aiToNodes";
import { placeComputedDiagram } from "@/lib/lessonnotes/ai/aiEditDiagrams";
import {
  centreFromCircumference,
  circumferenceFromCentre,
  distanceOf,
  enlargeFrom,
  frequencyDensity,
  gateExternalScene,
  gradientOf,
  oppositeCyclicAngle,
  pieAngle,
  rotateAboutOrigin,
  translateBy,
  vectorAdd,
} from "@/lib/lessonnotes/ai/topicScenes";

const placed = (source: string, section: "question" | "solution" | "teaching" | "document" = "document") =>
  placeComputedDiagram({ source, section });

describe("remaining classroom diagrams", () => {
  it("draws circle theorems from the stated angle", () => {
    expect(centreFromCircumference(35)).toBe(70);
    expect(circumferenceFromCentre(80)).toBe(40);
    expect(oppositeCyclicAngle(70)).toBe(110);
    const centre = placed("The angle at the circumference is 35°. Find the angle at the centre of the circle.");
    expect(centre?.valid).toBe(true);
    expect(centre?.text).toContain("70°");
    expect(centre?.questionView).not.toContain("70°");
    const same = placed("Angles in the same segment. One of them is 42°.");
    expect(same?.text).toContain("42°");
    const semi = placed("Find the angle in a semicircle with diameter AB.");
    expect(semi?.scene?.objects.some((object) => object.type === "angle" && object.marker === "right")).toBe(true);
    const cyclic = placed("ABCD is a cyclic quadrilateral. Angle A is 70°. Find the opposite angle.");
    expect(cyclic?.text).toContain("110°");
    const alternate = placed("The alternate segment theorem. The angle between the tangent and the chord is 50°.");
    expect(alternate?.text).toContain("50°");
    const clash = placed("The angle at the centre is 80° and the angle at the circumference is 30°.");
    expect(clash?.valid).toBe(false);
    expect(clash?.scene).toBeNull();
  });

  it("draws a coordinate triangle, a rotation, a translation and an enlargement", () => {
    expect(gradientOf({ x: 1, y: 2 }, { x: 4, y: 6 })).toBeCloseTo(4 / 3, 5);
    expect(distanceOf({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(rotateAboutOrigin({ x: 1, y: 2 }, 1)).toEqual({ x: -2, y: 1 });
    expect(translateBy({ x: 1, y: 2 }, { x: 3, y: -1 })).toEqual({ x: 4, y: 1 });
    expect(enlargeFrom({ x: 2, y: 2 }, { x: 0, y: 0 }, 2)).toEqual({ x: 4, y: 4 });
    const triangle = placed("Find the gradient and the distance AB for A(0, 0), B(3, 0) and C(0, 4).");
    expect(triangle?.valid).toBe(true);
    expect(triangle?.text).toContain("Gradient of AB = 0");
    expect(triangle?.text).toContain("Distance AB = 3");
    expect(triangle?.scene?.objects.some((object) => object.type === "angle" && object.marker === "right")).toBe(true);
    const rotation = placed("Rotate A(1, 2) through 90° anticlockwise about the origin.");
    expect(rotation?.text).toContain("A'(-2, 1)");
    const translation = placed("Translate A(1, 2) by the vector (3, -1).");
    expect(translation?.text).toContain("A'(4, 1)");
    const enlargement = placed("Enlarge A(2, 2) with scale factor 2, centre (0, 0).");
    expect(enlargement?.text).toContain("A'(4, 4)");
    expect(placed("Rotate the triangle about the origin.")?.valid).toBe(false);
  });

  it("adds vectors, an angle bisector, loci, a net and a cross-section", () => {
    expect(vectorAdd({ x: 2, y: 3 }, { x: 5, y: 1 })).toEqual({ x: 7, y: 4 });
    const vectors = placed("Add the vectors a = (2, 3) and b = (5, 1).");
    expect(vectors?.text).toContain("(7, 4)");
    expect(vectors?.scene?.objects.some((object) => object.type === "segment" && object.arrow === "end")).toBe(true);
    const bisector = placed("Construct the angle bisector of angle ABC.");
    expect(bisector?.valid).toBe(true);
    expect(bisector?.scene?.objects.some((object) => object.type === "arc" && object.dashed)).toBe(true);
    const line = placed("Draw the locus of points equidistant from points A and B.");
    expect(line?.scene?.objects.some((object) => object.type === "line" && object.dashed)).toBe(true);
    const circle = placed("Draw the locus of points 5 cm from a point O.");
    expect(circle?.scene?.objects.some((object) => object.type === "circle" && object.dashed && object.r > 0)).toBe(true);
    const net = placed("Draw the net of a cube.");
    expect(net?.scene?.objects.filter((object) => object.type === "polygon")).toHaveLength(6);
    const section = placed("Draw the cross-section of a cylinder perpendicular to its axis.");
    expect(section?.scene?.objects.some((object) => object.type === "circle" && object.r > 0)).toBe(true);
    expect(placed("Draw the cross-section of a cylinder.")?.valid).toBe(false);
  });

  it("checks histograms, pie angles, cumulative readings, graphs, Venn diagrams and trees", () => {
    expect(frequencyDensity(15, 10)).toBe(1.5);
    expect(pieAngle(1, 4)).toBe(90);
    const histogram = placed("Draw a histogram. 0-10 frequency 5. 10-20 frequency 15.");
    expect(histogram?.valid).toBe(true);
    expect(histogram?.text).toContain("0.5");
    expect(histogram?.text).toContain("1.5");
    const pie = placed("Draw a pie chart. Red 1. Blue 3.");
    expect(pie?.text).toContain("90");
    expect(pie?.text).toContain("270");
    const curve = placed("Plot the cumulative frequency: 10, 4 and 20, 12. Draw the reading at 15.");
    expect(curve?.scene?.objects.some((object) => object.type === "segment" && object.dashed)).toBe(true);
    const graph = placed("Sketch the graph of y = 1/x and mark the asymptote.");
    expect(graph?.valid).toBe(true);
    expect(graph?.text).toContain("not joined");
    const venn = placed("30 students in all. 18 study Maths. 12 study Science. 5 do both. Draw the Venn diagram.");
    expect(venn?.text).toContain("A only = 13");
    expect(venn?.text).toContain("neither = 5");
    const tree = placed("Draw a probability tree with branches 1/2 and 1/2.");
    expect(tree?.valid).toBe(true);
    expect(placed("Draw a probability tree with branches 1/2 and 1/4.")?.valid).toBe(false);
  });

  it("refuses an unchecked engine scene and still builds a solution figure for AI Edit", () => {
    expect(gateExternalScene({ bounds: { width: 10, height: 10 }, objects: [{ id: "A", type: "point", x: 1, y: 1, label: "A" }] }).ok).toBe(false);
    const solution = placed("The angle in a semicircle with diameter AB. Find the angle.", "question");
    expect(solution?.withheld).toBe(true);
    expect(solution?.questionView).not.toContain("[[tool:");
    const nodes = aiTextToNodes('[[tool:graph equation="y = 1/x" xMin="-4" xMax="4"]]');
    expect(nodes[0].attrs.connect).toBe("scatter");
    expect(nodes[0].attrs.functions[0].expression).toBe("1/x");
    expect(nodes[0].attrs.shapes.some((shape: { label?: string }) => shape.label === "asymptote")).toBe(true);
    const line = aiTextToNodes('[[tool:graph equation="y = 2*x + 3" xMin="-2" xMax="2"]]');
    expect(line[0].attrs.connect).toBe("smooth");
    expect(line[0].attrs.points.length).toBeGreaterThan(5);
  });
});
