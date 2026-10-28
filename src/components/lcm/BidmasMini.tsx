import { cn } from "@/lib/utils";

interface Props {
  factors: number[];
  /** Adjacent pair (i, i+1) currently being multiplied. */
  activePair: number | null;
  onPickPair: (i: number) => void;
}

export const BidmasMini = ({ factors, activePair, onPickPair }: Props) => {
  const done = factors.length === 1;
  return (
    <div className="rounded-2xl border-2 border-violet-400/40 bg-card/50 p-3 sm:p-4 backdrop-blur shadow-[0_0_30px_rgba(0,0,0,0.4)]">
      <div className="text-center mb-2">
        <div className="text-[9px] uppercase tracking-[0.3em] text-violet-300 font-bold">BIDMAS · Simplify</div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 min-h-[60px] py-2">
        {factors.map((f, i) => {
          const inPair = activePair !== null && (i === activePair || i === activePair + 1);
          return (
            <span key={i} className="flex items-center gap-2 animate-fade-in">
              <button
                type="button"
                disabled={done}
                onClick={() => {
                  if (i === factors.length - 1) onPickPair(i - 1);
                  else onPickPair(i);
                }}
                className={cn(
                  "rounded-lg border-2 px-3 py-1.5 text-xl sm:text-2xl font-black tabular-nums transition-all",
                  done && "border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow-[0_0_22px_hsl(150_70%_50%/0.7)] scale-110",
                  !done && inPair && "border-amber-400 bg-amber-500/20 text-amber-200 shadow-[0_0_18px_hsl(45_95%_60%/0.7)] scale-110",
                  !done && !inPair && "border-violet-400/40 bg-background/40 text-foreground hover:border-amber-400/70 hover:scale-105",
                )}
              >
                {f}
              </button>
              {i < factors.length - 1 && (
                <span className="text-violet-300 font-black text-xl">×</span>
              )}
            </span>
          );
        })}
      </div>
      {done && (
        <div className="mt-1 text-center text-emerald-300 font-black text-sm tracking-wide animate-fade-in">
          LCM = {factors[0]}
        </div>
      )}
    </div>
  );
};

export default BidmasMini;
