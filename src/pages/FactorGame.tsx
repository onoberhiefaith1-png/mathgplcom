import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, Heart, Timer, RotateCcw, CornerDownLeft, Users, Divide as DivideIcon } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { cn } from "@/lib/utils";
import { FactorDifficulty, FACTOR_TIMERS, computeFactors, factorPairs, pickTarget } from "@/lib/factors";
import { BidmasRewardKind, BIDMAS_REWARD_META } from "@/lib/bidmasRewards";
import { FlyingRewards, BidmasFlightEvent } from "@/components/bidmas/FlyingRewards";
import { FactorSettingsPanel, DEFAULT_FACTOR_SETTINGS, FactorSettings } from "@/components/factors/SettingsPanel";
import { toast } from "@/hooks/use-toast";

type TileState = "idle" | "selected" | "verified" | "wrong";
const MAX_LIVES = 5;

const REWARD_CYCLE: BidmasRewardKind[] = ["coin", "diamond", "crown", "heart", "coin", "diamond"];
const tileReward = (n: number): BidmasRewardKind => REWARD_CYCLE[n % REWARD_CYCLE.length];

const GROUP_COLORS = [
  "bg-rose-400", "bg-emerald-400", "bg-sky-400", "bg-amber-400",
  "bg-fuchsia-400", "bg-violet-400", "bg-orange-400", "bg-teal-400",
  "bg-pink-400", "bg-lime-400",
];

const FactorGame = () => {
  const { difficulty = "easy" } = useParams<{ difficulty: FactorDifficulty }>();
  const diff = (["easy", "medium", "hard"].includes(difficulty) ? difficulty : "easy") as FactorDifficulty;
  const allowGrouping = diff !== "hard";

  const [settings, setSettings] = useState<FactorSettings>({ ...DEFAULT_FACTOR_SETTINGS, difficulty: diff, roundSec: FACTOR_TIMERS[diff] });
  const [target, setTarget] = useState<number>(() => pickTarget(diff));
  const [lives, setLives] = useState(settings.startingLives);
  const [seconds, setSeconds] = useState(settings.roundSec);
  const [tested, setTested] = useState<Record<number, TileState>>({});
  const [verifiedFactors, setVerifiedFactors] = useState<number[]>([]);
  const [wrongTested, setWrongTested] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<"group" | "division">(allowGrouping ? "group" : "division");
  const [coins, setCoins] = useState<Record<BidmasRewardKind, number>>(
    () => ({ coin: 0, diamond: 0, heart: 0, crown: 0, star: 0, gem: 0, energy: 0, key: 0 }),
  );
  const [flights, setFlights] = useState<BidmasFlightEvent[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const counterRef = useRef<HTMLDivElement>(null);

  const effectiveDiff = settings.difficulty;
  const effectiveAllowGrouping = effectiveDiff !== "hard";

  const correctFactors = useMemo(() => computeFactors(target), [target]);
  const allPairs = useMemo(() => factorPairs(target), [target]);

  const goals = { coin: 30, diamond: 6, crown: 4, heart: 4 } as Partial<Record<BidmasRewardKind, number>>;

  const updateSettings = (patch: Partial<FactorSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      if (patch.startingLives !== undefined) setLives(patch.startingLives);
      if (patch.roundSec !== undefined) setSeconds(patch.roundSec);
      return next;
    });
  };


  const newRound = useCallback(() => {
    setTarget(pickTarget(effectiveDiff));
    setTested({});
    setVerifiedFactors([]);
    setWrongTested([]);
    setSelected(null);
    setSeconds(settings.roundSec);
    setMode(effectiveAllowGrouping ? "group" : "division");
  }, [effectiveDiff, effectiveAllowGrouping, settings.roundSec]);

  useEffect(() => { newRound(); }, [effectiveDiff]);

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

  // auto-advance when all factors found
  useEffect(() => {
    if (verifiedFactors.length === correctFactors.length && verifiedFactors.length > 0) {
      toast({ title: `All ${correctFactors.length} factors of ${target} found!` });
      setTimeout(newRound, 1200);
    }
    // eslint-disable-next-line
  }, [verifiedFactors, correctFactors]);

  const decrementLife = (msg: string) => {
    setLives((l) => {
      const nl = Math.max(0, l - 1);
      if (nl === 0) setGameOver(true);
      return nl;
    });
    toast({ title: msg });
  };

  const onTileClick = (n: number) => {
    if (gameOver) return;
    const st = tested[n];
    if (st === "verified" || st === "wrong") return;
    setSelected(n);
  };

  const flyReward = (n: number, kind: BidmasRewardKind) => {
    const el = document.querySelector(`[data-factor-tile="${n}"]`) as HTMLElement | null;
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

  const onConfirm = () => {
    if (selected == null || gameOver) return;
    const n = selected;
    if (target % n === 0) {
      setTested((t) => ({ ...t, [n]: "verified" }));
      setVerifiedFactors((v) => v.includes(n) ? v : [...v, n]);
      flyReward(n, tileReward(n));
      // a coin always
      flyReward(n, "coin");
      setSelected(null);
    } else {
      setTested((t) => ({ ...t, [n]: "wrong" }));
      setWrongTested((w) => w.includes(n) ? w : [...w, n]);
      decrementLife("Not a factor");
      setTimeout(() => setSelected(null), 600);
    }
  };

  // Pair slots: render allPairs; show only verified halves filled
  const pairSlots = useMemo(() => allPairs.map(([a, b]) => {
    const aDone = verifiedFactors.includes(a);
    const bDone = verifiedFactors.includes(b);
    return { a, b, aDone, bDone };
  }), [allPairs, verifiedFactors]);

  // Visual grouping
  const groupingView = useMemo(() => {
    if (selected == null) return null;
    const n = selected;
    const groups = Math.floor(target / n);
    const remainder = target % n;
    const dotsPerGroup = n;
    return { n, groups, remainder, dotsPerGroup };
  }, [selected, target]);

  // long division
  const longDivisionView = useMemo(() => {
    if (selected == null) return null;
    const n = selected;
    const q = Math.floor(target / n);
    const product = q * n;
    const remainder = target - product;
    return { n, q, product, remainder };
  }, [selected, target]);

  const minStr = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secStr = String(seconds % 60).padStart(2, "0");

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
      <SeamlessBackground file="royal-gold.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/80" />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <Link to="/games/factors" className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-card/60 px-2 py-1 text-xs font-bold hover:border-amber-400/60">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1">
            <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
            <span className="text-xs font-black tabular-nums text-rose-200">{lives}/{settings.startingLives}</span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-primary/30 bg-card/60 px-2 py-1 text-xs font-black">
            <Timer className="h-3.5 w-3.5 text-amber-300" /> <span className="tabular-nums">{minStr}:{secStr}</span>
          </div>
          <div ref={counterRef} className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-card/60 px-2 py-1">
            {(["coin", "diamond", "crown", "heart"] as const).map((k, i) => {
              const goal = goals[k];
              const got = coins[k] || 0;
              const done = goal !== undefined && got >= goal;
              return (
                <div key={k} className={cn("flex items-center gap-0.5", i > 0 && "pl-1.5 border-l border-primary/20")}>
                  <img src={BIDMAS_REWARD_META[k].src} alt={BIDMAS_REWARD_META[k].label} className="h-3.5 w-3.5" />
                  <span className={cn("text-[11px] font-black tabular-nums", done ? "text-emerald-300" : BIDMAS_REWARD_META[k].tint)}>
                    {got}{goal !== undefined && <span className="text-muted-foreground/70">/{goal}</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <FactorSettingsPanel settings={settings} onChange={updateSettings} />
        </div>
      </header>

      <section className="relative z-10 px-3 sm:px-4 pb-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-3">
            <p className="text-[9px] uppercase tracking-[0.4em] text-amber-300 font-bold">Question</p>
            <h2 className="text-lg sm:text-xl font-black tracking-wide">
              Find all factors of <span className="text-amber-300 drop-shadow-[0_0_12px_hsl(45_95%_60%/0.6)]">{target}</span>
            </h2>
          </div>

          <div className="grid gap-3 grid-cols-4">
            {/* number tile board — 3/4 */}
            <div className="col-span-3 rounded-xl border-2 border-primary/30 bg-card/40 p-2 backdrop-blur">
              <div className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${Math.min(target, 10)}, minmax(0, 1fr))` }}>
                {Array.from({ length: target }, (_, i) => i + 1).map((n) => {
                  const st: TileState = selected === n ? "selected" : (tested[n] || "idle");
                  const reward = tileReward(n);
                  return (
                    <button
                      key={n}
                      data-factor-tile={n}
                      onClick={() => onTileClick(n)}
                      disabled={st === "verified" || st === "wrong"}
                      className={cn(
                        "relative aspect-square rounded-md border flex flex-col items-center justify-between p-0.5 transition-all duration-200",
                        "hover:scale-[1.04] hover:-translate-y-0.5",
                        st === "idle" && "border-primary/30 bg-card/60",
                        st === "selected" && "border-amber-400 bg-amber-500/15 shadow-[0_0_16px_hsl(45_95%_60%/0.5)] animate-soft-pulse",
                        st === "verified" && "border-emerald-400 bg-emerald-500/15 shadow-[0_0_14px_hsl(150_70%_50%/0.6)]",
                        st === "wrong" && "border-rose-500/60 bg-rose-500/10 opacity-60 cursor-not-allowed",
                      )}
                    >
                      <span className={cn(
                        "text-sm sm:text-base font-black tabular-nums leading-none mt-0.5",
                        st === "verified" ? "text-emerald-200" : st === "wrong" ? "text-rose-300/70" : "text-white",
                      )}>{n}</span>
                      <img src={BIDMAS_REWARD_META[reward].src} alt="" className={cn("h-3 w-3 object-contain", st === "wrong" && "grayscale opacity-50")} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* validation panel */}
            <aside className="col-span-1 rounded-xl border-2 border-amber-400/50 bg-card/60 p-2 backdrop-blur min-h-[260px] text-[11px]">
              {selected == null ? (
                <div className="flex h-full min-h-[240px] items-center justify-center text-center text-muted-foreground px-2">
                  Tap a number to test.
                </div>
              ) : (
                <>
                  <div className="text-center mb-2">
                    <div className="text-[9px] uppercase tracking-[0.3em] text-amber-300 font-bold">Testing</div>
                    <div className="text-base font-black tabular-nums">{target} ÷ {selected}</div>
                  </div>
                  {effectiveAllowGrouping && (
                    <div className="flex gap-0.5 mb-2 rounded-md border border-primary/20 p-0.5 bg-background/40">
                      <button onClick={() => setMode("group")} className={cn(
                        "flex-1 rounded px-1 py-1 text-[10px] font-bold flex items-center justify-center gap-0.5 transition-colors",
                        mode === "group" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "text-muted-foreground hover:text-foreground",
                      )}><Users className="h-3 w-3" /> Group</button>
                      <button onClick={() => setMode("division")} className={cn(
                        "flex-1 rounded px-1 py-1 text-[10px] font-bold flex items-center justify-center gap-0.5 transition-colors",
                        mode === "division" ? "bg-sky-500/20 text-sky-300 border border-sky-500/40" : "text-muted-foreground hover:text-foreground",
                      )}><DivideIcon className="h-3 w-3" /> Divide</button>
                    </div>
                  )}

                  {mode === "group" && effectiveAllowGrouping && groupingView && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground text-center">
                        Groups of {groupingView.n}
                      </p>
                      <div className="flex flex-wrap justify-center gap-1">
                        {Array.from({ length: groupingView.groups }, (_, gi) => (
                          <div key={gi} className="rounded border border-primary/30 bg-background/40 p-1">
                            <div className="grid gap-0.5"
                              style={{ gridTemplateColumns: `repeat(${Math.min(groupingView.dotsPerGroup, 4)}, minmax(0, 1fr))` }}>
                              {Array.from({ length: groupingView.dotsPerGroup }).map((_, di) => (
                                <span key={di} className={cn("h-1.5 w-1.5 rounded-full", GROUP_COLORS[gi % GROUP_COLORS.length])} />
                              ))}
                            </div>
                          </div>
                        ))}
                        {groupingView.remainder > 0 && (
                          <div className="rounded border border-rose-500/50 border-dashed bg-rose-500/10 p-1">
                            <div className="text-[8px] uppercase font-bold text-rose-300 mb-0.5 text-center">Left</div>
                            <div className="flex gap-0.5">
                              {Array.from({ length: groupingView.remainder }).map((_, di) => (
                                <span key={di} className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(mode === "division" || !effectiveAllowGrouping) && longDivisionView && (
                    <div className="space-y-2">
                      <div className="mx-auto inline-block font-mono text-base text-center text-foreground">
                        <div className="grid grid-cols-[auto_auto] items-end gap-x-1">
                          <div></div>
                          <div className="text-emerald-300 font-black tabular-nums border-b border-transparent">{longDivisionView.q}</div>
                          <div className="font-black tabular-nums">{longDivisionView.n}</div>
                          <div className="border-l-2 border-t-2 border-foreground/70 pl-1 tabular-nums">{target}</div>
                          <div></div>
                          <div className="border-b-2 border-foreground/70 tabular-nums text-right pr-0.5">{longDivisionView.product}</div>
                          <div></div>
                          <div className={cn(
                            "tabular-nums text-right pr-0.5 font-black",
                            longDivisionView.remainder === 0 ? "text-emerald-300" : "text-rose-300",
                          )}>{longDivisionView.remainder}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex gap-1">
                    <button onClick={() => setSelected(null)}
                      className="flex-1 rounded border border-primary/30 bg-card/60 px-1.5 py-1.5 text-[10px] font-bold hover:border-amber-400/60 inline-flex items-center justify-center gap-0.5">
                      <RotateCcw className="h-3 w-3" />
                    </button>
                    <button onClick={onConfirm}
                      className="flex-[2] rounded bg-emerald-500/90 px-1.5 py-1.5 text-[11px] font-black text-background hover:bg-emerald-400 inline-flex items-center justify-center gap-1 shadow-[0_0_14px_hsl(150_70%_50%/0.5)]">
                      <CornerDownLeft className="h-3.5 w-3.5" /> ENTER
                    </button>
                  </div>
                </>
              )}
            </aside>
          </div>

          {/* Factor pair slots */}
          {effectiveDiff !== "hard" && (
            <div className="mt-4 rounded-2xl border-2 border-primary/30 bg-card/40 p-3 backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300 font-bold text-center mb-2">Factor Pair Slots</div>
              <div className="flex flex-wrap justify-center gap-2">
                {pairSlots.map(({ a, b, aDone, bDone }, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-background/40 px-2.5 py-1.5">
                    <Slot value={a} done={aDone} />
                    <span className="text-rose-300 font-black">×</span>
                    <Slot value={b} done={bDone} />
                    <span className="text-muted-foreground font-bold">=</span>
                    <span className="text-amber-300 font-black tabular-nums">{target}</span>
                  </div>
                ))}
                {wrongTested.map((n) => (
                  <div key={`w-${n}`} className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/5 px-2.5 py-1.5 opacity-70">
                    <span className="font-black text-rose-300 tabular-nums">{n}</span>
                    <span className="text-rose-300 font-black">×</span>
                    <span className="font-black text-rose-300/70">?</span>
                    <span className="text-muted-foreground font-bold">≠</span>
                    <span className="text-rose-300 font-black tabular-nums">{target}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Factors found */}
          <div className="mt-3 rounded-2xl border-2 border-emerald-500/40 bg-card/40 p-3 backdrop-blur">
            <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-300 font-bold text-center mb-2">
              Factors Found · {verifiedFactors.length}/{correctFactors.length}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {correctFactors.map((f, i) => {
                const found = verifiedFactors.includes(f);
                return (
                  <div key={i} className={cn(
                    "h-9 w-9 sm:h-10 sm:w-10 rounded-md border-2 flex items-center justify-center font-black text-sm tabular-nums transition-all",
                    found ? "border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow-[0_0_12px_hsl(150_70%_50%/0.5)]"
                          : "border-primary/20 bg-background/30 text-muted-foreground/40",
                  )}>{found ? f : "·"}</div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <FlyingRewards events={flights} />

      {gameOver && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 backdrop-blur">
          <div className="rounded-2xl border-2 border-amber-400/70 bg-card p-8 text-center shadow-[0_0_50px_hsl(45_95%_60%/0.4)]">
            <div className="text-3xl font-black text-amber-300 mb-2">Game Over</div>
            <div className="text-sm text-muted-foreground mb-4">Coins collected: {coins.coin || 0}</div>
            <button
              onClick={() => { setLives(settings.startingLives); setGameOver(false); newRound(); }}
              className="rounded-lg bg-amber-500 px-5 py-2 font-black text-background hover:bg-amber-400">
              Play Again
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

const Slot = ({ value, done }: { value: number; done: boolean }) => (
  <span className={cn(
    "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border-2 px-1.5 font-black tabular-nums text-sm",
    done ? "border-emerald-400 bg-emerald-500/15 text-emerald-200" : "border-dashed border-primary/30 bg-background/30 text-muted-foreground/50",
  )}>{done ? value : "?"}</span>
);

export default FactorGame;
