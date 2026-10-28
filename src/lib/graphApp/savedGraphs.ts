import { parseEquation } from "./math";
import { validMatrix, type Matrix } from "./operations";
import { validSolid, type Solid } from "./solids";
export interface LabSnapshot {
  equations: { src: string; colour: string; hidden: boolean }[];
  mode: "2D" | "3D" | "ND";
  view: { cx: number; cy: number; scale: number };
  grid: boolean; axes: boolean; labels: boolean;
  ndN: number; ndAngle: number;
  matrices: { a: Matrix; b: Matrix };
  calculus: { src: string; x: number; lower: number; upper: number };
  solid?: Solid | null;
}
export interface SavedGraph { version: 1; id: string; name: string; savedAt: string; snapshot: LabSnapshot }
export const graphStorageKey = (userId: string, orgId: string | null) => `mathgpl.math-lab.v1:${encodeURIComponent(userId)}:${encodeURIComponent(orgId ?? "personal")}`;
export function validateGraph(value: unknown): SavedGraph {
  if (!value || typeof value !== "object") throw Error("Invalid Math Lab file.");
  const g = value as SavedGraph, s = g.snapshot;
  if (g.version !== 1 || typeof g.id !== "string" || g.id.length > 150 || typeof g.name !== "string" || !g.name.trim() || g.name.length > 100 || typeof g.savedAt !== "string" || !s) throw Error("Invalid Math Lab file.");
  if (!Array.isArray(s.equations) || s.equations.length > 200 || !s.equations.every(e => e && typeof e.src === "string" && e.src.length <= 2000 && parseEquation(e.src).kind !== "error" && /^#[\da-f]{6}$/i.test(e.colour) && typeof e.hidden === "boolean")) throw Error("Invalid graph equations.");
  if (!["2D", "3D", "ND"].includes(s.mode) || !s.view || ![s.view.cx, s.view.cy, s.view.scale, s.ndAngle].every(Number.isFinite) || s.view.scale < 2 || s.view.scale > 5000 || ![4, 5, 6].includes(s.ndN)) throw Error("Invalid graph view.");
  if (![s.grid, s.axes, s.labels].every(v => typeof v === "boolean") || !s.matrices || !validMatrix(s.matrices.a) || !validMatrix(s.matrices.b)) throw Error("Invalid graph settings.");
  if (!s.calculus || typeof s.calculus.src !== "string" || s.calculus.src.length > 2000 || ![s.calculus.x, s.calculus.lower, s.calculus.upper].every(Number.isFinite)) throw Error("Invalid calculus settings.");
  if (s.solid != null && !validSolid(s.solid)) throw Error("Invalid solid settings.");
  return g;
}
export function readGraphs(storage: Pick<Storage, "getItem">, key: string): SavedGraph[] {
  const raw = storage.getItem(key); if (!raw) return [];
  const list: unknown = JSON.parse(raw);
  if (!Array.isArray(list) || list.length > 200) throw Error("Saved graphs could not be read.");
  return list.map(validateGraph);
}
export function writeGraphs(storage: Pick<Storage, "setItem">, key: string, graphs: SavedGraph[]): void {
  if (graphs.length > 200) throw Error("Keep at most 200 saved graphs; export a backup before removing old graphs.");
  storage.setItem(key, JSON.stringify(graphs.map(validateGraph)));
}
