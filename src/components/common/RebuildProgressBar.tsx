import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Props {
  /** 0–100, or null to render nothing. */
  percent: number | null;
  /** Short line under the bar, e.g. "Rebuilding the solution". */
  label?: string | null;
  className?: string;
}

/** A slim percentage bar for long AI runs ("40% done"). */
export function RebuildProgressBar({ percent, label, className }: Props) {
  if (percent == null) return null;
  return (
    <div
      className={cn("w-full space-y-1", className)}
      role="status"
      aria-live="polite"
      aria-label={`${percent}% done`}
    >
      <Progress value={percent} className="h-1.5" />
      <div className="flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
        <span className="truncate">{label ?? "Working"}</span>
        <span className="tabular-nums font-medium shrink-0">{percent}% done</span>
      </div>
    </div>
  );
}

export default RebuildProgressBar;
