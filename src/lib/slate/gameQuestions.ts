// Questions are ASSIGNED to a Game, never re-authored inside it. The Game
// stores a reference only; the mathematics, marks and timing stay in the
// Lesson Notes / Floating Numbers question.
//
// CLASS + GAME = ONE PLAYABLE GAME. A question row belongs to a class-and-game
// pair, so SS1 + Quest and SS2 + Quest keep completely separate collections and
// their own order. Rows with no class are the teacher's own legacy/test pool.

import { db } from "@/lib/db/scope";
import {
  DEFAULT_SCORING,
  markForLine,
  type FloatingLine,
  type FloatingScoring,
} from "@/lib/lessonnotes/floatingCompile";

export interface GameQuestion {
  id: string;
  gameId: string;
  /** The class this playable instance belongs to. null = teacher's own pool. */
  classId: string | null;
  position: number;
  notebookId: string;
  subsectionId: string;
  /** The question line's text (Line 0), read-only inside the Game. */
  questionText: string;
  /** Floating Numbers solving lines, in saved order. Game Line N = lines[N-1]. */
  lines: FloatingLine[];
  scoring: FloatingScoring;
  totalMarks: number;
}

interface QuestionRow {
  id: string;
  game_id: string;
  class_id: string | null;
  position: number;
  notebook_id: string;
  subsection_id: string;
}

const questionTextFor = async (subsectionId: string): Promise<string> => {
  const { data } = await db()
    .from("notebook_blocks")
    .select("content_ascii, kind, order_index")
    .eq("subsection_id", subsectionId)
    .eq("kind", "problem")
    .order("order_index", { ascending: true })
    .limit(1);
  return ((data?.[0] as { content_ascii?: string } | undefined)?.content_ascii ?? "").trim();
};

/**
 * Questions of one playable Game instance.
 * `classId` given → only that Class + Game collection.
 * `classId` omitted → the Game's own unscoped pool (teacher legacy/test set).
 */
export const listGameQuestions = async (
  gameId: string,
  classId?: string | null,
): Promise<GameQuestion[]> => {
  let query = db()
    .from("slate_game_questions")
    .select("id, game_id, class_id, position, notebook_id, subsection_id")
    .eq("game_id", gameId);
  query = classId ? query.eq("class_id", classId) : query.is("class_id", null);
  const { data, error } = await query.order("position", { ascending: true });
  if (error || !data) return [];

  const rows = data as unknown as QuestionRow[];
  return Promise.all(
    rows.map(async (row) => {
      const { data: sub } = await db()
        .from("notebook_subsections")
        .select("floating_lines, floating_scoring")
        .eq("id", row.subsection_id)
        .maybeSingle();
      const lines = (((sub as { floating_lines?: unknown } | null)?.floating_lines ?? []) as FloatingLine[]);
      const scoring = {
        ...DEFAULT_SCORING,
        ...(((sub as { floating_scoring?: unknown } | null)?.floating_scoring ?? {}) as Partial<FloatingScoring>),
      };
      return {
        id: row.id,
        gameId: row.game_id,
        classId: row.class_id ?? null,
        position: row.position,
        notebookId: row.notebook_id,
        subsectionId: row.subsection_id,
        questionText: await questionTextFor(row.subsection_id),
        lines,
        scoring,
        totalMarks: lines.reduce((sum, line) => sum + markForLine(line), 0),
      } satisfies GameQuestion;
    }),
  );
};

/**
 * Question → Class → Game. The row joins ONE playable instance, so the same
 * question can be given to SS1 without ever reaching SS2.
 */
export const assignQuestion = async (
  gameId: string,
  notebookId: string,
  subsectionId: string,
  classId?: string | null,
): Promise<boolean> => {
  let countQuery = db()
    .from("slate_game_questions")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);
  countQuery = classId ? countQuery.eq("class_id", classId) : countQuery.is("class_id", null);
  const { count } = await countQuery;

  const { error } = await db().from("slate_game_questions").insert({
    game_id: gameId,
    class_id: classId ?? null,
    notebook_id: notebookId,
    subsection_id: subsectionId,
    position: count ?? 0,
  } as never);
  // A repeat of the same question in the same instance is not a failure.
  if (error && /duplicate key/i.test(error.message)) return true;
  return !error;
};

export const removeQuestion = async (id: string): Promise<boolean> => {
  const { error } = await db().from("slate_game_questions").delete().eq("id", id);
  return !error;
};

/** Writes the given order back as positions 0..n-1. Never duplicates a row. */
export const reorderQuestions = async (ids: string[]): Promise<void> => {
  await Promise.all(
    ids.map((id, index) =>
      db().from("slate_game_questions").update({ position: index } as never).eq("id", id),
    ),
  );
};

export interface PickableQuestion {
  notebookId: string;
  notebookTitle: string;
  subsectionId: string;
  label: string;
  lineCount: number;
}

/** Every question of the teacher's notebooks that has saved Floating Numbers. */
export const listPickableQuestions = async (): Promise<PickableQuestion[]> => {
  const { data: notebooks } = await db()
    .from("notebooks")
    .select("id, title")
    .order("updated_at", { ascending: false })
    .limit(60);
  if (!notebooks?.length) return [];

  const out: PickableQuestion[] = [];
  for (const nb of notebooks as { id: string; title: string }[]) {
    const { data: sections } = await db()
      .from("notebook_sections")
      .select("id")
      .eq("notebook_id", nb.id);
    const sectionIds = (sections ?? []).map((s) => (s as { id: string }).id);
    if (!sectionIds.length) continue;
    const { data: subs } = await db()
      .from("notebook_subsections")
      .select("id, order_index, floating_lines, section_id")
      .in("section_id", sectionIds)
      .order("order_index", { ascending: true });
    (subs ?? []).forEach((raw) => {
      const sub = raw as { id: string; order_index: number; floating_lines?: unknown };
      const lines = Array.isArray(sub.floating_lines) ? (sub.floating_lines as unknown[]) : [];
      if (lines.length === 0) return;
      out.push({
        notebookId: nb.id,
        notebookTitle: nb.title ?? "Untitled note",
        subsectionId: sub.id,
        label: `Question ${(sub.order_index ?? 0) + 1}`,
        lineCount: lines.length,
      });
    });
  }
  return out;
};
