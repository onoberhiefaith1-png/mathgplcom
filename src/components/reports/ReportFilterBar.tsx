// Segmented Assignment / Adventure / Both filter — display only.

import type { ReportFilter } from "./reportTheme";

const OPTIONS: { id: ReportFilter; label: string; dot?: string }[] = [
  { id: "both", label: "Both" },
  { id: "assignment", label: "Assignment", dot: "hsl(var(--rp-assignment))" },
  { id: "adventure", label: "Adventure", dot: "hsl(var(--rp-adventure))" },
];

const ReportFilterBar = ({ value, onChange }: { value: ReportFilter; onChange: (v: ReportFilter) => void }) => (
  <div
    role="radiogroup"
    aria-label="Show"
    className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-panel))] p-1"
  >
    {OPTIONS.map((o) => (
      <button
        key={o.id}
        type="button"
        role="radio"
        aria-checked={value === o.id}
        onClick={() => onChange(o.id)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
          value === o.id
            ? "bg-[hsl(var(--rp-fg))] text-[hsl(var(--rp-panel))]"
            : "text-[hsl(var(--rp-muted))] hover:text-[hsl(var(--rp-fg))]"
        }`}
      >
        {o.dot && <span className="h-2 w-2 rounded-[3px]" style={{ background: o.dot }} />}
        {o.label}
      </button>
    ))}
  </div>
);

export default ReportFilterBar;
