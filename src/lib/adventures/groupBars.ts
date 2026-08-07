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
    // A duplicate may be moved, resized and recoloured. Questions, scoring and
    // reward assignment always stay identical to the source bar.
    out.push({
      ...src,
      id: g.progress_element_id,
      label: g.name,
      x: g.position_x ?? src.x,
      y: g.position_y ?? src.y,
      scale: g.style_scale ?? src.scale,
      progress: src.progress
        ? {
            ...src.progress,
            ...(g.style_preset_id ? { presetId: g.style_preset_id } : {}),
            ...(g.style_color ? { fillStyle: "plain" as const, plainColor: g.style_color } : {}),
          }
        : src.progress,
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

// ───────────────────────────────────────────────────────────────────────────
// Scoreboard duplicates.
//
// Group Competition duplicates the master Progress Bar ONCE PER TEAM as a
// purely visual scoreboard: same Learning Point, same questions, same rules —
// only the fill differs, because each duplicate shows one team's live progress.
// The duplicates are never written into the shared Adventure canvas; they are
// rebuilt here on every render, and their position/scale/colour live on the
// team's own row so the teacher can arrange them freely.
// ───────────────────────────────────────────────────────────────────────────

export type GroupBarFill = {
  group: AdventureGroup;
  /** 0…1 of the team's required mark. */
  fill: number;
};

/** Default layout for a team bar that the teacher has not placed yet. */
const defaultGroupSlot = (master: CanvasElement, index: number, count: number) => {
  const w = Math.max(0.02, Number(master.scale) || 0.2);
  const span = Math.min(0.94, (w + BAR_GAP) * count);
  const startX = Math.max(w / 2 + 0.02, 0.5 - span / 2 + w / 2);
  return {
    x: Math.min(1 - w / 2 - 0.02, startX + index * (w + BAR_GAP)),
    y: Math.min(0.94, (Number(master.y) || 0.5) + 0.18),
  };
};

/**
 * One display bar per team, cloned from the master bar and filled from that
 * team's standing.
 */
export const buildGroupScoreboardBars = (
  master: CanvasElement | null,
  fills: GroupBarFill[],
): CanvasElement[] => {
  if (!master || master.kind !== "progress_bar" || fills.length === 0) return [];
  const segments = Math.max(1, Number(master.progress?.segments) || 10);
  return fills.map(({ group, fill }, i) => {
    const slot = defaultGroupSlot(master, i, fills.length);
    const lit = Math.max(0, Math.min(segments, Math.round(fill * segments)));
    return {
      ...master,
      id: groupBarElementId(group.id),
      label: group.name,
      x: group.position_x ?? slot.x,
      y: group.position_y ?? slot.y,
      scale: group.style_scale ?? master.scale,
      progress: master.progress
        ? {
            ...master.progress,
            segments,
            currentMarks: lit,
            totalMarks: segments,
            ...(group.style_preset_id ? { presetId: group.style_preset_id } : {}),
            ...(group.style_color ? { fillStyle: "plain" as const, plainColor: group.style_color } : {}),
          }
        : master.progress,
    } as CanvasElement;
  });
};

/** `grpbar-<id>` → group id. */
export const groupIdOfBarElementId = (elementId: string): string | null =>
  isGroupBarElementId(elementId) ? elementId.slice(GROUP_BAR_PREFIX.length) : null;

