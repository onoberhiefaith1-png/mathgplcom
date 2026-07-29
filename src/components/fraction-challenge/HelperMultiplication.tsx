// Interactive multiplication helper — blank times-table patch + input.
// Student computes the product themselves.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  a: number;
  b: number;
}

export const HelperMultiplication = ({ a, b }: Props) => {
  const rowStart = Math.max(1, a - 2);
  const colStart = Math.max(1, b - 2);
  const rowCount = 5;
  const colCount = 5;
  const expected = a * b;

  const [value, setValue] = useState("");
  const [checked, setChecked] = useState<null | "ok" | "bad">(null);

  useEffect(() => {
    setValue("");
    setChecked(null);
  }, [a, b]);

  const onCheck = () => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) { setChecked("bad"); return; }
    setChecked(n === expected ? "ok" : "bad");
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-[0.25em] text-violet-300/80 font-bold">
        Solve {a} × {b}
      </div>
      <div className="rounded-2xl border-2 border-violet-400/40 bg-card/50 p-3 backdrop-blur">
        <div className="overflow-hidden rounded-lg border border-primary/30">
          <table className="w-full border-collapse text-center text-xs tabular-nums">
            <thead>
              <tr className="bg-background/40">
                <th className="border border-primary/20 p-1.5 text-violet-300 font-black">×</th>
                {Array.from({ length: colCount }).map((_, ci) => {
                  const c = colStart + ci;
                  const isTarget = c === b;
                  return (
                    <th
                      key={ci}
                      className={cn(
                        "border border-primary/20 p-1.5 font-black",
                        isTarget ? "bg-violet-500/30 text-violet-100" : "text-violet-300/70",
                      )}
                    >
                      {c}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }).map((_, ri) => {
                const r = rowStart + ri;
                const rowIsTarget = r === a;
                return (
                  <tr key={ri}>
                    <th
                      className={cn(
                        "border border-primary/20 p-1.5 font-black",
                        rowIsTarget ? "bg-violet-500/30 text-violet-100" : "text-violet-300/70 bg-background/40",
                      )}
                    >
                      {r}
                    </th>
                    {Array.from({ length: colCount }).map((_, ci) => {
                      const c = colStart + ci;
                      const cellTarget = r === a && c === b;
                      return (
                        <td
                          key={ci}
                          className={cn(
                            "border border-primary/20 p-1.5",
                            cellTarget
                              ? "bg-amber-500/20 text-amber-200 font-black"
                              : (r === a || c === b)
                                ? "bg-violet-500/10"
                                : "",
                          )}
                        >
                          {/* blank — student computes */}
                          {cellTarget ? "?" : ""}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-lg font-black tabular-nums">
        <span className="text-violet-200">{a}</span>
        <span className="text-violet-300/70">×</span>
        <span className="text-violet-200">{b}</span>
        <span className="text-violet-300/70">=</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => { setValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 5)); setChecked(null); }}
          onKeyDown={(e) => e.key === "Enter" && onCheck()}
          placeholder="?"
          className={cn(
            "w-20 rounded-md border-2 bg-background/60 px-2 py-1 text-center text-lg font-black tabular-nums outline-hidden",
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

export default HelperMultiplication;
