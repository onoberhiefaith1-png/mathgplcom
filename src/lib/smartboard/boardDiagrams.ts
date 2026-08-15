// Board diagrams — Smartboard-owned placements of the EXISTING diagram
// engines. The board only stores scene data plus a position; all drawing and
// editing is delegated to the geometry (2D) and 3D/TVD engines already used
// by Lesson Notes. There is deliberately no second diagram engine here.

import { EMPTY_SCENE, sanitizeScene, type GeometryScene } from "@/lib/geometry/scene";
import { EMPTY_SCENE_3D, sanitizeScene3D, type Scene3D } from "@/lib/geometry3d/scene3d";

export interface BoardDiagram2D {
  id: string;
  kind: "2d";
  x: number;
  y: number;
  width: number;
  height: number;
  scene: GeometryScene;
}

export interface BoardDiagram3D {
  id: string;
  kind: "3d";
  x: number;
  y: number;
  width: number;
  height: number;
  scene: Scene3D;
}

export type BoardDiagram = BoardDiagram2D | BoardDiagram3D;

const rid = () =>
  `dgm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export const newBoardDiagram2D = (x: number, y: number, scene?: GeometryScene): BoardDiagram2D => ({
  id: rid(),
  kind: "2d",
  x,
  y,
  width: 460,
  height: 340,
  scene: scene ?? EMPTY_SCENE,
});

export const newBoardDiagram3D = (x: number, y: number, scene?: Scene3D): BoardDiagram3D => ({
  id: rid(),
  kind: "3d",
  x,
  y,
  width: 520,
  height: 380,
  scene: scene ?? EMPTY_SCENE_3D,
});

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Defensive parse of the persisted board bucket. */
export function sanitizeBoardDiagrams(raw: unknown): BoardDiagram[] {
  if (!Array.isArray(raw)) return [];
  const out: BoardDiagram[] = [];
  for (const item of raw) {
    const r = item as Record<string, unknown>;
    if (!r || typeof r.id !== "string") continue;
    if (r.kind === "3d") {
      out.push({
        id: r.id,
        kind: "3d",
        x: num(r.x, 40),
        y: num(r.y, 40),
        width: num(r.width, 520),
        height: num(r.height, 380),
        scene: sanitizeScene3D(r.scene),
      });
    } else {
      const scene = sanitizeScene(r.scene) ?? EMPTY_SCENE;
      out.push({
        id: r.id,
        kind: "2d",
        x: num(r.x, 40),
        y: num(r.y, 40),
        width: num(r.width, 460),
        height: num(r.height, 340),
        scene,
      });
    }
  }
  return out;
}
