// Shared helpers to aggregate per-student progress rows for a set of
// assessments (a lesson note's assessments, or an adventure's linked bars).
//
// Two modes:
//   - Contribution mode (Adventure): pass `requiredContribution` — a student
//     is Completed when their summed score across these assessments reaches
//     their share of the collaborative target. Submit is irrelevant.
//   - Status mode (Assignment, default): completion follows the DB
//     `assessment_progress.status='completed'` column, which the Submit
//     button flips.

import { supabase } from "@/integrations/supabase/client";
import type { StudentProgressRow } from "@/components/dashboards/AssessmentStatusPanel";

export type LessonMember = { user_id: string; display_name: string };

export type LessonAssessment = { id: string; total_marks: number };

export async function loadLessonProgress(
  assessments: LessonAssessment[],
  members: LessonMember[],
  activeSet: Set<string>,
  requiredContribution: number | null = null,
): Promise<StudentProgressRow[]> {
  const totalMarks = assessments.reduce((s, a) => s + (Number(a.total_marks) || 0), 0);
  const ids = assessments.map((a) => a.id);
  const byStudent = new Map<string, { score: number; anyCompleted: boolean }>();
  if (ids.length) {
    const { data } = await supabase
      .from("assessment_progress")
      .select("assessment_id, student_id, score, status")
      .in("assessment_id", ids);
    for (const r of data ?? []) {
      const sid = (r as any).student_id as string;
      const cur = byStudent.get(sid) ?? { score: 0, anyCompleted: false };
      cur.score += Number((r as any).score ?? 0);
      if ((r as any).status === "completed") cur.anyCompleted = true;
      byStudent.set(sid, cur);
    }
  }
  const contribMode = requiredContribution != null && requiredContribution > 0;
  return members.map((m) => {
    const p = byStudent.get(m.user_id);
    const score = p?.score ?? 0;
    const isActive = activeSet.has(m.user_id);
    const hitContribution = contribMode && score >= (requiredContribution as number);
    const status: StudentProgressRow["status"] =
      (contribMode ? hitContribution : !!p?.anyCompleted)
        ? "completed"
        : isActive
        ? "in_progress"
        : "inactive";
    return {
      studentId: m.user_id,
      displayName: m.display_name,
      score,
      totalMarks,
      progressPct: totalMarks > 0 ? Math.min(100, (score / totalMarks) * 100) : 0,
      status,
      online: isActive,
    };
  });
}
