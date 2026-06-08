import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Timer, RotateCcw, Trophy, Flame } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { cn } from "@/lib/utils";
import {
  FractionDifficulty,
  MixedNumber,
  pickMixed,
  validateMixedToImproper,
  TIMERS,
  MAX_LANES,
  INITIAL_LANES,
  LANE_RAMP_SEC,
  TRAVEL_SEC,
} from "@/lib/fractions";
import { useLaneRunner } from "@/hooks/useLaneRunner";
import { FractionLaneBoard } from "@/components/fractions/FractionLaneBoard";
import { MixedNumberView, FractionView } from "@/components/fractions/MixedNumber";
import { NumberChipPad } from "@/components/fractions/NumberChipPad";
import { AnswerWorkspaceImproper, FracSlot } from "@/components/fractions/AnswerWorkspaceImproper";
import { LongMulMini } from "@/components/lcm/LongMulMini";
import { REWARDS, RewardKind } from "@/data/tallyAssets";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { FractionSettingsPanel, FractionSettings } from "@/components/fractions/SettingsPanel";

const MISS_LIMIT = 5;

const objectivesFor = (d: FractionDifficulty) => {
  const base = d === "easy" ? 4 : d === "medium" ? 6 : 8;
  return [
    { reward: "coin" as RewardKind, target: base * 2, collected: 0 },
    { reward: "diamond" as RewardKind, target: Math.max(2, Math.floor(base / 2)), collected: 0 },
    { reward: "crown" as RewardKind, target: 1, collected: 0 },
  ];
};

const FractionsMixedGame = () => {
  const { difficulty = "easy" } = useParams<{ difficulty: FractionDifficulty }>();
  const initialDiff = (["easy", "medium", "hard"].includes(difficulty) ? difficulty : "easy") as FractionDifficulty;
  const navigate = useNavigate();

  const [settings, setSettings] = useState<FractionSettings>({
    difficulty: initialDiff,
    travelSec: TRAVEL_SEC[initialDiff],
    rampSec: LANE_RAMP_SEC[initialDiff],
    initialActiveRows: INITIAL_LANES[initialDiff],
    missLimit: MISS_LIMIT,
  });
  const diff = settings.difficulty;

  const [seconds, setSeconds] = useState(TIMERS[diff]);
  const [num, setNum] = useState("");
  const [den, setDen] = useState("");
  const [focus, setFocus] = useState<FracSlot>("num");
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "ok" | "bad">("idle");

  const opts = useMemo(() => ({
    rows: MAX_LANES[diff],
    initialActiveRows: settings.initialActiveRows,
    rampSec: settings.rampSec,
    travelSec: settings.travelSec,
    missLimit: settings.missLimit,
    spawn: () => pickMixed(diff),
    objectives: objectivesFor(diff),
  }), [diff, settings.initialActiveRows, settings.rampSec, settings.travelSec, settings.missLimit]);

  const runner = useLaneRunner<MixedNumber>(opts);

  const onSettingsChange = useCallback((patch: Partial<FractionSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (patch.difficulty && patch.difficulty !== prev.difficulty) {
        next.travelSec = TRAVEL_SEC[patch.difficulty];
        next.rampSec = LANE_RAMP_SEC[patch.difficulty];
        next.initialActiveRows = INITIAL_LANES[patch.difficulty];
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (runner.status !== "playing") return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [runner.status]);

  const selectedCapsule = selectedRow !== null ? runner.peekRow(selectedRow) : null;

  const clearAnswer = useCallback(() => {
    setNum(""); setDen(""); setFocus("num"); setStatus("idle");
  }, []);

  useEffect(() => { clearAnswer(); }, [selectedCapsule?.id, clearAnswer]);

  const writeDigit = (d: number) => {
    const set = (cur: string, v: number) => (cur + String(v)).slice(0, 4);
    if (focus === "num") setNum((w) => set(w, d));
    else setDen((w) => set(w, d));
    setStatus("idle");
  };

  const backspace = () => {
    if (focus === "num") setNum((w) => w.slice(0, -1));
    else setDen((w) => w.slice(0, -1));
    setStatus("idle");
  };

  const submit = () => {
    if (!selectedCapsule) return;
    const n = parseInt(num || "0", 10);
    const d = parseInt(den || "0", 10);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0 || n <= 0) {
      setStatus("bad");
      return;
    }
    const ok = validateMixedToImproper(selectedCapsule.payload, { num: n, den: d });
    if (ok) {
      setStatus("ok");
      runner.solveCapsule(selectedCapsule.id);
      setTimeout(() => setSelectedRow(null), 250);
    } else {
      setStatus("bad");
      runner.failCapsule(selectedCapsule.id);
      setTimeout(() => setStatus("idle"), 600);
    }
  };

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const lives = Math.max(0, settings.missLimit - runner.misses);

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <SeamlessBackground file="royal-gold.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/80" />

      <header className="relative z-10 flex items-center justify-between gap-3 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <Link to="/games/fractions/mixed-to-improper" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-[10px] uppercase tracking-[0.4em] text-amber-300 font-bold ml-2">Mixed → Improper · {diff}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1">
            {Array.from({ length: settings.missLimit }).map((_, i) => (
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
          <div className="flex items-center gap-1 rounded-lg border border-orange-500/40 bg-orange-500/10 px-2 py-1 text-xs font-black text-orange-200">
            <Flame className="h-3.5 w-3.5" /> x{runner.streak}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-card/60 px-2 py-1">
            {(["coin", "diamond", "crown"] as RewardKind[]).map((k) => {
              const got = runner.objectives.find((o) => o.reward === k);
              return (
                <div key={k} className="flex items-center gap-1">
                  <img src={REWARDS[k].src} alt={k} className="h-4 w-4" />
                  <span className="text-[11px] font-black tabular-nums text-amber-200">
                    {got ? `${got.collected}/${got.target}` : runner.coinsEarned}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => { runner.reset(); setSeconds(TIMERS[diff]); clearAnswer(); setSelectedRow(null); }}
            className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-card/60 px-2 py-1 text-[11px] font-bold hover:border-amber-400/60"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restart
          </button>
          <FractionSettingsPanel settings={settings} onChange={onSettingsChange} />
        </div>
      </header>

      <section className="relative z-10 px-3 sm:px-4 pb-6">
        <div className="max-w-7xl mx-auto space-y-3">
          <FractionLaneBoard
            rows={MAX_LANES[diff]}
            activeRows={runner.activeRows}
            capsules={runner.active}
            selectedRow={selectedRow}
            onSelectRow={(r) => setSelectedRow(r)}
            lastMissAt={runner.lastMissAt}
            renderPayload={(p) => <MixedNumberView whole={p.whole} num={p.num} den={p.den} size="sm" />}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-3">
              {selectedCapsule ? (
                <div className="flex items-center justify-center gap-3 rounded-xl border-2 border-amber-400/40 bg-card/40 p-2 text-amber-200">
                  <span className="text-xs uppercase tracking-widest">Solving</span>
                  <MixedNumberView whole={selectedCapsule.payload.whole} num={selectedCapsule.payload.num} den={selectedCapsule.payload.den} size="md" />
                  <span className="text-xs">→</span>
                  <FractionView num={num || "?"} den={den || "?"} size="md" />
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-amber-400/30 p-3 text-center text-xs text-amber-200/60">
                  Tap an active lane to select the leading mixed number.
                </div>
              )}
              <AnswerWorkspaceImproper
                num={num}
                den={den}
                focus={focus}
                onFocus={setFocus}
                status={status}
              />
              <NumberChipPad
                onDigit={writeDigit}
                onBackspace={backspace}
                onSubmit={submit}
                disabled={!selectedCapsule}
              />
            </div>
            <div>
              {selectedCapsule ? (
                <LongMulMini
                  key={selectedCapsule.id}
                  a={selectedCapsule.payload.whole}
                  b={selectedCapsule.payload.den}
                  onSolved={() => { /* support only — does not auto-fill */ }}
                />
              ) : (
                <div className="rounded-xl border-2 border-dashed border-amber-400/30 p-6 text-center text-xs text-amber-200/60 min-h-[260px] flex items-center justify-center">
                  Long multiplication workspace appears when you select a lane.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Dialog open={runner.status === "gameover"} onOpenChange={(o) => { if (!o) navigate("/games/fractions/mixed-to-improper"); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Game Over</DialogTitle>
            <DialogDescription>
              Solved <strong>{runner.solved}</strong> · Best streak <strong>x{runner.bestStreak}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => { runner.reset(); setSeconds(TIMERS[diff]); clearAnswer(); setSelectedRow(null); }}>
              Play Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={runner.status === "won"} onOpenChange={(o) => { if (!o) navigate("/games/fractions/mixed-to-improper"); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-300" /> Round Cleared!</DialogTitle>
            <DialogDescription>
              All objectives complete · Solved <strong>{runner.solved}</strong> · Best streak <strong>x{runner.bestStreak}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => { runner.reset(); setSeconds(TIMERS[diff]); clearAnswer(); setSelectedRow(null); }}>
              Next Round
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default FractionsMixedGame;
