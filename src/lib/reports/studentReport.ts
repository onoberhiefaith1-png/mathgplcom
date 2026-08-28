// Individual Student Assessment Report — detailed lens.
//
// This reads the SAME dataset the class bar chart reads
// (`loadReportDataset`), but drops down one level: one row per assessment
// (question) instead of one bar per task. Because both lenses share the
// dataset they can never disagree.
//
// Reporting language rule: an assessment is never Pass/Fail. It always
// reports marks earned out of marks available plus a completion percentage.

import {
  loadReportDataset,
  type ClassMember,
  type TaskDataset,
  type TaskMode,
} from "./progressChart";

export interface StudentAssessmentRow {
  assessmentId: string;
  taskId: string;
  /** "Q3 — Indices" style label. */
  label: string;
  index: number;
  mode: TaskMode;
  topic: string;
  subtopic: string;
  available: number;
  earned: number;
  /** 0–100 */
  completion: number;
  status: "completed" | "in_progress" | "not_started";
  at: string | null;
  /** Floating Numbers construction detail (0 when not recorded). */
  constructedElements: number;
  totalElements: number;
}

export interface StudentSummary {
  assessmentsCompleted: number;
  assessmentsTotal: number;
  marksEarned: number;
  marksAvailable: number;
  /** 0–100 */
  performance: number;
  averageScore: number;
  averageAvailable: number;
}

export interface SubtopicStat {
  name: string;
  percent: number;
  earned: number;
  available: number;
  assessments: number;
}

export interface TopicStat extends SubtopicStat {
  subtopics: SubtopicStat[];
}

const pct = (earned: number, available: number) =>
  available > 0 ? Math.max(0, Math.min(100, Math.round((earned / available) * 100))) : 0;

const round1 = (n: number) => Math.round(n * 10) / 10;

function rowsFor(dataset: TaskDataset, studentId: string): StudentAssessmentRow[] {
  const rows: StudentAssessmentRow[] = [];
  let index = 0;
  for (const task of dataset.tasks) {
    for (const aid of task.assessmentIds) {
      const meta = dataset.assessmentMeta.get(aid);
      const available = meta?.totalMarks ?? 0;
      const earned = dataset.scores.get(aid)?.get(studentId) ?? 0;
      const progress = dataset.progressMeta.get(aid)?.get(studentId);
      index += 1;
      const status: StudentAssessmentRow["status"] =
        progress?.status === "completed"
          ? "completed"
          : progress
          ? "in_progress"
          : "not_started";
      rows.push({
        assessmentId: aid,
        taskId: task.id,
        label: `Q${index} — ${meta?.title || task.title}`,
        index,
        mode: task.mode,
        topic: task.topic || task.title,
        subtopic: task.subtopic || "General",
        available,
        earned: round1(earned),
        completion: pct(earned, available),
        status,
        at: progress?.updatedAt ?? task.dueAt ?? task.startedAt,
        constructedElements: progress?.solvedCount ?? 0,
        totalElements: progress?.slotCount ?? 0,
      });
    }
  }
  return rows;
}

export function summarise(rows: StudentAssessmentRow[]): StudentSummary {
  const marksEarned = rows.reduce((s, r) => s + r.earned, 0);
  const marksAvailable = rows.reduce((s, r) => s + r.available, 0);
  const completed = rows.filter((r) => r.status === "completed").length;
  return {
    assessmentsCompleted: completed,
    assessmentsTotal: rows.length,
    marksEarned: round1(marksEarned),
    marksAvailable: round1(marksAvailable),
    performance: pct(marksEarned, marksAvailable),
    averageScore: rows.length ? round1(marksEarned / rows.length) : 0,
    averageAvailable: rows.length ? round1(marksAvailable / rows.length) : 0,
  };
}

/** Topic → Subtopic → performance, built from the same rows the table shows. */
export function topicBreakdown(rows: StudentAssessmentRow[]): TopicStat[] {
  const topics = new Map<string, Map<string, StudentAssessmentRow[]>>();
  for (const r of rows) {
    const subs = topics.get(r.topic) ?? new Map<string, StudentAssessmentRow[]>();
    const list = subs.get(r.subtopic) ?? [];
    list.push(r);
    subs.set(r.subtopic, list);
    topics.set(r.topic, subs);
  }
  const statOf = (name: string, list: StudentAssessmentRow[]): SubtopicStat => {
    const earned = list.reduce((s, r) => s + r.earned, 0);
    const available = list.reduce((s, r) => s + r.available, 0);
    return { name, earned: round1(earned), available: round1(available), percent: pct(earned, available), assessments: list.length };
  };
  return Array.from(topics.entries()).map(([topic, subs]) => {
    const all = Array.from(subs.values()).flat();
    return {
      ...statOf(topic, all),
      subtopics: Array.from(subs.entries()).map(([name, list]) => statOf(name, list)),
    };
  });
}

export interface StudentReportData {
  members: ClassMember[];
  rowsByStudent: Map<string, StudentAssessmentRow[]>;
}

export async function loadStudentReport(classId: string): Promise<StudentReportData> {
  const dataset = await loadReportDataset(classId);
  const rowsByStudent = new Map<string, StudentAssessmentRow[]>();
  for (const m of dataset.members) rowsByStudent.set(m.user_id, rowsFor(dataset, m.user_id));
  return { members: dataset.members, rowsByStudent };
}

export async function loadOneStudentReport(
  classId: string,
  studentId: string,
): Promise<StudentAssessmentRow[]> {
  const dataset = await loadReportDataset(classId);
  return rowsFor(dataset, studentId);
}
