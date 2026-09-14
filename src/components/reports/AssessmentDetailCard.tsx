// One assessment, in full. Marks earned out of marks available plus a
// completion indicator — never Pass/Fail, never "failed question".

import CompletionBar from "./CompletionBar";
import type { StudentAssessmentRow } from "@/lib/reports/studentReport";

const TYPE_LABEL = { assignment: "Assignment", adventure: "Adventure", game: "Game" } as const;

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—";

const Line = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-3 text-sm">
    <span className="text-[hsl(var(--rp-muted))]">{label}</span>
    <span className="font-medium tabular-nums">{value}</span>
  </div>
);

const AssessmentDetailCard = ({ row }: { row: StudentAssessmentRow | null }) => {
  if (!row) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--rp-border))] px-4 py-10 text-center text-sm text-[hsl(var(--rp-muted))]">
        Select an assessment to see its detail.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-panel))] p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
        Assessment detail
      </h3>
      <p className="mt-1 text-sm font-semibold">
        {row.label} ({TYPE_LABEL[row.mode]})
      </p>
      <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        <Line label="Topic" value={row.topic} />
        <Line label="Marks available" value={String(row.available)} />
        <Line label="Subtopic" value={row.subtopic} />
        <Line label="Marks earned" value={String(row.earned)} />
        <Line label="Date" value={fmtDate(row.at)} />
        <Line label="Assessment performance" value={`${row.completion}%`} />
        <Line label="Time" value={fmtTime(row.at)} />
        <Line
          label="Status"
          value={row.status === "completed" ? "Completed" : row.status === "in_progress" ? "In progress" : "Not started"}
        />
      </div>
      <div className="mt-4">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
          Assessment completion
        </div>
        <CompletionBar percent={row.completion} tone={row.mode} />
        {row.totalElements > 0 && (
          <p className="mt-1.5 text-xs text-[hsl(var(--rp-muted))]">
            Correctly constructed: {row.constructedElements} / {row.totalElements} elements
          </p>
        )}
      </div>
    </div>
  );
};

export default AssessmentDetailCard;
