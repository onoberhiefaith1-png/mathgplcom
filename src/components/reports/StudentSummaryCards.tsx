// Individual Student summary — every number is calculated from real records.

import type { StudentSummary } from "@/lib/reports/studentReport";

const Card = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-panel))] px-4 py-3 text-center">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">{label}</div>
    <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
  </div>
);

const StudentSummaryCards = ({ summary }: { summary: StudentSummary }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <Card label="Assessments" value={`${summary.assessmentsCompleted} / ${summary.assessmentsTotal}`} />
    <Card label="Marks Earned" value={`${summary.marksEarned} / ${summary.marksAvailable}`} />
    <Card label="Assessment Performance" value={`${summary.performance}%`} />
    <Card label="Average Score" value={`${summary.averageScore} / ${summary.averageAvailable}`} />
  </div>
);

export default StudentSummaryCards;
