// Assessment Activities — one row per recorded assessment, Assignment and
// Adventure side by side in the same table.

import type { StudentAssessmentRow } from "@/lib/reports/studentReport";

const TYPE_LABEL: Record<StudentAssessmentRow["mode"], string> = {
  assignment: "Assignment",
  adventure: "Adventure",
};

const StudentAssessmentTable = ({
  rows,
  selectedId,
  onSelect,
}: {
  rows: StudentAssessmentRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--rp-border))] px-4 py-10 text-center text-sm text-[hsl(var(--rp-muted))]">
        No recorded assessments match these filters yet.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--rp-border))] text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--rp-muted))]">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-3">Assessment</th>
            <th className="py-2 pr-3">Type</th>
            <th className="py-2 pr-3">Topic</th>
            <th className="py-2 pr-3">Subtopic</th>
            <th className="py-2 pr-3 text-right">Marks</th>
            <th className="py-2 pr-3 text-right">Earned</th>
            <th className="py-2 text-right">Completion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.assessmentId}
              onClick={() => onSelect(r.assessmentId)}
              className={`cursor-pointer border-b border-dashed border-[hsl(var(--rp-border))] transition ${
                selectedId === r.assessmentId ? "bg-[hsl(var(--rp-grid))]" : "hover:bg-[hsl(var(--rp-grid))]/60"
              }`}
            >
              <td className="py-2 pr-2 tabular-nums text-[hsl(var(--rp-muted))]">{r.index}</td>
              <td className="py-2 pr-3 font-medium">{r.label}</td>
              <td className="py-2 pr-3">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-[3px]"
                    style={{ background: `hsl(var(--rp-${r.mode}))` }}
                  />
                  {TYPE_LABEL[r.mode]}
                </span>
              </td>
              <td className="py-2 pr-3">{r.topic}</td>
              <td className="py-2 pr-3 text-[hsl(var(--rp-muted))]">{r.subtopic}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.available}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.earned}</td>
              <td className="py-2 text-right font-semibold tabular-nums">{r.completion}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StudentAssessmentTable;
