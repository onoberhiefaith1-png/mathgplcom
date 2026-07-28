// Group Bars — geometry + cloning helpers.
//
// A duplicated Progress Bar is NOT written into the shared Adventure (`games`)
// canvas: the Adventure is a reusable template used by many classes. Instead a
// clone is described by its `adventure_groups` row (source element + position)
// and rebuilt at render time from the source element, so every group's bar
// inherits every setting of the original bar verbatim.

import { normalizeCanvas, type CanvasElement, type GameRow } from "@/lib/games/types";
import { getPreset } from "@/lib/games/progressPresets";
import type { AdventureGroup } from "./groups";

export const GROUP_BAR_PREFIX = "grpbar-";

export const groupBarElementId = (groupId: string) => `${GROUP_BAR_PREFIX}${groupId}`;

export const isGroupBarElementId = (id: string) => id.startsWith(GROUP_BAR_PREFIX);

export interface Rect { x: number; y: number; w: number; h: number }

/** Gap kept between two bars, as a fraction of stage width. */
export const BAR_GAP = 0.02;

/** Stage aspect (width / height) used when estimating a bar's height. */
const STAGE_ASPECT = 16 / 9;

/** Footprint of an element on the normalised stage (centre-anchored). */
export const elementRect = (el: CanvasElement, heightUnits = 1): Rect => {
  const w = Math.max(0.02, Number(el.scale) || 0.1);
  const aspect = getPreset(el.progress?.presetId)?.aspect ?? 0.5;
  const h = Math.min(0.98, (w / aspect) * (STAGE_ASPECT / Math.max(1, heightUnits)));
  return { x: Number(el.x) || 0.5, y: Number(el.y) || 0.5, w, h };
};

const overlaps = (a: Rect, b: Rect, gap = BAR_GAP): boolean =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap &&
  Math.abs(a.y - b.y) < (a.h + b.h) / 2 + gap;

export const collides = (candidate: Rect, occupied: Rect[], gap = BAR_GAP): boolean =>
  occupied.some((r) => overlaps(candidate, r, gap));

/**
 * Find free space for one more bar of the given size.
 * Scans a grid left→right, top→bottom and returns the first slot that clears
 * every occupied rect (plus a gap) and stays inside the stage.
 * Returns null when the stage is full — the caller then disables "Add Group".
 */
export const findFreeSlot = (
  size: { w: number; h: number },
  occupied: Rect[],
  gap = BAR_GAP,
): { x: number; y: number } | null => {
  const stepX = Math.max(0.01, size.w / 2);
  const stepY = Math.max(0.01, size.h / 3);
  const minX = size.w / 2 + gap;
  const maxX = 1 - size.w / 2 - gap;
  const minY = size.h / 2 + gap;
  const maxY = 1 - size.h / 2 - gap;
  if (minX > maxX || minY > maxY) return null;

  for (let y = minY; y <= maxY + 1e-9; y += stepY) {
    for (let x = minX; x <= maxX + 1e-9; x += stepX) {
      const cand = { x: Math.min(x, maxX), y: Math.min(y, maxY), w: size.w, h: size.h };
      if (!collides(cand, occupied, gap)) return { x: cand.x, y: cand.y };
    }
  }
  return null;
};

/** Elements of the active scene of a game. */
export const sceneElements = (game: GameRow | null): CanvasElement[] => {
  if (!game) return [];
  const canvas = normalizeCanvas(game.canvas);
  const scene = canvas.scenes.find((s) => s.id === canvas.activeSceneId) ?? canvas.scenes[0];
  return scene?.elements ?? [];
};

export const sceneHeightUnits = (game: GameRow | null): number =>
  game ? Math.max(1, Math.floor(Number(normalizeCanvas(game.canvas).heightUnits) || 1)) : 1;

/** Build the clone elements for every duplicated group of this game. */
export const buildGroupBarElements = (
  game: GameRow | null,
  groups: AdventureGroup[],
): CanvasElement[] => {
  const base = sceneElements(game);
  const byId = new Map(base.map((e) => [e.id, e]));
  const out: CanvasElement[] = [];
  for (const g of groups) {
    if (!g.source_element_id) continue; // primary group reuses the original bar
    if (!isGroupBarElementId(g.progress_element_id)) continue;
    const src = byId.get(g.source_element_id);
    if (!src || src.kind !== "progress_bar") continue;
    out.push({
      ...src,
      id: g.progress_element_id,
      label: g.name,
      x: g.position_x ?? src.x,
      y: g.position_y ?? src.y,
      progress: src.progress ? { ...src.progress } : src.progress,
    });
  }
  return out;
};

/** A derived game whose active scene also contains every group clone bar. */
export const withGroupBars = (game: GameRow | null, groups: AdventureGroup[]): GameRow | null => {
  if (!game) return null;
  const clones = buildGroupBarElements(game, groups);
  if (clones.length === 0) return game;
  const canvas = normalizeCanvas(game.canvas);
  const activeId = canvas.scenes.find((s) => s.id === canvas.activeSceneId)?.id ?? canvas.scenes[0]?.id;
  return {
    ...game,
    canvas: {
      ...canvas,
      scenes: canvas.scenes.map((s) =>
        s.id === activeId ? { ...s, elements: [...s.elements, ...clones] } : s,
      ),
    },
  } as GameRow;
};

/** Where the next duplicated bar should sit, or null when the stage is full. */
export const nextGroupBarPosition = (
  game: GameRow | null,
  groups: AdventureGroup[],
  sourceElementId: string,
): { x: number; y: number } | null => {
  const base = sceneElements(game);
  const src = base.find((e) => e.id === sourceElementId);
  if (!src) return null;
  const hu = sceneHeightUnits(game);
  const clones = buildGroupBarElements(game, groups);
  const occupied = [...base, ...clones]
    .filter((e) => e.kind === "progress_bar" || e.kind === "reward")
    .map((e) => elementRect(e, hu));
  const size = elementRect(src, hu);
  return findFreeSlot({ w: size.w, h: size.h }, occupied);
};

/** Can another duplicate fit on the stage right now? */
export const hasRoomForGroupBar = (
  game: GameRow | null,
  groups: AdventureGroup[],
  sourceElementId: string | null,
): boolean => (sourceElementId ? nextGroupBarPosition(game, groups, sourceElementId) !== null : false);
