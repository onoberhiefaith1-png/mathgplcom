// Speed Performance — reporting layer over the existing assignment timer data.
//
// Nothing here writes timer data. Best Time always means a student's FASTEST
// successful attempt, never their latest one, and the overall best is derived
// from the stored attempts so it updates by itself.
//
// Privacy: the student loader returns no identity of any kind. That boundary is
// enforced by the database function `speed_performance_student`, which never
// selects a name or a user id.

import { supabase } from "@/integrations/supabase/client";

export type StudentSpeedRow = {
  assessmentId: string;
  questionId: string;
  assignmentTitle: string;
  questionLabel: string;
  myBestMs: number;
  overallBestMs: number | null;
  iHoldRecord: boolean;
};

export type TeacherSpeedRow = {
  assessmentId: string;
  notebookId: string | null;
  questionId: string;
  assignmentTitle: string;
  questionLabel: string;
  studentId: string;
  studentBestMs: number;
  overallBestMs: number | null;
  holderId: string | null;
  holderKind: "student" | "guest";
};

export type RecordHistoryEntry = {
  id: string;
  assessmentId: string;
  questionId: string;
  holderId: string | null;
  holderKind: "student" | "guest";
  bestMs: number;
  setAt: string;
};

/** One question, as a teacher reads it. */
export type TeacherQuestionBoard = {
  key: string;
  assessmentId: string;
  questionId: string;
  assignmentTitle: string;
  questionLabel: string;
  overallBestMs: number | null;
  holderId: string | null;
  holderKind: "student" | "guest";
  students: Array<{ studentId: string; bestMs: number }>;
};

// The Speed Performance functions and the history table ship with this change,
// so the generated types do not know about them yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = supabase as any;

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Gap behind the overall best, in ms. Null when there is nothing to compare. */
export const behindBy = (myBestMs: number, overallBestMs: number | null): number | null =>
  overallBestMs == null ? null : Math.max(0, myBestMs - overallBestMs);

/** Group the flat teacher rows into one board per question, fastest first. */
export const groupTeacherRows = (rows: TeacherSpeedRow[]): TeacherQuestionBoard[] => {
  const boards = new Map<string, TeacherQuestionBoard>();
  for (const r of rows) {
    const key = `${r.assessmentId}:${r.questionId}`;
    let board = boards.get(key);
    if (!board) {
      board = {
        key,
        assessmentId: r.assessmentId,
        questionId: r.questionId,
        assignmentTitle: r.assignmentTitle,
        questionLabel: r.questionLabel,
        overallBestMs: r.overallBestMs,
        holderId: r.holderId,
        holderKind: r.holderKind,
        students: [],
      };
      boards.set(key, board);
    }
    board.students.push({ studentId: r.studentId, bestMs: r.studentBestMs });
  }
  const out = Array.from(boards.values());
  for (const b of out) b.students.sort((a, c) => a.bestMs - c.bestMs);
  out.sort(
    (a, b) =>
      a.assignmentTitle.localeCompare(b.assignmentTitle) ||
      a.questionLabel.localeCompare(b.questionLabel),
  );
  return out;
};

export async function loadStudentSpeedPerformance(classId: string): Promise<StudentSpeedRow[]> {
  const { data, error } = await anyDb.rpc("speed_performance_student", { _class_id: classId });
  if (error) {
    console.warn("[speed-performance] student load failed", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).flatMap((r) => {
    const mine = num(r["my_best_ms"]);
    if (mine == null) return [];
    return [{
      assessmentId: String(r["assessment_id"]),
      questionId: String(r["question_id"]),
      assignmentTitle: String(r["assignment_title"] ?? "Assignment"),
      questionLabel: String(r["question_label"] ?? "Question"),
      myBestMs: mine,
      overallBestMs: num(r["overall_best_ms"]),
      iHoldRecord: Boolean(r["i_hold_record"]),
    }];
  });
}

export async function loadTeacherSpeedPerformance(
  classId: string,
  notebookId?: string | null,
): Promise<TeacherSpeedRow[]> {
  const { data, error } = await anyDb.rpc("speed_performance_teacher", {
    _class_id: classId,
    _notebook_id: notebookId ?? null,
  });
  if (error) {
    console.warn("[speed-performance] teacher load failed", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).flatMap((r) => {
    const best = num(r["student_best_ms"]);
    if (best == null) return [];
    return [{
      assessmentId: String(r["assessment_id"]),
      notebookId: r["notebook_id"] ? String(r["notebook_id"]) : null,
      questionId: String(r["question_id"]),
      assignmentTitle: String(r["assignment_title"] ?? "Assignment"),
      questionLabel: String(r["question_label"] ?? "Question"),
      studentId: String(r["student_id"]),
      studentBestMs: best,
      overallBestMs: num(r["overall_best_ms"]),
      holderId: r["holder_id"] ? String(r["holder_id"]) : null,
      holderKind: r["holder_kind"] === "guest" ? "guest" : "student",
    }];
  });
}

export async function loadRecordHistory(assessmentIds: string[]): Promise<RecordHistoryEntry[]> {
  if (assessmentIds.length === 0) return [];
  const { data, error } = await anyDb
    .from("speed_record_history")
    .select("id, assessment_id, question_id, holder_id, holder_kind, best_ms, set_at")
    .in("assessment_id", assessmentIds)
    .order("set_at", { ascending: false });
  if (error) {
    console.warn("[speed-performance] history load failed", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r["id"]),
    assessmentId: String(r["assessment_id"]),
    questionId: String(r["question_id"]),
    holderId: r["holder_id"] ? String(r["holder_id"]) : null,
    holderKind: r["holder_kind"] === "guest" ? "guest" : "student",
    bestMs: Number(r["best_ms"]) || 0,
    setAt: String(r["set_at"]),
  }));
}

/** Timed assignments of a class, for the teacher's assignment picker. */
export async function loadTimedAssignments(
  classId: string,
): Promise<Array<{ notebookId: string; title: string; subject: string | null }>> {
  const { data } = await anyDb
    .from("assessments")
    .select("notebook_id, title, notebooks(title, subject)")
    .eq("class_id", classId)
    .is("unassigned_at", null);
  const seen = new Map<string, { notebookId: string; title: string; subject: string | null }>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const nid = row["notebook_id"] ? String(row["notebook_id"]) : null;
    if (!nid || seen.has(nid)) continue;
    const nb = (row["notebooks"] ?? {}) as { title?: string | null; subject?: string | null };
    seen.set(nid, {
      notebookId: nid,
      title: String(nb.title ?? row["title"] ?? "Assignment"),
      subject: nb.subject ?? null,
    });
  }
  return Array.from(seen.values()).sort((a, b) => a.title.localeCompare(b.title));
}

export async function loadMemberNames(classId: string): Promise<Map<string, string>> {
  const { data } = await anyDb.rpc("get_class_member_names", { _class_id: classId });
  const map = new Map<string, string>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    map.set(String(r["user_id"]), String(r["display_name"] ?? "Student"));
  }
  return map;
}
