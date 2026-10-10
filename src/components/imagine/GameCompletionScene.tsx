import { useEffect, useMemo, useRef, useState } from "react";
import { DoorOpen, LogOut, Play, RotateCcw } from "lucide-react";
import DraggableResizable, { type Placement } from "@/components/flow/DraggableResizable";
import FlowEmotionBar from "@/components/flow/FlowEmotionBar";
import FlowCharacter from "@/components/flow/FlowCharacter";
import { ImagineBackground } from "@/components/imagine/ImagineBackground";
import { Button } from "@/components/ui/button";
import { completionOutcome, visibleRewardRows, type CompletionOutcome, type QuestionRewardSummary } from "@/lib/imagine/gameCompletion";
import type { Game, GameCompletionFlow } from "@/lib/slate/types";
import markSeal from "@/assets/slate/rewards/mark-seal.webp";
import mathVault from "@/assets/slate/rewards/math-vault.webp";
import mathVaultOpen from "@/assets/slate/rewards/math-vault-open.webp";
import retryHeart from "@/assets/slate/rewards/retry-heart.webp";
import timeShard from "@/assets/slate/rewards/time-shard.webp";

const LABEL = {
  complete: "Question complete!",
  perfect: "Perfect run!",
  victory: "Game complete!",
  failed: "Time up",
  left: "Run paused",
} as const;

const REWARD_ART = {
  marks: markSeal,
  completion: "/assets/ui/icons/gold_coin_crown.png",
  vault: mathVault,
  vaults: mathVaultOpen,
  time: timeShard,
  lives: retryHeart,
} as const;

const CONFETTI = Array.from({ length: 18 }, (_, index) => index);

function AnimatedNumber({ value, active }: { value: number; active: boolean }) {
  const [shown, setShown] = useState(active ? 0 : value);
  useEffect(() => {
    if (!active || value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    setShown(0);
    const started = performance.now();
    const duration = Math.min(1400, 650 + value * 35);
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active, value]);
  return <span>{shown}</span>;
}

export function GameCompletionScene({ game, summary, final, failed = false, left = false, questionNumber = 1, questionTotal = 1, onContinue, onRetry, onExit, previewOutcome, creatorControls = false, onCharacterPlacementChange }: {
  game: Game;
  summary: QuestionRewardSummary;
  final: boolean;
  failed?: boolean;
  left?: boolean;
  questionNumber?: number;
  questionTotal?: number;
  onContinue?: () => void;
  onRetry?: () => void;
  onExit: () => void;
  previewOutcome?: CompletionOutcome;
  creatorControls?: boolean;
  onCharacterPlacementChange?: (position: GameCompletionFlow["position"]) => void;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [sceneSize, setSceneSize] = useState({ width: 1280, height: 720 });
  const flow = game.settings.completionFlow;
  const availableRewards = game.slots.reduce((sum, slot) => sum + slot.rewards.length, 0);
  const outcome = previewOutcome ?? completionOutcome({ failed, left, final, marks: summary.marks, totalMarks: summary.totalMarks, availableRewards, collectedRewards: summary.completionCoins + summary.vaultsOpened });
  const outcomeScene = flow?.moments[outcome] ?? ((outcome === "perfect" || outcome === "victory") ? flow?.moments.complete ?? null : null);
  const fallbackBase = (flow?.clips.length ?? 0) > 0
    ? { start: 0, end: flow?.clips[0]?.duration ?? 0 }
    : null;
  const baseScene = flow?.baseScene ?? fallbackBase;
  const previewScene = creatorControls && !baseScene && (flow?.clips.length ?? 0) > 0
    ? { start: 0, end: Math.min(flow?.clips[0]?.duration ?? 2, 2) }
    : null;
  const idleScene = baseScene ?? previewScene;
  const [scene, setScene] = useState<{ start: number; end: number } | null>(() => outcomeScene ?? idleScene);
  const [playingBase, setPlayingBase] = useState(() => !outcomeScene);
  const queuedReactions = useRef<{ start: number; end: number }[]>([]);
  const [playKey, setPlayKey] = useState(0);
  const emojis = flow?.emojis ?? [];
  const [characterPlacement, setCharacterPlacement] = useState<Placement>(() => ({ x: (flow?.position.x ?? 76) / 100, y: (flow?.position.y ?? 56) / 100, scale: flow?.position.scale ?? 1 }));
  const [emotionPlacement, setEmotionPlacement] = useState<Placement>(() => flow?.position.emotionBar ?? { x: 0.17, y: 0.74, scale: 1 });
  const [queuedCount, setQueuedCount] = useState(0);
  const [lit, setLit] = useState(0);
  useEffect(() => {
    if (failed || left || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setLit(failed || left ? 0 : 3); return; }
    setLit(0);
    const first = window.setTimeout(() => setLit(1), 120);
    const second = window.setTimeout(() => setLit(2), 360);
    const third = window.setTimeout(() => setLit(3), 600);
    return () => { window.clearTimeout(first); window.clearTimeout(second); window.clearTimeout(third); };
  }, [failed, left]);
  useEffect(() => {
    queuedReactions.current = [];
    setQueuedCount(0);
    setScene(outcomeScene ?? idleScene);
    setPlayingBase(!outcomeScene);
    setPlayKey((key) => key + 1);
  }, [outcome, outcomeScene?.start, outcomeScene?.end, idleScene?.start, idleScene?.end]);
  useEffect(() => {
    const node = sceneRef.current;
    if (!node) return;
    const measure = () => setSceneSize({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => setCharacterPlacement({ x: (flow?.position.x ?? 76) / 100, y: (flow?.position.y ?? 56) / 100, scale: flow?.position.scale ?? 1 }), [flow?.position.x, flow?.position.y, flow?.position.scale]);
  useEffect(() => setEmotionPlacement(flow?.position.emotionBar ?? { x: 0.17, y: 0.74, scale: 1 }), [flow?.position.emotionBar?.x, flow?.position.emotionBar?.y, flow?.position.emotionBar?.scale]);
  const rows = useMemo(() => visibleRewardRows(summary), [summary]);

  const celebrates = !failed && !left;

  const updatePlacement = (placement: Placement) => {
    setCharacterPlacement(placement);
    if (!flow) return;
    onCharacterPlacementChange?.({ ...flow.position, x: placement.x * 100, y: placement.y * 100, scale: placement.scale });
  };
  const updateEmotionPlacement = (placement: Placement) => {
    setEmotionPlacement(placement);
    if (!flow) return;
    onCharacterPlacementChange?.({ ...flow.position, emotionBar: placement });
  };
  const returnToBase = () => {
    const next = queuedReactions.current.shift();
    setQueuedCount(queuedReactions.current.length);
    if (next) {
      setScene(next);
      setPlayingBase(false);
      setPlayKey((key) => key + 1);
      return;
    }
    setScene(idleScene);
    setPlayingBase(true);
    setPlayKey((key) => key + 1);
  };
  const pickReaction = (id: string) => {
    const emoji = emojis.find((item) => item.id === id);
    if (!emoji) return;
    const next = { start: emoji.start, end: emoji.end };
    if (playingBase || !scene) {
      setScene(next);
      setPlayingBase(false);
      setPlayKey((key) => key + 1);
    } else {
      queuedReactions.current.push(next);
      setQueuedCount(queuedReactions.current.length);
    }
  };
  const compact = sceneSize.width < 768;
  const baseW = Math.min(sceneSize.width * (compact ? 0.82 : 0.42), 560);
  const baseH = sceneSize.height * (compact ? 0.27 : 0.48);

  return <div ref={sceneRef} className="game-completion absolute inset-0 z-50 overflow-hidden bg-background text-foreground">
    <ImagineBackground background={game.background} />
    <div className="game-completion-vignette absolute inset-0" />
    {celebrates ? <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">{CONFETTI.map((piece) => <i key={piece} className="game-completion-confetti" />)}</div> : null}
    {flow?.enabled && scene && flow.clips.length > 0 ? <DraggableResizable label="completion character" value={characterPlacement} min={0.3} max={10} editable={creatorControls} onChange={updatePlacement} onCommit={updatePlacement} baseW={baseW} baseH={baseH} controls="subject-top" coordinateSpace="parent">
      <div className="pointer-events-auto absolute inset-0"><FlowCharacter clips={flow.clips} range={scene} playKey={playKey} onSceneEnd={returnToBase} loop={playingBase && !queuedCount} visible volume={flow.position.volume} /></div>
    </DraggableResizable> : null}
    {flow?.enabled && emojis.length > 0 && flow.clips.length > 0 ? <DraggableResizable label="emotion buttons" value={emotionPlacement} min={0.5} max={2} editable={creatorControls} onChange={setEmotionPlacement} onCommit={updateEmotionPlacement} baseW={Math.min(Math.max(96, emojis.length * 34 + 20), sceneSize.width * 0.6)} baseH={42} controls="above" coordinateSpace="parent">
      <div className="pointer-events-auto absolute inset-0 overflow-x-auto" aria-label="Character reactions"><FlowEmotionBar emotions={emojis.map(({ id, label }) => ({ id, label }))} queued={queuedCount} onPick={pickReaction} /></div>
    </DraggableResizable> : null}
    <div className="relative z-30 flex h-full items-center justify-center px-3 py-4 max-md:items-end max-md:pb-[max(10px,env(safe-area-inset-bottom))]">
      <section className="game-completion-board relative min-w-0 w-full max-w-3xl px-5 pb-5 pt-16 text-center max-md:max-w-full max-md:px-3 max-md:pb-3 max-md:pt-12">
        <div className="game-completion-inner-frame pointer-events-none absolute inset-2" aria-hidden="true" />
        <div className="game-completion-corner game-completion-corner-tl" aria-hidden="true" />
        <div className="game-completion-corner game-completion-corner-tr" aria-hidden="true" />
        <div className="game-completion-corner game-completion-corner-bl" aria-hidden="true" />
        <div className="game-completion-corner game-completion-corner-br" aria-hidden="true" />
        {celebrates ? <div className="absolute inset-x-0 top-0 flex -translate-y-[36%] items-end justify-center gap-1" aria-label={`${lit} of 3 stars`}>
          {[1, 2, 3].map((star) => <img key={star} src="/assets/rewards/stars/gold_star.png" alt="" className={`game-completion-star ${star === 2 ? "game-completion-star-main" : ""} ${star <= lit ? "is-lit" : ""}`} />)}
        </div> : <DoorOpen className="absolute left-1/2 top-4 h-12 w-12 -translate-x-1/2 text-primary" />}
        <div className="game-completion-ribbon relative z-10 mx-auto max-w-2xl overflow-hidden px-5 py-2">
          <span className="game-completion-ribbon-glint" aria-hidden="true" />
          <h2 className="text-3xl font-black uppercase tracking-normal max-md:text-xl">{LABEL[outcome]}</h2>
        </div>
        <p className="mt-2 text-sm font-bold text-game-result-ink">Question {Math.max(1, questionNumber)} of {Math.max(1, questionTotal)} · {game.name}</p>
        <div className="mx-auto mt-3 grid min-w-0 max-w-2xl grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:grid-cols-6">
          {rows.map((row, index) => <article key={row.key} className={`game-completion-reward ${rows.length % 2 === 1 && index === rows.length - 1 ? "max-sm:col-span-2" : ""} sm:col-span-2`}>
            <img src={REWARD_ART[row.key as keyof typeof REWARD_ART]} alt="" className="h-14 w-16 shrink-0 object-contain drop-shadow-lg max-md:h-11 max-md:w-12" />
            <div className="min-w-0 flex-1 text-left text-game-result-ink"><div className="text-xs font-black leading-tight max-md:text-[10px]">{row.label}</div><div className="mt-1 whitespace-nowrap text-xl font-black tabular-nums max-md:text-base"><AnimatedNumber value={row.value} active={celebrates} />{row.suffix}</div></div>
            <div className="game-completion-meter absolute inset-x-3 bottom-1.5 h-1.5 overflow-hidden rounded-full"><span /></div>
          </article>)}
        </div>
        <div className="mx-auto mt-4 grid min-w-0 max-w-xl grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
          {failed && onRetry ? <Button onClick={onRetry} className="game-completion-action game-completion-continue h-14 text-lg font-black uppercase"><RotateCcw /> Try again</Button> : null}
          {celebrates && onContinue ? <Button onClick={onContinue} className="game-completion-action game-completion-continue h-14 text-lg font-black uppercase"><Play fill="currentColor" /> {final ? "Finish" : "Continue"}</Button> : null}
          <Button onClick={onExit} className={`game-completion-action game-completion-exit h-14 text-lg font-black uppercase ${left || (failed && !onRetry) ? "col-span-2" : ""}`}><LogOut /> {left ? "Leave Game" : "Exit Game"}</Button>
        </div>
      </section>
    </div>
  </div>;
}