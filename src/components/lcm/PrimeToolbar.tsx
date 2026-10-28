import { cn } from "@/lib/utils";

const PRIMES = [2, 3, 5, 7, 11, 13, 17];

interface Props {
  selected: number | null;
  onSelect: (p: number) => void;
  shake?: boolean;
}

export const PrimeToolbar = ({ selected, onSelect, shake }: Props) => (
  <div className={cn(
    "flex flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-amber-400/40 bg-card/50 px-3 py-2 backdrop-blur shadow-[0_0_18px_rgba(0,0,0,0.35)]",
    shake && "animate-[shake_0.4s_ease-in-out]",
  )}>
    <span className="text-[9px] uppercase tracking-[0.3em] text-amber-300 font-bold mr-1">Primes</span>
    {PRIMES.map((p) => {
      const isSel = selected === p;
      return (
        <button
          key={p}
          type="button"
          onClick={() => onSelect(p)}
          className={cn(
            "h-9 w-9 rounded-full border-2 text-sm font-black tabular-nums transition-all",
            isSel
              ? "border-amber-300 bg-amber-400 text-background scale-110 shadow-[0_0_18px_hsl(45_95%_60%/0.9)]"
              : "border-amber-400/40 bg-background/40 text-amber-200 hover:border-amber-300 hover:scale-105 shadow-[0_0_8px_hsl(45_95%_60%/0.25)]",
          )}
        >
          {p}
        </button>
      );
    })}
  </div>
);

export default PrimeToolbar;
