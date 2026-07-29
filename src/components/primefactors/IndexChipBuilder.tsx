import { useEffect, useRef, useState } from "react";
import { Plus, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toIndexNotation, toSuperscript } from "@/lib/primeFactors";

export interface IndexChip {
  prime: number;
  power: number;
}

interface Props {
  factors: number[]; // ground-truth prime factors (multiset)
  active: boolean;
  chips: IndexChip[];
  onChipsChange: (chips: IndexChip[]) => void;
  onCorrect: (chipPositions: { x: number; y: number }[]) => void;
}

export const IndexChipBuilder = ({ factors, active, chips, onChipsChange, onCorrect }: Props) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // auto-validate
  useEffect(() => {
    if (!active || chips.length === 0 || revealed) return;
    const want = toIndexNotation(factors);
    const got = [...chips].sort((a, b) => a.prime - b.prime);
    if (want.length !== got.length) return;
    const ok = want.every((w, i) => got[i].prime === w.prime && got[i].power === w.power);
    if (!ok) return;

    // Collect positions for reward burst
    const positions: { x: number; y: number }[] = [];
    for (const c of chips) {
      const el = chipRefs.current[c.prime];
      const r = el?.getBoundingClientRect();
      if (r) positions.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
    setRevealed(true);
    setTimeout(() => onCorrect(positions), 350);
  }, [chips, factors, active, revealed, onCorrect]);

  useEffect(() => { setRevealed(false); setSelected(null); }, [factors]);

  const adjust = (delta: number) => {
    if (selected == null) return;
    const next = chips
      .map((c) => (c.prime === selected ? { ...c, power: c.power + delta } : c))
      .filter((c) => c.power > 0);
    if (!next.find((c) => c.prime === selected)) setSelected(null);
    onChipsChange(next);
  };

  return (
    <div className="relative rounded-2xl border-2 border-fuchsia-500/40 bg-card/60 p-3 backdrop-blur overflow-hidden shadow-[0_0_24px_hsl(300_70%_55%/0.18)]">
      {/* Blurred treasure background */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.18] blur-md">
        <img src="/assets/rewards/treasure/golden_chest.png" alt="" className="h-32 w-32 object-contain" />
      </div>

      <div className="relative">
        <h3 className="text-center text-[10px] sm:text-xs uppercase tracking-[0.25em] font-black text-amber-300">
          Write your answer in
        </h3>
        <h3 className="text-center text-xs sm:text-sm uppercase tracking-[0.2em] font-black text-amber-400">
          Prime Factor Index Notation
        </h3>

        <div ref={containerRef} className={cn(
          "mt-3 min-h-[64px] rounded-xl border-2 border-fuchsia-400/40 bg-background/30 p-3",
          "flex flex-wrap items-center justify-center gap-2",
          revealed && "transition-opacity duration-300 opacity-0",
        )}>
          {chips.length === 0 && (
            <p className="text-xs text-muted-foreground/70 text-center">
              {active
                ? "Tap primes from the toolbar to build your answer"
                : "Finish the division table first"}
            </p>
          )}
          {chips.map((c, i) => (
            <div key={c.prime} className="flex items-center gap-2">
              <div
                ref={(el) => { chipRefs.current[c.prime] = el; }}
                onClick={() => active && setSelected(c.prime)}
                className={cn(
                  "relative cursor-pointer rounded-lg border-2 px-3 py-1.5 transition-all select-none",
                  "bg-gradient-to-b from-fuchsia-500/15 to-card/60",
                  selected === c.prime
                    ? "border-amber-400 shadow-[0_0_14px_hsl(45_95%_60%/0.65)] scale-110"
                    : "border-fuchsia-400/50 hover:border-fuchsia-300 hover:scale-105",
                )}
              >
                <span className="text-2xl sm:text-3xl font-black tabular-nums text-foreground">
                  {c.prime}
                  {c.power >= 2 && (
                    <span className="text-amber-300">{toSuperscript(c.power)}</span>
                  )}
                </span>
              </div>
              {i < chips.length - 1 && (
                <span className="text-lg sm:text-xl font-black text-muted-foreground">×</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            onClick={() => adjust(1)}
            disabled={!active || selected == null}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border-2 border-emerald-500/60 bg-emerald-500/15 px-3 py-1.5 text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-200",
              "hover:bg-emerald-500/25 hover:shadow-[0_0_12px_hsl(150_70%_50%/0.5)] transition-all",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            <Plus className="h-3.5 w-3.5" /> Power
          </button>
          <button
            onClick={() => adjust(-1)}
            disabled={!active || selected == null}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border-2 border-rose-500/60 bg-rose-500/15 px-3 py-1.5 text-xs sm:text-sm font-black uppercase tracking-wider text-rose-200",
              "hover:bg-rose-500/25 hover:shadow-[0_0_12px_hsl(0_70%_55%/0.5)] transition-all",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            <Minus className="h-3.5 w-3.5" /> Power
          </button>
        </div>

        {revealed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="inline-flex items-center gap-1 text-amber-300 font-black animate-[scale-in_0.3s_ease-out]">
              <Sparkles className="h-5 w-5" /> Correct!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
