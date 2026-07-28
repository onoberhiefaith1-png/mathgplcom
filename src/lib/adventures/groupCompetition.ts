// Group competition lifecycle: adopt the existing Progress Bar as Group A, then
// duplicate it for every additional group. All groups share ONE assessment (the
// same Lesson Note questions), so a student's marks follow them when they move
// between groups.

import { supabase } from "@/integrations/supabase/client";
import type { GameRow } from "@/lib/games/types";
import {
  assignManyToGroup,
  createGroup,
  setGroupBarElement,
  type AdventureGroup,
} from "./groups";
import { groupBarElementId, nextGroupBarPosition, sceneElements } from "./groupBars";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const nextGroupName = (groups: AdventureGroup[]): string =>
  `Group ${LETTERS[groups.length] ?? String(groups.length + 1)}`;

/** The bar every group's bar is copied from. */
export const primaryBarId = (groups: AdventureGroup[], fallback: string | null): string | null => {
  const primary = groups.find((g) => g.is_primary) ?? groups.find((g) => !g.source_element_id);
  return primary ? primary.source_element_id ?? primary.progress_element_id : fallback;
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

/** Copy the source bar's board so the clone answers exactly the same questions. */
async function cloneBoardRow(
  classId: string,
  gameId: string,
  sourceElementId: string,
  cloneElementId: string,
): Promise<void> {
  const { data: rows } = await supabase
    .from("class_game_boards")
    .select("assessment_id, notebook_id, section_id, required_marks, question_keys, assignment_id")
    .eq("class_id", classId)
    .eq("game_id", gameId)
    .eq("progress_element_id", sourceElementId)
    .limit(1);
  const src = (rows ?? [])[0] as
    | {
        assessment_id: string;
        notebook_id: string | null;
        section_id: string | null;
        required_marks: number | null;
        question_keys: string[] | null;
        assignment_id: string | null;
      }
    | undefined;
  if (!src) return;

  const { data: existing } = await supabase
    .from("class_game_boards")
    .select("id")
    .eq("class_id", classId)
    .eq("game_id", gameId)
    .eq("progress_element_id", cloneElementId)
    .limit(1);
  if ((existing ?? []).length > 0) return;

  await supabase.from("class_game_boards").insert({
    class_id: classId,
    game_id: gameId,
    progress_element_id: cloneElementId,
    assessment_id: src.assessment_id,
    notebook_id: src.notebook_id,
    section_id: src.section_id,
    required_marks: src.required_marks,
    question_keys: src.question_keys ?? [],
    assignment_id: src.assignment_id,
  } as never);
}

export type AddGroupResult =
  | { ok: true; group: AdventureGroup; adopted: boolean }
  | { ok: false; reason: "no_bar" | "no_space" };

/**
 * Add one group.
 * First call adopts the existing bar as Group A and puts every student in it.
 * Later calls duplicate that bar into free space.
 */
export async function addGroup(params: {
  classId: string;
  gameId: string;
  game: GameRow | null;
  groups: AdventureGroup[];
  memberIds: string[];
  sourceBarId: string | null;
}): Promise<AddGroupResult> {
  const { classId, gameId, game, groups, memberIds } = params;
  const source = primaryBarId(groups, params.sourceBarId);
  if (!source) return { ok: false, reason: "no_bar" };

  // First group — adopt the existing bar, nothing is duplicated.
  if (groups.length === 0) {
    const group = await createGroup(classId, gameId, nextGroupName(groups), source, {
      isPrimary: true,
      sourceElementId: null,
    });
    await assignManyToGroup(classId, gameId, memberIds, group.id);
    return { ok: true, group, adopted: true };
  }

  const pos = nextGroupBarPosition(game, groups, source);
  if (!pos) return { ok: false, reason: "no_space" };

  const group = await createGroup(classId, gameId, nextGroupName(groups), `pending-${Date.now()}`, {
    sourceElementId: source,
    isPrimary: false,
    x: pos.x,
    y: pos.y,
  });
  const elementId = groupBarElementId(group.id);
  await setGroupBarElement(group.id, elementId);
  await cloneBoardRow(classId, gameId, source, elementId);
  return { ok: true, group: { ...group, progress_element_id: elementId }, adopted: false };
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
