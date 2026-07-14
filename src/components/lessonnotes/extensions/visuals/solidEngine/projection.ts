// 3D → 2D projection for the Universal Solid Engine.
//
// Each solid is defined as vertices (unit-ish coords), edges, and faces.
// We apply rotation around X, Y, Z, then orthographic projection.
// Visibility is classified per edge by testing whether every face that
// owns the edge is back-facing (edge hidden) or at least one is
// front-facing (edge visible). Curved shapes (cylinder/cone/sphere) are
// rendered analytically since they don't fit the polygonal model.

import type { UCESolid } from "./types";

export type Vec3 = { x: number; y: number; z: number };
export type Vec2 = { x: number; y: number };

export interface Mesh {
  vertices: Vec3[];
  edges: Array<[number, number]>;
  /** faces reference vertex indices in CCW order (outward normal) */
  faces: number[][];
}

const cos = (d: number) => Math.cos((d * Math.PI) / 180);
const sin = (d: number) => Math.sin((d * Math.PI) / 180);

export function rotate(p: Vec3, rx: number, ry: number, rz: number): Vec3 {
  // Z
  let x = p.x * cos(rz) - p.y * sin(rz);
  let y = p.x * sin(rz) + p.y * cos(rz);
  let z = p.z;
  // Y
  const x2 = x * cos(ry) + z * sin(ry);
  const z2 = -x * sin(ry) + z * cos(ry);
  x = x2; z = z2;
  // X
  const y2 = y * cos(rx) - z * sin(rx);
  const z3 = y * sin(rx) + z * cos(rx);
  y = y2; z = z3;
  return { x, y, z };
}

function faceNormalZ(vs: Vec3[]): number {
  // Only need Z of the cross product (a-b) × (c-b) to decide visibility.
  if (vs.length < 3) return 0;
  const [a, b, c] = vs;
  const ux = a.x - b.x, uy = a.y - b.y;
  const vx = c.x - b.x, vy = c.y - b.y;
  return ux * vy - uy * vx;
}

/* ------------ Mesh builders ------------ */

export function meshFor(s: UCESolid): Mesh {
  const w = s.width * s.size / 2;
  const h = s.height * s.size / 2;
  const d = s.depth * s.size / 2;

  switch (s.type) {
    case "cube":
    case "cuboid":
      return cuboid(w, h, d);
    case "prism":
    case "triangularPrism":
      return triangularPrism(w, h, d);
    case "pyramid":
    case "squarePyramid":
      return squarePyramid(w, h, d);
    case "triangularPyramid":
      return tetrahedron(w, h, d);
    case "frustum":
      return frustum(w, h, d);
    // Curved solids get a stub mesh — rendered analytically in Canvas.
    case "cylinder":
    case "cone":
    case "sphere":
    case "hemisphere":
    default:
      return cuboid(w, h, d);
  }
}

function cuboid(w: number, h: number, d: number): Mesh {
  const V: Vec3[] = [
    { x: -w, y: -h, z:  d }, // 0 front-BL
    { x:  w, y: -h, z:  d }, // 1 front-BR
    { x:  w, y:  h, z:  d }, // 2 front-TR
    { x: -w, y:  h, z:  d }, // 3 front-TL
    { x: -w, y: -h, z: -d }, // 4 back-BL
    { x:  w, y: -h, z: -d }, // 5 back-BR
    { x:  w, y:  h, z: -d }, // 6 back-TR
    { x: -w, y:  h, z: -d }, // 7 back-TL
  ];
  const edges: Array<[number, number]> = [
    [0,1],[1,2],[2,3],[3,0], // front
    [4,5],[5,6],[6,7],[7,4], // back
    [0,4],[1,5],[2,6],[3,7], // sides
  ];
  const faces = [
    [0,1,2,3], // front (+z)
    [5,4,7,6], // back  (-z)
    [4,0,3,7], // left  (-x)
    [1,5,6,2], // right (+x)
    [3,2,6,7], // top   (+y)
    [4,5,1,0], // bottom(-y)
  ];
  return { vertices: V, edges, faces };
}

function triangularPrism(w: number, h: number, d: number): Mesh {
  const V: Vec3[] = [
    { x:    0, y:  h, z:  d }, // 0 front apex
    { x:   -w, y: -h, z:  d }, // 1 front BL
    { x:    w, y: -h, z:  d }, // 2 front BR
    { x:    0, y:  h, z: -d }, // 3 back apex
    { x:   -w, y: -h, z: -d }, // 4 back BL
    { x:    w, y: -h, z: -d }, // 5 back BR
  ];
  const edges: Array<[number, number]> = [
    [0,1],[1,2],[2,0],
    [3,4],[4,5],[5,3],
    [0,3],[1,4],[2,5],
  ];
  const faces = [
    [0,1,2],       // front
    [3,5,4],       // back
    [0,2,5,3],     // right
    [0,3,4,1],     // left
    [1,4,5,2],     // bottom
  ];
  return { vertices: V, edges, faces };
}

function squarePyramid(w: number, h: number, d: number): Mesh {
  const V: Vec3[] = [
    { x: -w, y: -h, z:  d }, // 0
    { x:  w, y: -h, z:  d }, // 1
    { x:  w, y: -h, z: -d }, // 2
    { x: -w, y: -h, z: -d }, // 3
    { x:  0, y:  h, z:  0 }, // 4 apex
  ];
  const edges: Array<[number, number]> = [
    [0,1],[1,2],[2,3],[3,0],
    [0,4],[1,4],[2,4],[3,4],
  ];
  const faces = [
    [0,3,2,1],     // base
    [0,1,4],       // front
    [1,2,4],       // right
    [2,3,4],       // back
    [3,0,4],       // left
  ];
  return { vertices: V, edges, faces };
}

function tetrahedron(w: number, h: number, d: number): Mesh {
  const V: Vec3[] = [
    { x: -w, y: -h, z:  d }, // 0
    { x:  w, y: -h, z:  d }, // 1
    { x:  0, y: -h, z: -d }, // 2
    { x:  0, y:  h, z:  0 }, // 3 apex
  ];
  const edges: Array<[number, number]> = [
    [0,1],[1,2],[2,0],
    [0,3],[1,3],[2,3],
  ];
  const faces = [
    [0,2,1],
    [0,1,3],
    [1,2,3],
    [2,0,3],
  ];
  return { vertices: V, edges, faces };
}

function frustum(w: number, h: number, d: number): Mesh {
  const topScale = 0.55;
  const tw = w * topScale;
  const td = d * topScale;
  const V: Vec3[] = [
    { x: -w, y: -h, z:  d }, // 0
    { x:  w, y: -h, z:  d }, // 1
    { x:  w, y: -h, z: -d }, // 2
    { x: -w, y: -h, z: -d }, // 3
    { x: -tw, y:  h, z:  td }, // 4
    { x:  tw, y:  h, z:  td }, // 5
    { x:  tw, y:  h, z: -td }, // 6
    { x: -tw, y:  h, z: -td }, // 7
  ];
  const edges: Array<[number, number]> = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ];
  const faces = [
    [0,3,2,1],
    [4,5,6,7],
    [0,1,5,4],
    [1,2,6,5],
    [2,3,7,6],
    [3,0,4,7],
  ];
  return { vertices: V, edges, faces };
}

/* ------------ Projection ------------ */

export interface ProjectedEdge {
  a: Vec2;
  b: Vec2;
  hidden: boolean;
}

export interface ProjectedSolid {
  vertices2d: Vec2[];
  /** rotated (pre-projection) vertices, used for depth sorting */
  vertices3d: Vec3[];
  edges: ProjectedEdge[];
  faces: Array<{ indices: number[]; hidden: boolean; normalZ: number }>;
  outline?: string;
}

export function projectSolid(s: UCESolid): ProjectedSolid {
  const mesh = meshFor(s);
  const rot = mesh.vertices.map((v) => rotate(v, s.rotX, s.rotY, s.rotZ));
  const vertices2d: Vec2[] = rot.map((v) => ({ x: s.x + v.x, y: s.y - v.y }));

  const faces = mesh.faces.map((f) => {
    const pts = f.map((i) => rot[i]);
    const nz = faceNormalZ(pts);
    return { indices: f, hidden: nz <= 0, normalZ: nz };
  });

  // An edge is visible if any face touching it is front-facing.
  const edges: ProjectedEdge[] = mesh.edges.map(([i, j]) => {
    let visible = false;
    for (const f of faces) {
      if (!f.hidden && edgeInFace(f.indices, i, j)) { visible = true; break; }
    }
    return { a: vertices2d[i], b: vertices2d[j], hidden: !visible };
  });

  return { vertices2d, vertices3d: rot, edges, faces };
}

function edgeInFace(face: number[], a: number, b: number): boolean {
  for (let k = 0; k < face.length; k++) {
    const p = face[k];
    const q = face[(k + 1) % face.length];
    if ((p === a && q === b) || (p === b && q === a)) return true;
  }
  return false;
}
