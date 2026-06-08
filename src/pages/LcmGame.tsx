import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Timer, RotateCcw, Trophy, Check, Circle } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { cn } from "@/lib/utils";
import { LcmDifficulty, LCM_TIMERS, lcmOf, pickLcmProblem, isPrime } from "@/lib/lcm";
import { LcmLadder, EditableRow, FocusTarget } from "@/components/lcm/LcmLadder";
import { DigitBank } from "@/components/lcm/DigitBank";
import { SubmitBar } from "@/components/lcm/SubmitBar";
import { VisualGroupingMini } from "@/components/lcm/VisualGroupingMini";
import { BidmasMini } from "@/components/lcm/BidmasMini";
import { LongMulMini } from "@/components/lcm/LongMulMini";
import { BidmasRewardKind, BIDMAS_REWARD_META } from "@/lib/bidmasRewards";
import { FlyingRewards, BidmasFlightEvent } from "@/components/bidmas/FlyingRewards";
import { TreasureBurst, TreasureBurstItem } from "@/components/abacus/TreasureBurst";

const MAX_LIVES = 5;

const buildInitialRows = (problem: number[]): EditableRow[] => [
  { divisor: "", values: problem.map(String), status: null },
  { divisor: "", values: problem.map(() => ""), status: null },
];

const LcmGame = () => {
  const { difficulty = "easy" } = useParams<{ difficulty: LcmDifficulty }>();
  const diff = (["easy", "medium", "hard"].includes(difficulty) ? difficulty : "easy") as LcmDifficulty;

  const [problem, setProblem] = useState<number[]>(() => pickLcmProblem(diff));
  const [rows, setRows] = useState<EditableRow[]>(() => buildInitialRows(problem));
  const [focus, setFocus] = useState<FocusTarget | null>({ rowIdx: 1, col: "div" });
  const [lit, setLit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hint, setHint] = useState("Pick a prime that divides at least one number above. Write it on the left, then divide each number on the next row.");

  const [phase, setPhase] = useState<"ladder" | "simplify" | "won">("ladder");
  const [factors, setFactors] = useState<number[]>([]);
  const [activePair, setActivePair] = useState<number | null>(null);
  const [lives, setLives] = useState(MAX_LIVES);
  const [seconds, setSeconds] = useState(LCM_TIMERS[diff]);
  const [coins, setCoins] = useState<Record<BidmasRewardKind, number>>(
    () => ({ coin: 0, diamond: 0, heart: 0, crown: 0, star: 0, gem: 0, energy: 0, key: 0 }),
  );
  const [flights, setFlights] = useState<BidmasFlightEvent[]>([]);
  const [chestOrigin, setChestOrigin] = useState<{ x: number; y: number } | null>(null);
  const [chestItems, setChestItems] = useState<TreasureBurstItem[]>([]);

  const ladderHostRef = useRef<HTMLDivElement>(null);
  const bidmasHostRef = useRef<HTMLDivElement>(null);
  const chestRef = useRef<HTMLDivElement>(null);
  const flightId = useRef(1);
  const burstId = useRef(1);

  const target = useMemo(() => lcmOf(problem), [problem]);

  const objectives = useMemo(() => [
    { key: "ladder", label: "Fill the ladder", done: lit },
    { key: "submit", label: "Submit & verify", done: submitted && lit },
    { key: "lcm", label: "Find the LCM", done: phase === "won" },
  ], [lit, submitted, phase]);

  useEffect(() => {
    if (phase !== "won" && seconds > 0) {
      const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
      return () => clearInterval(t);
    }
  }, [phase, seconds]);

  const getCenter = (el: HTMLElement | null) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const getCounterCenter = (kind: BidmasRewardKind) => {
    const el = document.querySelector(`[data-lcm-objective="${kind}"]`) as HTMLElement | null;
    return getCenter(el);
  };

  const handleArrived = useCallback((_id: number, kind: BidmasRewardKind) => {
    setCoins((c) => ({ ...c, [kind]: (c[kind] || 0) + 1 }));
    setFlights((p) => p.filter((x) => x.id !== _id));
  }, []);

  const flyFromEl = (el: HTMLElement | null, kind: BidmasRewardKind, count = 1) => {
    const from = getCenter(el);
    const to = getCounterCenter(kind);
    if (!from || !to) { setCoins((c) => ({ ...c, [kind]: (c[kind] || 0) + count })); return; }
    const ev: BidmasFlightEvent[] = [];
    for (let i = 0; i < count; i++) {
      ev.push({
        id: flightId.current++,
        kind,
        from: { x: from.x + (Math.random() - 0.5) * 40, y: from.y + (Math.random() - 0.5) * 20 },
        to,
      });
    }
    setFlights((p) => [...p, ...ev]);
  };

  // ───── Editing ────────────────────────────────────────────────
  const writeDigit = (d: number) => {
    if (!focus || submitted) return;
    setRows((rs) => rs.map((r, ri) => {
      if (ri !== focus.rowIdx) return r;
      if (focus.col === "div") {
        const next = (r.divisor + String(d)).slice(0, 3);
        return { ...r, divisor: next, status: null };
      }
      const ci = focus.col;
      const cur = r.values[ci] ?? "";
      const nextStr = (cur + String(d)).slice(0, 4);
      const nv = r.values.slice();
      nv[ci] = nextStr;
      return { ...r, values: nv, status: null };
    }));
  };

  const backspace = () => {
    if (!focus || submitted) return;
    setRows((rs) => rs.map((r, ri) => {
      if (ri !== focus.rowIdx) return r;
      if (focus.col === "div") return { ...r, divisor: r.divisor.slice(0, -1), status: null };
      const ci = focus.col;
      const cur = r.values[ci] ?? "";
      const nv = r.values.slice();
      nv[ci] = cur.slice(0, -1);
      return { ...r, values: nv, status: null };
    }));
  };

  const addRow = () => {
    if (submitted) return;
    setRows((rs) => [...rs, { divisor: "", values: rs[0].values.map(() => ""), status: null }]);
  };

  const removeRow = () => {
    if (submitted) return;
    setRows((rs) => (rs.length > 2 ? rs.slice(0, -1) : rs));
  };

  // ───── Submit / validate ──────────────────────────────────────
  const handleSubmit = () => {
    if (submitted) return;
    // Walk pairs of rows: row[i-1] (numbers) → row[i] (divisor on row[i] divides row[i-1]'s values)
    // Actually our model: divisor on a given row is applied to that row's values to produce the NEXT row's values.
    // So validate row r→r+1 using rows[r].divisor.
    const used: number[] = [];
    let allOk = true;
    const next: EditableRow[] = rows.map((r) => ({ ...r, status: null }));

    // The very first row has the original numbers; its divisor (if filled) divides into row 1's values (next row).
    for (let i = 0; i < next.length - 1; i++) {
      const cur = next[i];
      const nxt = next[i + 1];
      const dStr = cur.divisor.trim();
      if (!dStr) {
        // Allow empty trailing divisor only if nothing was filled below either
        const anyNext = nxt.values.some((v) => v.trim() !== "");
        if (anyNext) { cur.status = "bad"; allOk = false; }
        continue;
      }
      const d = parseInt(dStr, 10);
      if (!isPrime(d)) { cur.status = "bad"; allOk = false; continue; }
      // Validate every column
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

    // Final row should be all 1s
    const last = next[next.length - 1];
    const finalOnes = last.values.every((v) => v.trim() === "1");
    if (!finalOnes) { last.status = "bad"; allOk = false; }
    else { last.status = "ok"; }

    setRows(next);

    if (allOk && used.length >= 1) {
      setLit(true);
      setSubmitted(true);
      setHint(`LCM = product of every prime you used = ${used.join(" × ")} = ${used.reduce((a, b) => a * b, 1)}.`);
      setFactors(used);
      // Fly every reward inside the ladder cells to the counters
      setTimeout(() => {
        const cells = document.querySelectorAll<HTMLElement>("[data-lcm-cell][data-lcm-kind]");
        cells.forEach((el, i) => {
          const kind = (el.dataset.lcmKind as BidmasRewardKind) || "coin";
          setTimeout(() => flyFromEl(el, kind, 1), i * 60);
        });
      }, 350);
      setTimeout(() => setPhase("simplify"), 1400);
    } else {
      setHint("Check the highlighted rows — divisor must be prime and divide each number evenly.");
    }
  };

  // (rewards now auto-fly on submit; no per-row click)

  // Drive grouping panel from focused cell + its row's divisor
  const groupingDisplay = useMemo<{ n: number | null; g: number | null }>(() => {
    if (!focus) return { n: null, g: null };
    const r = rows[focus.rowIdx];
    if (!r) return { n: null, g: null };
    const d = parseInt(r.divisor, 10);
    if (focus.col === "div") {
      // pick first numeric value in this row
      const v = r.values.map((x) => parseInt(x, 10)).find((x) => Number.isFinite(x));
      return { n: v ?? null, g: Number.isFinite(d) ? d : null };
    }
    const v = parseInt(r.values[focus.col], 10);
    return { n: Number.isFinite(v) ? v : null, g: Number.isFinite(d) ? d : null };
  }, [focus, rows]);

  const onPickPair = (i: number) => {
    if (i < 0 || i + 1 >= factors.length) return;
    setActivePair(i);
  };

  const onMulSolved = (product: number) => {
    if (activePair === null) return;
    const i = activePair;
    setFactors((fs) => [...fs.slice(0, i), product, ...fs.slice(i + 2)]);
    flyFromEl(bidmasHostRef.current, "coin", 4);
    setActivePair(null);
  };

  // Win condition
  useEffect(() => {
    if (phase === "simplify" && factors.length === 1) {
      if (factors[0] === target) {
        setPhase("won");
        setTimeout(() => {
          const origin = getCenter(chestRef.current);
          if (origin) {
            setChestOrigin(origin);
            const counterCenter = getCounterCenter("coin");
            const items: TreasureBurstItem[] = [];
            for (let i = 0; i < 18; i++) {
              items.push({
                id: burstId.current++,
                kind: i % 4 === 0 ? "diamond" : i % 5 === 0 ? "gem" : "coin",
                to: counterCenter || { x: origin.x, y: origin.y - 200 },
              });
            }
            setChestItems(items);
            setCoins((c) => ({ ...c, coin: c.coin + 12, diamond: c.diamond + 3, crown: c.crown + 1 }));
          }
        }, 200);
      }
    }
  }, [factors, phase, target]);

  const newRound = () => {
    const p = pickLcmProblem(diff);
    setProblem(p);
    setRows(buildInitialRows(p));
    setFocus({ rowIdx: 1, col: "div" });
    setFactors([]);
    setActivePair(null);
    setPhase("ladder");
    setSeconds(LCM_TIMERS[diff]);
    setChestItems([]);
    setChestOrigin(null);
    setLives(MAX_LIVES);
    setLit(false);
    setSubmitted(false);
    
    setHint("Pick a prime that divides at least one number above. Write it on the left, then divide each number on the next row.");
  };

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <SeamlessBackground file="royal-gold.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/80" />

      <header className="relative z-10 flex items-center justify-between gap-3 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <Link to="/games/lcm" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-[10px] uppercase tracking-[0.4em] text-amber-300 font-bold ml-2">LCM Lab · {diff}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1">
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <Heart key={i} className={cn("h-3.5 w-3.5", i < lives ? "fill-rose-400 text-rose-400" : "text-muted-foreground/30")} />
            ))}
          </div>
          <div className={cn(
            "flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-black tabular-nums",
            seconds < 30 ? "border-rose-500/60 bg-rose-500/10 text-rose-300" : "border-primary/30 bg-card/60 text-amber-300",
          )}>
            <Timer className="h-3.5 w-3.5" />
            {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-card/60 px-2 py-1">
            {(["coin", "diamond", "crown"] as BidmasRewardKind[]).map((k) => {
              const got = coins[k] || 0;
              return (
                <div key={k} data-lcm-objective={k} className="flex items-center gap-1">
                  <img src={BIDMAS_REWARD_META[k].src} alt={BIDMAS_REWARD_META[k].label} className="h-4 w-4" />
                  <span className={cn("text-[11px] font-black tabular-nums", BIDMAS_REWARD_META[k].tint)}>{got}</span>
                </div>
              );
            })}
          </div>
          <button
            onClick={newRound}
            className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-card/60 px-2 py-1 text-[11px] font-bold hover:border-amber-400/60"
          >
            <RotateCcw className="h-3.5 w-3.5" /> New
          </button>
        </div>
      </header>

      <section className="relative z-10 px-3 sm:px-4 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-3">
            <p className="text-[9px] uppercase tracking-[0.4em] text-amber-300 font-bold">Question</p>
            <h2 className="text-lg sm:text-xl font-black tracking-wide">
              Find the LCM of{" "}
              <span className="text-amber-300 drop-shadow-[0_0_12px_hsl(45_95%_60%/0.6)]">
                {problem.join(", ")}
              </span>
            </h2>
          </div>

          {/* Objectives */}
          <div className="mx-auto mb-3 flex max-w-3xl flex-wrap items-center justify-center gap-2">
            {objectives.map((o) => (
              <div
                key={o.key}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all",
                  o.done
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-300"
                    : "border-primary/30 bg-card/40 text-muted-foreground",
                )}
              >
                {o.done ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                {o.label}
              </div>
            ))}
          </div>

          {phase === "ladder" && (
            <div className="space-y-3 animate-fade-in">
              <div className="grid gap-3 sm:grid-cols-2">
                <div ref={ladderHostRef} className="space-y-3">
                  <LcmLadder
                    rows={rows}
                    focus={focus}
                    onFocus={setFocus}
                    lit={lit}
                  />
                  <DigitBank onDigit={writeDigit} onBackspace={backspace} disabled={submitted} />
                  <SubmitBar
                    onAddRow={addRow}
                    onRemoveRow={removeRow}
                    onSubmit={handleSubmit}
                    hint={hint}
                    canRemove={rows.length > 2 && !submitted}
                    submitted={submitted}
                  />
                </div>
                <div>
                  <VisualGroupingMini n={groupingDisplay.n} groupSize={groupingDisplay.g} />
                </div>
              </div>
            </div>
          )}

          {(phase === "simplify" || phase === "won") && (
            <div className="grid gap-3 sm:grid-cols-2 animate-fade-in">
              <div ref={bidmasHostRef} className="space-y-3">
                <BidmasMini factors={factors} activePair={activePair} onPickPair={onPickPair} />
                {phase === "won" && (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-emerald-400/60 bg-emerald-500/10 p-4 animate-scale-in">
                    <div ref={chestRef}>
                      <Trophy className="h-12 w-12 text-amber-300 drop-shadow-[0_0_20px_hsl(45_95%_60%/0.9)] animate-bounce" />
                    </div>
                    <div className="text-2xl font-black text-emerald-200">LCM = {target}</div>
                    <button onClick={newRound} className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-black text-background hover:bg-amber-400 shadow-[0_0_18px_hsl(45_95%_60%/0.5)]">
                      Next Round
                    </button>
                  </div>
                )}
              </div>
              <div>
                {activePair !== null ? (
                  <LongMulMini
                    a={factors[activePair]}
                    b={factors[activePair + 1]}
                    onSolved={onMulSolved}
                  />
                ) : (
                  <VisualGroupingMini n={null} groupSize={null} />
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <FlyingRewards events={flights} onArrived={handleArrived} />
      <TreasureBurst origin={chestOrigin} items={chestItems} />
    </main>
  );
};

export default LcmGame;
