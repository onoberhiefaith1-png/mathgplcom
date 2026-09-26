// Class Overview — wide lens.
//
// Aggregates the exact same per-student assessment rows the Individual
// Student report uses, so a class figure can always be traced back to the
// students who produced it.

import type { StudentAssessmentRow, SubtopicStat, TopicStat } from "./studentReport";
import type { ClassMember, TaskMode } from "./progressChart";

const pct = (earned: number, available: number) =>
  available > 0 ? Math.max(0, Math.min(100, Math.round((earned / available) * 100))) : 0;

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface ClassSummary {
  students: number;
  assessments: number;
  marksAvailable: number;
  performance: number;
}

export interface TypeSummaryRow {
  mode: TaskMode;
  assigned: number;
  completed: number;
  performance: number;
}

export interface Contributor {
  studentId: string;
  displayName: string;
  earned: number;
  available: number;
  percent: number;
}

const allRows = (rowsByStudent: Map<string, StudentAssessmentRow[]>) =>
  Array.from(rowsByStudent.values()).flat();

export function classSummary(
  members: ClassMember[],
  rowsByStudent: Map<string, StudentAssessmentRow[]>,
): ClassSummary {
  const rows = allRows(rowsByStudent);
  const perStudent = members.length ? rows.length / members.length : rows.length;
  const earned = rows.reduce((s, r) => s + r.earned, 0);
  const available = rows.reduce((s, r) => s + r.available, 0);
  return {
    students: members.length,
    assessments: Math.round(perStudent),
    marksAvailable: round1(members.length ? available / members.length : available),
    performance: pct(earned, available),
  };
}

/** Topic → Subtopic performance across the whole class. */
export function classTopicBreakdown(
  rowsByStudent: Map<string, StudentAssessmentRow[]>,
): TopicStat[] {
  const topics = new Map<string, Map<string, StudentAssessmentRow[]>>();
  for (const r of allRows(rowsByStudent)) {
    const subs = topics.get(r.topic) ?? new Map<string, StudentAssessmentRow[]>();
    const list = subs.get(r.subtopic) ?? [];
    list.push(r);
    subs.set(r.subtopic, list);
    topics.set(r.topic, subs);
  }
  const statOf = (name: string, list: StudentAssessmentRow[]): SubtopicStat => {
    const earned = list.reduce((s, r) => s + r.earned, 0);
    const available = list.reduce((s, r) => s + r.available, 0);
    return {
      name,
      earned: round1(earned),
      available: round1(available),
      percent: pct(earned, available),
      assessments: list.length,
    };
  };
  return Array.from(topics.entries())
    .map(([topic, subs]) => {
      const all = Array.from(subs.values()).flat();
      return {
        ...statOf(topic, all),
        subtopics: Array.from(subs.entries())
          .map(([name, list]) => statOf(name, list))
          .sort((a, b) => b.percent - a.percent),
      };
    })
    .sort((a, b) => b.percent - a.percent);
}

export function typeSummary(
  rowsByStudent: Map<string, StudentAssessmentRow[]>,
): TypeSummaryRow[] {
  const rows = allRows(rowsByStudent);
  return (["assignment", "game", "adventure"] as TaskMode[]).map((mode) => {
    const mine = rows.filter((r) => r.mode === mode);
    const earned = mine.reduce((s, r) => s + r.earned, 0);
    const available = mine.reduce((s, r) => s + r.available, 0);
    return {
      mode,
      assigned: mine.length,
      completed: mine.filter((r) => r.status === "completed").length,
      performance: pct(earned, available),
    };
  });
}

/** Which students produced a topic / subtopic result — the drill-down. */
export function contributors(
  members: ClassMember[],
  rowsByStudent: Map<string, StudentAssessmentRow[]>,
  match: (row: StudentAssessmentRow) => boolean,
): Contributor[] {
  return members
    .map((m) => {
      const mine = (rowsByStudent.get(m.user_id) ?? []).filter(match);
      const earned = mine.reduce((s, r) => s + r.earned, 0);
      const available = mine.reduce((s, r) => s + r.available, 0);
      return {
        studentId: m.user_id,
        displayName: m.display_name,
        earned: round1(earned),
        available: round1(available),
        percent: pct(earned, available),
      };
    })
    .sort((a, b) => b.percent - a.percent);
}
