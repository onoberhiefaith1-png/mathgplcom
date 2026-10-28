import { ArrowDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PFRow {
  prime: number | null;
  dividend: number;
  locked: boolean;
}

interface Props {
  target: number;
  rows: PFRow[];
  activeRowIdx: number;
  finished: boolean;
}

export const PrimeFactorTable = ({ target, rows, activeRowIdx, finished }: Props) => {
  return (
    <div className="rounded-2xl border-2 border-primary/40 bg-card/60 p-3 sm:p-4 backdrop-blur shadow-[0_0_24px_hsl(220_70%_50%/0.18)]">
      <h2 className="text-center text-sm sm:text-base font-black uppercase tracking-[0.25em] text-cyan-300 mb-3">
        Prime Division Table
      </h2>

      <div className="rounded-lg border-2 border-primary/30 overflow-hidden">
        <div className="grid grid-cols-2 bg-card/80 text-[11px] uppercase tracking-[0.2em] font-black border-b-2 border-primary/30">
          <div className="px-2 py-2 text-center text-fuchsia-300 border-r-2 border-primary/30">Prime</div>
          <div className="px-2 py-2 text-center text-amber-300">Number</div>
        </div>

        <div>
          {rows.map((row, i) => {
            const active = i === activeRowIdx && !row.locked;
            const showArrow = i < rows.length - 1 || (finished && i === rows.length - 1 && row.dividend !== 1);
            return (
              <div key={i} data-pf-row={i}>
                <div className={cn(
                  "grid grid-cols-2 items-center transition-all min-h-[44px]",
                  row.locked && "bg-emerald-500/5",
                  active && "bg-amber-500/5 ring-1 ring-amber-400/30",
                )}>
                  <div className="px-2 py-2 text-center border-r-2 border-primary/30">
                    {row.prime != null ? (
                      <span className={cn(
                        "inline-flex items-center gap-1 text-xl font-black tabular-nums",
                        row.locked ? "text-fuchsia-300" : "text-fuchsia-200",
                      )}>
                        {row.locked && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                        {row.prime}
                      </span>
                    ) : row.dividend === 1 ? (
                      <span className="text-muted-foreground/60 text-xl font-black">—</span>
                    ) : active ? (
                      <span className="inline-block h-7 w-12 rounded-md border-2 border-dashed border-fuchsia-400/60 animate-pulse" />
                    ) : (
                      <span className="text-muted-foreground/40">·</span>
                    )}
                  </div>
                  <div className="px-2 py-2 text-center">
                    <span className={cn(
                      "text-xl sm:text-2xl font-black tabular-nums",
                      row.dividend === 1 ? "text-emerald-300 drop-shadow-[0_0_10px_hsl(150_70%_50%/0.6)]" : "text-amber-200",
                    )}>{row.dividend}</span>
                  </div>
                </div>
                {showArrow && (
                  <div className="grid grid-cols-2 border-t border-primary/10">
                    <div className="border-r-2 border-primary/30" />
                    <div className="flex justify-center py-0.5">
                      <ArrowDown className="h-3.5 w-3.5 text-amber-300/70" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
