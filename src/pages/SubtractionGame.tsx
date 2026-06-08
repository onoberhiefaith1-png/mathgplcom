import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Trophy } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TimerBar } from "@/components/abacus/TimerBar";
import { sfxClick, sfxError, sfxSuccess } from "@/components/abacus/abacusSfx";
import { cn } from "@/lib/utils";

import { SubDifficulty, SubProblem, generateProblem } from "@/lib/subtraction";
import { SubRewardKind, SUB_REWARD_META, pickSubReward } from "@/lib/subtractionRewards";
import { SubtractionBoard, SubBoardState, ToolMode, MinuendCol } from "@/components/subtraction/SubtractionBoard";
import { DigitBank } from "@/components/subtraction/DigitBank";
import { SubObjective, ObjectivesPanel } from "@/components/subtraction/ObjectivesPanel";
import { SubSettings, SubSettingsPanel, DEFAULT_SUB_SETTINGS } from "@/components/subtraction/SettingsPanel";
import { FlyingRewards, SubFlyingEvent } from "@/components/subtraction/FlyingRewards";
import { ToolBar } from "@/components/subtraction/ToolBar";

const STORAGE_KEY = "sub-settings-v1";

const buildObjectives = (level: number): SubObjective[] => {
  const m = 1 + Math.floor((level - 1) * 0.5);
  return [
    { kind: "coin",    collected: 0, target: 25 * m },
    { kind: "diamond", collected: 0, target: 5 * m },
    { kind: "crown",   collected: 0, target: 6 * m },
    { kind: "star",    collected: 0, target: 10 * m },
  ];
};

const buildBoard = (p: SubProblem): SubBoardState => {
  const minuend: MinuendCol[] = p.aDigits.map((d) => ({
    base: d, replaced: false, borrow: null, armingReplace: false, expanded: false, wrong: false,
  }));
  return {
    problem: p,
    minuend,
    answers: Array.from({ length: p.cols }, () => null),
    answerRewards: Array.from({ length: p.cols }, () => pickSubReward()),
    burstAnswer: Array.from({ length: p.cols }, () => false),
    wrongAnswer: Array.from({ length: p.cols }, () => false),
  };
};

const SubtractionGame = () => {
  const { difficulty: routeDiff } = useParams<{ difficulty?: string }>();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<SubSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const base: SubSettings = raw ? { ...DEFAULT_SUB_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SUB_SETTINGS;
      if (routeDiff && ["easy", "medium", "hard"].includes(routeDiff)) {
        return { ...base, difficulty: routeDiff as SubDifficulty };
      }
      return base;
    } catch { return DEFAULT_SUB_SETTINGS; }
  });
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }, [settings]);

  const [lives, setLives] = useState(settings.startingLives);
  const [coins, setCoins] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [level, setLevel] = useState(1);
  const [objectives, setObjectives] = useState<SubObjective[]>(buildObjectives(1));

  const [board, setBoard] = useState<SubBoardState | null>(null);
  const [toolMode, setToolModeRaw] = useState<ToolMode>("idle");
  const [activeAnswerCol, setActiveAnswerCol] = useState<number | null>(null);
  const [selectedMinCol, setSelectedMinCol] = useState<number | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [lifeLost, setLifeLost] = useState(false);
  const [shake, setShake] = useState(false);
  const [solved, setSolved] = useState(false);
  const failingRef = useRef(false);
  const advancingRef = useRef(false);
  const flightIdRef = useRef(1);
  const [flyingEvents, setFlyingEvents] = useState<SubFlyingEvent[]>([]);

  /* ---------- coords for flying rewards ---------- */
  const getCellCenter = (col: number) => {
    const el = document.querySelector(`[data-sub-cell="ans-${col}"]`) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const getObjectiveCenter = (kind: SubRewardKind) => {
    const el = document.querySelector(`[data-sub-objective="${kind}"] img`) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const handleArrived = (_id: number, kind: SubRewardKind) => {
    setObjectives((prev) => prev.map((o) => o.kind === kind ? { ...o, collected: o.collected + 1 } : o));
    if (kind === "coin") setCoins((c) => c + 1);
  };

  /* ---------- round lifecycle ---------- */
  const newRound = () => {
    const p = generateProblem(settings.difficulty);
    setBoard(buildBoard(p));
    setSolved(false);
    setToolModeRaw("idle");
    setSelectedMinCol(null);
    setActiveAnswerCol(0);
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

  /* ---------- hint: column furthest right that still needs work ---------- */
  const hintCol = (() => {
    if (!board) return null;
    for (let p = 0; p < board.problem.cols; p++) {
      if (board.answers[p] !== board.problem.answerDigits[p]) return p;
    }
    return null;
  })();

  /* ---------- tool mode wrapper: auto-arm/expand when a minuend cell is selected ---------- */
  const setToolMode = (m: ToolMode) => {
    setToolModeRaw(m);
    if (m === "idle") return;
    if (selectedMinCol === null || !board) return;
    // Auto-apply tool to currently selected cell.
    setBoard((prev) => {
      if (!prev) return prev;
      const minuend = prev.minuend.map((mc, i) => {
        if (i !== selectedMinCol) return { ...mc, armingReplace: false };
        if (m === "replace") return { ...mc, armingReplace: true, expanded: false };
        return { ...mc, expanded: true, armingReplace: false };
      });
      return { ...prev, minuend };
    });
    if (settings.sound) sfxClick();
  };

  /* ---------- minuend interactions ---------- */
  const handleMinuendClick = (col: number) => {
    if (!board || solved || gameOver || lifeLost || levelComplete) return;
    // Toggle selection
    setSelectedMinCol((cur) => (cur === col ? null : col));
    setActiveAnswerCol(null);
    if (toolMode === "idle") {
      if (settings.sound) sfxClick();
      return;
    }
    // Tool already chosen → arm/expand this cell immediately
    setBoard((prev) => {
      if (!prev) return prev;
      const minuend = prev.minuend.map((m, i) => {
        if (i !== col) return { ...m, armingReplace: false };
        if (toolMode === "replace") return { ...m, armingReplace: !m.armingReplace, expanded: false };
        return { ...m, expanded: true, armingReplace: false };
      });
      return { ...prev, minuend };
    });
    if (settings.sound) sfxClick();
  };

  const handleMinuendDrop = (col: number, digit: number, target: "base" | "borrow") => {
    if (!board || solved || gameOver || lifeLost || levelComplete) return;
    setBoard((prev) => {
      if (!prev) return prev;
      const minuend = prev.minuend.map((m, i) => {
        if (i !== col) return m;
        if (target === "base") {
          if (!m.armingReplace) return m;
          const original = prev.problem.aDigits[i];
          const replaced = digit !== original;
          return { ...m, base: digit, replaced, armingReplace: false };
        } else {
          if (!m.expanded) return m;
          return { ...m, borrow: digit };
        }
      });
      return { ...prev, minuend };
    });
    if (settings.sound) sfxClick();
    setToolModeRaw("idle");
    setSelectedMinCol(null);
  };

  /* ---------- answer interactions ---------- */
  const handleAnswerClick = (col: number) => {
    if (!board || solved || gameOver || lifeLost || levelComplete) return;
    setActiveAnswerCol(col);
    setSelectedMinCol(null);
  };
  const handleAnswerDrop = (col: number, digit: number) => {
    if (!board || solved || gameOver || lifeLost || levelComplete) return;
    setBoard((prev) => {
      if (!prev) return prev;
      const answers = [...prev.answers];
      answers[col] = digit;
      return { ...prev, answers };
    });
    setActiveAnswerCol((c) => (c === col ? findNextEmpty(col) : c));
    if (settings.sound) sfxClick();
  };
  const findNextEmpty = (from: number): number | null => {
    if (!board) return null;
    for (let p = 0; p < board.problem.cols; p++) {
      if (p === from) continue;
      if (board.answers[p] === null) return p;
    }
    return null;
  };

  const handleBankPick = (digit: number) => {
    if (!board || solved || gameOver || lifeLost || levelComplete) return;

    // 1. Replace tool armed on a minuend cell → fill its base
    if (toolMode === "replace") {
      const armedIdx = board.minuend.findIndex((m) => m.armingReplace);
      if (armedIdx >= 0) {
        handleMinuendDrop(armedIdx, digit, "base");
        return;
      }
    }
    // 2. Add tool with an expanded cell awaiting a borrow value
    if (toolMode === "add") {
      const expIdx = board.minuend.findIndex((m) => m.expanded && m.borrow === null);
      if (expIdx >= 0) {
        handleMinuendDrop(expIdx, digit, "borrow");
        return;
      }
    }
    // 3. Otherwise route to the active answer cell
    if (activeAnswerCol !== null && toolMode === "idle") {
      handleAnswerDrop(activeAnswerCol, digit);
    }
  };

  /* ---------- submission ---------- */
  const allAnswersFilled = board ? board.answers.every((v) => v !== null) : false;

  const completeEquation = (b: SubBoardState) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setSolved(true);
    if (settings.sound) sfxSuccess();

    // Burst rewards right→left
    const seq: Array<{ col: number; reward: SubRewardKind }> = [];
    for (let c = 0; c < b.problem.cols; c++) {
      seq.push({ col: c, reward: b.answerRewards[c] });
    }
    seq.forEach((step, i) => {
      setTimeout(() => {
        setBoard((prev) => {
          if (!prev) return prev;
          const burstAnswer = [...prev.burstAnswer];
          burstAnswer[step.col] = true;
          return { ...prev, burstAnswer };
        });
        const from = getCellCenter(step.col);
        const to = getObjectiveCenter(step.reward);
        if (from && to) {
          const id = flightIdRef.current++;
          setFlyingEvents((prev) => [...prev, { id, kind: step.reward, from, to }]);
        } else {
          handleArrived(-1, step.reward);
        }
      }, i * 160);
    });

    const totalDelay = seq.length * 160 + 950;
    setTimeout(() => {
      const gain = 25 * b.problem.cols + Math.min(60, streak * 4);
      setScore((s) => s + gain);
      setStreak((s) => { const ns = s + 1; setBestStreak((bb) => Math.max(bb, ns)); return ns; });
      setRoundsCompleted((n) => n + 1);
      setTimeout(() => newRound(), 500);
    }, totalDelay);
  };

  const handleSubmit = () => {
    if (!board || solved) return;
    const allCorrect = board.answers.every((v, i) => v === board.problem.answerDigits[i]);
    if (allCorrect) {
      completeEquation(board);
    } else {
      // Wrong: lose a life, flash wrong cells.
      if (settings.sound) sfxError();
      setBoard((prev) => {
        if (!prev) return prev;
        const wrongAnswer = prev.answers.map((v, i) => v !== prev.problem.answerDigits[i]);
        return { ...prev, wrongAnswer };
      });
      setStreak(0);
      setShake(true);
      setTimeout(() => setShake(false), 450);
      loseLife();
    }
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
        }, 1200);
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

  const updateSettings = (patch: Partial<SubSettings>) => setSettings((s) => ({ ...s, ...patch }));

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
          Subtraction <span className="text-amber-400">Borrow</span> Challenge
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
          <SubSettingsPanel settings={settings} onChange={updateSettings} />
        </div>
      </header>

      <div className={cn("relative z-10 mx-auto max-w-4xl p-2 sm:p-3 grid gap-2 lg:grid-cols-[1fr_220px] transition-transform", shake && "animate-[shake_0.4s_ease-in-out]")}>
        <div className="space-y-3">
          {/* Timer */}
          <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-card/80 p-2.5 backdrop-blur shadow-lg">
            <TimerBar durationSec={settings.roundSec} resetKey={timerKey} paused={gameOver || levelComplete || lifeLost || solved} onExpire={handleTimeout} />
          </div>

          {/* Board */}
          {board && (
            <SubtractionBoard
              state={board}
              toolMode={toolMode}
              hintCol={hintCol}
              selectedMinCol={selectedMinCol}
              onMinuendClick={handleMinuendClick}
              onMinuendDrop={handleMinuendDrop}
              onAnswerDrop={handleAnswerDrop}
              onAnswerClick={handleAnswerClick}
              activeAnswerCol={activeAnswerCol}
            />
          )}

          {/* Tool bar */}
          <ToolBar mode={toolMode} onModeChange={setToolMode} onSubmit={handleSubmit} canSubmit={allAnswersFilled && !solved} />

          {/* Digit bank */}
          <div className="sticky bottom-2 rounded-xl border-2 border-primary/30 bg-gradient-to-b from-card/95 to-card/80 p-2 backdrop-blur shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
            <div className="mb-1.5 text-center text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Tap a digit · Select a cell or tool first
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
            <Stat label="Coins" value={coins} />
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Rewards Collected</div>
              <div className="flex flex-wrap gap-2">
                {objectives.map((o) => {
                  const m = SUB_REWARD_META[o.kind];
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

      {/* Level Complete */}
      <Dialog open={levelComplete} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-400" /> Level {level} Complete!</DialogTitle>
            <DialogDescription>+100 bonus score. Tougher borrows ahead.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={advanceLevel}>Next Level</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Life Lost */}
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

export default SubtractionGame;
