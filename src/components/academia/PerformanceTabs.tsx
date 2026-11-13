import { PERFORMANCE_LABEL, PERFORMANCE_VIEWS, type PerformanceView } from "@/lib/academia/evaluationScore";

/** Beginner, Intermediate, Expert and Overall. Selecting one never changes another tier's score. */
const PerformanceTabs = ({ value, onChange, label = "Evaluation level" }: {
  value: PerformanceView;
  onChange: (view: PerformanceView) => void;
  label?: string;
}) => (
  <div role="tablist" aria-label={label} data-testid="evaluation-tiers" className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-border bg-card p-1">
    {PERFORMANCE_VIEWS.map((view) => (
      <button
        key={view}
        type="button"
        role="tab"
        aria-selected={value === view}
        data-testid={`eval-tab-${view}`}
        onClick={() => onChange(view)}
        className={`rounded-full px-3 py-1.5 text-sm font-semibold ${value === view ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        {PERFORMANCE_LABEL[view]}
      </button>
    ))}
  </div>
);

export default PerformanceTabs;
