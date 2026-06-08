import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Timer } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { BIDMAS_REWARD_META, BidmasRewardKind } from "@/lib/bidmasRewards";
import { FlyingRewards, BidmasFlightEvent } from "@/components/bidmas/FlyingRewards";
import { PFDifficulty, PF_LIVES, PF_TIMERS, getPrimeFactors, isPrime, pickFactorizable } from "@/lib/primeFactors";
import { DEFAULT_PF_SETTINGS, PFSettings, PFSettingsPanel } from "@/components/primefactors/SettingsPanel";
import { PFRow, PrimeFactorTable } from "@/components/primefactors/PrimeFactorTable";
import { LongDivisionScratchpad } from "@/components/primefactors/LongDivisionScratchpad";
import { PrimeToolbar } from "@/components/primefactors/PrimeToolbar";
import { IndexChip, IndexChipBuilder } from "@/components/primefactors/IndexChipBuilder";

const STORAGE_KEY = "prime-factors-settings-v1";
const DIFFS: PFDifficulty[] = ["easy", "medium", "hard"];

const PrimeFactorsGame = () => {
  const { difficulty: routeDiff } = useParams<{ difficulty?: string }>();
  const navigate = useNavigate();
  const diffFromRoute = (routeDiff && DIFFS.includes(routeDiff as PFDifficulty) ? routeDiff : "easy") as PFDifficulty;

  const [settings, setSettings] = useState<PFSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const base: PFSettings = raw ? { ...DEFAULT_PF_SETTINGS, ...JSON.parse(raw) } : DEFAULT_PF_SETTINGS;
      return { ...base, difficulty: diffFromRoute, roundSec: PF_TIMERS[diffFromRoute], startingLives: PF_LIVES[diffFromRoute] };
    } catch { return { ...DEFAULT_PF_SETTINGS, difficulty: diffFromRoute, roundSec: PF_TIMERS[diffFromRoute], startingLives: PF_LIVES[diffFromRoute] }; }
  });
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {} }, [settings]);
  useEffect(() => { if (settings.difficulty !== diffFromRoute) navigate(`/games/prime-factors/${settings.difficulty}`); /* eslint-disable-next-line */ }, [settings.difficulty]);

  const diff = settings.difficulty;

  const [target, setTarget] = useState<number>(() => pickFactorizable(diff));
  const [rows, setRows] = useState<PFRow[]>(() => [{ prime: null, dividend: target, locked: false }]);
  const [activeRowIdx, setActiveRowIdx] = useState(0);
  const [currentPrime, setCurrentPrime] = useState<number | null>(null);
  const [phase, setPhase] = useState<"factor" | "index" | "round-done">("factor");
  const [chips, setChips] = useState<IndexChip[]>([]);

  const [lives, setLives] = useState(settings.startingLives);
  const [seconds, setSeconds] = useState(settings.roundSec);
  const [coins, setCoins] = useState<Record<BidmasRewardKind, number>>(
    () => ({ coin: 0, diamond: 0, heart: 0, crown: 0, star: 0, gem: 0, energy: 0, key: 0 }),
  );
  const [flights, setFlights] = useState<BidmasFlightEvent[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const counterRef = useRef<HTMLDivElement>(null);
  const flightIdRef = useRef(1);

  const allFactors = useMemo(() => getPrimeFactors(target), [target]);

  const newRound = useCallback(() => {
    const t = pickFactorizable(diff);
    setTarget(t);
    setRows([{ prime: null, dividend: t, locked: false }]);
    setActiveRowIdx(0);
    setCurrentPrime(null);
    setChips([]);
    setPhase("factor");
    setSeconds(settings.roundSec);
  }, [diff, settings.roundSec]);

  useEffect(() => { newRound(); /* eslint-disable-next-line */ }, [diff]);

  useEffect(() => {
    if (gameOver || phase === "round-done") return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [gameOver, phase]);

  useEffect(() => {
    if (seconds === 0 && !gameOver && phase !== "round-done") {
      decrementLife("Time's up!");
      setTimeout(newRound, 800);
    }
    // eslint-disable-next-line
  }, [seconds]);

  const decrementLife = (msg: string) => {
    setLives((l) => {
      const nl = Math.max(0, l - 1);
      if (nl === 0) setGameOver(true);
      return nl;
    });
    toast({ title: msg });
  };

  const flyFromPoint = (from: { x: number; y: number }, kind: BidmasRewardKind) => {
    const dest = counterRef.current?.getBoundingClientRect();
    if (!dest) {
      setCoins((c) => ({ ...c, [kind]: (c[kind] || 0) + 1 }));
      return;
    }
    const id = flightIdRef.current++;
    setFlights((p) => [...p, {
      id, kind,
      from,
      to: { x: dest.left + dest.width / 2, y: dest.top + dest.height / 2 },
    }]);
  };

  const flyFromSelector = (selector: string, kind: BidmasRewardKind) => {
    const el = document.querySelector(selector) as HTMLElement | null;
    const r = el?.getBoundingClientRect();
    if (!r) { setCoins((c) => ({ ...c, [kind]: (c[kind] || 0) + 1 })); return; }
    flyFromPoint({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, kind);
  };

  // ─── Prime toolbar handler ─────────────────────────────────────────
  const handlePickPrime = (p: number): boolean => {
    if (phase === "factor") {
      const row = rows[activeRowIdx];
      if (!row || row.locked) return false;
      if (row.dividend % p !== 0) return false; // shake
      setCurrentPrime(p);
      setRows((rs) => rs.map((r, i) => i === activeRowIdx ? { ...r, prime: p } : r));
      flyFromSelector(`[data-pf-row="${activeRowIdx}"]`, "coin");
      return true;
    }
    if (phase === "index") {
      // Add chip or bump power
      setChips((cs) => {
        const exists = cs.find((c) => c.prime === p);
        if (exists) return cs.map((c) => c.prime === p ? { ...c, power: c.power + 1 } : c);
        return [...cs, { prime: p, power: 1 }].sort((a, b) => a.prime - b.prime);
      });
      return true;
    }
    return false;
  };

  // ─── Long division solved → advance row ────────────────────────────
  const handleSolved = (quotient: number) => {
    if (phase !== "factor") return;
    const row = rows[activeRowIdx];
    if (!row || currentPrime == null) return;

    // Lock the row, fly a coin reward
    setRows((rs) => {
      const next = rs.map((r, i) => i === activeRowIdx ? { ...r, prime: currentPrime, locked: true } : r);
      next.push({ prime: null, dividend: quotient, locked: quotient === 1 });
      return next;
    });
    flyFromSelector(`[data-pf-row="${activeRowIdx}"]`, "coin");

    if (quotient === 1) {
      // Factor phase done
      setPhase("index");
      setCurrentPrime(null);
      toast({ title: "Now build the index notation!", description: "Tap primes from the toolbar." });
    } else {
      setActiveRowIdx((i) => i + 1);
      setCurrentPrime(null);
    }
  };

  const handleIndexCorrect = (positions: { x: number; y: number }[]) => {
    // Burst rewards from each chip position
    const kinds: BidmasRewardKind[] = ["coin", "diamond", "crown", "star", "gem"];
    positions.forEach((pos, i) => {
      for (let k = 0; k < 3; k++) {
        const p = { x: pos.x + (Math.random() - 0.5) * 20, y: pos.y + (Math.random() - 0.5) * 20 };
        flyFromPoint(p, kinds[(i + k) % kinds.length]);
      }
    });
    toast({ title: `🎉 ${target} fully factored!` });
    setPhase("round-done");
    setTimeout(newRound, 2000);
  };

  const updateSettings = (patch: Partial<PFSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      if (patch.startingLives !== undefined) setLives(patch.startingLives);
      if (patch.roundSec !== undefined) setSeconds(patch.roundSec);
      return next;
    });
  };

  const minStr = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secStr = String(seconds % 60).padStart(2, "0");

  const activeRow = rows[activeRowIdx];
  const scratchpadDividend = activeRow?.dividend ?? target;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
      <SeamlessBackground file="royal-gold.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/85" />
      <FlyingRewards events={flights} onArrived={(id, kind) => {
        setFlights((p) => p.filter((x) => x.id !== id));
        setCoins((c) => ({ ...c, [kind]: (c[kind] || 0) + 1 }));
      }} />

      {/* TOP BAR */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 border-b border-primary/20 bg-card/40 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link to="/games/prime-factors" className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-card/60 px-2 py-1 text-xs font-bold hover:border-amber-400/60">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <div>
            <h1 className="text-sm sm:text-base font-black uppercase tracking-wider leading-none">
              PRIME <span className="text-amber-400">FACTORS</span> <span className="text-cyan-300">LAB</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground leading-none mt-0.5">
              Find the prime factors of <span className="text-amber-300 font-black tabular-nums">{target}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div ref={counterRef} className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-card/60 px-2 py-1">
            {(["coin", "diamond", "crown"] as const).map((k, i) => (
              <div key={k} className={cn("flex items-center gap-0.5", i > 0 && "pl-1.5 border-l border-primary/20")}>
                <img src={BIDMAS_REWARD_META[k].src} alt="" className="h-3.5 w-3.5" />
                <span className={cn("text-[11px] font-black tabular-nums", BIDMAS_REWARD_META[k].tint)}>{coins[k] || 0}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1">
            <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
            <span className="text-xs font-black tabular-nums text-rose-200">{lives}</span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-primary/30 bg-card/60 px-2 py-1 text-xs font-black">
            <Timer className="h-3.5 w-3.5 text-amber-300" /> <span className="tabular-nums">{minStr}:{secStr}</span>
          </div>
          <PFSettingsPanel settings={settings} onChange={updateSettings} />
        </div>
      </header>

      {/* MAIN GRID — 4 sections */}
      <section className="relative z-10 px-3 sm:px-4 py-3 max-w-7xl mx-auto">
        <div className="grid gap-3 md:grid-cols-2">
          {/* §1 Prime Division Table */}
          <div>
            <PrimeFactorTable
              target={target}
              rows={rows}
              activeRowIdx={activeRowIdx}
              finished={phase !== "factor"}
            />
          </div>

          {/* §2 Division Workspace */}
          <div>
            <LongDivisionScratchpad
              key={`${activeRowIdx}-${scratchpadDividend}-${currentPrime ?? "x"}`}
              dividend={scratchpadDividend}
              divisor={phase === "factor" ? currentPrime : null}
              onSolved={handleSolved}
              onDigitCorrect={(pos, kind) => flyFromPoint(pos, kind as BidmasRewardKind)}
            />
          </div>

          {/* §3 Prime Toolbar */}
          <div>
            <PrimeToolbar
              onPick={handlePickPrime}
              disabled={phase === "round-done"}
              title={phase === "index" ? "Tap primes to build the answer" : "Select a prime number"}
            />
          </div>

          {/* §4 Index Notation Builder */}
          <div>
            <IndexChipBuilder
              factors={allFactors}
              active={phase === "index"}
              chips={chips}
              onChipsChange={setChips}
              onCorrect={handleIndexCorrect}
            />
          </div>
        </div>
      </section>

      <Dialog open={gameOver} onOpenChange={(o) => { if (!o) { setGameOver(false); setLives(settings.startingLives); newRound(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Out of lives</DialogTitle>
            <DialogDescription>Take a breath and try again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate("/games/prime-factors")}>Back</Button>
            <Button onClick={() => { setGameOver(false); setLives(settings.startingLives); newRound(); }}>Play Again</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default PrimeFactorsGame;
