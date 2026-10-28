// Progress Over Time — the student's completion across assessments in order.

import type { StudentAssessmentRow } from "@/lib/reports/studentReport";

const W = 520;
const H = 190;
const PAD_L = 34;
const PAD_B = 26;
const PAD_T = 10;

const StudentProgressGraph = ({ rows }: { rows: StudentAssessmentRow[] }) => {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--rp-border))] px-4 py-10 text-center text-sm text-[hsl(var(--rp-muted))]">
        No assessment results to plot yet.
      </div>
    );
  }
  const innerW = W - PAD_L - 8;
  const innerH = H - PAD_B - PAD_T;
  const x = (i: number) => PAD_L + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const y = (p: number) => PAD_T + innerH - (Math.max(0, Math.min(100, p)) / 100) * innerH;
  const ticks = [0, 25, 50, 75, 100];
  const path = rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(r.completion)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Assessment progress over time">
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD_L}
            x2={W - 8}
            y1={y(t)}
            y2={y(t)}
            stroke="hsl(var(--rp-grid))"
            strokeWidth={1}
          />
          <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fontSize="9" fill="hsl(var(--rp-muted))">
            {t}%
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="hsl(var(--rp-fg))" strokeWidth={1.5} />
      {rows.map((r, i) => (
        <g key={r.assessmentId}>
          <circle cx={x(i)} cy={y(r.completion)} r={4} fill={`hsl(var(--rp-${r.mode}))`} />
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="hsl(var(--rp-muted))">
            Q{r.index}
          </text>
        </g>
      ))}
    </svg>
  );
};

export default StudentProgressGraph;
