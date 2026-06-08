import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Timer, CheckCircle2 } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { computeFactors } from "@/lib/factors";
import {
  CFDifficulty, CF_TIMERS, CF_LIVES, pickRound, commonFactorsOf, hcfOf,
} from "@/lib/commonFactors";
import { BIDMAS_REWARD_META, BidmasRewardKind } from "@/lib/bidmasRewards";
import { FlyingRewards, BidmasFlightEvent } from "@/components/bidmas/FlyingRewards";
import { FactorPanel, PanelTone, SlotMark } from "@/components/commonfactors/FactorPanel";
import { CommonMiddle } from "@/components/commonfactors/CommonMiddle";
import { TestingBar } from "@/components/commonfactors/TestingBar";
import { CFSettingsPanel, CFSettings } from "@/components/commonfactors/SettingsPanel";

const TONES: PanelTone[] = ["blue", "purple", "amber"];
const ZERO_COINS: Record<BidmasRewardKind, number> = { coin: 0, diamond: 0, heart: 0, crown: 0, star: 0, gem: 0, energy: 0, key: 0 };

const CommonFactorsGame = () => {
  const { difficulty = "easy" } = useParams<{ difficulty: CFDifficulty }>();
  const diff = (["easy", "medium", "hard"].includes(difficulty) ? difficulty : "easy") as CFDifficulty;
  const allowGrouping = diff !== "hard";

  const [settings, setSettings] = useState<CFSettings>({
    roundSec: CF_TIMERS[diff], startingLives: CF_LIVES[diff], difficulty: diff,
  });
  const [numbers, setNumbers] = useState<number[]>(() => pickRound(diff));
  const [foundPerNum, setFoundPerNum] = useState<number[][]>([]);
  const [panelMarks, setPanelMarks] = useState<SlotMark[][]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [divisor, setDivisor] = useState<number | null>(null);
  const [mode, setMode] = useState<"group" | "division">(allowGrouping ? "group" : "division");
  const [middleSlots, setMiddleSlots] = useState<(number | null)[]>([]);
  const [middleMarks, setMiddleMarks] = useState<SlotMark[]>([]);
  const [selectedMiddleIdx, setSelectedMiddleIdx] = useState<number | null>(null);
  const [hcfSelected, setHcfSelected] = useState(false);
  const [pickedHcf, setPickedHcf] = useState<number | null>(null);
  const [hcfMark, setHcfMark] = useState<SlotMark>("neutral");
  const [chestOpen, setChestOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lives, setLives] = useState(CF_LIVES[diff]);
  const [seconds, setSeconds] = useState(CF_TIMERS[diff]);
  const [coins, setCoins] = useState<Record<BidmasRewardKind, number>>(() => ({ ...ZERO_COINS }));
  const [flights, setFlights] = useState<BidmasFlightEvent[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const counterRef = useRef<HTMLDivElement>(null);

  const allTargets = useMemo(() => numbers.map((n) => computeFactors(n)), [numbers]);
  const commonFactors = useMemo(() => commonFactorsOf(numbers), [numbers]);
  const commonSet = useMemo(() => new Set(commonFactors), [commonFactors]);
  const hcfTarget = useMemo(() => hcfOf(numbers), [numbers]);
  const movedToMiddleSet = useMemo(
    () => new Set(middleSlots.filter((v): v is number => v != null).concat(pickedHcf != null ? [pickedHcf] : [])),
    [middleSlots, pickedHcf]
  );

  const newRound = useCallback(() => {
    const nums = pickRound(settings.difficulty);
    setNumbers(nums);
    setFoundPerNum(nums.map(() => []));
    setPanelMarks(nums.map(() => []));
    setActiveIdx(null);
    setDivisor(null);
    const cc = commonFactorsOf(nums).length;
    setMiddleSlots(Array(cc).fill(null));
    setMiddleMarks(Array(cc).fill("neutral"));
    setSelectedMiddleIdx(null);
    setHcfSelected(false);
    setPickedHcf(null);
    setHcfMark("neutral");
    setChestOpen(false);
    setSubmitted(false);
    setSeconds(settings.roundSec);
    setMode(settings.difficulty !== "hard" ? "group" : "division");
  }, [settings.difficulty, settings.roundSec]);

  useEffect(() => { newRound(); /* eslint-disable-next-line */ }, [settings.difficulty]);

  useEffect(() => {
    if (gameOver) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [gameOver]);

  useEffect(() => {
    if (seconds === 0 && !gameOver && !submitted) {
      decrementLife("Time's up!");
      setTimeout(newRound, 800);
    }
    // eslint-disable-next-line
  }, [seconds]);

  const updateSettings = (patch: Partial<CFSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      if (patch.startingLives !== undefined) setLives(patch.startingLives);
      if (patch.roundSec !== undefined) setSeconds(patch.roundSec);
      return next;
    });
  };

  const decrementLife = (msg: string) => {
    setLives((l) => {
      const nl = Math.max(0, l - 1);
      if (nl === 0) setGameOver(true);
      return nl;
    });
    toast({ title: msg });
  };

  const flyFrom = (selector: string, kind: BidmasRewardKind) => {
    const el = document.querySelector(selector) as HTMLElement | null;
    const dest = counterRef.current?.getBoundingClientRect();
    const src = el?.getBoundingClientRect();
    if (!src || !dest) return;
    const id = Date.now() + Math.floor(Math.random() * 100000);
    setFlights((p) => [...p, {
      id, kind,
      from: { x: src.left + src.width / 2, y: src.top + src.height / 2 },
      to: { x: dest.left + dest.width / 2, y: dest.top + dest.height / 2 },
    }]);
    setCoins((c) => ({ ...c, [kind]: (c[kind] || 0) + 1 }));
  };

  const onPickDivisor = (idx: number, d: number) => {
    if (gameOver || submitted) return;
    if (foundPerNum[idx]?.includes(d)) return;
    setActiveIdx(idx);
    setDivisor(d);
  };

  // Free entry: ENTER places divisor into the active panel, no validation
  const onConfirm = () => {
    if (gameOver || submitted || activeIdx == null || divisor == null) return;
    setFoundPerNum((prev) => prev.map((arr, i) => (
      i !== activeIdx || arr.includes(divisor) ? arr : [...arr, divisor].sort((a, b) => a - b)
    )));
    setDivisor(null);
  };

  const onClearPanelSlot = (panelIdx: number, slotIdx: number) => {
    if (submitted) return;
    setFoundPerNum((prev) => prev.map((arr, i) => i !== panelIdx ? arr : arr.filter((_, j) => j !== slotIdx)));
  };

  // Place a panel chip into the middle (selected slot or next empty)
  const placeIntoMiddleOrHcf = (n: number) => {
    if (submitted) return;
    if (movedToMiddleSet.has(n)) return;
    if (hcfSelected) {
      setPickedHcf(n);
      setHcfSelected(false);
      flyFrom("[data-cf-hcf-slot]", "coin");
      return;
    }
    let target = selectedMiddleIdx;
    if (target == null) {
      target = middleSlots.findIndex((v) => v == null);
    }
    if (target < 0) return;
    setMiddleSlots((prev) => prev.map((v, i) => i === target ? n : v));
    setSelectedMiddleIdx(null);
    flyFrom(`[data-cf-middle-slot="${target}"]`, "coin");
  };

  const onSelectMiddleSlot = (i: number) => {
    if (submitted) return;
    setHcfSelected(false);
    setSelectedMiddleIdx((prev) => prev === i ? null : i);
  };
  const onClearMiddleSlot = (i: number) => {
    if (submitted) return;
    setMiddleSlots((prev) => prev.map((v, idx) => idx === i ? null : v));
  };
  const onSelectHcf = () => {
    if (submitted) return;
    setSelectedMiddleIdx(null);
    setHcfSelected((p) => !p);
  };
  const onClearHcf = () => { if (!submitted) setPickedHcf(null); };

  // Submit & evaluate
  const onSubmit = () => {
    if (submitted || gameOver) return;
    // Validate panels
    const newPanelMarks: SlotMark[][] = foundPerNum.map((arr, panelIdx) => (
      arr.map((v) => numbers[panelIdx] % v === 0 ? "right" : "wrong")
    ));
    const newMiddleMarks: SlotMark[] = middleSlots.map((v) => (
      v == null ? "wrong" : commonSet.has(v) ? "right" : "wrong"
    ));
    const newHcfMark: SlotMark = pickedHcf == null ? "wrong" : (pickedHcf === hcfTarget ? "right" : "wrong");

    setPanelMarks(newPanelMarks);
    setMiddleMarks(newMiddleMarks);
    setHcfMark(newHcfMark);
    setSubmitted(true);

    const allMiddleRight = newMiddleMarks.every((m) => m === "right") && newMiddleMarks.length === commonFactors.length;
    const allPanelsRight = newPanelMarks.every((arr, i) => (
      arr.length === allTargets[i].length && arr.every((m) => m === "right")
    ));
    const perfect = allMiddleRight && allPanelsRight && newHcfMark === "right";

    // Reward animations from each correct slot
    setTimeout(() => {
      newPanelMarks.forEach((arr, pi) => arr.forEach((m, si) => {
        if (m === "right") setTimeout(() => flyFrom(`[data-cf-chip="${TONES[pi]}-${si}"]`, "coin"), si * 60);
      }));
      newMiddleMarks.forEach((m, i) => {
        if (m === "right") setTimeout(() => flyFrom(`[data-cf-middle-slot="${i}"]`, "diamond"), 200 + i * 80);
      });
      if (newHcfMark === "right") {
        setChestOpen(true);
        for (let i = 0; i < 4; i++) setTimeout(() => flyFrom("[data-cf-hcf-slot]", "crown"), 400 + i * 100);
      }
    }, 100);

    if (!perfect) {
      decrementLife("Some answers were wrong");
    } else {
      toast({ title: "Perfect! Next round…" });
    }
    setTimeout(newRound, 2200);
  };

  const minStr = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secStr = String(seconds % 60).padStart(2, "0");

  const colsClass = numbers.length === 3
    ? "grid-cols-1 md:grid-cols-[1fr_1fr_1.1fr_1fr]"
    : "grid-cols-1 md:grid-cols-[1fr_1.1fr_1fr]";

  const middleProps = {
    commonCount: commonFactors.length,
    middleSlots, middleMarks, pickedHcf, hcfMark, chestOpen,
    selectedMiddleIdx, onSelectMiddleSlot, onSelectHcf, hcfSelected,
    onClearMiddleSlot, onClearHcf,
  };

  const panel = (i: number, tone: PanelTone) => (
    <FactorPanel
      number={numbers[i]} tone={tone} totalFactors={allTargets[i].length}
      found={foundPerNum[i] ?? []} marks={panelMarks[i] ?? []}
      active={activeIdx === i} selectedDivisor={activeIdx === i ? divisor : null}
      movedToMiddle={movedToMiddleSet}
      onPickDivisor={(d) => onPickDivisor(i, d)}
      onSendToMiddle={placeIntoMiddleOrHcf}
      onClearSlot={(si) => onClearPanelSlot(i, si)}
    />
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground animate-fade-in">
      <SeamlessBackground file="royal-gold.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/80" />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <Link to="/games/common-factors" className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-card/60 px-2 py-1 text-xs font-bold hover:border-amber-400/60">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="text-center flex-1 min-w-[200px]">
          <p className="text-[9px] uppercase tracking-[0.4em] text-amber-300 font-bold">COMMON FACTORS LAB</p>
          <h2 className="text-sm sm:text-base font-black">
            Find the common factors of{" "}
            {numbers.map((n, i) => (
              <span key={i}>
                <span className={cn(
                  i === 0 && "text-sky-300",
                  i === 1 && "text-fuchsia-300",
                  i === 2 && "text-amber-300",
                  "drop-shadow-[0_0_10px_currentColor]",
                )}>{n}</span>
                {i < numbers.length - 1 && <span className="text-muted-foreground">{i === numbers.length - 2 ? " and " : ", "}</span>}
              </span>
            ))}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1">
            <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
            <span className="text-xs font-black tabular-nums text-rose-200">{lives}/{settings.startingLives}</span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-primary/30 bg-card/60 px-2 py-1 text-xs font-black">
            <Timer className="h-3.5 w-3.5 text-amber-300" /> <span className="tabular-nums">{minStr}:{secStr}</span>
          </div>
          <div ref={counterRef} className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-card/60 px-2 py-1">
            {(["coin", "diamond", "crown"] as const).map((k, i) => (
              <div key={k} className={cn("flex items-center gap-0.5", i > 0 && "pl-1.5 border-l border-primary/20")}>
                <img src={BIDMAS_REWARD_META[k].src} alt="" className="h-3.5 w-3.5" />
                <span className={cn("text-[11px] font-black tabular-nums", BIDMAS_REWARD_META[k].tint)}>{coins[k] || 0}</span>
              </div>
            ))}
          </div>
          <CFSettingsPanel settings={settings} onChange={updateSettings} />
        </div>
      </header>

      <section className="relative z-10 px-3 sm:px-4 pb-4">
        <div className={cn("grid gap-3 mx-auto max-w-[1280px]", colsClass)}>
          {numbers.length === 2 ? (
            <>
              {panel(0, "blue")}
              <div data-cf-chest><CommonMiddle {...middleProps} /></div>
              {panel(1, "purple")}
            </>
          ) : (
            <>
              {panel(0, "blue")}
              {panel(1, "purple")}
              <div data-cf-chest><CommonMiddle {...middleProps} /></div>
              {panel(2, "amber")}
            </>
          )}
        </div>

        <div className="mx-auto max-w-[1280px] mt-3 flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <TestingBar
              activeNumber={activeIdx == null ? null : numbers[activeIdx]}
              divisor={divisor} mode={mode} setMode={setMode} allowGrouping={allowGrouping}
              onConfirm={onConfirm} onClear={() => setDivisor(null)}
            />
          </div>
          <button
            onClick={onSubmit}
            disabled={submitted}
            className={cn(
              "rounded-xl px-5 py-3 text-sm font-black inline-flex items-center justify-center gap-2 border-2 transition-all",
              submitted
                ? "border-primary/20 bg-card/40 text-muted-foreground"
                : "border-amber-400 bg-amber-500 text-background hover:bg-amber-400 shadow-[0_0_20px_hsl(45_95%_60%/0.6)]",
            )}
          >
            <CheckCircle2 className="h-4 w-4" /> SUBMIT
          </button>
        </div>

        {(selectedMiddleIdx != null || hcfSelected) && !submitted && (
          <div className="mx-auto max-w-[1280px] mt-2 text-center text-[11px] text-amber-300 font-bold animate-pulse">
            {hcfSelected ? "Tap a chip in any panel to set as Highest Common Factor" : `Tap a chip to drop it into common slot ${selectedMiddleIdx! + 1}`}
          </div>
        )}
      </section>

      <FlyingRewards events={flights} />

      {gameOver && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 backdrop-blur">
          <div className="rounded-2xl border-2 border-amber-400/70 bg-card p-8 text-center shadow-[0_0_50px_hsl(45_95%_60%/0.4)]">
            <div className="text-3xl font-black text-amber-300 mb-2">Game Over</div>
            <div className="text-sm text-muted-foreground mb-4">Coins: {coins.coin || 0}</div>
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

export default CommonFactorsGame;
