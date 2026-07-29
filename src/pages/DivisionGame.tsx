import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
import { ArrowLeft, Heart, Trophy } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TimerBar } from "@/components/abacus/TimerBar";
import { sfxClick, sfxError, sfxSuccess } from "@/components/abacus/abacusSfx";
import { cn } from "@/lib/utils";

import { DivDifficulty, DivProblem, DivStep, DivStage, generateProblem, buildStages, buildSteps } from "@/lib/division";
import { DivRewardKind, DIV_REWARD_META, pickDivReward } from "@/lib/divisionRewards";
import { DivisionBoard, DivBoardState, DivAnswerCell, DivCellKind } from "@/components/division/DivisionBoard";
import { DigitBank } from "@/components/division/DigitBank";
import { DivObjective, ObjectivesPanel } from "@/components/division/ObjectivesPanel";
import { DivSettings, DivSettingsPanel, DEFAULT_DIV_SETTINGS } from "@/components/division/SettingsPanel";
import { FlyingRewards, DivFlyingEvent } from "@/components/division/FlyingRewards";
import { ToolBar } from "@/components/division/ToolBar";
import { GroupingPanel } from "@/components/division/GroupingPanel";

const STORAGE_KEY = "div-settings-v1";

const buildObjectives = (level: number): DivObjective[] => {
  const m = 1 + Math.floor((level - 1) * 0.5);
  return [
    { kind: "coin",    collected: 0, target: 30 * m },
    { kind: "diamond", collected: 0, target: 5 * m },
    { kind: "crown",   collected: 0, target: 6 * m },
    { kind: "star",    collected: 0, target: 10 * m },
  ];
};

const newCell = (): DivAnswerCell => ({ value: null, reward: pickDivReward(), burst: false, wrong: false });

const buildBoard = (p: DivProblem): { board: DivBoardState; stages: DivStage[]; steps: DivStep[] } => {
  const stages = buildStages(p);
  const steps = buildSteps(p, stages);
  const quotient: DivAnswerCell[] = Array.from({ length: p.nCols }, () => newCell());
  const products: Record<number, Record<number, DivAnswerCell>> = {};
  const remainders: Record<number, Record<number, DivAnswerCell>> = {};
  for (const st of stages) {
    products[st.stage] = {};
    for (const cell of st.productSigCells) products[st.stage][cell.col] = newCell();
    for (const cell of st.productPadCells) products[st.stage][cell.col] = newCell();
    remainders[st.stage] = {};
    for (const cell of st.remainderCells) remainders[st.stage][cell.col] = newCell();
    for (const cell of st.remainderAutoCells) remainders[st.stage][cell.col] = newCell();
  }
  return {
    board: {
      problem: p, stages, quotient, products, remainders,
      stepIdx: 0, totalSteps: steps.length,
      productPadRevealed: -1, remaindersRevealed: -1,
    },
    stages, steps,
  };
};

const helperVisibleByDefault = (d: DivDifficulty) => d === "easy" || d === "medium";

const buildSeedProblem = (dividend: number, divisor: number): DivProblem | null => {
  if (!Number.isFinite(dividend) || !Number.isFinite(divisor)) return null;
  if (divisor < 2 || dividend < divisor * 2) return null;
  const dDigits = String(dividend).split("").map(Number);
  const sDigits = String(divisor).split("").map(Number);
  let startIdx = 0;
  let prefixVal = dDigits[0];
  while (prefixVal < divisor && startIdx < dDigits.length - 1) {
    startIdx++;
    prefixVal = prefixVal * 10 + dDigits[startIdx];
  }
  const quotient = Math.floor(dividend / divisor);
  const remainder = dividend - quotient * divisor;
  return { dividend, divisor, quotient, remainder, dDigits, sDigits, nCols: dDigits.length, startIdx };
};

const DivisionGame = () => {
  const { difficulty: routeDiff } = useParams<{ difficulty?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [settings, setSettings] = useState<DivSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const base: DivSettings = raw ? { ...DEFAULT_DIV_SETTINGS, ...JSON.parse(raw) } : DEFAULT_DIV_SETTINGS;
      if (routeDiff && ["easy", "medium", "hard", "expert"].includes(routeDiff)) {
        const diff = routeDiff as DivDifficulty;
        return { ...base, difficulty: diff, showHelper: helperVisibleByDefault(diff) };
      }
      return base;
    } catch { return DEFAULT_DIV_SETTINGS; }
  });
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }, [settings]);

  const [lives, setLives] = useState(settings.startingLives);
  const [coins, setCoins] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [level, setLevel] = useState(1);
  const [objectives, setObjectives] = useState<DivObjective[]>(buildObjectives(1));

  const [board, setBoard] = useState<DivBoardState | null>(null);
  const [steps, setSteps] = useState<DivStep[]>([]);
  const [, setStages] = useState<DivStage[]>([]);
  const [timerKey, setTimerKey] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [lifeLost, setLifeLost] = useState(false);
  const [shake, setShake] = useState(false);
  const [solved, setSolved] = useState(false);
  const failingRef = useRef(false);
  const advancingRef = useRef(false);
  const flightIdRef = useRef(1);
  const [flyingEvents, setFlyingEvents] = useState<DivFlyingEvent[]>([]);

  const currentStep: DivStep | null = board && board.stepIdx < steps.length ? steps[board.stepIdx] : null;

  /* ---------- coords ---------- */
  const getCellCenter = (selector: string) => {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const getObjectiveCenter = (kind: DivRewardKind) => {
    const el = document.querySelector(`[data-div-objective="${kind}"] img`) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const handleArrived = (_id: number, kind: DivRewardKind) => {
    setObjectives((prev) => prev.map((o) => o.kind === kind ? { ...o, collected: o.collected + 1 } : o));
    if (kind === "coin") setCoins((c) => c + 1);
  };
  const flyReward = (selector: string, reward: DivRewardKind) => {
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
  const seedConsumedRef = useRef(false);
  const seedDividend = Number(searchParams.get("dividend"));
  const seedDivisor = Number(searchParams.get("divisor"));
  const returnTo = searchParams.get("return");

  const newRound = () => {
    let p: DivProblem | null = null;
    if (!seedConsumedRef.current) {
      p = buildSeedProblem(seedDividend, seedDivisor);
      seedConsumedRef.current = true;
    }
    if (!p) p = generateProblem(settings.difficulty);
    const built = buildBoard(p);
    setBoard(built.board);
    setSteps(built.steps);
    setStages(built.stages);
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

  const placeDigit = (kind: DivCellKind, stage: number, col: number, digit: number) => {
    if (!board || solved || gameOver || lifeLost || levelComplete) return;
    const step = currentStep;
    if (!step) return;

    const matchesTarget =
      step.kind === kind &&
      (kind === "quotient" ? col === step.targetCol : (stage === step.stage && col === step.targetCol));

    if (!matchesTarget) {
      flashWrong(kind, stage, col);
      return;
    }

    if (digit !== step.expectedDigit) {
      flashWrong(kind, stage, col);
      if (settings.sound) sfxError();
      setStreak(0);
      decrementLifeOnly();
      return;
    }

    if (settings.sound) sfxClick();

    setBoard((prev) => {
      if (!prev) return prev;
      let next = { ...prev };
      if (kind === "quotient") {
        const quotient = prev.quotient.map((c, i) => i === col ? { ...c, value: digit, burst: true, wrong: false } : c);
        next = { ...next, quotient };
      } else if (kind === "product") {
        const stageMap = { ...(prev.products[step.stage] ?? {}) };
        stageMap[col] = { ...stageMap[col], value: digit, burst: true, wrong: false };
        // Last sig product digit → auto-fill trailing zeros + auto-fill leading carry-down remainder digits
        if ((step.prodDigitIdx ?? 0) + 1 >= (step.prodTotalDigits ?? 1)) {
          const stageDef = prev.stages[step.stage];
          for (const padC of stageDef.productPadCells) {
            stageMap[padC.col] = { ...(stageMap[padC.col] ?? newCell()), value: padC.digit, burst: false, wrong: false };
          }
          const stageRem = { ...(prev.remainders[step.stage] ?? {}) };
          for (const rc of stageDef.remainderAutoCells) {
            stageRem[rc.col] = { ...(stageRem[rc.col] ?? newCell()), value: rc.digit, burst: false, wrong: false };
          }
          next = {
            ...next,
            products: { ...prev.products, [step.stage]: stageMap },
            remainders: { ...prev.remainders, [step.stage]: stageRem },
            productPadRevealed: Math.max(next.productPadRevealed, step.stage),
          };
        } else {
          next = { ...next, products: { ...prev.products, [step.stage]: stageMap } };
        }
      } else {
        const stageMap = { ...(prev.remainders[step.stage] ?? {}) };
        stageMap[col] = { ...stageMap[col], value: digit, burst: true, wrong: false };
        const remainders = { ...prev.remainders, [step.stage]: stageMap };
        next = { ...next, remainders };
        if ((step.remDigitIdx ?? 0) + 1 >= (step.remTotalDigits ?? 1)) {
          next = { ...next, remaindersRevealed: Math.max(next.remaindersRevealed, step.stage) };
        }
      }
      next = { ...next, stepIdx: prev.stepIdx + 1 };
      return next;
    });

    // Fly reward
    let cell: DivAnswerCell | undefined;
    let sel = "";
    if (kind === "quotient") {
      cell = board.quotient[col];
      sel = `[data-div-cell="q-${col}"]`;
    } else if (kind === "product") {
      cell = board.products[step.stage]?.[col];
      sel = `[data-div-cell="p-${step.stage}-${col}"]`;
    } else {
      cell = board.remainders[step.stage]?.[col];
      sel = `[data-div-cell="r-${step.stage}-${col}"]`;
    }
    if (cell) flyReward(sel, cell.reward);

    // Clear burst
    setTimeout(() => {
      setBoard((prev) => {
        if (!prev) return prev;
        if (kind === "quotient") {
          const quotient = prev.quotient.map((c, i) => i === col ? { ...c, burst: false } : c);
          return { ...prev, quotient };
        }
        if (kind === "product") {
          const stageMap = { ...(prev.products[stage] ?? {}) };
          if (stageMap[col]) stageMap[col] = { ...stageMap[col], burst: false };
          return { ...prev, products: { ...prev.products, [stage]: stageMap } };
        }
        const stageMap = { ...(prev.remainders[stage] ?? {}) };
        if (stageMap[col]) stageMap[col] = { ...stageMap[col], burst: false };
        return { ...prev, remainders: { ...prev.remainders, [stage]: stageMap } };
      });
    }, 600);

    // Round complete?
    setTimeout(() => {
      setBoard((prev) => {
        if (!prev) return prev;
        if (prev.stepIdx >= steps.length && !advancingRef.current) {
          completeRound();
        }
        return prev;
      });
    }, 250);
  };

  const flashWrong = (kind: DivCellKind, stage: number, col: number) => {
    setBoard((prev) => {
      if (!prev) return prev;
      if (kind === "quotient") {
        const quotient = prev.quotient.map((c, i) => i === col ? { ...c, wrong: true } : c);
        return { ...prev, quotient };
      }
      if (kind === "product") {
        const stageMap = { ...(prev.products[stage] ?? {}) };
        if (stageMap[col]) stageMap[col] = { ...stageMap[col], wrong: true };
        return { ...prev, products: { ...prev.products, [stage]: stageMap } };
      }
      const stageMap = { ...(prev.remainders[stage] ?? {}) };
      if (stageMap[col]) stageMap[col] = { ...stageMap[col], wrong: true };
      return { ...prev, remainders: { ...prev.remainders, [stage]: stageMap } };
    });
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setTimeout(() => {
      setBoard((prev) => {
        if (!prev) return prev;
        if (kind === "quotient") {
          const quotient = prev.quotient.map((c, i) => i === col ? { ...c, wrong: false } : c);
          return { ...prev, quotient };
        }
        if (kind === "product") {
          const stageMap = { ...(prev.products[stage] ?? {}) };
          if (stageMap[col]) stageMap[col] = { ...stageMap[col], wrong: false };
          return { ...prev, products: { ...prev.products, [stage]: stageMap } };
        }
        const stageMap = { ...(prev.remainders[stage] ?? {}) };
        if (stageMap[col]) stageMap[col] = { ...stageMap[col], wrong: false };
        return { ...prev, remainders: { ...prev.remainders, [stage]: stageMap } };
      });
    }, 500);
  };

  const completeRound = () => {
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
  const handleCellClick = (kind: DivCellKind, stage: number, col: number) => {
    if (settings.sound) sfxClick();
    void kind; void stage; void col;
  };
  const handleCellDrop = (kind: DivCellKind, stage: number, col: number, digit: number) => {
    placeDigit(kind, stage, col, digit);
  };
  const handleBankPick = (digit: number) => {
    const step = currentStep;
    if (!step) return;
    placeDigit(step.kind, step.stage, step.targetCol, digit);
  };

  /* ---------- erase / undo ---------- */
  const handleErase = () => handleUndo();
  const handleUndo = () => {
    if (!board || board.stepIdx === 0) return;
    const prevIdx = board.stepIdx - 1;
    const prevStep = steps[prevIdx];
    setBoard((prev) => {
      if (!prev) return prev;
      let next = { ...prev, stepIdx: prevIdx };
      if (prevStep.kind === "quotient") {
        const quotient = prev.quotient.map((c, i) => i === prevStep.targetCol ? { ...c, value: null } : c);
        next = { ...next, quotient };
      } else if (prevStep.kind === "product") {
        const stageMap = { ...(prev.products[prevStep.stage] ?? {}) };
        if (stageMap[prevStep.targetCol]) stageMap[prevStep.targetCol] = { ...stageMap[prevStep.targetCol], value: null };
        next = { ...next, products: { ...prev.products, [prevStep.stage]: stageMap } };
        if ((prevStep.prodDigitIdx ?? 0) + 1 >= (prevStep.prodTotalDigits ?? 1)) {
          next = { ...next, productPadRevealed: prevStep.stage - 1 };
        }
      } else {
        const stageMap = { ...(prev.remainders[prevStep.stage] ?? {}) };
        if (stageMap[prevStep.targetCol]) stageMap[prevStep.targetCol] = { ...stageMap[prevStep.targetCol], value: null };
        next = { ...next, remainders: { ...prev.remainders, [prevStep.stage]: stageMap } };
        if ((prevStep.remDigitIdx ?? 0) + 1 >= (prevStep.remTotalDigits ?? 1)) {
          next = { ...next, remaindersRevealed: prevStep.stage - 1 };
        }
      }
      return next;
    });
  };

  /* ---------- timer ---------- */
  const decrementLifeOnly = () => {
    setLives((l) => {
      const nl = Math.max(0, l - 1);
      if (nl === 0) {
        setGameOver(true);
      }
      return nl;
    });
  };

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

  const updateSettings = (patch: Partial<DivSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const stepHint = useMemo(() => {
    if (!currentStep || !board) return undefined;
    const divisor = board.problem.divisor;
    if (currentStep.kind === "quotient") {
      return `${currentStep.windowVal} ÷ ${divisor} = ?`;
    }
    if (currentStep.kind === "product") {
      const idx = currentStep.prodDigitIdx ?? 0;
      const tot = currentStep.prodTotalDigits ?? 1;
      return `${currentStep.q} × ${divisor} = ? → tap digit ${idx + 1} of ${tot}`;
    }
    const idx = currentStep.remDigitIdx ?? 0;
    const tot = currentStep.remTotalDigits ?? 1;
    const stageDef = board.stages[currentStep.stage];
    return `${stageDef.W} − ${currentStep.paddedProduct} = ? → tap digit ${idx + 1} of ${tot}`;
  }, [currentStep, board]);

  const groupingW = currentStep?.windowVal ?? 0;

  const showHelper = settings.showHelper && settings.difficulty !== "expert" && currentStep && currentStep.kind === "quotient" && board;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
      <SeamlessBackground file="royal-gold.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/75" />

      <header className="relative z-10 flex flex-wrap items-center gap-2 p-3 sm:p-4 border-b border-border/50 bg-card/40 backdrop-blur">
        <Link to="/subjects/algebra/numbers-and-numerals" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-sm sm:text-base font-black uppercase tracking-wider">
          Long <span className="text-amber-400">Division</span> Builder
        </h1>
        {returnTo && (
          <Link to={returnTo} className="inline-flex items-center gap-1 rounded-md border border-sky-400/50 bg-sky-500/15 px-2 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-500/25">
            <ArrowLeft className="h-3.5 w-3.5" /> Prime Lab
          </Link>
        )}
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
          <DivSettingsPanel settings={settings} onChange={updateSettings} />
        </div>
      </header>

      <div className={cn("relative z-10 mx-auto max-w-6xl p-2 sm:p-3 grid gap-2 md:grid-cols-[1fr_220px] transition-transform", shake && "animate-[shake_0.4s_ease-in-out]")}>
        <div className="space-y-3 min-w-0">
          <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-card/80 p-2.5 backdrop-blur shadow-lg">
            <TimerBar durationSec={settings.roundSec} resetKey={timerKey} paused={gameOver || levelComplete || lifeLost || solved} onExpire={handleTimeout} />
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="min-w-0">
              {board && (
                <DivisionBoard
                  state={board}
                  step={currentStep}
                  onCellClick={handleCellClick}
                  onCellDrop={handleCellDrop}
                />
              )}
            </div>
            {showHelper && currentStep && board && (
              <div className="md:sticky md:top-2 self-start">
                <GroupingPanel W={groupingW} divisor={board.problem.divisor} key={`g-${currentStep.stage}-${currentStep.colP}`} />
              </div>
            )}
          </div>

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
                  const m = DIV_REWARD_META[o.kind];
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

export default DivisionGame;
