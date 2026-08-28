// Report System — Phase 1 data layer.
//
// ONE bar = ONE task. A task is a row in `learning_assignments`
// (mode = 'assignment' | 'adventure'). Bars are created the moment a task is
// assigned (0%) and only ever change height. Nothing else feeds this chart.
//
// Every future report (Weekly, Monthly, Term, Yearly, analytics) must read from
// this module instead of recomputing scores.

import { supabase } from "@/integrations/supabase/client";

export type TaskMode = "assignment" | "adventure";

export interface TaskBar {
  taskId: string;
  mode: TaskMode;
  fullTitle: string;
  abbreviation: string;
  /** 0–100, always capped. */
  percent: number;
  startedAt: string | null;
  dueAt: string | null;
  /** When the task result was locked in — drives the Trend Report timeline. */
  completedAt: string | null;
  frozen: boolean;

  /** Display-only: marks earned (class view = class average). */
  score: number;
  /** Display-only: marks needed (adventure = individual quota). */
  target: number;
}

export interface ClassMember {
  user_id: string;
  display_name: string;
}

const STOP_WORDS = new Set(["the", "a", "an", "of", "to", "and", "for", "in", "on", "with", "using"]);

/** "Using the Quadratic Formula to Solve …" → "QUA". Display only. */
export function abbreviateTitle(title: string): string {
  const words = (title || "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  const first = words[0] ?? (title || "").trim();
  if (!first) return "TSK";
  return first.slice(0, 3).toUpperCase();
}

const pct = (score: number, target: number) => {
  if (!(target > 0)) return 0;
  return Math.max(0, Math.min(100, (score / target) * 100));
};

export interface RawTask {
  id: string;
  mode: TaskMode;
  title: string;
  notebookId: string;
  gameId: string | null;
  startedAt: string | null;
  dueAt: string | null;
  /** assessments that make up this task */
  assessmentIds: string[];
  /** assignment: total marks. adventure: total required marks for the class. */
  target: number;
  /** Curriculum topic (notebook subject) — display only. */
  topic: string;
  /** Curriculum subtopic (notebook subtopic) — display only. */
  subtopic: string;
}

interface FrozenSnap { percent: number; at: string | null }

/** Per-question metadata used by the detailed Individual Student report. */
export interface AssessmentMeta {
  id: string;
  title: string;
  totalMarks: number;
  kind: string;
}

export interface ProgressMeta {
  status: string;
  updatedAt: string | null;
  /** Floating-number construction detail, when the engine recorded it. */
  solvedCount: number;
  slotCount: number;
}

export interface TaskDataset {
  tasks: RawTask[];
  members: ClassMember[];
  /** assessmentId -> studentId -> score */
  scores: Map<string, Map<string, number>>;
  /** taskId -> studentId -> frozen snapshot */
  frozen: Map<string, Map<string, FrozenSnap>>;
  /** assessmentId -> question metadata */
  assessmentMeta: Map<string, AssessmentMeta>;
  /** assessmentId -> studentId -> progress metadata */
  progressMeta: Map<string, Map<string, ProgressMeta>>;
}



async function loadDataset(classId: string): Promise<TaskDataset> {
  const [{ data: rawTasks }, { data: memberRows }] = await Promise.all([
    supabase
      .from("learning_assignments" as never)
      .select("id, mode, title, notebook_id, game_id, started_at, due_at, created_at")
      .eq("class_id" as never, classId as never)
      .order("started_at", { ascending: true }) as never as Promise<{ data: any[] | null }>,
    supabase.rpc("get_class_member_names", { _class_id: classId }) as never as Promise<{ data: any[] | null }>,
  ]);

  const taskRows = (rawTasks ?? []) as any[];
  const members: ClassMember[] = ((memberRows ?? []) as any[]).map((m) => ({
    user_id: m.user_id as string,
    display_name: (m.display_name as string) || "Student",
  }));

  const notebookIds = Array.from(new Set(taskRows.map((t) => t.notebook_id as string).filter(Boolean)));
  const nbTitles = new Map<string, string>();
  if (notebookIds.length) {
    const { data: nbs } = await supabase.from("notebooks").select("id, title, subtopic").in("id", notebookIds);
    for (const n of (nbs ?? []) as any[]) {
      nbTitles.set(n.id as string, (n.title as string) || (n.subtopic as string) || "Task");
    }
  }

  const ids = taskRows.map((t) => t.id as string);

  // Assessments (assignments) and boards (adventures) that belong to these tasks.
  const [{ data: assessRows }, { data: boardRows }] = await Promise.all([
    ids.length
      ? (supabase
          .from("assessments")
          .select("id, assignment_id, notebook_id, total_marks, kind")
          .eq("class_id", classId) as never as Promise<{ data: any[] | null }>)
      : Promise.resolve({ data: [] as any[] }),
    ids.length
      ? (supabase
          .from("class_game_boards")
          .select("id, assignment_id, assessment_id, notebook_id, game_id, required_marks")
          .eq("class_id", classId) as never as Promise<{ data: any[] | null }>)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const assessments = (assessRows ?? []) as any[];
  const boards = (boardRows ?? []) as any[];
  const marksByAssessment = new Map<string, number>(
    assessments.map((a) => [a.id as string, Number(a.total_marks ?? 0)]),
  );

  const tasks: RawTask[] = taskRows.map((t) => {
    const mode: TaskMode = (t.mode as TaskMode) === "adventure" ? "adventure" : "assignment";
    const title = (t.title as string) || nbTitles.get(t.notebook_id as string) || "Task";
    let assessmentIds: string[] = [];
    let target = 0;

    if (mode === "adventure") {
      const mine = boards.filter(
        (b) =>
          b.assignment_id === t.id ||
          (!b.assignment_id && b.notebook_id === t.notebook_id && (!t.game_id || b.game_id === t.game_id)),
      );
      assessmentIds = mine.map((b) => b.assessment_id as string).filter(Boolean);
      target = mine.reduce(
        (s, b) => s + (Number(b.required_marks ?? 0) || marksByAssessment.get(b.assessment_id as string) || 0),
        0,
      );
    } else {
      const mine = assessments.filter(
        (a) =>
          a.kind !== "adventure" &&
          (a.assignment_id === t.id || (!a.assignment_id && a.notebook_id === t.notebook_id)),
      );
      assessmentIds = mine.map((a) => a.id as string);
      target = mine.reduce((s, a) => s + Number(a.total_marks ?? 0), 0);
    }

    return {
      id: t.id as string,
      mode,
      title,
      notebookId: t.notebook_id as string,
      gameId: (t.game_id as string | null) ?? null,
      startedAt: (t.started_at as string | null) ?? (t.created_at as string | null) ?? null,
      dueAt: (t.due_at as string | null) ?? null,
      assessmentIds,
      target,
    };
  });

  // Progress rows for every assessment referenced by any task.
  const allAssessmentIds = Array.from(new Set(tasks.flatMap((t) => t.assessmentIds)));
  const scores = new Map<string, Map<string, number>>();
  if (allAssessmentIds.length) {
    const { data: progress } = await supabase
      .from("assessment_progress")
      .select("assessment_id, student_id, score")
      .in("assessment_id", allAssessmentIds);
    for (const p of (progress ?? []) as any[]) {
      const aid = p.assessment_id as string;
      const inner = scores.get(aid) ?? new Map<string, number>();
      inner.set(p.student_id as string, Number(p.score ?? 0));
      scores.set(aid, inner);
    }
  }

  // Frozen historical results win over live maths (pass-mark changes must never
  // rewrite a finished task).
  const frozen = new Map<string, Map<string, FrozenSnap>>();
  const { data: frozenRows } = (await supabase
    .from("report_task_results" as never)
    .select("assignment_id, student_id, percent, frozen_at")
    .eq("class_id" as never, classId as never)) as any;
  for (const r of ((frozenRows ?? []) as any[])) {
    const inner = frozen.get(r.assignment_id as string) ?? new Map<string, FrozenSnap>();
    inner.set(r.student_id as string, {
      percent: Number(r.percent ?? 0),
      at: (r.frozen_at as string | null) ?? null,
    });
    frozen.set(r.assignment_id as string, inner);
  }

  return { tasks, members, scores, frozen };
}

function studentScore(task: RawTask, dataset: TaskDataset, studentId: string): number {
  let total = 0;
  for (const aid of task.assessmentIds) total += dataset.scores.get(aid)?.get(studentId) ?? 0;
  return total;
}

/** Individual quota for an adventure: required class marks ÷ class size. */
function adventureQuota(task: RawTask, memberCount: number): number {
  if (memberCount <= 0) return task.target;
  return task.target / memberCount;
}

interface Measure { percent: number; frozen: boolean; score: number; target: number; completedAt: string | null }

function percentFor(task: RawTask, dataset: TaskDataset, studentId: string): Measure {
  const score = studentScore(task, dataset, studentId);
  const target = task.mode === "adventure" ? adventureQuota(task, dataset.members.length) : task.target;
  const snap = dataset.frozen.get(task.id)?.get(studentId);
  if (snap) {
    return {
      percent: Math.max(0, Math.min(100, snap.percent)),
      frozen: true,
      score,
      target,
      completedAt: snap.at ?? task.dueAt ?? task.startedAt,
    };
  }
  return { percent: pct(score, target), frozen: false, score, target, completedAt: task.dueAt ?? task.startedAt };
}

function toBar(task: RawTask, m: Measure): TaskBar {
  return {
    taskId: task.id,
    mode: task.mode,
    fullTitle: task.title,
    abbreviation: abbreviateTitle(task.title),
    percent: Math.round(m.percent),
    startedAt: task.startedAt,
    dueAt: task.dueAt,
    completedAt: m.completedAt,
    frozen: m.frozen,
    score: Math.round(m.score * 10) / 10,
    target: Math.round(m.target * 10) / 10,
  };
}


const emptyMeasure = (task: RawTask): Measure => ({
  percent: 0,
  frozen: false,
  score: 0,
  target: task.target,
  completedAt: task.dueAt ?? task.startedAt,
});

/** Average every student's measure into one class-level measure. */
function classMeasure(task: RawTask, dataset: TaskDataset): Measure {
  const n = dataset.members.length;
  if (n === 0) return emptyMeasure(task);
  let percent = 0;
  let score = 0;
  let target = 0;
  let frozen = false;
  let completedAt: string | null = null;
  for (const m of dataset.members) {
    const r = percentFor(task, dataset, m.user_id);
    percent += r.percent;
    score += r.score;
    target += r.target;
    frozen = frozen || r.frozen;
    // The class task lands on the timeline when the last student finished it.
    if (r.completedAt && (!completedAt || r.completedAt > completedAt)) completedAt = r.completedAt;
  }
  return {
    percent: percent / n,
    frozen,
    score: score / n,
    target: target / n,
    completedAt: completedAt ?? task.dueAt ?? task.startedAt,
  };
}


export async function loadClassMembers(classId: string): Promise<ClassMember[]> {
  const { data } = (await supabase.rpc("get_class_member_names", { _class_id: classId })) as any;
  return ((data ?? []) as any[]).map((m) => ({
    user_id: m.user_id as string,
    display_name: (m.display_name as string) || "Student",
  }));
}

/** One bar per task, for a single student. */
export async function loadStudentTaskBars(classId: string, studentId: string): Promise<TaskBar[]> {
  const dataset = await loadDataset(classId);
  return dataset.tasks.map((t) => toBar(t, percentFor(t, dataset, studentId)));
}

/** One bar per task, averaged across every class member. */
export async function loadClassTaskBars(classId: string): Promise<TaskBar[]> {
  const dataset = await loadDataset(classId);
  return dataset.tasks.map((t) => toBar(t, classMeasure(t, dataset)));
}

/** Both views in one round trip, used by the teacher Report page. */
export async function loadReportData(classId: string): Promise<{
  members: ClassMember[];
  classBars: TaskBar[];
  barsByStudent: Map<string, TaskBar[]>;
}> {
  const dataset = await loadDataset(classId);
  const barsByStudent = new Map<string, TaskBar[]>();
  for (const m of dataset.members) {
    barsByStudent.set(m.user_id, dataset.tasks.map((t) => toBar(t, percentFor(t, dataset, m.user_id))));
  }
  const classBars = dataset.tasks.map((t) => toBar(t, classMeasure(t, dataset)));
  return { members: dataset.members, classBars, barsByStudent };
}

/**
 * Freeze the current percentages for a finished task so later pass-mark or
 * total-marks changes can never rewrite history.
 */
export async function freezeTaskResults(classId: string, taskId: string): Promise<void> {
  const dataset = await loadDataset(classId);
  const task = dataset.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const target = task.mode === "adventure" ? adventureQuota(task, dataset.members.length) : task.target;
  const rows = dataset.members.map((m) => {
    const score = studentScore(task, dataset, m.user_id);
    return {
      class_id: classId,
      assignment_id: task.id,
      student_id: m.user_id,
      mode: task.mode,
      percent: Math.round(pct(score, target)),
      frozen_score: score,
      frozen_target: target,
    };
  });
  if (!rows.length) return;
  await (supabase.from("report_task_results" as never) as any).upsert(rows, {
    onConflict: "assignment_id,student_id",
  });
}
