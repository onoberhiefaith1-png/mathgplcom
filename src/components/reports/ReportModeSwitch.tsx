// Reports — two lenses on the same data. Individual Student is the default.

export type ReportMode = "student" | "class";

const OPTIONS: { id: ReportMode; label: string }[] = [
  { id: "student", label: "Individual Student" },
  { id: "class", label: "Class Overview" },
];

const ReportModeSwitch = ({
  value,
  onChange,
}: {
  value: ReportMode;
  onChange: (v: ReportMode) => void;
}) => (
  <div
    role="radiogroup"
    aria-label="Report mode"
    className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-panel))] p-1"
  >
    {OPTIONS.map((o) => (
      <button
        key={o.id}
        type="button"
        role="radio"
        aria-checked={value === o.id}
        onClick={() => onChange(o.id)}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-tight transition ${
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

export default ReportModeSwitch;
