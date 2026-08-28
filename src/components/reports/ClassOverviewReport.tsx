// CLASS OVERVIEW REPORT — the wide, deliberately simple lens.
// Keeps the existing bar chart / trend chart, adds class summary, topic and
// subtopic bars, an Assignment/Adventure summary, and drill-down to a student.

import { useMemo, useState } from "react";
import CompletionBar from "./CompletionBar";
import TopicBreakdown from "./TopicBreakdown";
import {
  classSummary,
  classTopicBreakdown,
  contributors,
  typeSummary,
} from "@/lib/reports/classTopics";
import type { StudentAssessmentRow } from "@/lib/reports/studentReport";
import type { ClassMember } from "@/lib/reports/progressChart";

const Card = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-panel))] px-4 py-3 text-center">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">{label}</div>
    <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
  </div>
);

const ClassOverviewReport = ({
  className,
  members,
  rowsByStudent,
  onOpenStudent,
  children,
}: {
  className: string;
  members: ClassMember[];
  rowsByStudent: Map<string, StudentAssessmentRow[]>;
  onOpenStudent: (studentId: string) => void;
  /** The existing bar chart + trend chart block, kept unchanged. */
  children?: React.ReactNode;
}) => {
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const summary = useMemo(() => classSummary(members, rowsByStudent), [members, rowsByStudent]);
  const topics = useMemo(() => classTopicBreakdown(rowsByStudent), [rowsByStudent]);
  const types = useMemo(() => typeSummary(rowsByStudent), [rowsByStudent]);
  const topic = topics.find((t) => t.name === activeTopic) ?? topics[0] ?? null;
  const people = useMemo(
    () =>
      topic
        ? contributors(members, rowsByStudent, (r) => r.topic === topic.name).filter((c) => c.available > 0)
        : [],
    [topic, members, rowsByStudent],
  );

  return (
    <div className="rounded-2xl border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-panel))] p-5">
      <h2 className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--rp-muted))]">
        Class Overview Report
      </h2>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[hsl(var(--rp-muted))]">
        <span>Class: {className || "—"}</span>
        <span>
          {summary.students} student{summary.students === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Students" value={String(summary.students)} />
        <Card label="Assessments" value={String(summary.assessments)} />
        <Card label="Marks Available" value={String(summary.marksAvailable)} />
        <Card label="Class Performance" value={`${summary.performance}%`} />
      </div>

      <div className="mt-6">
        <TopicBreakdown
          title="Class performance by topic"
          topics={topics}
          activeTopic={topic?.name ?? null}
          onTopicSelect={setActiveTopic}
        />
      </div>

      {topic && people.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
            Students contributing to {topic.name}
          </h3>
          <ul className="space-y-2">
            {people.map((c) => (
              <li key={c.studentId}>
                <button
                  type="button"
                  onClick={() => onOpenStudent(c.studentId)}
                  className="grid w-full grid-cols-[minmax(96px,1fr)_2fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-[hsl(var(--rp-grid))]"
                >
                  <span className="truncate text-sm">{c.displayName}</span>
                  <CompletionBar percent={c.percent} showValue={false} />
                  <span className="text-xs font-semibold tabular-nums">
                    {c.earned}/{c.available}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
          Assessment type summary
        </h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--rp-border))] text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
              <th className="py-2">Type</th>
              <th className="py-2 text-right">Assigned</th>
              <th className="py-2 text-right">Completed</th>
              <th className="py-2 text-right">Avg performance</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.mode} className="border-b border-dashed border-[hsl(var(--rp-border))]">
                <td className="py-2 capitalize">{t.mode}</td>
                <td className="py-2 text-right tabular-nums">{t.assigned}</td>
                <td className="py-2 text-right tabular-nums">{t.completed}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{t.performance}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-[hsl(var(--rp-muted))]">
          Class performance is calculated from average marks earned.
        </p>
      </section>

      {children && <div className="mt-6">{children}</div>}
    </div>
  );
};

export default ClassOverviewReport;
