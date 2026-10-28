// Interactive addition helper — blank sum, student fills in result.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  a: number;
  b: number;
  op: "+" | "-";
}

export const HelperAddition = ({ a, b, op }: Props) => {
  const expected = op === "+" ? a + b : a - b;
  const max = Math.max(a, b, op === "+" ? a + b : a, 10);
  const ticks = Array.from({ length: max + 1 }, (_, i) => i);

  const [value, setValue] = useState("");
  const [checked, setChecked] = useState<null | "ok" | "bad">(null);

  useEffect(() => {
    setValue("");
    setChecked(null);
  }, [a, b, op]);

  const onCheck = () => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) { setChecked("bad"); return; }
    setChecked(n === expected ? "ok" : "bad");
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-[0.25em] text-emerald-300/80 font-bold">
        Solve {a} {op} {b}
      </div>
      <div className="rounded-2xl border-2 border-emerald-400/40 bg-card/50 p-3 backdrop-blur space-y-3">
        <div className="flex items-end justify-center gap-2 text-2xl font-black tabular-nums">
          <span className="text-emerald-200">{a}</span>
          <span className="text-emerald-300/70 text-xl">{op}</span>
          <span className="text-emerald-200">{b}</span>
          <span className="text-emerald-300/70 text-xl">=</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(e) => { setValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 5)); setChecked(null); }}
            onKeyDown={(e) => e.key === "Enter" && onCheck()}
            placeholder="?"
            className={cn(
              "w-20 rounded-md border-2 bg-background/60 px-2 py-1 text-center text-xl font-black tabular-nums outline-hidden",
              checked === "ok" && "border-emerald-400 text-emerald-200",
              checked === "bad" && "border-rose-400 text-rose-200",
              checked === null && "border-amber-400/60 text-amber-200",
            )}
          />
        </div>
        {max <= 30 && (
          <div className="flex items-end justify-between gap-px overflow-x-auto px-1">
            {ticks.map((t) => {
              const isA = t === a;
              const isB = op === "+" ? t === b : false;
              return (
                <div key={t} className="flex flex-col items-center min-w-[10px]">
                  <div
                    className={cn(
                      "h-3 w-px",
                      isA || isB ? "bg-emerald-300 h-4" : "bg-primary/30",
                    )}
                  />
                  <div
                    className={cn(
                      "text-[8px] tabular-nums mt-0.5",
                      isA || isB ? "text-emerald-200 font-bold" : "text-muted-foreground/40",
                    )}
                  >
                    {t}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onCheck}
        className="w-full rounded-lg bg-amber-500 px-2 py-1.5 text-[11px] font-black text-background hover:bg-amber-400"
      >
        Check
      </button>
      {checked === "bad" && (
        <p className="text-center text-[10px] text-rose-300">Not quite — try again.</p>
      )}
      {checked === "ok" && (
        <p className="text-center text-[10px] text-emerald-300 font-bold">Correct!</p>
      )}
    </div>
  );
};

export default HelperAddition;
