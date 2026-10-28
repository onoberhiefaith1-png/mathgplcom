// Teacher Speed Performance — overall best, record holder, every student's best
// time, and the record history. Teacher-only view.

import { useMemo } from "react";
import { Crown, History } from "lucide-react";
import { formatAttemptTime } from "@/hooks/useQuestionTimerAttempt";
import {
  groupTeacherRows,
  type RecordHistoryEntry,
  type TeacherSpeedRow,
} from "@/lib/reports/speedPerformance";

const holderName = (
  holderId: string | null,
  holderKind: "student" | "guest",
  names: Map<string, string>,
) => (holderKind === "guest" ? "Guest" : holderId ? names.get(holderId) ?? "Student" : "—");

const TeacherSpeedPanel = ({
  rows,
  history,
  memberNames,
}: {
  rows: TeacherSpeedRow[];
  history: RecordHistoryEntry[];
  memberNames: Map<string, string>;
}) => {
  const boards = useMemo(() => groupTeacherRows(rows), [rows]);

  const historyByQuestion = useMemo(() => {
    const map = new Map<string, RecordHistoryEntry[]>();
    for (const h of history) {
      const key = `${h.assessmentId}:${h.questionId}`;
      const list = map.get(key) ?? [];
      list.push(h);
      map.set(key, list);
    }
    return map;
  }, [history]);

  if (boards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--rp-border))] p-6 text-center text-xs text-[hsl(var(--rp-muted))]">
        No timed attempts recorded for this assignment yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {boards.map((b) => {
        const entries = historyByQuestion.get(b.key) ?? [];
        return (
          <section key={b.key} className="rounded-2xl border border-[hsl(var(--rp-border))] p-4">
            <header className="mb-4">
              <h3 className="text-sm font-semibold">{b.questionLabel}</h3>
              <p className="text-[11px] text-[hsl(var(--rp-muted))]">{b.assignmentTitle}</p>
            </header>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[hsl(var(--rp-border))] p-3">
                <div className="text-[11px] uppercase tracking-wide text-[hsl(var(--rp-muted))]">
                  Overall Best
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {b.overallBestMs == null ? "—" : formatAttemptTime(b.overallBestMs)}
                </div>
              </div>
              <div className="rounded-xl border border-[hsl(var(--rp-border))] p-3">
                <div className="text-[11px] uppercase tracking-wide text-[hsl(var(--rp-muted))]">
                  Record Holder
                </div>
                <div className="mt-1 inline-flex items-center gap-2 text-lg font-semibold">
                  <Crown className="h-4 w-4" aria-hidden />
                  {holderName(b.holderId, b.holderKind, memberNames)}
                </div>
              </div>
            </div>

            <h4 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
              Student Best Times
            </h4>
            <ul className="space-y-1">
              {b.students.map((s, i) => (
                <li key={s.studentId} className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 tabular-nums text-[hsl(var(--rp-muted))]">{i + 1}.</span>
                    {memberNames.get(s.studentId) ?? "Student"}
                  </span>
                  <span className="tabular-nums font-semibold">{formatAttemptTime(s.bestMs)}</span>
                </li>
              ))}
            </ul>

            {entries.length > 0 && (
              <>
                <h4 className="mb-2 mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
                  <History className="h-3.5 w-3.5" aria-hidden /> Record History
                </h4>
                <ol className="space-y-1">
                  {entries.map((h) => (
                    <li key={h.id} className="flex items-center justify-between text-xs">
                      <span className="text-[hsl(var(--rp-muted))]">
                        {new Date(h.setAt).toLocaleDateString()} ·{" "}
                        {holderName(h.holderId, h.holderKind, memberNames)}
                      </span>
                      <span className="tabular-nums">{formatAttemptTime(h.bestMs)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default TeacherSpeedPanel;
