import type { AssetDef } from "./types";

const V = (
  id: string,
  label: string,
  visual: string,
  group: string,
  keywords: string[],
  attrs: Record<string, unknown> = {},
): AssetDef => ({
  id,
  label,
  category: "Diagrams",
  group,
  keywords: [id, label.toLowerCase(), ...keywords],
  render: { kind: "visual", visual, attrs: { variant: id, ...attrs } },
});

export const DIAGRAMS: AssetDef[] = [
  // Lines & Angles — all routed through the Universal Line Engine.
  // Tiles keep their classic pictograms; the engine seeds either "line" or "angle".
  V("lineSegment", "Line segment", "lineEngine", "Lines & Angles", ["line", "segment"], { preset: "line" }),
  V("ray", "Ray / vector line", "lineEngine", "Lines & Angles", ["ray", "vector", "arrow"], { preset: "line" }),
  V("intersectingLines", "Intersecting lines", "lineEngine", "Lines & Angles", ["cross", "vertical angles"], { preset: "line" }),
  V("parallelTransversal", "Parallel lines w/ transversal", "lineEngine", "Lines & Angles", ["parallel", "alternate"], { preset: "line" }),
  V("angleAcute", "Angle (acute)", "lineEngine", "Lines & Angles", ["angle"], { preset: "angle" }),
  V("angleObtuse", "Angle (obtuse)", "lineEngine", "Lines & Angles", ["angle"], { preset: "angle" }),
  V("angleReflex", "Angle (reflex)", "lineEngine", "Lines & Angles", ["angle"], { preset: "angle" }),
  V("angleRight", "Angle (right)", "lineEngine", "Lines & Angles", ["angle", "90"], { preset: "angle" }),

  // Triangles
  V("triangleRight", "Triangle (right-angled)", "shape", "Triangles", ["triangle", "right"]),
  V("triangleIso", "Triangle (isosceles)", "shape", "Triangles", ["triangle"]),
  V("triangleEqui", "Triangle (equilateral)", "shape", "Triangles", ["triangle"]),
  V("triangleScalene", "Triangle (scalene)", "shape", "Triangles", ["triangle"]),
  V("triangleHyp", "Triangle (on hypotenuse)", "shape", "Triangles", ["triangle"]),
  V("triangleAltitude", "Triangle with altitude", "shape", "Triangles", ["triangle", "height"]),

  // Quadrilaterals & Polygons
  V("rectangle", "Rectangle", "shape", "Quadrilaterals & Polygons", ["polygon"]),
  V("square", "Square", "shape", "Quadrilaterals & Polygons", ["polygon"]),
  V("parallelogram", "Parallelogram", "shape", "Quadrilaterals & Polygons", ["polygon"]),
  V("trapezium", "Trapezium", "shape", "Quadrilaterals & Polygons", ["polygon", "trapezoid"]),
  V("rhombus", "Rhombus", "shape", "Quadrilaterals & Polygons", ["polygon", "diamond"]),
  V("kite", "Kite", "shape", "Quadrilaterals & Polygons", ["polygon"]),
  V("pentagon", "Pentagon", "shape", "Quadrilaterals & Polygons", ["polygon"]),
  V("hexagon", "Hexagon", "shape", "Quadrilaterals & Polygons", ["polygon"]),
  V("octagon", "Octagon", "shape", "Quadrilaterals & Polygons", ["polygon"]),

  // Circles — all routed through the Universal Circle Engine.
  V("circle", "Circle (blank)", "circleEngine", "Circles", ["circle"], { preset: "circle" }),
  V("circleRadius", "Circle with radius", "circleEngine", "Circles", ["circle", "radius"], { preset: "radius" }),
  V("circleDiameter", "Circle with diameter", "circleEngine", "Circles", ["circle", "diameter"], { preset: "diameter" }),
  V("circleSector", "Sector", "circleEngine", "Circles", ["circle", "sector", "pie"], { preset: "sector" }),
  V("circleSegmentChord", "Segment / chord", "circleEngine", "Circles", ["circle", "chord", "segment"], { preset: "segment" }),
  V("circleTangent", "Circle with tangent", "circleEngine", "Circles", ["circle", "tangent"], { preset: "tangent" }),
  V("arc", "Arc", "circleEngine", "Circles", ["arc"], { preset: "arc" }),
  V("semicircle", "Semicircle", "circleEngine", "Circles", ["semicircle", "half"], { preset: "semicircle" }),
  V("quadrant", "Quadrant", "circleEngine", "Circles", ["quadrant", "quarter"], { preset: "quadrant" }),
  V("concentricCircles", "Concentric circles", "circleEngine", "Circles", ["concentric", "rings"], { preset: "concentric" }),
  V("circleInscribed", "Inscribed shape", "shape", "Circles", ["circle"]),
  V("cyclicQuadrilateral", "Cyclic quadrilateral", "shape", "Circles", ["circle", "quad"]),

  // 3D — all routed through the Universal Solid Engine.
  V("cube", "Cube", "solidEngine", "3D Solids", ["3d", "solid"], { preset: "cube" }),
  V("cuboid", "Cuboid", "solidEngine", "3D Solids", ["3d", "solid"], { preset: "cuboid" }),
  V("cylinder", "Cylinder", "solidEngine", "3D Solids", ["3d", "solid"], { preset: "cylinder" }),
  V("cone", "Cone", "solidEngine", "3D Solids", ["3d", "solid"], { preset: "cone" }),
  V("sphere", "Sphere", "solidEngine", "3D Solids", ["3d", "solid"], { preset: "sphere" }),
  V("hemisphere", "Hemisphere", "solidEngine", "3D Solids", ["3d", "solid"], { preset: "hemisphere" }),
  V("pyramid", "Pyramid", "solidEngine", "3D Solids", ["3d", "solid"], { preset: "pyramid" }),
  V("squarePyramid", "Square-based pyramid", "solidEngine", "3D Solids", ["3d", "solid"], { preset: "squarePyramid" }),
  V("prism", "Prism", "solidEngine", "3D Solids", ["3d", "solid"], { preset: "prism" }),
  V("triangularPrism", "Triangular prism", "solidEngine", "3D Solids", ["3d", "solid"], { preset: "triangularPrism" }),
  V("triangularPyramid", "Triangular pyramid", "solidEngine", "3D Solids", ["3d", "solid", "tetrahedron"], { preset: "triangularPyramid" }),
  V("frustum", "Frustum", "solidEngine", "3D Solids", ["3d", "solid", "truncated"], { preset: "frustum" }),
  V("netCube", "Net (cube)", "shape", "3D Solids", ["3d", "net"]),
  V("netCylinder", "Net (cylinder)", "shape", "3D Solids", ["3d", "net"]),
  V("netPrism", "Net (triangular prism)", "shape", "3D Solids", ["3d", "net"]),

  // Logic
  V("venn2", "Venn diagram (2-set)", "vennEngine", "Logic & Organisation", ["venn", "logic"], { preset: "venn2" }),
  V("venn3", "Venn diagram (3-set)", "vennEngine", "Logic & Organisation", ["venn", "logic"], { preset: "venn3" }),
  V("vennDisjoint", "Venn (disjoint)", "vennEngine", "Logic & Organisation", ["venn", "logic"], { preset: "vennDisjoint" }),
  V("tree2", "Tree diagram (2-branch)", "shape", "Logic & Organisation", ["tree", "probability"]),
  V("tree3", "Tree diagram (3-branch)", "shape", "Logic & Organisation", ["tree", "probability"]),
  V("flowchart", "Flowchart", "shape", "Logic & Organisation", ["flow"]),
];
