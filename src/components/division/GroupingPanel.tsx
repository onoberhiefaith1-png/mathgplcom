import { cn } from "@/lib/utils";

interface Props {
  W: number;
  divisor: number;
}

const GROUP_COLORS = [
  "bg-rose-500 border-rose-300 shadow-[0_0_8px_hsl(0_85%_60%/0.7)]",
  "bg-amber-400 border-amber-200 shadow-[0_0_8px_hsl(45_95%_60%/0.75)]",
  "bg-sky-400 border-sky-200 shadow-[0_0_8px_hsl(200_85%_60%/0.7)]",
  "bg-violet-500 border-violet-300 shadow-[0_0_8px_hsl(270_80%_65%/0.7)]",
  "bg-emerald-400 border-emerald-200 shadow-[0_0_8px_hsl(150_75%_55%/0.7)]",
  "bg-fuchsia-500 border-fuchsia-300 shadow-[0_0_8px_hsl(310_80%_60%/0.7)]",
];

/** Visual grouping helper for the CURRENT division step only.
 *  Renders W balls in rows of `divisor`, each group in a distinct color.
 *  Leftover balls in the final row render as dim/empty slots. No answer revealed. */
export const GroupingPanel = ({ W, divisor }: Props) => {
  if (divisor <= 0) return null;
  const fullGroups = Math.floor(W / divisor);
  const remainder = W - fullGroups * divisor;
  const totalRows = fullGroups + (remainder > 0 ? 1 : 0) || 1;

  const displayedRows = Math.min(totalRows, 8);
  const showOverflow = totalRows > displayedRows;

  return (
    <div className="rounded-xl border-2 border-sky-500/40 bg-gradient-to-b from-sky-500/10 to-card/70 p-3 backdrop-blur shadow-lg animate-[scale-in_0.3s_ease-out]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-sky-300">Visual Grouping</h3>
        <div className="rounded-md border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-xs font-black tabular-nums text-sky-100">
          {W} ÷ {divisor} = <span className="text-amber-300">?</span>
        </div>
      </div>

      <div className="space-y-1.5">
        {Array.from({ length: displayedRows }).map((_, ri) => {
          const isFull = ri < fullGroups;
          const ballCount = isFull ? divisor : remainder;
          const colorClass = isFull ? GROUP_COLORS[ri % GROUP_COLORS.length] : "";
          return (
            <div
              key={ri}
              className={cn(
                "flex items-center gap-1 rounded-md border p-1 transition-all",
                isFull ? "border-emerald-500/30 bg-emerald-500/5" : "border-dashed border-muted-foreground/30 bg-muted/10",
              )}
              style={{ animation: `scale-in 0.25s ease-out ${ri * 70}ms backwards` } as React.CSSProperties}
            >
              {Array.from({ length: divisor }).map((_, bi) => {
                const filled = bi < ballCount;
                return (
                  <div
                    key={bi}
                    className={cn(
                      "h-4 w-4 rounded-full border transition-all",
                      filled ? cn(colorClass || "bg-amber-300 border-amber-100 shadow-[0_0_6px_hsl(45_95%_60%/0.7)]") : "border-dashed border-muted-foreground/40 bg-transparent",
                    )}
                  />
                );
              })}
            </div>
          );
        })}
        {showOverflow && (
          <div className="text-center text-[10px] text-muted-foreground">+ {totalRows - displayedRows} more rows</div>
        )}
      </div>

      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
        How many full groups of <span className="font-bold text-sky-200">{divisor}</span> fit in <span className="font-bold text-sky-200">{W}</span>?
      </p>
    </div>
  );
};
