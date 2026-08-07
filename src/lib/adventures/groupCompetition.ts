// Group competition lifecycle.
//
// Setup (Adventure page): a group is just a named bucket of students. NOTHING is
// duplicated on the stage — every group points at the same master Progress Bar,
// so all groups answer exactly the same Lesson Note questions and a student's
// marks follow them when they move between groups.
//
// Gameplay (dashboard): the Group Competition Board shows each group's live
// progress against that one master bar.

import type { GameRow } from "@/lib/games/types";
import {
  assignManyToGroup,
  createGroup,
  setGroupQualification,
  MAX_GROUPS,
  type AdventureGroup,
} from "./groups";
import { sceneElements } from "./groupBars";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * First unused team name. Names are unique per class+game in the database, so
 * the suggestion skips letters already taken (e.g. after deleting Group B).
 */
export const nextGroupName = (groups: AdventureGroup[]): string => {
  const used = new Set(groups.map((g) => g.name.trim().toLowerCase()));
  for (const l of LETTERS) {
    const candidate = `Group ${l}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return `Group ${groups.length + 1}`;
};

/** A name nobody else in this class+game is using. */
export const uniqueGroupName = (groups: AdventureGroup[], wanted: string): string => {
  const used = new Set(groups.map((g) => g.name.trim().toLowerCase()));
  const base = wanted.trim() || nextGroupName(groups);
  if (!used.has(base.toLowerCase())) return base;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base} ${i}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${Date.now()}`;
};

/** The master bar every group competes on. */
export const primaryBarId = (groups: AdventureGroup[], fallback: string | null): string | null => {
  const primary = groups.find((g) => g.is_primary) ?? groups.find((g) => !g.source_element_id);
  return primary ? primary.progress_element_id : fallback;
};

/**
 * Pick the lesson's Progress Bar — the one that actually carries questions and
 * is not the Time Bar.
 */
export const defaultSourceBarId = (
  game: GameRow | null,
  playableBarIds: string[],
  timeBarId?: string | null,
): string | null => {
  const bars = sceneElements(game).filter((e) => e.kind === "progress_bar" && e.id !== timeBarId);
  const withQuestions = bars.find((b) => playableBarIds.includes(b.id));
  return (withQuestions ?? bars[0])?.id ?? null;
};

export type AddGroupResult =
  | { ok: true; group: AdventureGroup; adopted: boolean }
  | { ok: false; reason: "no_bar" | "max_groups" };

/**
 * Add one group. The first group adopts the whole class; later groups start
 * empty and the teacher moves students into them. No gameplay object is ever
 * duplicated.
 */
export async function addGroup(params: {
  classId: string;
  gameId: string;
  game?: GameRow | null;
  groups: AdventureGroup[];
  memberIds: string[];
  sourceBarId: string | null;
  /** Teacher-supplied group name; falls back to Group A, Group B, … */
  name?: string;
}): Promise<AddGroupResult> {
  const { classId, gameId, groups, memberIds } = params;
  if (groups.length >= MAX_GROUPS) return { ok: false, reason: "max_groups" };
  const master = primaryBarId(groups, params.sourceBarId);
  if (!master) return { ok: false, reason: "no_bar" };
  const name = params.name?.trim() || nextGroupName(groups);
  const first = groups.length === 0;

  const group = await createGroup(classId, gameId, name, master, {
    isPrimary: first,
    sourceElementId: null,
  });
  if (first) await assignManyToGroup(classId, gameId, memberIds, group.id);
  return { ok: true, group, adopted: first };
}

/** Every class member that is not yet in a group joins the primary group. */
export async function backfillUngrouped(params: {
  classId: string;
  gameId: string;
  groups: AdventureGroup[];
  memberIds: string[];
  grouped: Set<string>;
}): Promise<boolean> {
  const { classId, gameId, groups, memberIds, grouped } = params;
  if (groups.length === 0) return false;
  const target = groups.find((g) => g.is_primary) ?? groups[0];
  const missing = memberIds.filter((id) => !grouped.has(id));
  if (missing.length === 0) return false;
  await assignManyToGroup(classId, gameId, missing, target.id);
  return true;
}

/**
 * Adventure — a race. The first group whose progress is complete wins
 * immediately; there is no timer and no waiting.
 */
export function raceWinner(
  groups: AdventureGroup[],
  fillByGroup: Map<string, number>,
): AdventureGroup | null {
  const finished = groups.filter((g) => (fillByGroup.get(g.id) ?? 0) >= 1);
  if (finished.length === 0) return null;
  return (
    finished
      .slice()
      .sort((a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""))[0] ?? null
  );
}

/**
 * Video Adventure — when a Learning Point's Time Progress Bar runs out, every
 * group is evaluated once. Groups that reached the target continue; the others
 * stop travelling and watch the rest of the story.
 */
export async function evaluateCheckpoint(params: {
  sceneId: string;
  groups: AdventureGroup[];
  fillByGroup: Map<string, number>;
}): Promise<{ continuing: AdventureGroup[]; waiting: AdventureGroup[] }> {
  const continuing: AdventureGroup[] = [];
  const waiting: AdventureGroup[] = [];
  for (const g of params.groups) {
    if (!g.qualified) { waiting.push(g); continue; }
    const done = (params.fillByGroup.get(g.id) ?? 0) >= 1;
    (done ? continuing : waiting).push(g);
    if (!done) await setGroupQualification(g.id, false, params.sceneId);
  }
  return { continuing, waiting };
}

/** Independent dashboard status for one group. */
export type GroupStatus = "winner" | "completed" | "eliminated" | "in_progress";

export function groupStatus(params: {
  group: AdventureGroup;
  fill: number;
  mode: "static" | "video";
  winnerGroupId?: string | null;
}): GroupStatus {
  const { group, fill, mode, winnerGroupId } = params;
  if (mode === "static" && winnerGroupId && winnerGroupId === group.id) return "winner";
  if (mode === "video" && !group.qualified) return "eliminated";
  if (fill >= 1) return "completed";
  return "in_progress";
}

export const GROUP_STATUS_LABEL: Record<GroupStatus, string> = {
  winner: "Winner",
  completed: "Completed",
  eliminated: "Watching",
  in_progress: "In Progress",
};
