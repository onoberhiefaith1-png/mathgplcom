import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Trophy } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TimerBar } from "@/components/abacus/TimerBar";
import { sfxClick, sfxError, sfxSuccess } from "@/components/abacus/abacusSfx";
import { cn } from "@/lib/utils";

import { MulDifficulty, MulProblem, MulStep, generateProblem, buildSteps } from "@/lib/multiplication";
import { MulRewardKind, MUL_REWARD_META, pickMulReward } from "@/lib/multiplicationRewards";
import { MultiplicationBoard, MulBoardState, PartialCell, SumCell, Phase } from "@/components/multiplication/MultiplicationBoard";
import { DigitBank } from "@/components/multiplication/DigitBank";
import { MulObjective, ObjectivesPanel } from "@/components/multiplication/ObjectivesPanel";
import { MulSettings, MulSettingsPanel, DEFAULT_MUL_SETTINGS } from "@/components/multiplication/SettingsPanel";
import { FlyingRewards, MulFlyingEvent } from "@/components/multiplication/FlyingRewards";
import { ToolBar } from "@/components/multiplication/ToolBar";

const STORAGE_KEY = "mul-settings-v1";

const buildObjectives = (level: number): MulObjective[] => {
  const m = 1 + Math.floor((level - 1) * 0.5);
  return [
    { kind: "coin",    collected: 0, target: 30 * m },
    { kind: "diamond", collected: 0, target: 5 * m },
    { kind: "crown",   collected: 0, target: 6 * m },
    { kind: "star",    collected: 0, target: 10 * m },
  ];
};

const buildBoard = (p: MulProblem): MulBoardState => {
  const partials: PartialCell[][] = [];
  for (let r = 0; r < p.rows; r++) {
    const row: PartialCell[] = [];
    for (let c = 0; c < p.cols; c++) {
      row.push({ value: null, reward: pickMulReward(), burst: false, wrong: false });
    }
    partials.push(row);
  }
  const sum: SumCell[] = [];
  for (let c = 0; c < p.cols; c++) {
    sum.push({ value: null, reward: pickMulReward(), burst: false, wrong: false });
  }
  const steps = buildSteps(p);
  return {
    problem: p,
    partials,
    sum,
    productCarry: {},
    sumCarry: {},
    stepIdx: 0,
    totalSteps: steps.length,
    phase: "multiply",
  };
};

const MultiplicationGame = () => {
  const { difficulty: routeDiff } = useParams<{ difficulty?: string }>();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<MulSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const base: MulSettings = raw ? { ...DEFAULT_MUL_SETTINGS, ...JSON.parse(raw) } : DEFAULT_MUL_SETTINGS;
      if (routeDiff && ["easy", "medium", "hard", "expert"].includes(routeDiff)) {
        return { ...base, difficulty: routeDiff as MulDifficulty };
      }
      return base;
    } catch { return DEFAULT_MUL_SETTINGS; }
  });
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }, [settings]);

  const [lives, setLives] = useState(settings.startingLives);
  const [coins, setCoins] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [level, setLevel] = useState(1);
  const [objectives, setObjectives] = useState<MulObjective[]>(buildObjectives(1));

  const [board, setBoard] = useState<MulBoardState | null>(null);
  const [steps, setSteps] = useState<MulStep[]>([]);
  const [timerKey, setTimerKey] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [lifeLost, setLifeLost] = useState(false);
  const [shake, setShake] = useState(false);
  const [solved, setSolved] = useState(false);
  const failingRef = useRef(false);
  const advancingRef = useRef(false);
  const flightIdRef = useRef(1);
  const [flyingEvents, setFlyingEvents] = useState<MulFlyingEvent[]>([]);

  const currentStep: MulStep | null = board && board.stepIdx < steps.length ? steps[board.stepIdx] : null;

  /* ---------- coords ---------- */
  const getCellCenter = (selector: string) => {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const getObjectiveCenter = (kind: MulRewardKind) => {
    const el = document.querySelector(`[data-mul-objective="${kind}"] img`) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const handleArrived = (_id: number, kind: MulRewardKind) => {
    setObjectives((prev) => prev.map((o) => o.kind === kind ? { ...o, collected: o.collected + 1 } : o));
    if (kind === "coin") setCoins((c) => c + 1);
  };
  const flyReward = (selector: string, reward: MulRewardKind) => {
    // defer to next frame so DOM has the new burst class
    requestAnimationFrame(() => {
      const from = getCellCenter(selector);
      const to = getObjectiveCenter(reward);
      if (from && to) {
        const id = flightIdRef.current++;
        setFlyingEvents((prev) => [...prev, { id, kind: reward, from, to }]);
      } else {
        handleArrived(-1, reward);
      }
    });
  };

  /* ---------- round lifecycle ---------- */
  const newRound = () => {
    const p = generateProblem(settings.difficulty);
    const b = buildBoard(p);
    setBoard(b);
    setSteps(buildSteps(p));
    setSolved(false);
    setTimerKey((k) => k + 1);
    advancingRef.current = false;
    setFlyingEvents([]);
  };

  useEffect(() => { newRound(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (board) newRound(); /* eslint-disable-next-line */ }, [settings.difficulty]);
  useEffect(() => { setLives((l) => Math.min(l, settings.startingLives)); }, [settings.startingLives]);
  useEffect(() => {
    if (objectives.length && objectives.every((o) => o.collected >= o.target) && !levelComplete) {
      setLevelComplete(true);
    }
  }, [objectives, levelComplete]);

  /* ---------- placement ---------- */

  const advanceStep = (b: MulBoardState, justPlacedStep: MulStep): MulBoardState => {
    let nextIdx = b.stepIdx + 1;
    let phase: Phase = b.phase;
    let productCarry: Record<number, number> = {};
    let sumCarry = { ...b.sumCarry };

    // Recompute productCarry/sumCarry based on the upcoming step.

    // Recompute productCarry and sumCarry from upcoming step
    const next = nextIdx < steps.length ? steps[nextIdx] : null;
    if (next) {
      if (next.kind === "product" && next.carryIn > 0 && next.aIdx !== null) {
        productCarry = { [next.aIdx]: next.carryIn };
      } else if (next.kind === "finalCarry") {
        productCarry = {};
      } else if (next.kind === "product") {
        productCarry = {};
      } else if (next.kind === "sum") {
        productCarry = {};
        if (next.carryIn > 0) {
          sumCarry = { ...sumCarry, [next.targetCol]: next.carryIn };
        }
      }
      // Phase transition: first sum step
      if (next.kind === "sum" && b.phase === "multiply") {
        phase = "sum";
      }
    } else {
      productCarry = {};
      phase = "done";
    }

    return { ...b, stepIdx: nextIdx, phase, productCarry, sumCarry };
  };

  const placeDigit = (row: number, col: number, digit: number) => {
    if (!board || solved || gameOver || lifeLost || levelComplete) return;
    const step = currentStep;
    if (!step) return;

    const targetRow = step.targetRow;
    const targetCol = step.targetCol;
    if (row !== targetRow || col !== targetCol) {
      // wrong cell — soft shake on the cell they tapped
      flashWrong(row, col);
      return;
    }

    if (digit !== step.expectedDigit) {
      // wrong digit
      flashWrong(row, col);
      if (settings.sound) sfxError();
      setStreak(0);
      loseLife();
      return;
    }

    // Correct
    if (settings.sound) sfxClick();
    setBoard((prev) => {
      if (!prev) return prev;
      let next = prev;
      if (row === -1) {
        const sum = prev.sum.map((c, i) => i === col ? { ...c, value: digit, burst: true, wrong: false } : c);
        next = { ...prev, sum };
      } else {
        const partials = prev.partials.map((r, ri) =>
          ri === row ? r.map((c, i) => i === col ? { ...c, value: digit, burst: true, wrong: false } : c) : r,
        );
        next = { ...prev, partials };
      }
      next = advanceStep(next, step);
      return next;
    });

    // Fly reward
    const reward = row === -1 ? board.sum[col].reward : board.partials[row][col].reward;
    const sel = row === -1 ? `[data-mul-cell="s-${col}"]` : `[data-mul-cell="p-${row}-${col}"]`;
    flyReward(sel, reward);

    // Clear burst after animation
    setTimeout(() => {
      setBoard((prev) => {
        if (!prev) return prev;
        if (row === -1) {
          const sum = prev.sum.map((c, i) => i === col ? { ...c, burst: false } : c);
          return { ...prev, sum };
        }
        const partials = prev.partials.map((r, ri) =>
          ri === row ? r.map((c, i) => i === col ? { ...c, burst: false } : c) : r,
        );
        return { ...prev, partials };
      });
    }, 600);

    // Round complete?
    setTimeout(() => {
      setBoard((prev) => {
        if (!prev) return prev;
        if (prev.stepIdx >= steps.length && !advancingRef.current) {
          completeRound(prev);
        }
        return prev;
      });
    }, 250);
  };

  const flashWrong = (row: number, col: number) => {
    setBoard((prev) => {
      if (!prev) return prev;
      if (row === -1) {
        const sum = prev.sum.map((c, i) => i === col ? { ...c, wrong: true } : c);
        return { ...prev, sum };
      }
      const partials = prev.partials.map((r, ri) =>
        ri === row ? r.map((c, i) => i === col ? { ...c, wrong: true } : c) : r,
      );
      return { ...prev, partials };
    });
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setTimeout(() => {
      setBoard((prev) => {
        if (!prev) return prev;
        if (row === -1) {
          const sum = prev.sum.map((c, i) => i === col ? { ...c, wrong: false } : c);
          return { ...prev, sum };
        }
        const partials = prev.partials.map((r, ri) =>
          ri === row ? r.map((c, i) => i === col ? { ...c, wrong: false } : c) : r,
        );
        return { ...prev, partials };
      });
    }, 500);
  };

  const completeRound = (_b: MulBoardState) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setSolved(true);
    if (settings.sound) sfxSuccess();
    setScore((s) => s + 50 + Math.min(120, streak * 6));
    setStreak((s) => { const ns = s + 1; setBestStreak((bb) => Math.max(bb, ns)); return ns; });
    setRoundsCompleted((n) => n + 1);
    setTimeout(() => newRound(), 900);
  };

  /* ---------- input routing ---------- */
  const handleCellClick = (_row: number, _col: number) => {
    // Cell selection isn't required — just play a click; the active cell glows automatically.
    if (settings.sound) sfxClick();
  };
  const handleCellDrop = (row: number, col: number, digit: number) => {
    placeDigit(row, col, digit);
  };
  const handleBankPick = (digit: number) => {
    const step = currentStep;
    if (!step) return;
    placeDigit(step.targetRow, step.targetCol, digit);
  };

  /* ---------- erase / undo ---------- */
  const handleErase = () => {
    // Placeholder: erase last placed correct digit (rewind one step)
    handleUndo();
  };
  const handleUndo = () => {
    if (!board || board.stepIdx === 0) return;
    const prevIdx = board.stepIdx - 1;
    const prevStep = steps[prevIdx];
    setBoard((prev) => {
      if (!prev) return prev;
      let next = { ...prev, stepIdx: prevIdx };
      if (prevStep.targetRow === -1) {
        const sum = prev.sum.map((c, i) => i === prevStep.targetCol ? { ...c, value: null } : c);
        next = { ...next, sum };
      } else {
        const partials = prev.partials.map((r, ri) =>
          ri === prevStep.targetRow ? r.map((c, i) => i === prevStep.targetCol ? { ...c, value: null } : c) : r,
        );
        next = { ...next, partials };
      }
      // Recompute carries based on the step now active (prevStep)
      const step = prevStep;
      let productCarry: Record<number, number> = {};
      let sumCarry: Record<number, number> = { ...prev.sumCarry };
      let phase: Phase = prev.phase;
      if (step.kind === "product" && step.carryIn > 0 && step.aIdx !== null) {
        productCarry = { [step.aIdx]: step.carryIn };
      }
      if (step.kind === "sum") {
        phase = "sum";
        // Remove sum carry that came from the now-undone step
        delete sumCarry[step.targetCol];
        if (step.carryIn > 0) sumCarry[step.targetCol] = step.carryIn;
      } else {
        phase = "multiply";
        sumCarry = {};
      }
      return { ...next, productCarry, sumCarry, phase };
    });
  };

  /* ---------- timer ---------- */
  const loseLife = () => {
    if (failingRef.current) return;
    failingRef.current = true;
    setLifeLost(true);
    setLives((l) => {
      const nl = Math.max(0, l - 1);
      if (nl === 0) {
        setGameOver(true);
        setLifeLost(false);
        failingRef.current = false;
      } else {
        setTimeout(() => {
          setLifeLost(false);
          newRound();
          failingRef.current = false;
        }, 1100);
      }
      return nl;
    });
  };

  const handleTimeout = () => {
    if (gameOver || levelComplete || failingRef.current) return;
    if (settings.sound) sfxError();
    setStreak(0);
    loseLife();
  };

  /* ---------- restart / advance ---------- */
  const restart = () => {
    setLives(settings.startingLives);
    setScore(0); setStreak(0); setBestStreak(0); setRoundsCompleted(0);
    setLevel(1); setObjectives(buildObjectives(1));
    setCoins(0);
    setGameOver(false); setLevelComplete(false);
    newRound();
  };
  const advanceLevel = () => {
    setLevel((l) => l + 1);
    setObjectives(buildObjectives(level + 1));
    setScore((s) => s + 100);
    setLevelComplete(false);
    newRound();
  };

  const updateSettings = (patch: Partial<MulSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const stepHint = useMemo(() => {
    if (!currentStep || !board) return undefined;
    if (currentStep.kind === "product" && currentStep.aIdx !== null) {
      const a = board.problem.aDigits[currentStep.aIdx];
      const b = board.problem.bDigits[currentStep.bIdx];
      const carry = currentStep.carryIn;
      return carry > 0 ? `${a} × ${b} + ${carry}` : `${a} × ${b}`;
    }
    if (currentStep.kind === "finalCarry") return `Bring down carry`;
    if (currentStep.kind === "sum") {
      const parts = (currentStep.sumSources ?? []).map((s) => s.digit);
      const all = currentStep.carryIn > 0 ? [currentStep.carryIn, ...parts] : parts;
      return `Add: ${all.join(" + ")}`;
    }
    return undefined;
  }, [currentStep, board]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
      <SeamlessBackground file="royal-gold.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/75" />

      <header className="relative z-10 flex flex-wrap items-center gap-2 p-3 sm:p-4 border-b border-border/50 bg-card/40 backdrop-blur">
        <Link to="/subjects/algebra/numbers-and-numerals" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-sm sm:text-base font-black uppercase tracking-wider">
          Long <span className="text-amber-400">Multiplication</span> Builder
        </h1>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/40 px-2 py-1">
            <img src="/assets/rewards/coin/gold_coin.png" alt="" className="h-4 w-4 object-contain" />
            <span className="text-xs font-black tabular-nums text-amber-300">{coins}</span>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: settings.startingLives }).map((_, i) => (
              <Heart key={i} className={i < lives ? "h-4 w-4 fill-rose-500 text-rose-500" : "h-4 w-4 text-muted-foreground/30"} />
            ))}
          </div>
          <MulSettingsPanel settings={settings} onChange={updateSettings} />
        </div>
      </header>

      <div className={cn("relative z-10 mx-auto max-w-4xl p-2 sm:p-3 grid gap-2 lg:grid-cols-[1fr_220px] transition-transform", shake && "animate-[shake_0.4s_ease-in-out]")}>
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-card/80 p-2.5 backdrop-blur shadow-lg">
            <TimerBar durationSec={settings.roundSec} resetKey={timerKey} paused={gameOver || levelComplete || lifeLost || solved} onExpire={handleTimeout} />
          </div>

          {board && (
            <MultiplicationBoard
              state={board}
              step={currentStep}
              onCellClick={handleCellClick}
              onCellDrop={handleCellDrop}
            />
          )}

          <ToolBar onErase={handleErase} onUndo={handleUndo} canUndo={!!board && board.stepIdx > 0} hint={stepHint} />

          <div className="sticky bottom-2 rounded-xl border-2 border-primary/30 bg-gradient-to-b from-card/95 to-card/80 p-2 backdrop-blur shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
            <div className="mb-1.5 text-center text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Tap the digit that fills the glowing box
            </div>
            <DigitBank onPick={handleBankPick} />
          </div>
        </div>

        <aside className="space-y-2">
          <ObjectivesPanel objectives={objectives} />
          <div className="rounded-xl border-2 border-primary/30 bg-card/70 p-2.5 backdrop-blur grid grid-cols-3 lg:grid-cols-2 gap-2 text-xs">
            <Stat label="Lvl" value={level} />
            <Stat label="Score" value={score} />
            <Stat label="Streak" value={streak} />
            <Stat label="Best" value={bestStreak} />
            <Stat label="Rounds" value={roundsCompleted} />
            {board && <Stat label="Step" value={`${Math.min(board.stepIdx + 1, board.totalSteps)}/${board.totalSteps}`} />}
          </div>
        </aside>
      </div>

      <FlyingRewards events={flyingEvents} onArrived={handleArrived} />

      <Dialog open={gameOver} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Game Over</DialogTitle>
            <DialogDescription>You've used all your lives.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Score" value={score} />
            <Stat label="Rounds" value={roundsCompleted} />
            <Stat label="Best Streak" value={bestStreak} />
            <Stat label="Coins" value={coins} />
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Rewards Collected</div>
              <div className="flex flex-wrap gap-2">
                {objectives.map((o) => {
                  const m = MUL_REWARD_META[o.kind];
                  return (
                    <div key={o.kind} className="flex items-center gap-1 text-xs">
                      <img src={m.src} alt="" className="h-4 w-4 object-contain" />
                      <span className="tabular-nums">{o.collected}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => navigate("/subjects/algebra/numbers-and-numerals")}>Menu</Button>
            {coins >= 50 && (
              <Button variant="secondary" onClick={() => { setCoins((c) => c - 50); setLives(3); setGameOver(false); newRound(); }}>
                Continue (50 coins)
              </Button>
            )}
            <Button onClick={restart}>Retry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={levelComplete} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-400" /> Level {level} Complete!</DialogTitle>
            <DialogDescription>+100 bonus score. Tougher problems ahead.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={advanceLevel}>Next Level</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lifeLost && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-rose-950/40 backdrop-blur-sm" />
          <div className="relative flex flex-col items-center gap-2 rounded-2xl border-2 border-rose-500/60 bg-card/90 px-8 py-6 shadow-[0_0_40px_hsl(0_80%_55%/0.6)]">
            <Heart className="h-12 w-12 fill-rose-500 text-rose-500 animate-pulse" />
            <span className="text-lg font-black uppercase tracking-widest text-rose-400">Try Again</span>
            <span className="text-xs text-muted-foreground">New question coming…</span>
          </div>
        </div>
      )}
    </main>
  );
};

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex flex-col">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className="text-base font-bold tabular-nums">{value}</span>
  </div>
);

export default MultiplicationGame;
