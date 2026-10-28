// Trend Report — Weekly / Monthly / Yearly grouping switch.

import type { TrendGrouping } from "@/components/reports/reportTheme";

const OPTIONS: { id: TrendGrouping; label: string }[] = [
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
  { id: "year", label: "Yearly" },
];

const TrendRangeBar = ({ value, onChange }: { value: TrendGrouping; onChange: (v: TrendGrouping) => void }) => (
  <div
    role="radiogroup"
    aria-label="Trend grouping"
    className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-panel))] p-1"
  >
    {OPTIONS.map((o) => (
      <button
        key={o.id}
        type="button"
        role="radio"
        aria-checked={value === o.id}
        onClick={() => onChange(o.id)}
        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
          value === o.id
            ? "bg-[hsl(var(--rp-fg))] text-[hsl(var(--rp-panel))]"
            : "text-[hsl(var(--rp-muted))] hover:text-[hsl(var(--rp-fg))]"
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export default TrendRangeBar;
