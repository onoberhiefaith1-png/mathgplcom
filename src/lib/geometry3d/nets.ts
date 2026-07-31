// Precomputed 2D nets (unfoldings) for the shape library. Each net is a set
// of labelled polygons drawn inside an SVG viewbox.

import type { Solid3D } from "./scene3d";

export interface NetShape {
  kind: "polygon" | "circle";
  points?: [number, number][];
  cx?: number;
  cy?: number;
  r?: number;
  color: string;
  label: string;
  /** Index of the matching face in topologyFor(solid) — links 2D net to 3D. */
  faceIndex?: number;
}

export interface Net2D {
  width: number;
  height: number;
  shapes: NetShape[];
  notes?: string;
}

const PALETTE = ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#f472b6", "#f87171", "#22d3ee", "#facc15"];

const rect = (x: number, y: number, w: number, h: number, color: string, label: string, faceIndex?: number): NetShape => ({
  kind: "polygon",
  points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
  color, label, faceIndex,
});

const tri = (a: [number, number], b: [number, number], c: [number, number], color: string, label: string, faceIndex?: number): NetShape => ({
  kind: "polygon", points: [a, b, c], color, label, faceIndex,
});

/** Compute a 2D net (in arbitrary unit-space) for the given solid. */
export function netFor(solid: Solid3D): Net2D | null {
  const p = solid.params ?? {};
  const r = p.radius ?? 1;
  const h = p.height ?? 2;
  const cx = (n: number) => n * 40; // display scale

  switch (solid.kind) {
    case "cube": {
      const s = cx(p.size ?? 2);
      const shapes: NetShape[] = [];
      const layout = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]];
      const labels = ["Top", "Left", "Front", "Right", "Back", "Bottom"];
      const faceIdx = [1, 5, 2, 3, 4, 0];
      layout.forEach(([col, row], i) => shapes.push(rect(20 + col * s, 20 + row * s, s, s, PALETTE[i], labels[i], faceIdx[i])));
      return { width: 20 + 4 * s + 20, height: 20 + 3 * s + 20, shapes };
    }
    case "cuboid": {
      const w = cx(p.width ?? 2), hh = cx(p.height ?? 1.5), d = cx(p.depth ?? 1);
      const shapes: NetShape[] = [
        rect(20 + d, 20, w, d, PALETTE[0], "Top", 1),
        rect(20, 20 + d, d, hh, PALETTE[1], "Left", 5),
        rect(20 + d, 20 + d, w, hh, PALETTE[2], "Front", 2),
        rect(20 + d + w, 20 + d, d, hh, PALETTE[3], "Right", 3),
        rect(20 + d + w + d, 20 + d, w, hh, PALETTE[4], "Back", 4),
        rect(20 + d, 20 + d + hh, w, d, PALETTE[5], "Bottom", 0),
      ];
      return { width: 40 + 2 * d + 2 * w, height: 40 + 2 * d + hh, shapes };
    }
    case "cylinder": {
      const rr = cx(r), hh = cx(h);
      const circ = 2 * Math.PI * rr;
      const shapes: NetShape[] = [
        { kind: "circle", cx: 20 + rr, cy: 20 + rr, r: rr, color: PALETTE[0], label: "Top", faceIndex: 0 },
        rect(20 + 2 * rr + 20, 20, circ, hh, PALETTE[2], "Curved surface (2πr)", 2),
        { kind: "circle", cx: 20 + rr, cy: 20 + rr + hh + 20 + rr, r: rr, color: PALETTE[5], label: "Base", faceIndex: 1 },
      ];
      return { width: 60 + 2 * rr + circ, height: 40 + 2 * (2 * rr) + hh, shapes,
        notes: `Rectangle width = 2πr ≈ ${(circ / 40).toFixed(2)}` };
    }
    case "cone": {
      const rr = cx(r), l = cx(Math.hypot(r, h));
      // Sector angle (radians) = 2π r / l
      const theta = (2 * Math.PI * rr) / l;
      const cxp = 20 + l, cyp = 20 + l;
      const pts: [number, number][] = [[cxp, cyp]];
      const N = 32;
      for (let i = 0; i <= N; i++) {
        const a = -Math.PI / 2 - theta / 2 + (theta * i) / N;
        pts.push([cxp + Math.cos(a) * l, cyp + Math.sin(a) * l]);
      }
      return {
        width: 60 + 2 * l + 2 * rr,
        height: 40 + 2 * l,
        shapes: [
          { kind: "polygon", points: pts, color: PALETTE[2], label: "Curved surface (sector)", faceIndex: 1 },
          { kind: "circle", cx: 20 + 2 * l + 20 + rr, cy: 20 + l, r: rr, color: PALETTE[5], label: "Base", faceIndex: 0 },
        ],
        notes: `Slant ℓ = √(r²+h²) ≈ ${(l / 40).toFixed(2)}, sector angle = 2πr/ℓ`,
      };
    }
    case "triangularPrism":
    case "pentagonalPrism":
    case "hexagonalPrism": {
      const sides = Math.max(3, Math.round(p.sides ?? 6));
      const rr = cx(r), hh = cx(h);
      const side = 2 * rr * Math.sin(Math.PI / sides);
      const shapes: NetShape[] = [];
      // n rectangles side-by-side
      for (let i = 0; i < sides; i++) {
        shapes.push(rect(20 + i * side, 20 + rr, side, hh, PALETTE[(i + 1) % PALETTE.length], `Side ${i + 1}`, 2 + i));
      }
      // top and bottom polygons
      const polyPts = (offX: number, offY: number): [number, number][] => {
        const arr: [number, number][] = [];
        for (let k = 0; k < sides; k++) {
          const t = (k / sides) * Math.PI * 2 - Math.PI / 2;
          arr.push([offX + rr + Math.cos(t) * rr, offY + rr + Math.sin(t) * rr]);
        }
        return arr;
      };
      shapes.unshift({ kind: "polygon", points: polyPts(20 + (sides * side) / 2 - rr, 20 - rr), color: PALETTE[0], label: "Top", faceIndex: 1 });
      shapes.push({ kind: "polygon", points: polyPts(20 + (sides * side) / 2 - rr, 20 + rr + hh + 10), color: PALETTE[5], label: "Base", faceIndex: 0 });
      return { width: 40 + sides * side, height: 40 + rr + hh + 10 + 2 * rr, shapes };
    }
    case "squarePyramid":
    case "tetrahedron":
    case "pentagonalPyramid":
    case "hexagonalPyramid": {
      const sides = Math.max(3, Math.round(p.sides ?? 4));
      const rr = cx(r), hh = cx(h);
      const side = 2 * rr * Math.sin(Math.PI / sides);
      const apothem = rr * Math.cos(Math.PI / sides);
      const slant = Math.hypot(hh, apothem);
      const shapes: NetShape[] = [];
      // central base polygon
      const cxp = 200, cyp = 200;
      const basePts: [number, number][] = [];
      for (let k = 0; k < sides; k++) {
        const t = (k / sides) * Math.PI * 2 - Math.PI / 2;
        basePts.push([cxp + Math.cos(t) * rr, cyp + Math.sin(t) * rr]);
      }
      shapes.push({ kind: "polygon", points: basePts, color: PALETTE[5], label: "Base", faceIndex: 0 });
      // triangular side flaps hinged on each base edge
      for (let k = 0; k < sides; k++) {
        const a = basePts[k];
        const b = basePts[(k + 1) % sides];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const dx = mx - cxp, dy = my - cyp;
        const dl = Math.hypot(dx, dy) || 1;
        const apex: [number, number] = [mx + (dx / dl) * slant, my + (dy / dl) * slant];
        shapes.push(tri(a, b, apex, PALETTE[(k + 1) % PALETTE.length], `Face ${k + 1}`, 1 + k));
      }
      return { width: 400, height: 400, shapes };
    }
    case "octahedron": {
      // 8 equilateral triangles in a strip
      const side = cx(r * Math.SQRT2);
      const th = (side * Math.sqrt(3)) / 2;
      const shapes: NetShape[] = [];
      for (let i = 0; i < 8; i++) {
        const x = 20 + (i * side) / 2;
        const up = i % 2 === 0;
        const a: [number, number] = [x, up ? 20 + th : 20];
        const b: [number, number] = [x + side, up ? 20 + th : 20];
        const c: [number, number] = [x + side / 2, up ? 20 : 20 + th];
        shapes.push(tri(a, b, c, PALETTE[i % PALETTE.length], `T${i + 1}`, i));
      }
      return { width: 40 + 4.5 * side, height: 40 + th, shapes };
    }
    case "sphere":
    case "hemisphere":
    case "frustum":
    default:
      return null;
  }
}
