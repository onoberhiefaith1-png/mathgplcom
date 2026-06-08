import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TimerBar } from "@/components/abacus/TimerBar";
import { AnswerRow, RowState } from "@/components/placevalue/AnswerRow";
import { DigitBank } from "@/components/placevalue/DigitBank";
import { ObjectivesPanel, PVObjective } from "@/components/placevalue/ObjectivesPanel";
import { PVSettingsPanel, PVSettings, DEFAULT_PV_SETTINGS } from "@/components/placevalue/SettingsPanel";
import { Difficulty, generateRound, pickNextDigit, Round } from "@/lib/placeValue";
import { pickRewardWeighted, RewardKind, REWARD_META } from "@/lib/placeValueRewards";
import { sfxClick, sfxError, sfxSuccess } from "@/components/abacus/abacusSfx";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pv-settings-v1";

const buildObjectives = (level: number): PVObjective[] => {
  const m = 1 + Math.floor((level - 1) * 0.5);
  return [
    { kind: "coin", collected: 0, target: 20 * m },
    { kind: "crown", collected: 0, target: 8 * m },
    { kind: "heart", collected: 0, target: 6 * m },
    { kind: "diamond", collected: 0, target: 5 * m },
  ];
};

const PlaceValueGame = () => {
  const { difficulty: routeDiff } = useParams<{ difficulty?: string }>();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<PVSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const base: PVSettings = raw ? { ...DEFAULT_PV_SETTINGS, ...JSON.parse(raw) } : DEFAULT_PV_SETTINGS;
      if (routeDiff && ["easy", "medium", "hard"].includes(routeDiff)) {
        return { ...base, difficulty: routeDiff as Difficulty };
      }
      return base;
    } catch {
      return DEFAULT_PV_SETTINGS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const [lives, setLives] = useState(settings.startingLives);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [correctRows, setCorrectRows] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [level, setLevel] = useState(1);
  const [objectives, setObjectives] = useState<PVObjective[]>(buildObjectives(1));
  const [activeRow, setActiveRow] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [timerKey, setTimerKey] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [lifeLost, setLifeLost] = useState(false);
  const [shake, setShake] = useState(false);
  const lastDigit = useRef<number | undefined>(undefined);
  const failingRef = useRef(false);

  const newRound = () => {
    const digit = pickNextDigit(lastDigit.current);
    lastDigit.current = digit;
    const r = generateRound(settings.difficulty, digit, settings.numbersPerRound);
    setRound(r);
    setRows(
      r.questions.map((q) => ({
        question: q,
        rewards: Array.from({ length: r.slotCount }).map(() => pickRewardWeighted(settings.weights)),
        inputs: Array.from({ length: r.slotCount }).map(() => null),
        cleared: false,
      })),
    );
    setActiveRow(0);
    setTimerKey((k) => k + 1);
  };

  // Initial round
  useEffect(() => {
    newRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-roll if difficulty/numbers changes
  useEffect(() => {
    if (!round) return;
    newRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.difficulty, settings.numbersPerRound]);

  // Lives clamp on settings
  useEffect(() => {
    setLives((l) => Math.min(l, settings.startingLives));
  }, [settings.startingLives]);

  const collectRewards = (kinds: RewardKind[]) => {
    setObjectives((prev) =>
      prev.map((o) => ({ ...o, collected: o.collected + kinds.filter((k) => k === o.kind).length })),
    );
  };

  // Check level complete
  useEffect(() => {
    if (objectives.length && objectives.every((o) => o.collected >= o.target) && !levelComplete) {
      setLevelComplete(true);
    }
  }, [objectives, levelComplete]);

  // All rows cleared → next round
  useEffect(() => {
    if (rows.length && rows.every((r) => r.cleared)) {
      setRoundsCompleted((n) => n + 1);
      const t = setTimeout(() => newRound(), 600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const submitRow = (idx: number) => {
    setRows((prev) => {
      if (!prev[idx] || prev[idx].cleared) return prev;
      const next = [...prev];
      const row = { ...next[idx], inputs: [...next[idx].inputs] };
      // Player's entered digits, left-aligned, trimmed of trailing nulls.
      let lastFilled = -1;
      for (let i = 0; i < row.inputs.length; i++) if (row.inputs[i] !== null) lastFilled = i;
      if (lastFilled < 0) return prev; // nothing entered yet
      // Must be contiguous from slot 0
      const entered = row.inputs.slice(0, lastFilled + 1);
      const contiguous = entered.every((v) => v !== null);
      const expected = row.question.answerDigits;
      setTotalAttempts((n) => n + 1);
      const ok =
        contiguous &&
        entered.length === expected.length &&
        entered.every((v, i) => v === expected[i]);
      if (ok) {
        if (settings.sound) sfxSuccess();
        const earned: RewardKind[] = [];
        for (let i = 0; i < entered.length; i++) {
          const r = row.rewards[i];
          if (r) earned.push(r);
        }
        collectRewards(earned);
        const gain = 10 * expected.length + earned.length * 5 + Math.min(20, streak * 2);
        setScore((s) => s + gain);
        setStreak((s) => {
          const ns = s + 1;
          setBestStreak((b) => Math.max(b, ns));
          return ns;
        });
        setCorrectRows((n) => n + 1);
        row.cleared = true;
        next[idx] = row;
        const nextActive = next.findIndex((r, i) => i !== idx && !r.cleared);
        if (nextActive >= 0) setActiveRow(nextActive);
      } else {
        if (settings.sound) sfxError();
        setStreak(0);
        row.wrongFlash = true;
        // Clear inputs so the player can try again.
        row.inputs = row.inputs.map(() => null);
        next[idx] = row;
        setTimeout(() => {
          setRows((p) => p.map((r, i) => (i === idx ? { ...r, wrongFlash: false } : r)));
        }, 450);
      }
      return next;
    });
  };

  const placeDigitLTR = (rowIdx: number, digit: number) => {
    if (settings.sound) sfxClick();
    setRows((prev) => {
      if (!prev[rowIdx] || prev[rowIdx].cleared) return prev;
      const n = [...prev];
      const r = { ...n[rowIdx], inputs: [...n[rowIdx].inputs] };
      const slot = r.inputs.findIndex((v) => v === null);
      if (slot < 0) return prev;
      r.inputs[slot] = digit;
      n[rowIdx] = r;
      return n;
    });
  };

  const placeDigitAt = (rowIdx: number, slot: number, digit: number) => {
    // Drag-drop: only allowed at the leftmost empty slot to enforce L→R rule.
    if (settings.sound) sfxClick();
    setRows((prev) => {
      if (!prev[rowIdx] || prev[rowIdx].cleared) return prev;
      const n = [...prev];
      const r = { ...n[rowIdx], inputs: [...n[rowIdx].inputs] };
      const firstEmpty = r.inputs.findIndex((v) => v === null);
      if (firstEmpty < 0 || slot !== firstEmpty) return prev;
      r.inputs[slot] = digit;
      n[rowIdx] = r;
      return n;
    });
    setActiveRow(rowIdx);
  };

  const activeIdx = () => {
    const i = rows.findIndex((r, i) => !r.cleared && i === activeRow);
    return i >= 0 ? i : rows.findIndex((r) => !r.cleared);
  };

  const handleBankPick = (digit: number) => {
    const i = activeIdx();
    if (i < 0) return;
    placeDigitLTR(i, digit);
  };

  const handleBackspace = () => {
    const i = activeIdx();
    if (i < 0) return;
    setRows((prev) => {
      const n = [...prev];
      const r = { ...n[i], inputs: [...n[i].inputs] };
      let last = -1;
      for (let k = 0; k < r.inputs.length; k++) if (r.inputs[k] !== null) last = k;
      if (last < 0) return prev;
      r.inputs[last] = null;
      n[i] = r;
      return n;
    });
  };

  const handleSubmit = () => {
    const i = activeIdx();
    if (i < 0) return;
    submitRow(i);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameOver || levelComplete || lifeLost) return;
      if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
      else if (e.key === "Backspace") { e.preventDefault(); handleBackspace(); }
      else if (/^[0-9]$/.test(e.key)) { handleBankPick(Number(e.key)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeRow, gameOver, levelComplete, lifeLost]);

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
        }, 1100);
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
    setCorrectRows(0);
    setTotalAttempts(0);
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

  const accuracy = totalAttempts ? Math.round((correctRows / totalAttempts) * 100) : 100;
  const updateSettings = (patch: Partial<PVSettings>) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
      <SeamlessBackground file="arcane.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/75" />

      {/* HUD */}
      <header className="relative z-10 flex flex-wrap items-center gap-2 p-3 sm:p-4 border-b border-border/50 bg-card/40 backdrop-blur">
        <Link to="/subjects/algebra/numbers-and-numerals" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-sm sm:text-base font-bold uppercase tracking-wider">
          Place Value <span className="text-primary">Challenge</span>
        </h1>
        <div className="flex items-center gap-1 ml-auto">
          {Array.from({ length: settings.startingLives }).map((_, i) => (
            <Heart key={i} className={i < lives ? "h-4 w-4 fill-rose-500 text-rose-500" : "h-4 w-4 text-muted-foreground/30"} />
          ))}
        </div>
        <PVSettingsPanel settings={settings} onChange={updateSettings} />
      </header>

      <div className={cn("relative z-10 mx-auto max-w-3xl p-2 sm:p-3 grid gap-2 lg:grid-cols-[1fr_200px] transition-transform", shake && "animate-[shake_0.4s_ease-in-out]")}>
        <div className="space-y-2">
          {/* Compact prompt + timer */}
          <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 to-card/80 p-2 backdrop-blur shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Place value of</span>
              <span className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-2xl font-black h-9 w-9 shadow-md">
                {round?.digit ?? "?"}
              </span>
              <div className="flex-1 min-w-0">
                <TimerBar durationSec={settings.roundSec} resetKey={timerKey} paused={gameOver || levelComplete || lifeLost} onExpire={handleTimeout} />
              </div>
            </div>
          </div>

          {/* Board */}
          <div className="rounded-xl border bg-card/40 p-2 backdrop-blur space-y-1.5">
            {rows.map((row, i) => (
              <AnswerRow
                key={i}
                row={row}
                slotCount={round?.slotCount ?? 1}
                active={activeRow === i}
                index={i}
                onPlace={(slot, d) => placeDigitAt(i, slot, d)}
                onRemove={(slot) =>
                  setRows((prev) => {
                    const n = [...prev];
                    const r = { ...n[i], inputs: [...n[i].inputs] };
                    r.inputs[slot] = null;
                    n[i] = r;
                    return n;
                  })
                }
                onActivate={() => setActiveRow(i)}
              />
            ))}
          </div>

          {/* Digit bank */}
          <div className="sticky bottom-2 rounded-xl border-2 border-primary/30 bg-gradient-to-b from-card/95 to-card/80 p-2 backdrop-blur shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
            <DigitBank onPick={handleBankPick} onSubmit={handleSubmit} onBackspace={handleBackspace} />
          </div>
        </div>

        {/* Right column */}
        <aside className="space-y-2">
          <ObjectivesPanel objectives={objectives} />
          <div className="rounded-lg border bg-card/60 p-2 text-xs grid grid-cols-3 lg:grid-cols-2 gap-1.5">
            <Stat label="Lvl" value={level} />
            <Stat label="Score" value={score} />
            <Stat label="Streak" value={streak} />
            <Stat label="Best" value={bestStreak} />
            <Stat label="Rounds" value={roundsCompleted} />
            <Stat label="Acc" value={`${accuracy}%`} />
          </div>
        </aside>
      </div>

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
            <Stat label="Accuracy" value={`${accuracy}%`} />
            <Stat label="Best Streak" value={bestStreak} />
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Rewards Collected</div>
              <div className="flex flex-wrap gap-2">
                {objectives.map((o) => {
                  const m = REWARD_META[o.kind];
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

      {/* Level Complete */}
      <Dialog open={levelComplete} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Level {level} Complete!</DialogTitle>
            <DialogDescription>+100 bonus score. Numbers grow next level.</DialogDescription>
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
            <Heart className="h-12 w-12 fill-rose-500 text-rose-500 animate-[bomb-pulse_0.6s_ease-in-out_infinite]" />
            <span className="text-lg font-black uppercase tracking-widest text-rose-400">Life Lost</span>
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

export default PlaceValueGame;
