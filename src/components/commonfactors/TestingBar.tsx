import { cn } from "@/lib/utils";
import { CornerDownLeft, RotateCcw, Users, Divide as DivideIcon } from "lucide-react";

const GROUP_COLORS = [
  "bg-rose-400", "bg-emerald-400", "bg-sky-400", "bg-amber-400",
  "bg-fuchsia-400", "bg-violet-400", "bg-orange-400", "bg-teal-400",
  "bg-pink-400", "bg-lime-400",
];

interface Props {
  activeNumber: number | null;
  divisor: number | null;
  mode: "group" | "division";
  setMode: (m: "group" | "division") => void;
  allowGrouping: boolean;
  onConfirm: () => void;
  onClear: () => void;
}

export const TestingBar = ({ activeNumber, divisor, mode, setMode, allowGrouping, onConfirm, onClear }: Props) => {
  const ready = activeNumber != null && divisor != null;
  const groups = ready ? Math.floor(activeNumber! / divisor!) : 0;
  const remainder = ready ? activeNumber! - groups * divisor! : 0;
  const q = groups;
  const product = q * (divisor ?? 0);

  return (
    <div className="rounded-xl border-2 border-amber-400/50 bg-card/40 p-2.5 backdrop-blur">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-[9px] uppercase tracking-[0.3em] font-bold text-amber-300">Testing</div>

        {!ready ? (
          <div className="flex-1 text-center text-xs text-muted-foreground italic">
            Tap a divisor on any side to test. You decide if it's a factor.
          </div>
        ) : (
          <>
            <div className="text-base font-black tabular-nums">
              {activeNumber} ÷ <span className="text-amber-300">{divisor}</span>
            </div>

            {allowGrouping && (
              <div className="flex gap-0.5 rounded-md border border-primary/20 p-0.5 bg-background/40">
                <button onClick={() => setMode("group")} className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-bold flex items-center gap-1",
                  mode === "group" ? "bg-emerald-500/20 text-emerald-300" : "text-muted-foreground",
                )}><Users className="h-3 w-3" /> Group</button>
                <button onClick={() => setMode("division")} className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-bold flex items-center gap-1",
                  mode === "division" ? "bg-sky-500/20 text-sky-300" : "text-muted-foreground",
                )}><DivideIcon className="h-3 w-3" /> Divide</button>
              </div>
            )}

            <div className="flex-1 min-w-[220px] rounded-md border border-primary/20 bg-background/40 px-2 py-1.5">
              {mode === "group" && allowGrouping ? (
                <div className="flex flex-wrap items-start justify-center gap-1.5">
                  {Array.from({ length: groups }, (_, gi) => (
                    <div key={gi} className="rounded border border-primary/30 bg-background/40 p-1">
                      <div className="grid gap-0.5"
                        style={{ gridTemplateColumns: `repeat(${Math.min(divisor!, 5)}, minmax(0, 1fr))` }}>
                        {Array.from({ length: divisor! }).map((_, di) => (
                          <span key={di} className={cn("h-1.5 w-1.5 rounded-full", GROUP_COLORS[gi % GROUP_COLORS.length])} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {remainder > 0 && (
                    <div className="rounded border border-dashed border-muted-foreground/40 bg-muted-foreground/5 p-1">
                      <div className="text-[8px] uppercase font-bold text-muted-foreground mb-0.5 text-center">Left</div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: remainder }).map((_, di) => (
                          <span key={di} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mx-auto inline-block font-mono text-sm text-foreground">
                  <div className="grid grid-cols-[auto_auto] items-end gap-x-1">
                    <div></div>
                    <div className="font-black tabular-nums">{q}</div>
                    <div className="font-black tabular-nums">{divisor}</div>
                    <div className="border-l-2 border-t-2 border-foreground/70 pl-1 tabular-nums">{activeNumber}</div>
                    <div></div>
                    <div className="border-b-2 border-foreground/70 tabular-nums text-right pr-0.5">{product}</div>
                    <div></div>
                    <div className="tabular-nums text-right pr-0.5 font-black">{remainder}</div>
                  </div>
                </div>
              )}
            </div>

            <button onClick={onClear}
              className="rounded border border-primary/30 bg-card/60 p-1.5 hover:border-amber-400/60">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button onClick={onConfirm}
              className="rounded bg-emerald-500/90 px-3 py-1.5 text-xs font-black text-background hover:bg-emerald-400 inline-flex items-center gap-1 shadow-[0_0_12px_hsl(150_70%_50%/0.5)]">
              <CornerDownLeft className="h-3.5 w-3.5" /> ENTER
            </button>
          </>
        )}
      </div>
    </div>
  );
};
