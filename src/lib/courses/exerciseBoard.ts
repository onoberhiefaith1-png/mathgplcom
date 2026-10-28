// Exercise Card → the student's solving board.
//
// An Exercise Card links real Lesson Note questions. To let a student solve
// them we reuse the EXISTING assessment record shape and the existing marking
// engine: one hidden assessment per Exercise Card, holding exactly the linked
// questions, in the class the course was assigned to.
//
// The teacher (class owner) prepares these records — assessments are owner-only
// writable — so the student only ever reads.

import { supabase } from "@/integrations/supabase/client";
import {
  compileSectionQuestions,
  type AnswerKeyLine,
  type QuestionPayload,
} from "@/lib/assessments/createAssessment";
import {
  deleteFrozenQuestion,
  freezeQuestion,
  questionMarks,
  readFrozenAnswerKeys,
  readFrozenQuestions,
} from "@/lib/assessments/snapshot";
import type { CourseExerciseQuestion } from "./types";
import { ensureTestClass } from "@/lib/floating/testBoard";
import { videoLinesFromQuestion, type VideoLine } from "./questionVideo";

/** Marks this assessment as belonging to an Exercise Card, never an assignment. */
export const COURSE_EXERCISE_KIND = "course_exercise";

export interface ExerciseBoard {
  assessmentId: string;
  blockId: string;
  questions: { id: string; label: string; marks: number; lines: VideoLine[] }[];
  total: number;
}

export interface ExerciseTallyInput {
  questions: { id: string; marks: number }[];
  /** Marks earned per question id (from the student's own progress). */
  earnedByQuestion: Record<string, number>;
  passMark: number;
}

export interface ExerciseTally {
  earned: number;
  total: number;
  percent: number;
  solved: number;
  passed: boolean;
}

/** Pure roll-up used by the card and the question list. */
export const exerciseTally = (input: ExerciseTallyInput): ExerciseTally => {
  const total = input.questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);
  let earned = 0;
  let solved = 0;
  for (const q of input.questions) {
    const got = Number(input.earnedByQuestion[q.id] ?? 0);
    if (input.earnedByQuestion[q.id] !== undefined) solved += 1;
    earned += Number.isFinite(got) ? got : 0;
  }
  const percent = total > 0 ? Math.round((earned / total) * 100) : 0;
  return { earned, total, percent, solved, passed: total > 0 && percent >= input.passMark };
};

type Db = { from: (t: string) => any };
const db = supabase as unknown as Db;

/** The prepared board for one Exercise Card in one class, or null. */
export const findCourseExerciseAssessment = async (
  classId: string,
  blockId: string,
): Promise<ExerciseBoard | null> => {
  const { data } = await db
    .from("assessments")
    .select("id, questions, total_marks")
    .eq("class_id", classId)
    .eq("kind", COURSE_EXERCISE_KIND)
    .eq("question_key", blockId)
    .order("created_at", { ascending: true })
    .limit(1);
  const row = ((data ?? []) as { id: string; questions: unknown; total_marks: number }[])[0];
  if (!row) return null;
  const payload = (Array.isArray(row.questions) ? row.questions : []) as QuestionPayload[];
  return {
    assessmentId: row.id,
    blockId,
    questions: payload.map((q, i) => ({
      id: q.id,
      label: `Question ${i + 1}`,
      marks: (q.lines ?? []).reduce((s, l) => s + (Number(l.marks) || 0), 0),
      lines: videoLinesFromQuestion(q.lines),
    })),
    total: Number(row.total_marks) || 0,
  };
};

/** One row of a card's question list — always one entry per saved link. */
export interface ExerciseCardEntry {
  /** The `course_exercise_questions` row id (used to remove a dead link). */
  linkId: string;
  /** The question id the board opens with (the lesson-note question row). */
  questionId: string;
  label: string;
  marks: number;
  /** The compiled question, or null when its source note cannot be found. */
  payload: QuestionPayload | null;
  missing: boolean;
}

export interface ExerciseCard {
  blockId: string;
  title: string;
  passMark: number;
  entries: ExerciseCardEntry[];
  /** Marks of the resolvable questions plus the saved marks of the rest. */
  total: number;
}

const norm = (s: unknown): string => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Sections that may hold this link's question, most authoritative first. */
const candidateSections = async (link: CourseExerciseQuestion): Promise<string[]> => {
  const out: string[] = [];
  if (link.section_id) out.push(link.section_id);
  // The note may have been re-created: its durable key is the section's
  // stable_key, saved on the link as question_key.
  if (link.question_key) {
    let q = db.from("notebook_sections").select("id").eq("stable_key", link.question_key);
    if (link.notebook_id) q = q.eq("notebook_id", link.notebook_id);
    const { data } = await q;
    for (const row of ((data ?? []) as { id: string }[])) {
      if (!out.includes(row.id)) out.push(row.id);
    }
  }
  return out;
};

/**
 * Resolve every link of a card, in card order — never a shortened list.
 *
 * FROZEN COPY FIRST. A link that already carries its own copy of the question
 * is served from that copy and the Lesson Note is never touched, so a note that
 * was edited, moved, renamed or deleted cannot change what students solve.
 * Only a legacy link without a copy is compiled from the note — and it is then
 * frozen once, quietly, so it is independent from that moment on.
 */
const resolveLinks = async (
  links: CourseExerciseQuestion[],
): Promise<{ entries: ExerciseCardEntry[]; answerKey: AnswerKeyLine[]; total: number }> => {
  const ordered = [...links].sort((a, b) => a.position - b.position);

  // 1. The frozen copies, in one round trip.
  const frozenIds = ordered.map((l) => (l as { assigned_question_id?: string | null }).assigned_question_id ?? null);
  const [frozen, frozenKeys] = await Promise.all([
    readFrozenQuestions(frozenIds),
    readFrozenAnswerKeys(frozenIds),
  ]);
  const hasCopy = (i: number): boolean => {
    const id = frozenIds[i];
    return !!id && frozen.has(id);
  };

  // 2. Only links without a copy still need the Lesson Note.
  const candidates: string[][] = [];
  await Promise.all(
    ordered.map(async (link, i) => {
      candidates[i] = hasCopy(i) ? [] : await candidateSections(link);
    }),
  );

  const compiles = new Map<string, Promise<Awaited<ReturnType<typeof compileSectionQuestions>>>>();
  for (const list of candidates) {
    for (const sectionId of list ?? []) {
      if (compiles.has(sectionId)) continue;
      compiles.set(
        sectionId,
        compileSectionQuestions(sectionId).catch(() => ({ questions: [], answerKey: [], total: 0 })),
      );
    }
  }
  const bySection = new Map<string, Awaited<ReturnType<typeof compileSectionQuestions>>>();
  await Promise.all(
    [...compiles.entries()].map(async ([id, p]) => { bySection.set(id, await p); }),
  );

  // 3. Match in card order — pure, no I/O.
  const entries: ExerciseCardEntry[] = [];
  const answerKey: AnswerKeyLine[] = [];
  const backfill: { link: CourseExerciseQuestion; payload: QuestionPayload; key: AnswerKeyLine[] }[] = [];
  let total = 0;

  ordered.forEach((link, i) => {
    const label = link.label || "Lesson note question";
    const saved = Number(link.total_marks) || 0;
    let payload: QuestionPayload | null = null;
    let matchedKey: AnswerKeyLine[] = [];

    const copyId = frozenIds[i];
    const copy = copyId ? frozen.get(copyId) : undefined;
    if (copy) {
      payload = copy.question;
      matchedKey = copyId ? (frozenKeys.get(copyId) ?? []) : [];
    } else {
      for (const sectionId of candidates[i] ?? []) {
        const compiled = bySection.get(sectionId);
        if (!compiled) continue;
        const hit =
          (link.subsection_id ? compiled.questions.find((q) => q.id === link.subsection_id) : null) ??
          (label ? compiled.questions.find((q) => norm(q.questionText) === norm(label)) : null) ??
          null;
        if (!hit) continue;
        payload = hit;
        matchedKey = compiled.answerKey.filter((k) => k.questionId === hit.id);
        break;
      }
      if (payload) backfill.push({ link, payload, key: matchedKey });
    }

    const marks = payload ? questionMarks(payload) : saved;
    total += marks;
    answerKey.push(...matchedKey);
    entries.push({
      linkId: link.id,
      questionId: payload?.id ?? link.subsection_id ?? link.id,
      label,
      marks,
      payload,
      missing: !payload,
    });
  });

  // 4. Legacy links become independent, once, in the background.
  if (backfill.length > 0) void freezeExistingLinks(backfill);

  return { entries, answerKey, total };
};

/** One-time backfill: give a legacy link its own frozen copy. */
const freezeExistingLinks = async (
  items: { link: CourseExerciseQuestion; payload: QuestionPayload; key: AnswerKeyLine[] }[],
): Promise<void> => {
  for (const item of items) {
    try {
      const id = await freezeQuestion({
        question: item.payload,
        answerKey: item.key,
        source: {
          notebookId: item.link.notebook_id,
          sectionId: item.link.section_id,
          subsectionId: item.link.subsection_id,
          label: item.link.label,
        },
      });
      if (!id) continue;
      await db
        .from("course_exercise_questions")
        .update({ assigned_question_id: id, total_marks: questionMarks(item.payload) })
        .eq("id", item.link.id)
        .is("assigned_question_id", null);
    } catch {
      /* the card keeps working from the note until the copy succeeds */
    }
  }
};


/** Compile the questions linked to one Exercise Card, in card order. */
const compileExercise = async (
  links: CourseExerciseQuestion[],
): Promise<{ questions: QuestionPayload[]; answerKey: AnswerKeyLine[]; total: number }> => {
  const { entries, answerKey } = await resolveLinks(links);
  const resolved = entries.filter((e) => e.payload);
  return {
    questions: resolved.map((e) => e.payload as QuestionPayload),
    answerKey,
    total: resolved.reduce((s, e) => s + e.marks, 0),
  };
};

/**
 * The card's own question list — the single source of truth for the count, the
 * total marks and the list page. Reads the saved links only; no assessment
 * record is created and nothing a student can reach is touched.
 */
export const loadExerciseCard = async (blockId: string): Promise<ExerciseCard> => {
  const [{ data: linkRows }, { data: blockRow }] = await Promise.all([
    db.from("course_exercise_questions").select("*").eq("block_id", blockId),
    db.from("course_blocks").select("config").eq("id", blockId).maybeSingle(),
  ]);
  const links = (linkRows ?? []) as CourseExerciseQuestion[];
  const config = (blockRow as { config?: { name?: string; passMark?: number } } | null)?.config ?? {};
  const { entries, total } = await resolveLinks(links);
  return {
    blockId,
    title: String(config.name ?? "Exercise"),
    passMark: Number(config.passMark ?? 80),
    entries,
    total,
  };
};

/**
 * The card WITHOUT resolving its lesson notes — links only, one round trip.
 * The question list paints from this immediately; marks and the solving payload
 * arrive from `loadExerciseCard` right after.
 */
export const loadExerciseCardShell = async (blockId: string): Promise<ExerciseCard> => {
  const [{ data: linkRows }, { data: blockRow }] = await Promise.all([
    db.from("course_exercise_questions").select("*").eq("block_id", blockId),
    db.from("course_blocks").select("config").eq("id", blockId).maybeSingle(),
  ]);
  const links = ((linkRows ?? []) as CourseExerciseQuestion[]).sort((a, b) => a.position - b.position);
  const config = (blockRow as { config?: { name?: string; passMark?: number } } | null)?.config ?? {};
  const entries: ExerciseCardEntry[] = links.map((link) => ({
    linkId: link.id,
    questionId: link.subsection_id ?? link.id,
    label: link.label || "Lesson note question",
    marks: Number(link.total_marks) || 0,
    payload: null,
    missing: false,
  }));
  return {
    blockId,
    title: String(config.name ?? "Exercise"),
    passMark: Number(config.passMark ?? 80),
    entries,
    total: entries.reduce((s, e) => s + e.marks, 0),
  };
};


/** Remove one dead link from a card (the link only — never the lesson note).
 *  The link's frozen copy of the question goes with it; nothing else does. */
export const removeExerciseLink = async (linkId: string): Promise<void> => {
  const { data } = await db
    .from("course_exercise_questions")
    .select("assigned_question_id")
    .eq("id", linkId)
    .maybeSingle();
  await db.from("course_exercise_questions").delete().eq("id", linkId);
  await deleteFrozenQuestion((data as { assigned_question_id?: string | null } | null)?.assigned_question_id ?? null);
};

/**
 * Class-free compile of one Exercise Card, straight from its question links —
 * the teacher's own testing surface inside the Course Builder.
 */
export const compileExerciseBoard = async (
  blockId: string,
): Promise<{ id: string; title: string; questions: QuestionPayload[]; total: number }> => {
  const card = await loadExerciseCard(blockId);
  const resolved = card.entries.filter((e) => e.payload);
  return {
    id: blockId,
    title: card.title,
    questions: resolved.map((e) => e.payload as QuestionPayload),
    total: resolved.reduce((s, e) => s + e.marks, 0),
  };
};

/* ── Exercise Card question → the EXISTING Test Smartboard ────────────────
   The teacher tests ONE linked question on the same student board used by
   Floating Numbers → Test. No second board, no second marking engine: only a
   hidden per-teacher container so the existing engine has an assessment to
   read. Nothing here is ever visible to a student. */

/** Own kind so it can never collide with the Floating Numbers test board. */
export const COURSE_EXERCISE_TEST_KIND = "course_exercise_test";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ExerciseQuestionTestBoard {
  assessmentId: string;
  classId: string;
  question: QuestionPayload;
  total: number;
  title: string;
  /** Fresh per entry — every open is a brand new, disposable sitting. */
  sittingId: string;
}

const openExerciseQuestionTestBoard = async (
  blockId: string,
  questionId: string,
): Promise<ExerciseQuestionTestBoard> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("You need to be signed in to test on the Smartboard.");

  const [{ data: linkRows }, { data: blockRow }] = await Promise.all([
    db.from("course_exercise_questions").select("*").eq("block_id", blockId),
    db.from("course_blocks").select("config").eq("id", blockId).maybeSingle(),
  ]);
  const links = (linkRows ?? []) as CourseExerciseQuestion[];
  const config = (blockRow as { config?: { name?: string } } | null)?.config ?? {};
  const cardTitle = String(config.name ?? "Exercise");

  const { entries, answerKey } = await resolveLinks(links);
  const entry = entries.find((e) => e.questionId === questionId && e.payload);
  if (!entry?.payload) {
    throw new Error("This question's lesson note could not be loaded.");
  }
  const question = entry.payload;
  const keyLines = answerKey.filter((k) => k.questionId === question.id);
  const total = (question.lines ?? []).reduce((s, l) => s + (Number(l.marks) || 0), 0);

  const classId = await ensureTestClass(uid);
  // The container is keyed on the question's own id — a single uuid. A joined
  // pair (block:question) is not a uuid and the column rejects it.
  const questionKey = questionId;
  if (!UUID_RE.test(questionKey)) {
    throw new Error("This question cannot be tested: its link is missing a valid question id.");
  }

  const { data: rows } = await db
    .from("assessments")
    .select("id")
    .eq("class_id", classId)
    .eq("kind", COURSE_EXERCISE_TEST_KIND)
    .eq("question_key", questionKey)
    .order("created_at", { ascending: true });
  const list = (rows ?? []) as { id: string }[];
  let assessmentId = list[0]?.id ?? null;
  if (list.length > 1) {
    await db.from("assessments").delete().in("id", list.slice(1).map((r) => r.id));
  }

  if (assessmentId) {
    await db
      .from("assessments")
      .update({
        title: `${cardTitle} — test`,
        total_marks: total,
        questions: [question] as never,
        unassigned_at: new Date().toISOString(),
      } as never)
      .eq("id", assessmentId);
  } else {
    const { data: created, error } = await db
      .from("assessments")
      .insert({
        class_id: classId,
        owner_id: uid,
        question_key: questionKey,
        kind: COURSE_EXERCISE_TEST_KIND,
        title: `${cardTitle} — test`,
        score_label: "marks",
        total_marks: total,
        questions: [question] as never,
        unassigned_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not open the test board");
    assessmentId = created.id as string;
  }

  await writeAnswerKey(assessmentId, keyLines);
  // A test never keeps results: clear anything an earlier sitting left behind.
  await db.from("assessment_progress").delete().eq("assessment_id", assessmentId);

  return {
    assessmentId,
    classId,
    question,
    total,
    title: cardTitle,
    sittingId: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  };
};

/** Single-flight: a second open for the same question shares the in-flight one. */
const testBoardInFlight = new Map<string, Promise<ExerciseQuestionTestBoard>>();

export const ensureExerciseQuestionTestBoard = (
  blockId: string,
  questionId: string,
): Promise<ExerciseQuestionTestBoard> => {
  const k = `${blockId}:${questionId}`;
  const running = testBoardInFlight.get(k);
  if (running) return running;
  const p = openExerciseQuestionTestBoard(blockId, questionId).finally(() => {
    testBoardInFlight.delete(k);
  });
  testBoardInFlight.set(k, p);
  return p;
};



const writeAnswerKey = async (assessmentId: string, lines: AnswerKeyLine[]): Promise<void> => {
  const { error } = await db
    .from("assessment_answer_keys")
    .upsert({ assessment_id: assessmentId, lines: lines as never }, { onConflict: "assessment_id" });
  if (error && (error as { code?: string }).code !== "23505") {
    await db.from("assessment_answer_keys").update({ lines: lines as never }).eq("assessment_id", assessmentId);
  }
};

/**
 * Prepare (or refresh) one hidden assessment per Exercise Card for every course
 * assigned to this class. Owner-only: called from the teacher's class Courses
 * page and right after a course is assigned. Safe to call repeatedly — one
 * record per card, updated in place.
 */
export const syncCourseExerciseAssessments = async (classId: string): Promise<void> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;

  const { data: assigned } = await db
    .from("class_course_assignments")
    .select("course_id")
    .eq("class_id", classId);
  const courseIds = ((assigned ?? []) as { course_id: string }[]).map((r) => r.course_id);
  if (courseIds.length === 0) return;

  const { data: sectionRows } = await db
    .from("course_sections")
    .select("id, course_id")
    .in("course_id", courseIds);
  const sectionIds = ((sectionRows ?? []) as { id: string }[]).map((s) => s.id);
  if (sectionIds.length === 0) return;

  const { data: blockRows } = await db
    .from("course_blocks")
    .select("id, kind, config")
    .in("section_id", sectionIds);
  const exercises = ((blockRows ?? []) as { id: string; kind: string; config: any }[]).filter(
    (b) => b.kind === "exercise",
  );
  if (exercises.length === 0) return;

  const { data: linkRows } = await db
    .from("course_exercise_questions")
    .select("*")
    .in("block_id", exercises.map((b) => b.id));
  const links = (linkRows ?? []) as CourseExerciseQuestion[];

  for (const block of exercises) {
    const own = links.filter((l) => l.block_id === block.id);
    if (own.length === 0) continue;
    const { questions, answerKey, total } = await compileExercise(own);
    if (questions.length === 0) continue;

    const title = `${String(block.config?.name ?? "Exercise")} — exercise`;
    const notebookId = own.find((l) => l.notebook_id)?.notebook_id ?? null;
    const sectionId = own.find((l) => l.section_id)?.section_id ?? null;

    const { data: existingRows } = await db
      .from("assessments")
      .select("id")
      .eq("class_id", classId)
      .eq("kind", COURSE_EXERCISE_KIND)
      .eq("question_key", block.id)
      .order("created_at", { ascending: true });
    const existing = (existingRows ?? []) as { id: string }[];
    const keep = existing[0]?.id ?? null;
    if (existing.length > 1) {
      await db.from("assessments").delete().in("id", existing.slice(1).map((r) => r.id));
    }

    let assessmentId: string | null = keep;
    if (assessmentId) {
      await db
        .from("assessments")
        .update({
          notebook_id: notebookId,
          section_id: sectionId,
          title,
          total_marks: total,
          questions: questions as never,
          // Hidden from every assignment list; reached only through the card.
          unassigned_at: new Date().toISOString(),
        })
        .eq("id", assessmentId);
    } else {
      const { data: created } = await db
        .from("assessments")
        .insert({
          class_id: classId,
          owner_id: uid,
          notebook_id: notebookId,
          section_id: sectionId,
          question_key: block.id,
          kind: COURSE_EXERCISE_KIND,
          title,
          score_label: "Marks",
          total_marks: total,
          questions: questions as never,
          unassigned_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      assessmentId = (created as { id?: string } | null)?.id ?? null;
    }
    if (assessmentId) await writeAnswerKey(assessmentId, answerKey);
  }
};

/** The raw compiled payload of one Exercise Card's hidden assessment. */
export const findCourseExerciseAssessmentRaw = async (
  classId: string,
  blockId: string,
): Promise<{ id: string; title: string; questions: QuestionPayload[] } | null> => {
  const { data } = await db
    .from("assessments")
    .select("id, title, questions")
    .eq("class_id", classId)
    .eq("kind", COURSE_EXERCISE_KIND)
    .eq("question_key", blockId)
    .order("created_at", { ascending: true })
    .limit(1);
  const row = ((data ?? []) as { id: string; title: string | null; questions: unknown }[])[0];
  if (!row) return null;
  return {
    id: row.id,
    title: row.title ?? "Exercise",
    questions: (Array.isArray(row.questions) ? row.questions : []) as QuestionPayload[],
  };
};

/* ── Guest Link exercises ──────────────────────────────────────────────────
   A Guest Link opens the ORIGINAL course. Its Exercise Cards still need a
   container the existing marking engine can read, so one hidden per-teacher
   record is prepared per card. Guest marks are written to `guest_attempts` —
   never to a student's progress. */

export const COURSE_EXERCISE_GUEST_KIND = "course_exercise_guest";

/** Prepare (or refresh) the guest container for every Exercise Card of a
 *  course. Owner-only; safe to call whenever the guest link is opened. */
export const syncGuestExerciseAssessments = async (courseId: string): Promise<void> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;

  const { data: sectionRows } = await db
    .from("course_sections")
    .select("id")
    .eq("course_id", courseId);
  const sectionIds = ((sectionRows ?? []) as { id: string }[]).map((s) => s.id);
  if (sectionIds.length === 0) return;

  const { data: blockRows } = await db
    .from("course_blocks")
    .select("id, kind, config")
    .in("section_id", sectionIds);
  const exercises = ((blockRows ?? []) as { id: string; kind: string; config: any }[]).filter(
    (b) => b.kind === "exercise",
  );
  if (exercises.length === 0) return;

  const { data: linkRows } = await db
    .from("course_exercise_questions")
    .select("*")
    .in("block_id", exercises.map((b) => b.id));
  const links = (linkRows ?? []) as CourseExerciseQuestion[];
  const classId = await ensureTestClass(uid);

  for (const block of exercises) {
    const own = links.filter((l) => l.block_id === block.id);
    if (own.length === 0) continue;
    const { questions, answerKey, total } = await compileExercise(own);
    if (questions.length === 0) continue;

    const title = `${String(block.config?.name ?? "Exercise")} — guest`;
    const notebookId = own.find((l) => l.notebook_id)?.notebook_id ?? null;
    const sectionId = own.find((l) => l.section_id)?.section_id ?? null;

    const { data: existingRows } = await db
      .from("assessments")
      .select("id")
      .eq("class_id", classId)
      .eq("kind", COURSE_EXERCISE_GUEST_KIND)
      .eq("question_key", block.id)
      .order("created_at", { ascending: true });
    const existing = (existingRows ?? []) as { id: string }[];
    let assessmentId: string | null = existing[0]?.id ?? null;
    if (existing.length > 1) {
      await db.from("assessments").delete().in("id", existing.slice(1).map((r) => r.id));
    }

    if (assessmentId) {
      await db
        .from("assessments")
        .update({
          notebook_id: notebookId,
          section_id: sectionId,
          title,
          total_marks: total,
          questions: questions as never,
          unassigned_at: new Date().toISOString(),
        })
        .eq("id", assessmentId);
    } else {
      const { data: created } = await db
        .from("assessments")
        .insert({
          class_id: classId,
          owner_id: uid,
          notebook_id: notebookId,
          section_id: sectionId,
          question_key: block.id,
          kind: COURSE_EXERCISE_GUEST_KIND,
          title,
          score_label: "Marks",
          total_marks: total,
          questions: questions as never,
          unassigned_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      assessmentId = (created as { id?: string } | null)?.id ?? null;
    }
    if (assessmentId) await writeAnswerKey(assessmentId, answerKey);
  }
};
