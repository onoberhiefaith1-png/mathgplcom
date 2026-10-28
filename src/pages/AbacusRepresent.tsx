import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Coins, Diamond, Heart, RotateCcw, Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import SeamlessBackground from "@/components/SeamlessBackground";
import { Abacus, AbacusDigits } from "@/components/abacus/Abacus";
import { AbacusGate } from "@/components/abacus/AbacusGate";
import { TimerBar } from "@/components/abacus/TimerBar";
import { TreasureBurst, TreasureBurstItem, TreasureKind } from "@/components/abacus/TreasureBurst";
import { AbacusObjective, AbacusObjectivesPanel } from "@/components/abacus/ObjectivesPanel";
import { AbacusSettingsPanel, AbacusSettings, DEFAULT_SETTINGS } from "@/components/abacus/SettingsPanel";
import { sfxClick, sfxError, sfxSuccess } from "@/components/abacus/abacusSfx";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Difficulty = "easy" | "medium" | "hard";

const DIFFS: Record<Difficulty, { label: string; min: number; max: number; rods: { th: boolean; h: boolean; t: boolean; u: boolean } }> = {
  easy: { label: "Easy", min: 1, max: 99, rods: { th: false, h: false, t: true, u: true } },
  medium: { label: "Medium", min: 100, max: 999, rods: { th: false, h: true, t: true, u: true } },
  hard: { label: "Hard", min: 1000, max: 9999, rods: { th: true, h: true, t: true, u: true } },
};

const ZERO: AbacusDigits = { th: 0, h: 0, t: 0, u: 0 };

const numberToDigits = (n: number): AbacusDigits => ({
  th: Math.floor(n / 1000) % 10,
  h: Math.floor(n / 100) % 10,
  t: Math.floor(n / 10) % 10,
  u: n % 10,
});
const digitsToNumber = (d: AbacusDigits) => d.th * 1000 + d.h * 100 + d.t * 10 + d.u;
const randTarget = (d: Difficulty) => {
  const { min, max } = DIFFS[d];
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const buildObjectives = (level: number, scale: number): AbacusObjective[] => {
  const m = scale;
  return [
    { kind: "coin", collected: 0, target: Math.max(3, Math.round((6 + level * 2) * m)) },
    { kind: "diamond", collected: 0, target: Math.max(1, Math.round((2 + level) * m)) },
    { kind: "gold", collected: 0, target: Math.max(1, Math.round((1 + Math.floor(level / 2)) * m)) },
  ];
};

const pickTreasure = (s: AbacusSettings): TreasureKind => {
  const total = s.coinWeight + s.diamondWeight + s.goldWeight + s.gemWeight || 1;
  let r = Math.random() * total;
  if ((r -= s.coinWeight) < 0) return "coin";
  if ((r -= s.diamondWeight) < 0) return "diamond";
  if ((r -= s.goldWeight) < 0) return "gold";
  return "gem";
};

const AbacusRepresent = () => {
  const navigate = useNavigate();
  const params = useParams<{ difficulty?: string }>();
  const difficulty: Difficulty = (params.difficulty as Difficulty) || "easy";
  const cfg = DIFFS[difficulty] ?? DIFFS.easy;

  const [settings, setSettings] = useState<AbacusSettings>(DEFAULT_SETTINGS);
  const [level, setLevel] = useState(1);
  const [target, setTarget] = useState<number>(() => randTarget(difficulty));
  const [digits, setDigits] = useState<AbacusDigits>(ZERO);
  const [history, setHistory] = useState<AbacusDigits[]>([]);
  const [wrongCols, setWrongCols] = useState<Partial<Record<keyof AbacusDigits, boolean>>>({});
  const [gateOpen, setGateOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(DEFAULT_SETTINGS.startingLives);
  const [objectives, setObjectives] = useState<AbacusObjective[]>(() => buildObjectives(1, 1));
  const [diamondsBag, setDiamondsBag] = useState(0);
  const [walletCoins, setWalletCoins] = useState<number>(() => Number(localStorage.getItem("tally_coins") || 0));
  const [userId, setUserId] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [levelComplete, setLevelComplete] = useState(false);
  const [paused, setPaused] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const lastSyncedRef = useRef(walletCoins);

  const [bursts, setBursts] = useState<TreasureBurstItem[]>([]);
  const burstIdRef = useRef(1);
  const gateRef = useRef<HTMLDivElement | null>(null);
  const coinHudRef = useRef<HTMLDivElement | null>(null);
  const diamondHudRef = useRef<HTMLDivElement | null>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  // Auth + wallet sync
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        supabase.from("player_stats").select("coins").eq("user_id", uid).maybeSingle()
          .then(({ data }) => { if (data?.coins != null) setWalletCoins(data.coins); });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    localStorage.setItem("tally_coins", String(walletCoins));
    if (!userId || walletCoins === lastSyncedRef.current) return;
    const t = setTimeout(() => {
      supabase.from("player_stats").upsert({ user_id: userId, coins: walletCoins, updated_at: new Date().toISOString() })
        .then(() => { lastSyncedRef.current = walletCoins; });
    }, 1500);
    return () => clearTimeout(t);
  }, [walletCoins, userId]);

  // Validate difficulty param
  useEffect(() => {
    if (!params.difficulty || !(params.difficulty in DIFFS)) {
      navigate("/subjects/algebra/numbers-and-numerals/abacus", { replace: true });
    }
  }, [params.difficulty, navigate]);

  const updateSettings = useCallback((p: Partial<AbacusSettings>) => setSettings((s) => ({ ...s, ...p })), []);

  const handleChange = useCallback((next: AbacusDigits) => {
    setHistory((h) => [...h, digits]);
    setDigits(next);
    setWrongCols({});
    sfxClick();
  }, [digits]);

  const handleUndo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      setDigits(h[h.length - 1]);
      return h.slice(0, -1);
    });
    setWrongCols({});
  };
  const handleReset = () => {
    setHistory((h) => [...h, digits]);
    setDigits(ZERO);
    setWrongCols({});
  };

  const nextTarget = useCallback(() => {
    setDigits(ZERO);
    setHistory([]);
    setWrongCols({});
    setTarget(randTarget(difficulty));
    setResetKey((k) => k + 1);
  }, [difficulty]);

  const spawnTreasures = (count: number) => {
    if (gateRef.current) {
      const r = gateRef.current.getBoundingClientRect();
      setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
    const newItems: TreasureBurstItem[] = [];
    const updates: Partial<Record<TreasureKind, number>> = {};
    for (let i = 0; i < count; i++) {
      const kind = pickTreasure(settings);
      updates[kind] = (updates[kind] || 0) + 1;
      const targetEl = kind === "diamond" ? diamondHudRef.current : coinHudRef.current;
      const tr = targetEl?.getBoundingClientRect();
      newItems.push({
        id: burstIdRef.current++,
        kind,
        to: tr ? { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 } : { x: window.innerWidth / 2, y: 60 },
      });
    }
    setBursts((b) => [...b, ...newItems]);

    // Apply rewards after a short delay (matches flight)
    setTimeout(() => {
      const coinsGained = (updates.coin || 0) * 1 + (updates.gold || 0) * 5 + (updates.gem || 0) * 3;
      const diamondsGained = (updates.diamond || 0);
      if (coinsGained) setWalletCoins((c) => c + coinsGained);
      if (diamondsGained) setDiamondsBag((d) => d + diamondsGained);
      // Update objectives
      setObjectives((objs) => {
        const updated = objs.map((o) => ({ ...o, collected: o.collected + (updates[o.kind] || 0) }));
        if (updated.every((o) => o.collected >= o.target)) {
          setPaused(true);
          setLevelComplete(true);
        }
        return updated;
      });
    }, 900);
    // cleanup old bursts
    setTimeout(() => setBursts((b) => b.slice(-30)), 2000);
  };

  const handleSubmit = () => {
    if (paused) return;
    const current = digitsToNumber(digits);
    if (current === target) {
      sfxSuccess();
      setGateOpen(true);
      const reward = 10 + streak * 2;
      setScore((s) => s + reward);
      setStreak((s) => s + 1);
      // Treasure count scales with target magnitude + streak
      const tCount = 5 + Math.min(8, Math.floor(target / 50)) + Math.min(5, streak);
      spawnTreasures(tCount);
      toast({ title: "Gate opened!", description: `You built ${target.toLocaleString()} (+${reward})` });
      setTimeout(() => {
        setGateOpen(false);
        nextTarget();
      }, 1300);
    } else {
      sfxError();
      const tgt = numberToDigits(target);
      const wc: Partial<Record<keyof AbacusDigits, boolean>> = {};
      (["th", "h", "t", "u"] as const).forEach((k) => {
        if (tgt[k] !== digits[k]) wc[k] = true;
      });
      setWrongCols(wc);
      setStreak(0);
    }
  };

  const handleTimeout = useCallback(() => {
    if (paused || gateOpen) return;
    sfxError();
    setStreak(0);
    setLives((l) => {
      const nl = l - 1;
      if (nl <= 0) {
        setPaused(true);
        setGameOver(true);
      }
      return nl;
    });
    if (lives - 1 > 0) {
      toast({ title: "Time's up!", description: "Lost a life — new number coming." });
      nextTarget();
    }
  }, [paused, gateOpen, lives, nextTarget]);

  const advanceLevel = () => {
    setLevel((l) => l + 1);
    setObjectives(buildObjectives(level + 1, settings.objectiveScale));
    setLevelComplete(false);
    setPaused(false);
    nextTarget();
  };
  const restart = () => {
    setLevel(1);
    setScore(0);
    setStreak(0);
    setLives(settings.startingLives);
    setObjectives(buildObjectives(1, settings.objectiveScale));
    setDiamondsBag(0);
    setGameOver(false);
    setPaused(false);
    nextTarget();
  };

  const current = digitsToNumber(digits);
  const enabled = cfg.rods;

  const correctFlash = gateOpen;

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <SeamlessBackground file="obsidian.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/70" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-3 p-3 sm:p-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-card/60 px-3 py-2 backdrop-blur">
          <Link to="/subjects/algebra/numbers-and-numerals/abacus" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-3 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mode</div>
              <div className="text-sm font-bold capitalize">{cfg.label}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Level</div>
              <div className="text-sm font-bold text-primary">{level}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm font-bold">
            <span ref={coinHudRef} className="inline-flex items-center gap-1"><Coins className="h-4 w-4 text-yellow-400" />{walletCoins}</span>
            <span ref={diamondHudRef} className="inline-flex items-center gap-1"><Diamond className="h-4 w-4 text-cyan-300" />{diamondsBag}</span>
            <span className="inline-flex items-center gap-1"><Heart className="h-4 w-4 text-rose-500" />{lives}</span>
            <AbacusSettingsPanel settings={settings} onChange={updateSettings} />
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[230px_1fr_230px]">
          {/* Left: Objectives */}
          <aside className="flex flex-col gap-3">
            <div className="rounded-lg border-2 border-yellow-500/50 bg-card/70 p-3 backdrop-blur text-center">
              <div className="text-xs font-bold uppercase tracking-wider text-yellow-500 mb-1">Target</div>
              <div className="text-4xl font-black tabular-nums">{target.toLocaleString()}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">Build this with the abacus to open the gate.</p>
            </div>
            <AbacusObjectivesPanel objectives={objectives} />
          </aside>

          {/* Center: Gate + Abacus */}
          <div className="flex flex-col items-center justify-start gap-3">
            <div className="w-full max-w-md">
              <TimerBar durationSec={settings.roundSec} resetKey={resetKey} paused={paused || gateOpen} onExpire={handleTimeout} />
            </div>
            <div ref={gateRef} className="relative">
              <AbacusGate open={gateOpen}>
                <Abacus
                  digits={digits}
                  enabled={enabled}
                  wrongCols={wrongCols}
                  correct={correctFlash}
                  onChange={handleChange}
                />
              </AbacusGate>
            </div>
          </div>

          {/* Right: Current + actions */}
          <aside className="flex flex-col gap-3">
            <div className="rounded-lg border bg-card/60 p-3 backdrop-blur text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current</div>
              <div className={cn("text-4xl font-black tabular-nums", gateOpen ? "text-emerald-400" : "text-amber-300")}>
                {current.toLocaleString()}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Streak <span className="font-black text-orange-400">{streak}</span> · Score <span className="font-black text-primary">{score}</span></div>
            </div>
            <Button onClick={handleSubmit} disabled={paused} size="lg" className="w-full text-base font-bold">
              <Send className="h-5 w-5 mr-2" /> Open Gate
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleUndo} disabled={!history.length || paused}>
                <Undo2 className="h-4 w-4 mr-1" /> Undo
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={paused}>
                <RotateCcw className="h-4 w-4 mr-1" /> Reset
              </Button>
            </div>
          </aside>
        </div>
      </div>

      <TreasureBurst origin={origin} items={bursts} />

      {/* Level complete */}
      <Dialog open={levelComplete} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Level {level} Complete!</DialogTitle>
            <DialogDescription>All objectives collected. The treasure flows on…</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={advanceLevel}>Next Level →</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Game over */}
      <Dialog open={gameOver} onOpenChange={(o) => { if (!o) navigate("/subjects/algebra/numbers-and-numerals/abacus"); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Game Over</DialogTitle>
            <DialogDescription>Final score: <strong>{score}</strong> · Reached level <strong>{level}</strong></DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => navigate("/subjects/algebra/numbers-and-numerals/abacus")}>Back</Button>
            <Button onClick={restart}>Play Again</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AbacusRepresent;
