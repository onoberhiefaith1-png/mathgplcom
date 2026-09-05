// Student Speed Performance — own best vs the anonymous overall best.
// No other student's name, time or ranking is ever rendered here.

import { Trophy } from "lucide-react";
import { formatAttemptTime } from "@/hooks/useQuestionTimerAttempt";
import { behindBy, type StudentSpeedRow } from "@/lib/reports/speedPerformance";

const gapLabel = (row: StudentSpeedRow) => {
  if (row.iHoldRecord) return "You hold it";
  const gap = behindBy(row.myBestMs, row.overallBestMs);
  if (gap == null) return "—";
  if (gap === 0) return "Level with the record";
  return `${Math.round(gap / 1000)}s behind`;
};

const StudentSpeedTable = ({ rows }: { rows: StudentSpeedRow[] }) => {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--rp-border))] p-6 text-center text-xs text-[hsl(var(--rp-muted))]">
        No timed attempts recorded yet. Complete a timed question to see your best times here.
      </div>
    );
  }

  return (
    <>
      {/* Phone: stacked cards */}
      <ul className="space-y-3 sm:hidden">
        {rows.map((r) => (
          <li
            key={`${r.assessmentId}:${r.questionId}`}
            className="rounded-xl border border-[hsl(var(--rp-border))] p-3"
          >
            <div className="text-sm font-semibold">{r.questionLabel}</div>
            <div className="text-[11px] text-[hsl(var(--rp-muted))]">{r.assignmentTitle}</div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-[hsl(var(--rp-muted))]">Your Best</dt>
                <dd className="tabular-nums font-semibold">{formatAttemptTime(r.myBestMs)}</dd>
              </div>
              <div>
                <dt className="text-[hsl(var(--rp-muted))]">Overall Best</dt>
                <dd className="tabular-nums font-semibold">
                  {r.overallBestMs == null ? "—" : formatAttemptTime(r.overallBestMs)}
                </dd>
              </div>
            </dl>
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-[hsl(var(--rp-muted))]">
              {r.iHoldRecord && <Trophy className="h-3.5 w-3.5" aria-hidden />}
              {gapLabel(r)}
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet and desktop: table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-[hsl(var(--rp-muted))]">
              <th scope="col" className="py-2 pr-4 font-semibold">Question</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Assignment</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Your Best</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Overall Best</th>
              <th scope="col" className="py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.assessmentId}:${r.questionId}`}
                className="border-t border-[hsl(var(--rp-border))]"
              >
                <td className="py-2.5 pr-4 font-medium">{r.questionLabel}</td>
                <td className="py-2.5 pr-4 text-[hsl(var(--rp-muted))]">{r.assignmentTitle}</td>
                <td className="py-2.5 pr-4 tabular-nums font-semibold">{formatAttemptTime(r.myBestMs)}</td>
                <td className="py-2.5 pr-4 tabular-nums">
                  {r.overallBestMs == null ? "—" : formatAttemptTime(r.overallBestMs)}
                </td>
                <td className="py-2.5">
                  <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--rp-muted))]">
                    {r.iHoldRecord && <Trophy className="h-3.5 w-3.5" aria-hidden />}
                    {gapLabel(r)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default StudentSpeedTable;
