// Interactive mini LCM ladder. Student fills in prime divisors and reduced
// values themselves — no auto-solve.

import { useEffect, useMemo, useState } from "react";
import { LcmLadder, EditableRow, FocusTarget } from "@/components/lcm/LcmLadder";
import { DigitBank } from "@/components/lcm/DigitBank";
import { isPrime, lcmOf } from "@/lib/lcm";
import { cn } from "@/lib/utils";

interface Props {
  numbers: number[];
}

const buildInitial = (nums: number[]): EditableRow[] => [
  { divisor: "", values: nums.map(String), status: null },
  { divisor: "", values: nums.map(() => ""), status: null },
];

export const HelperLCM = ({ numbers }: Props) => {
  const seed = useMemo(() => Array.from(new Set(numbers)), [numbers]);
  const [rows, setRows] = useState<EditableRow[]>(() => buildInitial(seed));
  const [focus, setFocus] = useState<FocusTarget | null>({ rowIdx: 1, col: "div" });
  const [submitted, setSubmitted] = useState(false);
  const [lit, setLit] = useState(false);
  const [hint, setHint] = useState<string>("Pick a prime that divides at least one number above.");
  const [result, setResult] = useState<number | null>(null);

  // Reset when the question's denominators change.
  useEffect(() => {
    setRows(buildInitial(seed));
    setFocus({ rowIdx: 1, col: "div" });
    setSubmitted(false);
    setLit(false);
    setHint("Pick a prime that divides at least one number above.");
    setResult(null);
  }, [seed.join(",")]);

  const writeDigit = (d: number) => {
    if (!focus || submitted) return;
    setRows((rs) => rs.map((r, ri) => {
      if (ri !== focus.rowIdx) return r;
      if (focus.col === "div") {
        return { ...r, divisor: (r.divisor + String(d)).slice(0, 3), status: null };
      }
      const ci = focus.col;
      const nv = r.values.slice();
      nv[ci] = ((nv[ci] ?? "") + String(d)).slice(0, 4);
      return { ...r, values: nv, status: null };
    }));
  };

  const backspace = () => {
    if (!focus || submitted) return;
    setRows((rs) => rs.map((r, ri) => {
      if (ri !== focus.rowIdx) return r;
      if (focus.col === "div") return { ...r, divisor: r.divisor.slice(0, -1), status: null };
      const ci = focus.col;
      const nv = r.values.slice();
      nv[ci] = (nv[ci] ?? "").slice(0, -1);
      return { ...r, values: nv, status: null };
    }));
  };

  const addRow = () => {
    if (submitted) return;
    setRows((rs) => [...rs, { divisor: "", values: rs[0].values.map(() => ""), status: null }]);
  };

  const handleSubmit = () => {
    if (submitted) return;
    const used: number[] = [];
    let allOk = true;
    const next: EditableRow[] = rows.map((r) => ({ ...r, status: null }));

    for (let i = 0; i < next.length - 1; i++) {
      const cur = next[i];
      const nxt = next[i + 1];
      const dStr = cur.divisor.trim();
      if (!dStr) {
        const anyNext = nxt.values.some((v) => v.trim() !== "");
        if (anyNext) { cur.status = "bad"; allOk = false; }
        continue;
      }
      const d = parseInt(dStr, 10);
      if (!isPrime(d)) { cur.status = "bad"; allOk = false; continue; }
      let rowOk = true;
      for (let c = 0; c < cur.values.length; c++) {
        const prevN = parseInt(cur.values[c], 10);
        const nextN = parseInt(nxt.values[c] ?? "", 10);
        if (!Number.isFinite(prevN) || !Number.isFinite(nextN)) { rowOk = false; break; }
        if (prevN % d === 0) {
          if (nextN !== prevN / d) { rowOk = false; break; }
        } else {
          if (nextN !== prevN) { rowOk = false; break; }
        }
      }
      if (rowOk) { cur.status = "ok"; used.push(d); }
      else { cur.status = "bad"; allOk = false; }
    }

    const last = next[next.length - 1];
    const finalOnes = last.values.every((v) => v.trim() === "1");
    if (!finalOnes) { last.status = "bad"; allOk = false; }
    else { last.status = "ok"; }

    setRows(next);
    if (allOk && used.length >= 1) {
      const r = used.reduce((a, b) => a * b, 1);
      setLit(true);
      setSubmitted(true);
      setResult(r);
      setHint(`Correct! ${used.join(" × ")} = ${r}`);
    } else {
      setHint("Check the highlighted rows — divisor must be prime and divide evenly.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-[0.25em] text-amber-300/80 font-bold">
        Find LCM of {seed.join(" and ")}
      </div>
      <LcmLadder rows={rows} focus={focus} onFocus={setFocus} lit={lit} />
      <DigitBank onDigit={writeDigit} onBackspace={backspace} disabled={submitted} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={addRow}
          disabled={submitted}
          className="flex-1 rounded-lg border border-primary/40 bg-card/60 px-2 py-1.5 text-[11px] font-bold hover:border-amber-400/60 disabled:opacity-40"
        >
          + Row
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitted}
          className="flex-[2] rounded-lg bg-amber-500 px-2 py-1.5 text-[11px] font-black text-background hover:bg-amber-400 disabled:opacity-40"
        >
          Check
        </button>
      </div>
      <p
        className={cn(
          "text-center text-[10px] leading-snug",
          submitted && lit ? "text-emerald-300 font-bold" : "text-muted-foreground",
        )}
      >
        {hint}
      </p>
      {result !== null && lcmOf(seed) === result && (
        <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/5 px-3 py-2 text-center">
          <div className="text-[9px] uppercase tracking-widest text-emerald-300/80">Your LCM</div>
          <div className="text-2xl font-black text-emerald-200 tabular-nums">{result}</div>
        </div>
      )}
    </div>
  );
};

export default HelperLCM;
