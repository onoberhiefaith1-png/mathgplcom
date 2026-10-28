// Topology — the mathematical structure of every solid in the library.
//
// This is the layer that makes the 3D workspace a *mathematics* tool rather
// than a 3D modeller: it exposes the real faces, edges and vertices a teacher
// talks about in class (a cylinder has 3 faces / 2 edges / 0 vertices — not
// the hundreds of triangles the renderer actually draws).
//
// All positions are in the solid's LOCAL geometry frame, i.e. the same frame
// the mesh is built in, so annotation visuals can simply be mounted in the
// same group as the mesh.

import { SOLID_GROUPS, type Solid3D, type Solid3DKind, type Vec3 } from "./scene3d";

export type ElementKind = "face" | "edge" | "vertex";

export interface VertexEl {
  index: number;
  position: Vec3;
  label: string;
}

export type EdgeEl =
  | { index: number; shape: "straight"; a: Vec3; b: Vec3; center: Vec3; label: string }
  | { index: number; shape: "circle"; center: Vec3; radius: number; axis: "y"; label: string };

export interface FaceEl {
  index: number;
  /** polygon = flat face with real corners; curved = a curved surface. */
  shape: "polygon" | "curved";
  points?: Vec3[];
  center: Vec3;
  normal: Vec3;
  label: string;
  curved: boolean;
}

export interface Topology {
  vertices: VertexEl[];
  edges: EdgeEl[];
  faces: FaceEl[];
  flatFaces: number;
  curvedFaces: number;
  /** Euler's formula F + V − E = 2 only applies to polyhedra. */
  isPolyhedron: boolean;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function vertexLetter(i: number): string {
  if (i < 26) return LETTERS[i];
  return `${LETTERS[i % 26]}${Math.floor(i / 26)}`;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const centroid = (pts: Vec3[]): Vec3 =>
  pts.length
    ? scale(pts.reduce((acc, p) => add(acc, p), [0, 0, 0] as Vec3), 1 / pts.length)
    : [0, 0, 0];

interface RawPoly {
  verts: Vec3[];
  edges: [number, number][];
  faces: number[][];
}

/** Ring of a regular n-gon matching three.js Cylinder/Cone vertex placement. */
function ring(n: number, r: number, y: number): Vec3[] {
  const out: Vec3[] = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2;
    out.push([r * Math.sin(t), y, r * Math.cos(t)]);
  }
  return out;
}

function boxPoly(w: number, h: number, d: number): RawPoly {
  const x = w / 2, y = h / 2, z = d / 2;
  const verts: Vec3[] = [
    [-x, -y, z], [x, -y, z], [x, -y, -z], [-x, -y, -z],
    [-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z],
  ];
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const faces = [
    [0, 1, 2, 3], [4, 5, 6, 7],
    [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
  ];
  return { verts, edges, faces };
}

function prismPoly(n: number, r: number, h: number): RawPoly {
  const bottom = ring(n, r, -h / 2);
  const top = ring(n, r, h / 2);
  const verts = [...bottom, ...top];
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) edges.push([i, (i + 1) % n]);
  for (let i = 0; i < n; i++) edges.push([n + i, n + ((i + 1) % n)]);
  for (let i = 0; i < n; i++) edges.push([i, n + i]);
  const faces: number[][] = [
    Array.from({ length: n }, (_, i) => i),
    Array.from({ length: n }, (_, i) => n + i),
  ];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([i, j, n + j, n + i]);
  }
  return { verts, edges, faces };
}

function pyramidPoly(n: number, r: number, h: number): RawPoly {
  const base = ring(n, r, -h / 2);
  const apex: Vec3 = [0, h / 2, 0];
  const verts = [...base, apex];
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) edges.push([i, (i + 1) % n]);
  for (let i = 0; i < n; i++) edges.push([i, n]);
  const faces: number[][] = [Array.from({ length: n }, (_, i) => i)];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n]);
  return { verts, edges, faces };
}

function octahedronPoly(r: number): RawPoly {
  const verts: Vec3[] = [
    [r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r],
  ];
  const edges: [number, number][] = [
    [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 2], [1, 3], [1, 4], [1, 5],
    [2, 4], [4, 3], [3, 5], [5, 2],
  ];
  const faces = [
    [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
    [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5],
  ];
  return { verts, edges, faces };
}

function polyhedronTopology(poly: RawPoly): Topology {
  const vertices: VertexEl[] = poly.verts.map((position, index) => ({
    index,
    position,
    label: vertexLetter(index),
  }));

  const edges: EdgeEl[] = poly.edges.map(([i, j], index) => ({
    index,
    shape: "straight" as const,
    a: poly.verts[i],
    b: poly.verts[j],
    center: centroid([poly.verts[i], poly.verts[j]]),
    label: `${vertexLetter(i)}${vertexLetter(j)}`,
  }));

  const body = centroid(poly.verts);
  const faces: FaceEl[] = poly.faces.map((idxs, index) => {
    const points = idxs.map((i) => poly.verts[i]);
    const center = centroid(points);
    let normal = norm(cross(sub(points[1], points[0]), sub(points[2], points[0])));
    if (dot(normal, sub(center, body)) < 0) normal = scale(normal, -1);
    return {
      index,
      shape: "polygon" as const,
      points,
      center,
      normal,
      label: idxs.map(vertexLetter).join(""),
      curved: false,
    };
  });

  return { vertices, edges, faces, flatFaces: faces.length, curvedFaces: 0, isPolyhedron: true };
}

function circleEdge(index: number, y: number, radius: number, label: string): EdgeEl {
  return { index, shape: "circle", center: [0, y, 0], radius, axis: "y", label };
}

function curvedFace(index: number, center: Vec3, normal: Vec3, label: string): FaceEl {
  return { index, shape: "curved", center, normal, label, curved: true };
}

function discFace(index: number, y: number, radius: number, up: boolean, label: string): FaceEl {
  const points = ring(48, radius, y);
  return {
    index,
    shape: "polygon",
    points,
    center: [0, y, 0],
    normal: up ? [0, 1, 0] : [0, -1, 0],
    label,
    curved: false,
  };
}

/** Mathematical structure of a solid, in its local geometry frame. */
export function topologyFor(solid: Solid3D): Topology {
  const p = solid.params ?? {};
  const r = p.radius ?? 1;
  const h = p.height ?? 2;
  const sides = Math.max(3, Math.round(p.sides ?? 6));

  switch (solid.kind) {
    case "cube": {
      const s = p.size ?? 2;
      return polyhedronTopology(boxPoly(s, s, s));
    }
    case "cuboid":
      return polyhedronTopology(boxPoly(p.width ?? 2, p.height ?? 1.5, p.depth ?? 1));
    case "triangularPrism":
    case "pentagonalPrism":
    case "hexagonalPrism":
      return polyhedronTopology(prismPoly(sides, r, h));
    case "squarePyramid":
    case "tetrahedron":
    case "pentagonalPyramid":
    case "hexagonalPyramid":
      return polyhedronTopology(pyramidPoly(Math.max(3, Math.round(p.sides ?? 4)), r, h));
    case "octahedron":
      return polyhedronTopology(octahedronPoly(r));
    case "cylinder":
      return {
        vertices: [],
        edges: [
          circleEdge(0, h / 2, r, "Top circular edge"),
          circleEdge(1, -h / 2, r, "Base circular edge"),
        ],
        faces: [
          discFace(0, h / 2, r, true, "Top face"),
          discFace(1, -h / 2, r, false, "Base face"),
          curvedFace(2, [0, 0, 0], [0, 0, 1], "Curved surface"),
        ],
        flatFaces: 2,
        curvedFaces: 1,
        isPolyhedron: false,
      };
    case "cone":
      return {
        vertices: [{ index: 0, position: [0, h / 2, 0], label: "Apex" }],
        edges: [circleEdge(0, -h / 2, r, "Base circular edge")],
        faces: [
          discFace(0, -h / 2, r, false, "Base face"),
          curvedFace(1, [0, 0, 0], [0, 0, 1], "Curved surface"),
        ],
        flatFaces: 1,
        curvedFaces: 1,
        isPolyhedron: false,
      };
    case "frustum": {
      const top = p.topRadius ?? 0.6;
      return {
        vertices: [],
        edges: [
          circleEdge(0, h / 2, top, "Top circular edge"),
          circleEdge(1, -h / 2, r, "Base circular edge"),
        ],
        faces: [
          discFace(0, h / 2, top, true, "Top face"),
          discFace(1, -h / 2, r, false, "Base face"),
          curvedFace(2, [0, 0, 0], [0, 0, 1], "Curved surface"),
        ],
        flatFaces: 2,
        curvedFaces: 1,
        isPolyhedron: false,
      };
    }
    case "hemisphere":
      return {
        vertices: [],
        edges: [circleEdge(0, 0, r, "Circular edge")],
        faces: [
          discFace(0, 0, r, false, "Flat circular face"),
          curvedFace(1, [0, r / 2, 0], [0, 0, 1], "Curved surface"),
        ],
        flatFaces: 1,
        curvedFaces: 1,
        isPolyhedron: false,
      };
    case "sphere":
    default:
      return {
        vertices: [],
        edges: [],
        faces: [curvedFace(0, [0, 0, 0], [0, 0, 1], "Curved surface")],
        flatFaces: 0,
        curvedFaces: 1,
        isPolyhedron: false,
      };
  }
}

export interface SolidProperties {
  name: string;
  family: string;
  faces: number;
  edges: number;
  vertices: number;
  flatFaces: number;
  curvedFaces: number;
  isPolyhedron: boolean;
  eulerHolds: boolean | null;
}

const FAMILY_OF: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const g of SOLID_GROUPS) for (const k of g.kinds) map[k] = g.label.replace(/s$/, "");
  return map;
})();

const NAME_OVERRIDES: Partial<Record<Solid3DKind, string>> = {
  tetrahedron: "Tetrahedron (Triangular Pyramid)",
};

export function solidProperties(solid: Solid3D, label: string): SolidProperties {
  const t = topologyFor(solid);
  const F = t.faces.length, E = t.edges.length, V = t.vertices.length;
  return {
    name: NAME_OVERRIDES[solid.kind] ?? label,
    family: FAMILY_OF[solid.kind] ?? "Solid",
    faces: F,
    edges: E,
    vertices: V,
    flatFaces: t.flatFaces,
    curvedFaces: t.curvedFaces,
    isPolyhedron: t.isPolyhedron,
    eulerHolds: t.isPolyhedron ? F + V - E === 2 : null,
  };
}

/** Point a label sits at: pushed slightly off the element so it stays readable. */
export function labelAnchor(kind: ElementKind, el: VertexEl | EdgeEl | FaceEl): Vec3 {
  if (kind === "vertex") {
    const v = el as VertexEl;
    return scale(norm(v.position.some((c) => c !== 0) ? v.position : [0, 1, 0]), Math.hypot(...v.position) + 0.28);
  }
  if (kind === "edge") {
    const e = el as EdgeEl;
    return e.shape === "straight" ? e.center : [e.center[0], e.center[1], e.center[2] + e.radius];
  }
  const f = el as FaceEl;
  return add(f.center, scale(f.normal, 0.12));
}
