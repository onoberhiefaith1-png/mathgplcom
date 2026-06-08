import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Timer, Target, Delete, CornerDownLeft } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { cn } from "@/lib/utils";
import { isPrime, pickRoundNumbers, PrimeDifficulty, PRIME_TIMERS } from "@/lib/prime";
import { BIDMAS_REWARD_META, BidmasRewardKind } from "@/lib/bidmasRewards";
import { FlyingRewards, BidmasFlightEvent } from "@/components/bidmas/FlyingRewards";
import { DotGroups } from "@/components/prime/DotGroups";
import { MiniLongDivision } from "@/components/prime/MiniLongDivision";
import { DEFAULT_PRIME_SETTINGS, PrimeSettings, PrimeSettingsPanel } from "@/components/prime/SettingsPanel";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "prime-settings-v1";
const DIFFS: PrimeDifficulty[] = ["easy", "medium", "hard"];
const MAX_SLOTS = 10;

const TILE_REWARD_POOL: BidmasRewardKind[] = ["coin", "diamond", "crown", "heart", "star", "gem"];
const pickTileReward = (n: number, salt: number): BidmasRewardKind => {
  const h = (n * 2654435761 + salt * 97) >>> 0;
  return TILE_REWARD_POOL[h % TILE_REWARD_POOL.length];
};

const PrimeGame = () => {
  const { difficulty: routeDiff } = useParams<{ difficulty?: string }>();
  const navigate = useNavigate();
  const diffFromRoute = (routeDiff && DIFFS.includes(routeDiff as PrimeDifficulty) ? routeDiff : "easy") as PrimeDifficulty;

  const [settings, setSettings] = useState<PrimeSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const base: PrimeSettings = raw ? { ...DEFAULT_PRIME_SETTINGS, ...JSON.parse(raw) } : DEFAULT_PRIME_SETTINGS;
      return { ...base, difficulty: diffFromRoute, roundSec: PRIME_TIMERS[diffFromRoute] };
    } catch { return { ...DEFAULT_PRIME_SETTINGS, difficulty: diffFromRoute, roundSec: PRIME_TIMERS[diffFromRoute] }; }
  });
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {} }, [settings]);

  useEffect(() => { if (settings.difficulty !== diffFromRoute) navigate(`/games/prime/${settings.difficulty}`); /* eslint-disable-next-line */ }, [settings.difficulty]);

  const diff = settings.difficulty;

  const [numbers, setNumbers] = useState<number[]>(() => pickRoundNumbers(diff));
  const [roundSalt, setRoundSalt] = useState(() => Math.floor(Math.random() * 100000));
  const [selection, setSelection] = useState<number[]>([]); // student's prime picks
  const [focused, setFocused] = useState<number | null>(null); // currently testing
  const [divisor, setDivisor] = useState<number>(1);
  const [divisorPristine, setDivisorPristine] = useState(true);
  const [shakeWrong, setShakeWrong] = useState<Set<number>>(new Set());
  const [verifiedDone, setVerifiedDone] = useState<number[]>([]);

  const [lives, setLives] = useState(settings.startingLives);
  const [seconds, setSeconds] = useState(settings.roundSec);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [coins, setCoins] = useState<Record<BidmasRewardKind, number>>(
    () => ({ coin: 0, diamond: 0, heart: 0, crown: 0, star: 0, gem: 0, energy: 0, key: 0 }),
  );
  const [flights, setFlights] = useState<BidmasFlightEvent[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const counterRef = useRef<HTMLDivElement>(null);

  const primesInRound = useMemo(() => numbers.filter(isPrime), [numbers]);
  const goalCount = primesInRound.length;

  const updateSettings = (patch: Partial<PrimeSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      if (patch.startingLives !== undefined) setLives(patch.startingLives);
      if (patch.roundSec !== undefined) setSeconds(patch.roundSec);
      return next;
    });
  };

  const newRound = useCallback(() => {
    setNumbers(pickRoundNumbers(diff));
    setRoundSalt(Math.floor(Math.random() * 100000));
    setSelection([]);
    setFocused(null);
    setDivisor(1);
    setDivisorPristine(true);
    setVerifiedDone([]);
    setShakeWrong(new Set());
    setSeconds(settings.roundSec);
  }, [diff, settings.roundSec]);

  useEffect(() => { newRound(); /* eslint-disable-next-line */ }, [diff]);

  useEffect(() => {
    if (gameOver) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [gameOver]);

  useEffect(() => {
    if (seconds === 0 && !gameOver) {
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

  const flyReward = (n: number, kind: BidmasRewardKind) => {
    const el = document.querySelector(`[data-prime-tile="${n}"]`) as HTMLElement | null;
    const dest = counterRef.current?.getBoundingClientRect();
    const src = el?.getBoundingClientRect();
    if (!src || !dest) return;
    const id = Date.now() + n + Math.floor(Math.random() * 1000);
    setFlights((p) => [...p, {
      id, kind,
      from: { x: src.left + src.width / 2, y: src.top + src.height / 2 },
      to: { x: dest.left + dest.width / 2, y: dest.top + dest.height / 2 },
    }]);
    setCoins((c) => ({ ...c, [kind]: (c[kind] || 0) + 1 }));
  };

  const onTileClick = (n: number) => {
    if (gameOver) return;
    if (verifiedDone.includes(n)) return;
    setFocused(n);
    setDivisor(1);
    setDivisorPristine(true);
    // toggle selection
    setSelection((sel) => {
      if (sel.includes(n)) return sel.filter((x) => x !== n);
      if (sel.length >= MAX_SLOTS) {
        toast({ title: `Max ${MAX_SLOTS} selections` });
        return sel;
      }
      return [...sel, n];
    });
  };

  const pressDigit = (d: number) => {
    if (focused == null) return;
    if (divisorPristine) {
      if (d === 0) return; // divisor cannot start with 0
      setDivisor(d);
      setDivisorPristine(false);
      return;
    }
    const next = divisor * 10 + d;
    if (next >= focused) return; // must be < N
    if (String(next).length > 3) return;
    setDivisor(next);
  };

  const clearDivisor = () => {
    setDivisor(1);
    setDivisorPristine(true);
  };

  const onSubmit = () => {
    if (gameOver) return;
    if (selection.length === 0) {
      toast({ title: "Select numbers first" });
      return;
    }
    const primesSet = new Set(primesInRound);
    const selSet = new Set(selection);
    const allCorrect = selection.every((n) => primesSet.has(n)) && primesSet.size === selSet.size;
    if (allCorrect) {
      // success
      selection.forEach((n) => {
        flyReward(n, pickTileReward(n, roundSalt));
        flyReward(n, "coin");
      });
      setScore((s) => s + 10 * selection.length);
      setStreak((s) => s + 1);
      setVerifiedDone(selection);
      toast({ title: `All ${goalCount} primes found!` });
      setTimeout(newRound, 1200);
    } else {
      // shake wrongs and missing
      const wrong = new Set<number>();
      selection.forEach((n) => { if (!primesSet.has(n)) wrong.add(n); });
      primesInRound.forEach((n) => { if (!selSet.has(n)) wrong.add(n); });
      setShakeWrong(wrong);
      setTimeout(() => setShakeWrong(new Set()), 700);
      setStreak(0);
      decrementLife("Find ALL prime numbers");
    }
  };

  const minStr = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secStr = String(seconds % 60).padStart(2, "0");

  const rangeLabel = diff === "easy" ? "1 – 20" : diff === "medium" ? "21 – 40" : "41 – 2000";
  const tileCols = numbers.length <= 10 ? 5 : 6;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
      <SeamlessBackground file="royal-gold.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/80" />

      <FlyingRewards events={flights} onArrived={(id) => setFlights((p) => p.filter((x) => x.id !== id))} />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <Link to="/games/prime" className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-card/60 px-2 py-1 text-xs font-bold hover:border-amber-400/60">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-card/60 px-2 py-1">
            <Target className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Picks</span>
            <span className="text-xs font-black tabular-nums text-amber-300">{selection.length}</span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-primary/30 bg-card/60 px-2 py-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Lvl</span>
            <span className="text-xs font-black uppercase text-foreground">{diff}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{rangeLabel}</span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1">
            <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
            <span className="text-xs font-black tabular-nums text-rose-200">{lives}/{settings.startingLives}</span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-primary/30 bg-card/60 px-2 py-1 text-xs font-black">
            <Timer className="h-3.5 w-3.5 text-amber-300" /> <span className="tabular-nums">{minStr}:{secStr}</span>
          </div>
          <div ref={counterRef} className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-card/60 px-2 py-1">
            {(["coin", "diamond", "crown", "heart"] as const).map((k, i) => (
              <div key={k} className={cn("flex items-center gap-0.5", i > 0 && "pl-1.5 border-l border-primary/20")}>
                <img src={BIDMAS_REWARD_META[k].src} alt="" className="h-3.5 w-3.5" />
                <span className={cn("text-[11px] font-black tabular-nums", BIDMAS_REWARD_META[k].tint)}>{coins[k] || 0}</span>
              </div>
            ))}
          </div>
          <PrimeSettingsPanel settings={settings} onChange={updateSettings} />
        </div>
      </header>

      <section className="relative z-10 px-3 sm:px-4 pb-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-3">
            <p className="text-[9px] uppercase tracking-[0.4em] text-amber-300 font-bold">Question</p>
            <h2 className="text-lg sm:text-xl font-black tracking-wide">
              Find ALL <span className="text-amber-300 drop-shadow-[0_0_12px_hsl(45_95%_60%/0.6)]">prime</span> numbers
            </h2>
          </div>

          <div className="grid gap-3 grid-cols-4">
            {/* tile grid — 3/4 */}
            <div className="col-span-3 rounded-xl border-2 border-primary/30 bg-card/40 p-2 backdrop-blur">
              <div className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${tileCols}, minmax(0, 1fr))` }}>
                {numbers.map((n) => {
                  const isSelected = selection.includes(n);
                  const isFocused = focused === n;
                  const isDone = verifiedDone.includes(n);
                  const isShake = shakeWrong.has(n);
                  const reward = pickTileReward(n, roundSalt);
                  return (
                    <button
                      key={n}
                      data-prime-tile={n}
                      onClick={() => onTileClick(n)}
                      disabled={isDone}
                      className={cn(
                        "relative aspect-square rounded-md border flex items-center justify-center p-0.5 transition-all duration-200",
                        "hover:scale-[1.04] hover:-translate-y-0.5",
                        !isSelected && !isFocused && !isDone && "border-primary/30 bg-card/60",
                        isSelected && !isDone && "border-amber-400 bg-amber-500/15 shadow-[0_0_14px_hsl(45_95%_60%/0.5)]",
                        isFocused && !isDone && "ring-2 ring-amber-300 animate-soft-pulse",
                        isDone && "border-emerald-400 bg-emerald-500/15 shadow-[0_0_14px_hsl(150_70%_50%/0.6)]",
                        isShake && "border-rose-500 bg-rose-500/20 animate-[shake_0.5s_ease-in-out]",
                      )}
                    >
                      <img
                        src={BIDMAS_REWARD_META[reward].src}
                        alt=""
                        aria-hidden
                        className={cn(
                          "absolute inset-0 m-auto h-2/3 w-2/3 object-contain pointer-events-none",
                          isDone ? "opacity-0" : "opacity-15",
                        )}
                      />
                      <span className={cn(
                        "relative text-base sm:text-lg font-black tabular-nums drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]",
                        isDone ? "text-emerald-200" : "text-foreground",
                      )}>{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* testing panel — 1/4 */}
            <aside className="col-span-1 rounded-xl border-2 border-amber-400/50 bg-card/60 p-2 backdrop-blur min-h-[280px] text-[11px]">
              {focused == null ? (
                <div className="flex h-full min-h-[260px] items-center justify-center text-center text-muted-foreground px-2">
                  Tap a number to test or select.
                </div>
              ) : (
                <>
                  <div className="text-center mb-2">
                    <div className="text-[9px] uppercase tracking-[0.3em] text-amber-300 font-bold">Testing</div>
                    <div className="text-base font-black tabular-nums">
                      {focused} ÷ <span className="text-amber-300">{divisor}</span>
                    </div>
                  </div>

                  {focused <= 30 ? (
                    <DotGroups n={focused} divisor={divisor} />
                  ) : (
                    <MiniLongDivision n={focused} divisor={divisor} />
                  )}
                </>
              )}
            </aside>
          </div>

          {/* Bottom card: Primes Found slots + digit pad */}
          <div className="mt-3 rounded-2xl border-2 border-emerald-500/40 bg-card/40 p-3 backdrop-blur">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Picks */}
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-300 font-bold text-center mb-2">
                  Your Picks · {selection.length}/{MAX_SLOTS}
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {Array.from({ length: MAX_SLOTS }).map((_, i) => {
                    const n = selection[i];
                    return (
                      <div key={i} className={cn(
                        "h-9 w-9 sm:h-10 sm:w-10 rounded-md border-2 flex items-center justify-center font-black text-sm tabular-nums transition-all",
                        n != null
                          ? "border-amber-400 bg-amber-500/20 text-amber-200 shadow-[0_0_10px_hsl(45_95%_60%/0.4)]"
                          : "border-primary/20 bg-background/30 text-muted-foreground/40",
                      )}>{n ?? "·"}</div>
                    );
                  })}
                </div>
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  Score: <span className="text-amber-300 font-bold tabular-nums">{score}</span> · Streak: <span className="text-emerald-300 font-bold tabular-nums">{streak}</span>
                </p>
              </div>

              {/* Digit pad + submit */}
              <div className="flex flex-col gap-2">
                <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300 font-bold text-center">
                  Divisor pad
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {Array.from({ length: 10 }).map((_, d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => pressDigit(d)}
                      disabled={focused == null}
                      className={cn(
                        "h-9 sm:h-10 rounded-lg border-2 border-primary/40 bg-gradient-to-b from-card to-card/70",
                        "font-black text-base sm:text-lg tabular-nums text-foreground",
                        "hover:border-amber-400 hover:scale-105 hover:shadow-[0_0_10px_hsl(45_95%_60%/0.4)] transition-all",
                        "active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={clearDivisor}
                    disabled={focused == null}
                    className="flex-1 rounded-lg border-2 border-primary/30 bg-card/60 px-2 py-1.5 text-[11px] font-bold hover:border-amber-400/60 inline-flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <Delete className="h-3.5 w-3.5" /> Clear
                  </button>
                  <button
                    onClick={onSubmit}
                    className="flex-[2] rounded-lg bg-emerald-500/90 px-2 py-1.5 text-xs font-black text-background hover:bg-emerald-400 inline-flex items-center justify-center gap-1 shadow-[0_0_14px_hsl(150_70%_50%/0.5)]"
                  >
                    <CornerDownLeft className="h-3.5 w-3.5" /> SUBMIT
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={gameOver} onOpenChange={(o) => { if (!o) { setGameOver(false); setLives(settings.startingLives); newRound(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Out of lives</DialogTitle>
            <DialogDescription>Score: {score}. Take a breath and try again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate("/games/prime")}>Back</Button>
            <Button onClick={() => { setGameOver(false); setLives(settings.startingLives); setScore(0); setStreak(0); newRound(); }}>Play Again</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default PrimeGame;
