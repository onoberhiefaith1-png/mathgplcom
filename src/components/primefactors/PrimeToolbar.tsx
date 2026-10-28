import { useState } from "react";
import { cn } from "@/lib/utils";
import { PRIME_HINTS } from "@/lib/primeFactors";

interface Props {
  onPick: (prime: number) => boolean | void; // return false → reject (shake)
  disabled?: boolean;
  title?: string;
}

export const PrimeToolbar = ({ onPick, disabled, title = "Select a prime number" }: Props) => {
  const [shake, setShake] = useState<number | null>(null);

  const handleClick = (p: number) => {
    if (disabled) return;
    const ok = onPick(p);
    if (ok === false) {
      setShake(p);
      setTimeout(() => setShake((s) => (s === p ? null : s)), 450);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-cyan-500/40 bg-card/60 p-3 backdrop-blur shadow-[0_0_24px_hsl(190_70%_50%/0.15)]">
      <h3 className="text-center text-[11px] sm:text-xs uppercase tracking-[0.3em] font-black text-cyan-300 mb-2">
        {title}
      </h3>
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {PRIME_HINTS.map((p) => (
          <button
            key={p}
            onClick={() => handleClick(p)}
            disabled={disabled}
            className={cn(
              "h-10 min-w-[2.5rem] sm:h-11 sm:min-w-[2.75rem] px-2 rounded-lg border-2 border-cyan-400/50 bg-background/40",
              "text-base sm:text-lg font-black tabular-nums text-cyan-100",
              "hover:border-cyan-300 hover:bg-cyan-500/10 hover:scale-110 hover:shadow-[0_0_12px_hsl(190_80%_55%/0.6)] transition-all",
              "active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100",
              shake === p && "animate-[shake_0.4s_ease-in-out] border-rose-500 text-rose-300 shadow-[0_0_14px_hsl(0_80%_55%/0.7)]",
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
};
