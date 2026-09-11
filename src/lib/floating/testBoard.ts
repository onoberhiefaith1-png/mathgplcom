// Floating Number → question-scoped test board.
//
// The teacher tests ONE question/solution on the EXISTING student Smartboard.
// Nothing here is a second board, a second marking engine or a second question
// model: the same compiler, the same assessment record shape and the same
// grade-line engine are reused. The only new thing is a hidden per-teacher
// container that holds the test question so the existing engine can read it.

import { supabase } from "@/integrations/supabase/client";
import {
  compileSectionQuestions,
  type AnswerKeyLine,
  type QuestionPayload,
} from "@/lib/assessments/createAssessment";
import { diag } from "@/lib/diagnostics/opLog";
import type { SmartboardLessonSource } from "@/lib/smartboard/presentation";

/** Hidden workspace value — Teaching Hub only lists `classroom` classes. */
export const FLOATING_TEST_WORKSPACE = "floating_test";
const TEST_KIND = "floating_test";

export interface FloatingTestBoard {
  assessmentId: string;
  classId: string;
  notebookId: string | null;
  sectionId: string;
  question: QuestionPayload;
  total: number;
  title: string;
  /** Exact saved lesson source used by Main and Classroom Smartboards. */
  boardSource: SmartboardLessonSource;
  /** Fresh per entry — every open is a brand new, disposable sitting. */
  sittingId: string;
}


const code = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `FT${out}`;
};

/** One hidden container per teacher, created once and reused forever. */
export async function ensureTestClass(ownerId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("classes")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("workspace", FLOATING_TEST_WORKSPACE)
    .order("created_at", { ascending: true })
    .limit(1);
  const hit = (existing ?? [])[0]?.id as string | undefined;
  if (hit) return hit;

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("classes")
      .insert({
        name: "Floating Number Test",
        description: "Private testing surface — never visible to students.",
        class_code: code(),
        owner_id: ownerId,
        workspace: FLOATING_TEST_WORKSPACE,
      })
      .select("id")
      .single();
    if (!error && data) return data.id as string;
    lastError = error;
    if (error && (error as { code?: string }).code !== "23505") break;
  }
  throw new Error(
    String((lastError as { message?: string })?.message ?? "Could not open the test board"),
  );
}

/**
 * Compile the ONE question the teacher is editing and make it available to the
 * existing student board. Returns the record ids the board needs.
 *
 * Question scoping is exact: `question.id === subsectionId`, so no other
 * example, question or part of the lesson note is ever loaded.
 */
async function openFloatingTestBoard(subsectionId: string): Promise<FloatingTestBoard> {
  const end = diag.start("floating.test.open", { subsectionId });
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error("You need to be signed in to test on the Smartboard.");

    const { data: sub } = await supabase
      .from("notebook_subsections")
      .select("id, section_id")
      .eq("id", subsectionId)
      .maybeSingle();
    const sectionId = (sub as { section_id?: string } | null)?.section_id;
    if (!sectionId) throw new Error("This solution could not be found.");

    const { data: section } = await supabase
      .from("notebook_sections")
      .select("id, notebook_id")
      .eq("id", sectionId)
      .maybeSingle();
    const notebookId = (section as { notebook_id?: string } | null)?.notebook_id ?? null;

    let title = "Floating Number test";
    if (notebookId) {
      const { data: nb } = await supabase
        .from("notebooks")
        .select("title, subtopic")
        .eq("id", notebookId)
        .maybeSingle();
      const n = nb as { title?: string; subtopic?: string } | null;
      title = n?.subtopic || n?.title || title;
    }

    const compiled = await compileSectionQuestions(sectionId);
    const compiledQuestion = compiled.questions.find((q) => q.id === subsectionId);
    if (!compiledQuestion) {
      throw new Error("Generate the floating numbers for this solution before testing.");
    }
    const beatId = `${subsectionId}-q`;
    const question: QuestionPayload = { ...compiledQuestion, id: beatId };
    const answerKey: AnswerKeyLine[] = compiled.answerKey
      .filter((k) => k.questionId === subsectionId)
      .map((line) => ({ ...line, questionId: beatId }));
    const canonicalBeat = compiled.lessonSource?.beats.find((beat) => beat.id === beatId);
    const canonicalReservoir = compiled.lessonSource?.reservoirs.find((reservoir) => reservoir.beatId === beatId);
    if (!canonicalBeat || !canonicalReservoir) {
      throw new Error("Generate the floating numbers for this solution before testing.");
    }
    const boardSource: SmartboardLessonSource = {
      beats: [canonicalBeat],
      reservoirs: [canonicalReservoir],
      title: `${title} — test`,
    };
    const total = question.lines.reduce((s, l) => s + (Number(l.marks) || 0), 0);

    const classId = await ensureTestClass(uid);

    const { data: rows } = await supabase
      .from("assessments")
      .select("id")
      .eq("class_id", classId)
      .eq("kind", TEST_KIND)
      .eq("question_key", subsectionId)
      .order("created_at", { ascending: true });
    const list = (rows ?? []) as { id: string }[];
    const keep = list[0]?.id ?? null;
    if (list.length > 1) {
      await supabase.from("assessments").delete().in("id", list.slice(1).map((r) => r.id));
    }

    let assessmentId = keep;
    if (assessmentId) {
      await supabase
        .from("assessments")
        .update({
          notebook_id: notebookId,
          section_id: sectionId,
          title: `${title} — test`,
          total_marks: total,
          questions: [question] as never,
          unassigned_at: new Date().toISOString(),
        } as never)
        .eq("id", assessmentId);
    } else {
      const { data: created, error: insErr } = await supabase
        .from("assessments")
        .insert({
          class_id: classId,
          owner_id: uid,
          notebook_id: notebookId,
          section_id: sectionId,
          question_key: subsectionId,
          kind: TEST_KIND,
          title: `${title} — test`,
          score_label: "marks",
          total_marks: total,
          questions: [question] as never,
          unassigned_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insErr || !created) {
        throw new Error(insErr?.message ?? "Could not open the test board");
      }
      assessmentId = created.id as string;
    }

    // One conflict-safe write. Repeated opens can never collide on the
    // primary key, so the duplicate-key condition cannot occur at all.
    const { error: keyErr } = await supabase
      .from("assessment_answer_keys")
      .upsert(
        { assessment_id: assessmentId, lines: answerKey as never },
        { onConflict: "assessment_id" },
      );
    if (keyErr && (keyErr as { code?: string }).code !== "23505") {
      // A 23505 here means the identical row already exists — the desired
      // end state — so only genuine failures are surfaced.
      const { error: updErr } = await supabase
        .from("assessment_answer_keys")
        .update({ lines: answerKey as never })
        .eq("assessment_id", assessmentId);
      if (updErr) throw new Error(updErr.message);
    }

    // A test never keeps results: clear anything an earlier test left behind.
    await supabase.from("assessment_progress").delete().eq("assessment_id", assessmentId);

    const sittingId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    end("ok", { assessmentId, questionId: subsectionId, total });
    return { assessmentId, classId, notebookId, sectionId, question, total, title, boardSource, sittingId };

  } catch (error) {
    end("fail", { error: String((error as Error)?.message ?? error) });
    throw error;
  }
}

/**
 * Single-flight entry point. A second open for the same solution while one is
 * already running shares the in-flight result instead of racing it, so the
 * test record and its answer key are never written twice concurrently.
 */
const inFlight = new Map<string, Promise<FloatingTestBoard>>();

export function ensureFloatingTestBoard(subsectionId: string): Promise<FloatingTestBoard> {
  const running = inFlight.get(subsectionId);
  if (running) return running;
  const p = openFloatingTestBoard(subsectionId).finally(() => {
    inFlight.delete(subsectionId);
  });
  inFlight.set(subsectionId, p);
  return p;
}
