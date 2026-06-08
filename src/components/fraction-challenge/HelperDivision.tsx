// Interactive division helper — student types the quotient. No auto-answer.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import VisualGroupingMini from "@/components/lcm/VisualGroupingMini";

interface Props {
  dividend: number;
  divisor: number;
}

const DOTS_MAX = 200;

export const HelperDivision = ({ dividend, divisor }: Props) => {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState<null | "ok" | "bad">(null);

  useEffect(() => {
    setValue("");
    setChecked(null);
  }, [dividend, divisor]);

  const expected = divisor > 0 ? Math.floor(dividend / divisor) : 0;
  const exact = divisor > 0 && dividend % divisor === 0;

  const onCheck = () => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) { setChecked("bad"); return; }
    setChecked(n === expected && exact ? "ok" : "bad");
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300/80 font-bold">
        Solve {dividend} ÷ {divisor}
      </div>

      {/* Visual workspace: ungrouped dots, no pre-grouping */}
      {dividend <= DOTS_MAX ? (
        <VisualGroupingMini n={dividend} groupSize={divisor} />
      ) : (
        <div className="rounded-2xl border-2 border-cyan-400/40 bg-card/40 p-3 text-center text-xs text-muted-foreground backdrop-blur">
          Use long division on paper, then enter the quotient.
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-lg font-black tabular-nums">
        <span className="text-cyan-200">{dividend}</span>
        <span className="text-cyan-300/70">÷</span>
        <span className="text-cyan-200">{divisor}</span>
        <span className="text-cyan-300/70">=</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => { setValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 4)); setChecked(null); }}
          onKeyDown={(e) => e.key === "Enter" && onCheck()}
          placeholder="?"
          className={cn(
            "w-16 rounded-md border-2 bg-background/60 px-2 py-1 text-center text-lg font-black tabular-nums outline-none",
            checked === "ok" && "border-emerald-400 text-emerald-200",
            checked === "bad" && "border-rose-400 text-rose-200",
            checked === null && "border-amber-400/60 text-amber-200",
          )}
        />
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

export default HelperDivision;
