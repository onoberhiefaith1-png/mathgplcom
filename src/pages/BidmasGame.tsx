import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, Heart, Settings as SettingsIcon, Timer } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { cn } from "@/lib/utils";
import {
  BidmasDifficulty, generateBidmasProblem, tokenizeRow, evalTokens,
  classifyStep, nextRequiredOps, Token,
} from "@/lib/bidmas";
import { BidmasRewardKind, pickBidmasReward, BIDMAS_REWARD_META, BIDMAS_REWARD_KINDS } from "@/lib/bidmasRewards";
import { EquationBoard, BoardRow, RowCell } from "@/components/bidmas/EquationBoard";
import { BidmasGlowPanel } from "@/components/bidmas/BidmasGlowPanel";
import { SymbolTray } from "@/components/bidmas/SymbolTray";
import { HowToPlayPanel } from "@/components/bidmas/HowToPlayPanel";
import { FlyingRewards, BidmasFlightEvent } from "@/components/bidmas/FlyingRewards";
import { toast } from "@/hooks/use-toast";

const COLS = 14;
const TOTAL_ROWS = 8;
const MAX_LIVES = 5;

type Letter = "B" | "I" | "D" | "M" | "A" | "S";

const opToLetter = (ch: string): Letter | null => {
  if (ch === "+") return "A";
  if (ch === "-") return "S";
  if (ch === "×") return "M";
  if (ch === "÷") return "D";
  if (ch === "^" || ch === "²") return "I";
  if (ch === "(" || ch === ")") return "B";
  return null;
};

const makeEmptyRow = (id: number, locked = false): BoardRow => ({
  id, locked,
  cells: Array.from({ length: COLS }, () => ({ symbol: null, reward: pickBidmasReward(), collected: false } as RowCell)),
});

const makeProblemRow = (id: number, syms: string[]): BoardRow => {
  const row = makeEmptyRow(id, true);
  syms.forEach((s, i) => { if (i < COLS) row.cells[i].symbol = s; });
  return row;
};

const BidmasGame = () => {
  const { difficulty = "easy" } = useParams<{ difficulty: BidmasDifficulty }>();
  const diff = (["easy", "medium", "hard", "expert"].includes(difficulty) ? difficulty : "easy") as BidmasDifficulty;

  const [lives, setLives] = useState(MAX_LIVES);
  const [seconds, setSeconds] = useState(60);
  const [timerMin, setTimerMin] = useState(1);
  const [bidmasGlow, setBidmasGlow] = useState(true);
  const [opGlow, setOpGlow] = useState(true);
  const [problem, setProblem] = useState(() => generateBidmasProblem(diff));
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [cursor, setCursor] = useState<{ row: number; col: number } | null>(null);
  const [history, setHistory] = useState<{ row: number; col: number; prev: string | null }[]>([]);
  const [totals, setTotals] = useState<Record<BidmasRewardKind, number>>(
    () => Object.fromEntries(BIDMAS_REWARD_KINDS.map((k) => [k, 0])) as Record<BidmasRewardKind, number>);
  const [flights, setFlights] = useState<BidmasFlightEvent[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const counterRef = useRef<HTMLDivElement>(null);
  const failingRef = useRef(false);

  const goals = useMemo<Partial<Record<BidmasRewardKind, number>>>(() => ({
    coin: 50, diamond: 8, heart: 5, crown: 3,
  }), []);

  const newRound = useCallback(() => {
    failingRef.current = false;
    const p = generateBidmasProblem(diff);
    setProblem(p);
    const newRows: BoardRow[] = [makeProblemRow(0, p.cells)];
    for (let i = 1; i < TOTAL_ROWS; i++) newRows.push(makeEmptyRow(i, false));
    setRows(newRows);
    setCursor({ row: 1, col: 0 });
    setHistory([]);
    setSeconds(timerMin * 60);
  }, [diff, timerMin]);

  useEffect(() => { newRound(); }, [diff]);

  useEffect(() => {
    if (gameOver) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [gameOver]);

  useEffect(() => {
    if (seconds === 0 && !failingRef.current && !gameOver) {
      failingRef.current = true;
      decrementLife("Time's up!");
      setTimeout(() => { newRound(); }, 1100);
    }
  }, [seconds, gameOver, newRound]);

  const decrementLife = (msg: string) => {
    setLives((l) => {
      const nl = Math.max(0, l - 1);
      if (nl === 0) setGameOver(true);
      return nl;
    });
    toast({ title: msg });
  };

  const activeRowTokens = useMemo<Token[] | null>(() => {
    if (!cursor) return null;
    let src = cursor.row - 1;
    while (src >= 0 && rows[src] && !rows[src].cells.some((c) => c.symbol)) src--;
    if (src < 0) return null;
    const cells = rows[src]?.cells.map((c) => c.symbol) ?? [];
    const tk = tokenizeRow(cells);
    if ("error" in tk) return null;
    return tk.tokens;
  }, [cursor, rows]);

  const activeBidmasLetters = useMemo(() => {
    if (!activeRowTokens) return new Set<Letter>();
    return nextRequiredOps(activeRowTokens).letters;
  }, [activeRowTokens]);

  const decoratedRows = useMemo<BoardRow[]>(() => {
    if (!cursor || !activeRowTokens) return rows;
    let src = cursor.row - 1;
    while (src >= 0 && rows[src] && !rows[src].cells.some((c) => c.symbol)) src--;
    if (src < 0) return rows;
    const ops = nextRequiredOps(activeRowTokens).opIndices;
    const colSet = new Set<number>();
    for (const tIdx of ops) {
      const tok = activeRowTokens[tIdx];
      tok.cols.forEach((c) => colSet.add(c));
    }
    return rows.map((r, i) => i === src ? { ...r, glowOpIdx: colSet } : r);
  }, [rows, cursor, activeRowTokens]);

  /* ---------- Input ---------- */
  const placeSym = (sym: string) => {
    if (!cursor || gameOver) return;
    const { row, col } = cursor;
    if (row >= rows.length || col >= COLS) return;
    if (rows[row].locked) return;
    const prev = rows[row].cells[col].symbol;
    setRows((rs) => rs.map((r, i) => i !== row ? r : {
      ...r, cells: r.cells.map((c, j) => j !== col ? c : { ...c, symbol: sym }),
    }));
    setHistory((h) => [...h, { row, col, prev }]);
    if (col + 1 < COLS) setCursor({ row, col: col + 1 });
  };
  const onErase = () => {
    if (!cursor || gameOver) return;
    const { row, col } = cursor;
    if (rows[row]?.locked) return;
    const prev = rows[row]?.cells[col]?.symbol ?? null;
    setRows((rs) => rs.map((r, i) => i !== row ? r : {
      ...r, cells: r.cells.map((c, j) => j !== col ? c : { ...c, symbol: null }),
    }));
    setHistory((h) => [...h, { row, col, prev }]);
  };
  const onUndo = () => {
    if (!history.length) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRows((rs) => rs.map((r, i) => i !== last.row ? r : {
      ...r, cells: r.cells.map((c, j) => j !== last.col ? c : { ...c, symbol: last.prev }),
    }));
    setCursor({ row: last.row, col: last.col });
  };
  const onCellClick = (row: number, col: number) => {
    if (rows[row]?.locked || gameOver) return;
    setCursor({ row, col });
  };

  /* ---------- ENTER ---------- */
  const onEnter = () => {
    if (!cursor || gameOver) return;
    const row = cursor.row;
    const cellsRow = rows[row];
    if (!cellsRow || cellsRow.locked) return;
    const cellSyms = cellsRow.cells.map((c) => c.symbol);
    const tk = tokenizeRow(cellSyms);
    if ("error" in tk || !tk.tokens.length) {
      shakeRow(row); decrementLife("Incomplete row"); return;
    }
    const ev = evalTokens(tk.tokens);
    if ("error" in ev) { shakeRow(row); decrementLife("Invalid expression"); return; }
    if (Math.abs(ev.value - problem.value) > 1e-9) {
      shakeRow(row); decrementLife("Not equivalent to the question"); return;
    }
    let src = row - 1;
    while (src >= 0 && rows[src] && !rows[src].cells.some((c) => c.symbol)) src--;
    const prevTk = src >= 0 ? tokenizeRow(rows[src].cells.map((c) => c.symbol)) : { tokens: [] as Token[], usedCols: [] };
    if ("error" in prevTk) return;
    const kind = classifyStep(prevTk.tokens, tk.tokens);

    // ----- Transformation animation -----
    const { removedPrevCols, addedNextCols } = diffTokenCols(prevTk.tokens, tk.tokens);
    if (src >= 0 && (removedPrevCols.size || addedNextCols.size)) {
      setRows((rs) => rs.map((r, i) => {
        if (i === src) return { ...r, transformingCols: removedPrevCols };
        if (i === row) return { ...r, poppingCols: addedNextCols };
        return r;
      }));
      // clear transforming flags after the animation
      setTimeout(() => {
        setRows((rs) => rs.map((r, i) =>
          (i === src || i === row) ? { ...r, transformingCols: undefined, poppingCols: undefined } : r,
        ));
      }, 600);
    }

    const mult = kind === "bidmas" ? 1.0 : kind === "rearrange" ? 0.6 : kind === "final" ? 0.4 : 0;
    if (mult > 0) collectRewards(row, tk.usedCols, mult);

    setRows((rs) => rs.map((r, i) => i !== row ? r : { ...r, locked: true }));
    if (kind === "final") {
      toast({ title: "Solved! New question coming." });
      setTimeout(() => newRound(), 1000);
    } else {
      const next = row + 1;
      if (next < TOTAL_ROWS) setTimeout(() => setCursor({ row: next, col: 0 }), 350);
      else { toast({ title: "Out of rows — new question." }); setTimeout(() => newRound(), 800); }
    }
  };

  const shakeRow = (row: number) => {
    setRows((rs) => rs.map((r, i) => i !== row ? r : { ...r, shake: true }));
    setTimeout(() => setRows((rs) => rs.map((r, i) => i !== row ? r : { ...r, shake: false })), 450);
  };

  const collectRewards = (row: number, usedCols: number[], mult: number) => {
    const dest = counterRef.current?.getBoundingClientRect();
    const tx = dest ? dest.left + dest.width / 2 : window.innerWidth - 80;
    const ty = dest ? dest.top + dest.height / 2 : 80;
    const newFlights: BidmasFlightEvent[] = [];
    const collected: BidmasRewardKind[] = [];
    usedCols.forEach((col) => {
      const cell = rows[row]?.cells[col];
      if (!cell || cell.collected || !cell.symbol) return;
      if (Math.random() > mult) return;
      const r = cell.reward;
      const el = document.querySelector(`[data-bidmas-cell="${row}-${col}"]`) as HTMLElement | null;
      const rect = el?.getBoundingClientRect();
      const fx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const fy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      const id = Date.now() + col + Math.floor(Math.random() * 1000);
      newFlights.push({ id, kind: r, from: { x: fx, y: fy }, to: { x: tx, y: ty } });
      collected.push(r);
    });
    if (newFlights.length) setFlights((p) => [...p, ...newFlights]);
    setRows((rs) => rs.map((r, i) => i !== row ? r : {
      ...r, cells: r.cells.map((c, j) => usedCols.includes(j) ? { ...c, collected: true } : c),
    }));
    if (collected.length) {
      setTotals((t) => {
        const nt = { ...t };
        for (const k of collected) nt[k] = (nt[k] || 0) + 1;
        return nt;
      });
    }
  };

  const minStr = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secStr = String(seconds % 60).padStart(2, "0");

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
      <SeamlessBackground file="royal-gold.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/80" />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/games/bidmas" className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-card/60 px-3 py-2 text-sm font-bold hover:border-amber-400/60">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5">
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <Heart key={i} className={cn("h-5 w-5", i < lives ? "fill-rose-400 text-rose-400" : "text-muted-foreground/40")} />
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-card/60 px-3 py-1.5 text-base font-black">
            <Timer className="h-5 w-5 text-amber-300" /> <span className="tabular-nums">{minStr}:{secStr}</span>
          </div>
          <div ref={counterRef} className="flex items-center gap-2 rounded-lg border border-primary/30 bg-card/60 px-3 py-1.5">
            {(["coin", "diamond", "heart", "crown"] as const).map((k, i) => {
              const goal = goals[k];
              const got = totals[k] || 0;
              const done = goal !== undefined && got >= goal;
              return (
                <div key={k} className={cn("flex items-center gap-1", i > 0 && "pl-2 border-l border-primary/20")}>
                  <img src={BIDMAS_REWARD_META[k].src} alt={BIDMAS_REWARD_META[k].label} className="h-5 w-5" />
                  <span className={cn("text-sm font-black tabular-nums", done ? "text-emerald-300" : BIDMAS_REWARD_META[k].tint)}>
                    {got}{goal !== undefined && <span className="text-muted-foreground/70">/{goal}</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <button onClick={() => setTimerMin((m) => (m % 4) + 1)}
            title="Cycle timer length"
            className="rounded-lg border border-primary/30 bg-card/60 p-2 hover:border-amber-400/60">
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <section className="relative z-10 px-4 sm:px-6">
        <div className="space-y-4 max-w-5xl mx-auto">
          <HowToPlayPanel />

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px] rounded-2xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-500/15 to-amber-600/5 px-4 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300 font-bold">Question</div>
              <div className="text-2xl sm:text-3xl font-black text-foreground tabular-nums tracking-wide">
                <LiveQuestion display={problem.display} active={activeBidmasLetters} enabled={bidmasGlow} />
              </div>
            </div>
            <BidmasGlowPanel active={activeBidmasLetters} enabled={bidmasGlow} onToggle={() => setBidmasGlow((v) => !v)} />
            <button onClick={() => setOpGlow((v) => !v)} className={cn(
              "rounded-2xl border-2 px-3 py-2 text-[10px] uppercase tracking-[0.25em] font-bold transition-colors",
              opGlow ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-primary/30 bg-card/60 text-muted-foreground",
            )}>
              Operator Glow: {opGlow ? "ON" : "OFF"}
            </button>
          </div>

          <EquationBoard rows={decoratedRows} cols={COLS} cursor={cursor} onCellClick={onCellClick} showOperatorGlow={opGlow} />

          <SymbolTray onSym={placeSym} onEnter={onEnter} onUndo={onUndo} onErase={onErase} canUndo={history.length > 0} />

          <p className="text-[11px] text-muted-foreground text-center">
            Tip · Tap a tile to place the cursor, then tap a symbol. Press <span className="text-emerald-300 font-bold">ENTER</span> to submit each row.
          </p>
        </div>
      </section>


      <FlyingRewards events={flights} />

      {gameOver && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 backdrop-blur">
          <div className="rounded-2xl border-2 border-amber-400/70 bg-card p-8 text-center shadow-[0_0_50px_hsl(45_95%_60%/0.4)]">
            <div className="text-3xl font-black text-amber-300 mb-2">Game Over</div>
            <div className="text-sm text-muted-foreground mb-4">Coins collected: {totals.coin || 0}</div>
            <button
              onClick={() => { setLives(MAX_LIVES); setGameOver(false); newRound(); }}
              className="rounded-lg bg-amber-500 px-5 py-2 font-black text-background hover:bg-amber-400">
              Play Again
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

/** Diff two token streams and return source-cols removed and dest-cols added (best-effort). */
function diffTokenCols(prev: Token[], next: Token[]): { removedPrevCols: Set<number>; addedNextCols: Set<number> } {
  const sameTok = (a: Token, b: Token) => a.text === b.text && a.kind === b.kind;
  let p = 0;
  const maxPre = Math.min(prev.length, next.length);
  while (p < maxPre && sameTok(prev[p], next[p])) p++;
  let s = 0;
  while (s < maxPre - p && sameTok(prev[prev.length - 1 - s], next[next.length - 1 - s])) s++;
  const removedPrevCols = new Set<number>();
  const addedNextCols = new Set<number>();
  for (let i = p; i < prev.length - s; i++) prev[i].cols.forEach((c) => removedPrevCols.add(c));
  for (let i = p; i < next.length - s; i++) next[i].cols.forEach((c) => addedNextCols.add(c));
  return { removedPrevCols, addedNextCols };
}

/** Render the question with calm pulse on operators whose BIDMAS letter is active. */
const LiveQuestion = ({ display, active, enabled }: { display: string; active: Set<Letter>; enabled: boolean }) => {
  const chars = Array.from(display);
  return (
    <span>
      {chars.map((ch, i) => {
        if (ch === " ") return <span key={i}>&nbsp;</span>;
        const letter = opToLetter(ch);
        const isActive = enabled && letter && active.has(letter);
        return (
          <span
            key={i}
            className={cn(
              "transition-all duration-500",
              isActive && "text-amber-300 animate-soft-pulse drop-shadow-[0_0_6px_hsl(45_95%_60%/0.55)]",
              !isActive && letter && (ch === "(" || ch === ")") && "text-sky-300/90",
              !isActive && letter && /[+\-×÷^²]/.test(ch) && "text-rose-300/90",
            )}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

export default BidmasGame;
