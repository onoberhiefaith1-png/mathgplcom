import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Sparkles, Trophy } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TimerBar } from "@/components/abacus/TimerBar";
import { sfxClick, sfxError, sfxSuccess } from "@/components/abacus/abacusSfx";
import { cn } from "@/lib/utils";

import { AddDifficulty, AddProblem, generateProblem, planSteps, Step } from "@/lib/addition";
import { AddRewardKind, ADD_REWARD_META, pickAddReward } from "@/lib/additionRewards";
import { BoardState, EquationBoard } from "@/components/addition/EquationBoard";
import { DigitBank } from "@/components/addition/DigitBank";
import { AddObjective, ObjectivesPanel } from "@/components/addition/ObjectivesPanel";
import { AddSettings, AddSettingsPanel, DEFAULT_ADD_SETTINGS } from "@/components/addition/SettingsPanel";
import { FlyingRewards, FlyingRewardEvent } from "@/components/addition/FlyingRewards";

const STORAGE_KEY = "add-settings-v1";

const buildObjectives = (level: number): AddObjective[] => {
  const m = 1 + Math.floor((level - 1) * 0.5);
  return [
    { kind: "coin",    collected: 0, target: 25 * m },
    { kind: "crown",   collected: 0, target: 8 * m },
    { kind: "diamond", collected: 0, target: 5 * m },
    { kind: "star",    collected: 0, target: 10 * m },
  ];
};

const buildBoardState = (problem: AddProblem): BoardState => {
  const cols = problem.answerCols;
  return {
    problem,
    answers: Array.from({ length: cols }, () => null),
    carries: Array.from({ length: cols }, () => null),
    answerRewards: Array.from({ length: cols }, () => pickAddReward()),
    carryRewards: Array.from({ length: cols }, () => pickAddReward()),
    burstAnswer: Array.from({ length: cols }, () => false),
    burstCarry: Array.from({ length: cols }, () => false),
    wrongAnswer: Array.from({ length: cols }, () => false),
    wrongCarry: Array.from({ length: cols }, () => false),
  };
};

const AdditionGame = () => {
  const { difficulty: routeDiff } = useParams<{ difficulty?: string }>();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<AddSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const base: AddSettings = raw ? { ...DEFAULT_ADD_SETTINGS, ...JSON.parse(raw) } : DEFAULT_ADD_SETTINGS;
      if (routeDiff && ["easy", "medium", "hard"].includes(routeDiff)) {
        return { ...base, difficulty: routeDiff as AddDifficulty };
      }
      return base;
    } catch {
      return DEFAULT_ADD_SETTINGS;
    }
  });
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }, [settings]);

  const [lives, setLives] = useState(settings.startingLives);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [level, setLevel] = useState(1);
  const [objectives, setObjectives] = useState<AddObjective[]>(buildObjectives(1));

  const [board, setBoard] = useState<BoardState | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [lifeLost, setLifeLost] = useState(false);
  const [shake, setShake] = useState(false);
  const [solved, setSolved] = useState(false);
  const failingRef = useRef(false);
  const advancingRef = useRef(false);
  const flightIdRef = useRef(1);
  const [flyingEvents, setFlyingEvents] = useState<FlyingRewardEvent[]>([]);

  const getCellCenter = (type: "answer" | "carry", col: number) => {
    const el = document.querySelector(`[data-add-cell="${type}-${col}"]`) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const getObjectiveCenter = (kind: AddRewardKind) => {
    const el = document.querySelector(`[data-add-objective="${kind}"] img`) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const handleArrived = (_id: number, kind: AddRewardKind) => {
    setObjectives((prev) => prev.map((o) => (o.kind === kind ? { ...o, collected: o.collected + 1 } : o)));
  };

  const newRound = () => {
    const p = generateProblem(settings.difficulty);
    setBoard(buildBoardState(p));
    setSteps(planSteps(p));
    setStepIdx(0);
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

  const current = steps[stepIdx] ?? null;
  const active = current ? { type: current.type, col: current.col } : null;

  /** End-of-equation: animate rewards in sequence, collect them, then advance. */
  const completeEquation = (b: BoardState) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setSolved(true);
    if (settings.sound) sfxSuccess();

    // Determine which cells were used (have entered values matching expected).
    const cols = b.problem.answerCols;
    const usedAnswers: number[] = [];
    const usedCarries: number[] = [];
    for (let c = 0; c < cols; c++) {
      if (b.answers[c] !== null) usedAnswers.push(c);
      if (b.carries[c] !== null && b.problem.carryInto[c] > 0) usedCarries.push(c);
    }

    // Burst sequentially right-to-left (units first), satisfying.
    const seq: Array<{ type: "answer" | "carry"; col: number; reward: AddRewardKind }> = [];
    const ordered = [...usedAnswers].sort((a, c) => a - c);
    for (const c of ordered) {
      seq.push({ type: "answer", col: c, reward: b.answerRewards[c] });
      if (usedCarries.includes(c + 1)) {
        seq.push({ type: "carry", col: c + 1, reward: b.carryRewards[c + 1] });
      }
    }

    const earned: AddRewardKind[] = [];
    seq.forEach((step, i) => {
      setTimeout(() => {
        setBoard((prev) => {
          if (!prev) return prev;
          const next: BoardState = {
            ...prev,
            burstAnswer: [...prev.burstAnswer],
            burstCarry: [...prev.burstCarry],
          };
          if (step.type === "answer") next.burstAnswer[step.col] = true;
          else next.burstCarry[step.col] = true;
          return next;
        });
        earned.push(step.reward);
        // Launch a flying reward from the cell to its matching objective.
        const from = getCellCenter(step.type, step.col);
        const to = getObjectiveCenter(step.reward);
        if (from && to) {
          const id = flightIdRef.current++;
          setFlyingEvents((prev) => [...prev, { id, kind: step.reward, from, to }]);
        } else {
          // Fallback: still credit the objective if we can't measure positions.
          handleArrived(-1, step.reward);
        }
      }, i * 160);
    });

    const totalDelay = seq.length * 160 + 950;
    setTimeout(() => {
      const gain = 20 * b.problem.answerCols + earned.length * 5 + Math.min(40, streak * 3);
      setScore((s) => s + gain);
      setStreak((s) => {
        const ns = s + 1;
        setBestStreak((bb) => Math.max(bb, ns));
        return ns;
      });
      setRoundsCompleted((n) => n + 1);
      setTimeout(() => newRound(), 500);
    }, totalDelay);
  };

  const placeDigit = (type: "answer" | "carry", col: number, digit: number) => {
    if (!board || solved || gameOver || levelComplete || lifeLost) return;
    if (!current || current.type !== type || current.col !== col) {
      // Wrong cell — small shake on the cell that was clicked, no life lost.
      if (settings.sound) sfxError();
      setBoard((prev) => {
        if (!prev) return prev;
        const next = { ...prev, wrongAnswer: [...prev.wrongAnswer], wrongCarry: [...prev.wrongCarry] };
        if (type === "answer") next.wrongAnswer[col] = true;
        else next.wrongCarry[col] = true;
        return next;
      });
      setTimeout(() => {
        setBoard((prev) => {
          if (!prev) return prev;
          const next = { ...prev, wrongAnswer: [...prev.wrongAnswer], wrongCarry: [...prev.wrongCarry] };
          if (type === "answer") next.wrongAnswer[col] = false;
          else next.wrongCarry[col] = false;
          return next;
        });
      }, 450);
      return;
    }
    if (digit !== current.expected) {
      if (settings.sound) sfxError();
      setBoard((prev) => {
        if (!prev) return prev;
        const next = { ...prev, wrongAnswer: [...prev.wrongAnswer], wrongCarry: [...prev.wrongCarry] };
        if (type === "answer") next.wrongAnswer[col] = true;
        else next.wrongCarry[col] = true;
        return next;
      });
      setStreak(0);
      setTimeout(() => {
        setBoard((prev) => {
          if (!prev) return prev;
          const next = { ...prev, wrongAnswer: [...prev.wrongAnswer], wrongCarry: [...prev.wrongCarry] };
          if (type === "answer") next.wrongAnswer[col] = false;
          else next.wrongCarry[col] = false;
          return next;
        });
      }, 450);
      return;
    }

    // Correct placement.
    if (settings.sound) sfxClick();
    setBoard((prev) => {
      if (!prev) return prev;
      const next: BoardState = { ...prev, answers: [...prev.answers], carries: [...prev.carries] };
      if (type === "answer") next.answers[col] = digit;
      else next.carries[col] = digit;
      // After correct placement, if this was the last step, kick off completion.
      const isLast = stepIdx >= steps.length - 1;
      if (isLast) {
        // schedule completion with the freshly updated board
        setTimeout(() => completeEquation(next), 80);
      }
      return next;
    });
    setStepIdx((i) => i + 1);
  };

  const handleBankPick = (digit: number) => {
    if (!current) return;
    placeDigit(current.type, current.col, digit);
  };

  // Keyboard 0–9
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameOver || levelComplete || lifeLost) return;
      if (/^[0-9]$/.test(e.key)) handleBankPick(Number(e.key));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, [current, board, gameOver, levelComplete, lifeLost]);

  const handleTimeout = () => {
    if (gameOver || levelComplete || failingRef.current) return;
    failingRef.current = true;
    if (settings.sound) sfxError();
    setStreak(0);
    setShake(true);
    setLifeLost(true);
    setTimeout(() => setShake(false), 450);
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
        }, 1200);
      }
      return nl;
    });
  };

  const restart = () => {
    setLives(settings.startingLives);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setRoundsCompleted(0);
    setLevel(1);
    setObjectives(buildObjectives(1));
    setGameOver(false);
    setLevelComplete(false);
    newRound();
  };

  const advanceLevel = () => {
    setLevel((l) => l + 1);
    setObjectives(buildObjectives(level + 1));
    setScore((s) => s + 100);
    setLevelComplete(false);
    newRound();
  };

  const updateSettings = (patch: Partial<AddSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const hint = useMemo(() => {
    if (!current || !board) return "";
    if (current.type === "answer") {
      return `Solve the ${placeName(current.col)} column. Place the answer digit below.`;
    }
    return `Carry into the ${placeName(current.col)} column.`;
  }, [current, board]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
      <SeamlessBackground file="royal-gold.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/75" />

      {/* HUD */}
      <header className="relative z-10 flex flex-wrap items-center gap-2 p-3 sm:p-4 border-b border-border/50 bg-card/40 backdrop-blur">
        <Link to="/subjects/algebra/numbers-and-numerals" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-sm sm:text-base font-black uppercase tracking-wider">
          Addition <span className="text-amber-400">Carry</span> Challenge
        </h1>
        <div className="flex items-center gap-1 ml-auto">
          {Array.from({ length: settings.startingLives }).map((_, i) => (
            <Heart key={i} className={i < lives ? "h-4 w-4 fill-rose-500 text-rose-500" : "h-4 w-4 text-muted-foreground/30"} />
          ))}
        </div>
        <AddSettingsPanel settings={settings} onChange={updateSettings} />
      </header>

      <div className={cn("relative z-10 mx-auto max-w-3xl p-2 sm:p-3 grid gap-2 lg:grid-cols-[1fr_220px] transition-transform", shake && "animate-[shake_0.4s_ease-in-out]")}>
        <div className="space-y-2">
          {/* Prompt + timer */}
          <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-card/80 p-2.5 backdrop-blur shadow-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-300 shrink-0" />
              <div className="text-xs sm:text-sm font-semibold flex-1 truncate">{hint}</div>
            </div>
            <div className="mt-1.5">
              <TimerBar durationSec={settings.roundSec} resetKey={timerKey} paused={gameOver || levelComplete || lifeLost || solved} onExpire={handleTimeout} />
            </div>
          </div>

          {/* Board */}
          {board && (
            <EquationBoard
              state={board}
              active={active}
              onPlace={placeDigit}
              onActivate={() => { /* active follows current step; cell click is informational */ }}
            />
          )}

          {/* Digit bank */}
          <div className="sticky bottom-2 rounded-xl border-2 border-primary/30 bg-gradient-to-b from-card/95 to-card/80 p-2 backdrop-blur shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
            <div className="mb-1.5 text-center text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Drag or tap a digit
            </div>
            <DigitBank onPick={handleBankPick} />
          </div>
        </div>

        {/* Right column */}
        <aside className="space-y-2">
          <ObjectivesPanel objectives={objectives} />
          <div className="rounded-xl border-2 border-primary/30 bg-card/70 p-2.5 backdrop-blur grid grid-cols-3 lg:grid-cols-2 gap-2 text-xs">
            <Stat label="Lvl" value={level} />
            <Stat label="Score" value={score} />
            <Stat label="Streak" value={streak} />
            <Stat label="Best" value={bestStreak} />
            <Stat label="Rounds" value={roundsCompleted} />
          </div>
        </aside>
      </div>

      <FlyingRewards events={flyingEvents} onArrived={handleArrived} />

      {/* Game Over */}
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
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Rewards Collected</div>
              <div className="flex flex-wrap gap-2">
                {objectives.map((o) => {
                  const m = ADD_REWARD_META[o.kind];
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
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate("/subjects/algebra/numbers-and-numerals")}>Menu</Button>
            <Button onClick={restart}>Retry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Level complete */}
      <Dialog open={levelComplete} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-400" /> Level {level} Complete!</DialogTitle>
            <DialogDescription>+100 bonus score. The next level brings tougher carries.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={advanceLevel}>Next Level</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Life Lost overlay */}
      {lifeLost && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-rose-950/40 backdrop-blur-sm" />
          <div className="relative flex flex-col items-center gap-2 rounded-2xl border-2 border-rose-500/60 bg-card/90 px-8 py-6 shadow-[0_0_40px_hsl(0_80%_55%/0.6)]">
            <Heart className="h-12 w-12 fill-rose-500 text-rose-500 animate-pulse" />
            <span className="text-lg font-black uppercase tracking-widest text-rose-400">Time Up</span>
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

const placeName = (p: number) => {
  switch (p) {
    case 0: return "Units";
    case 1: return "Tens";
    case 2: return "Hundreds";
    case 3: return "Thousands";
    case 4: return "Ten-Thousands";
    default: return `Place ${p}`;
  }
};

export default AdditionGame;
