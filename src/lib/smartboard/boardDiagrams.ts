// Board diagrams — Smartboard-owned placements of the EXISTING diagram
// engines. The board only stores scene data plus a position; all drawing and
// editing is delegated to the geometry (2D) and 3D/TVD engines already used
// by Lesson Notes. There is deliberately no second diagram engine here.

import { EMPTY_SCENE, sanitizeScene, type GeometryScene } from "@/lib/geometry/scene";
import { EMPTY_SCENE_3D, sanitizeScene3D, type Scene3D } from "@/lib/geometry3d/scene3d";
import { DEFAULT_GRAPH, sanitizeGraphAttrs, type SmartGraphAttrs } from "@/lib/graph/graphModel";
import type { MathTableAttrs } from "@/components/lessonnotes/extensions/MathTable";

export interface BoardDiagram2D {
  id: string;
  kind: "2d";
  x: number;
  y: number;
  width: number;
  height: number;
  scene: GeometryScene;
  /** False while the diagram is still an editable floating workbench. */
  committed?: boolean;
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

/** A Smart Graph placed on the board — the SAME graph object the lesson note
 *  uses, stored as node attributes plus a board position. */
export interface BoardGraph {
  id: string;
  kind: "graph";
  x: number;
  y: number;
  width: number;
  height: number;
  attrs: SmartGraphAttrs;
}

/** A mathematical reference table (logs, sines, statistical…) placed on the
 *  board — again the same object the lesson note uses. */
export interface BoardTable {
  id: string;
  kind: "table";
  x: number;
  y: number;
  width: number;
  height: number;
  attrs: MathTableAttrs;
}

export type BoardDiagram = BoardDiagram2D | BoardDiagram3D | BoardGraph | BoardTable;

const rid = () =>
  `dgm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export const newBoardDiagram2D = (x: number, y: number, scene?: GeometryScene): BoardDiagram2D => ({
  id: rid(),
  kind: "2d",
  x,
  y,
  width: 720,
  height: 520,
  scene: scene ?? EMPTY_SCENE,
  committed: false,
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

export const newBoardGraph = (x: number, y: number, attrs?: Partial<SmartGraphAttrs>): BoardGraph => ({
  id: rid(),
  kind: "graph",
  x,
  y,
  width: 620,
  height: 460,
  attrs: { ...DEFAULT_GRAPH, ...(attrs ?? {}) },
});

export const newBoardTable = (x: number, y: number, attrs: MathTableAttrs): BoardTable => ({
  id: rid(),
  kind: "table",
  x,
  y,
  width: 560,
  height: 420,
  attrs,
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
    if (r.kind === "graph") {
      out.push({
        id: r.id,
        kind: "graph",
        x: num(r.x, 40),
        y: num(r.y, 40),
        width: num(r.width, 620),
        height: num(r.height, 460),
        attrs: sanitizeGraphAttrs(r.attrs),
      });
    } else if (r.kind === "table") {
      const a = (r.attrs ?? {}) as Record<string, unknown>;
      out.push({
        id: r.id,
        kind: "table",
        x: num(r.x, 40),
        y: num(r.y, 40),
        width: num(r.width, 560),
        height: num(r.height, 420),
        attrs: {
          tableId: typeof a.tableId === "string" ? a.tableId : "",
          tableName: typeof a.tableName === "string" ? a.tableName : "",
          input: num(a.input, 0),
          generated: (a.generated ?? null) as MathTableAttrs["generated"],
          edits: (a.edits && typeof a.edits === "object" ? a.edits : {}) as Record<string, string>,
        },
      });
    } else if (r.kind === "3d") {
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
        width: num(r.width, 720),
        height: num(r.height, 520),
        scene,
        // Anything already saved is finished work, so it loads committed.
        committed: r.committed === undefined ? true : !!r.committed,
      });
    }

  }
  return out;
}
