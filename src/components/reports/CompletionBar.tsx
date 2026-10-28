// Horizontal completion indicator — never a pass/fail badge.

const CompletionBar = ({
  percent,
  tone = "fg",
  showValue = true,
}: {
  percent: number;
  tone?: "fg" | "assignment" | "adventure" | "game";
  showValue?: boolean;
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const colour =
    tone === "assignment"
      ? "hsl(var(--rp-assignment))"
      : tone === "adventure"
      ? "hsl(var(--rp-adventure))"
      : tone === "game"
      ? "hsl(var(--rp-game))"
      : "hsl(var(--rp-fg))";
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--rp-grid))]"
      >
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${clamped}%`, background: colour }} />
      </div>
      {showValue && (
        <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">{clamped}%</span>
      )}
    </div>
  );
};

export default CompletionBar;
