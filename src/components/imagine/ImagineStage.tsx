// IMAGINE — a Smartboard-fast stage. Plain DOM/CSS, no 3D, no rooms.
import { gameTableSurfaceHeightPx } from "@/lib/slate/gameTableScale";
//
// Three independent layers:
//   1. BackgroundLayer (picture/video) — memoised, never restarts.
//   2. Writing surfaces — the Game Lines as light cards.
//   3. RewardOverlay — a pointer-events-none overlay with its own state, so a
//      reward animation never re-renders or blocks the writing surfaces.
import { clampContentMargin } from "@/lib/slate/layout";
import { surfacePicture, surfaceSkin, surfaceSlice } from "@/lib/imagine/surfaceSkins";
import {
  mobileLabelScale,
  mobileMarginFromPointer,
  mobileReservedFraction,
} from "@/lib/imagine/mobileMargin";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ImagineBackground } from "@/components/imagine/ImagineBackground";
import { MathLine } from "@/components/gameslate/ReadableMath";
import { MathTreeRender } from "@/components/smartboard/MathTreeRender";
import type { RewardDef } from "@/lib/slate/rewards";
import { getReward } from "@/lib/slate/rewards";
import { applyBackgroundSound, playRewardSound, prepareGameSounds, stopBackgroundSound } from "@/lib/slate/gameSound";
import { rewardSoundKeyForType } from "@/lib/slate/sound";
import { getSurface } from "@/lib/slate/surfaces";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import type { Game, Selection, Slot } from "@/lib/slate/types";
import { imagineSavedSize, imagineSurfaceScale, type ImagineViewport } from "@/lib/imagine/responsiveSize";
import { imagineEnergyBallTargets, isImagineEnergyBall } from "@/lib/imagine/energyBall";
import { imagineCollectorAxis, imagineCollectorTargets, type ImagineScreenRect } from "@/lib/imagine/collectorSweep";
import { imagineProjectileGeometry } from "@/lib/imagine/projectileGeometry";
import { normalizeImagineGame } from "@/lib/imagine/rewards";
import { ENERGY_BALL_ARRIVAL_MS, ENERGY_BALL_CENTRE_MS, ENERGY_BALL_SPIN_MS, ENERGY_BALL_FADE_MS, ENERGY_BALL_LIFETIME_MS } from "@/lib/imagine/energyBallTiming";

interface Props {
  game: Game;
  mode?: string;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onRewardConsume?: (slotId: string, rewardId: string) => void;
  focusSlotId?: string | null;
  onFocusSlot?: (slotId: string) => void;
  onReadyChange?: (ready: boolean) => void;
  onProgressChange?: (progress: number) => void;
  onContentMarginChange?: (margin: number) => void;
  textColour?: string | null;
  textSizeViewport?: ImagineViewport;
  [key: string]: unknown;
}

export default function ImagineStage(props: Props) {
  const { game, selection, onSelect, onRewardConsume, focusSlotId, onReadyChange, onProgressChange, onContentMarginChange, textColour } = props;
  const imagineGame = useMemo(() => normalizeImagineGame(game), [game]);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const breakpoint = useBreakpoint();

  useEffect(() => {
    onProgressChange?.(1);
    onReadyChange?.(true);
  }, [onReadyChange, onProgressChange]);

  useEffect(() => {
    prepareGameSounds(imagineGame.settings.sound);
    applyBackgroundSound(imagineGame.settings.sound.background);
    return () => stopBackgroundSound();
  }, [imagineGame.settings.sound]);

  useEffect(() => {
    if (!focusSlotId) return;
    refs.current[focusSlotId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusSlotId]);

  const selectedId = selection.kind === "none" ? focusSlotId : selection.slotId;

  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <ImagineBackground background={imagineGame.background} />
      </div>
      <div className="imagine-scroll absolute inset-0 overflow-y-auto overscroll-contain px-0 pb-40 pt-16 sm:pb-36">
        <div className="mx-[5vw] flex min-h-full w-[90vw] flex-col items-start justify-center gap-3 py-4">
          {imagineGame.slots.map((slot, index) => (
            <SurfaceCard
              key={slot.id}
              slot={slot}
              index={index}
              active={slot.id === selectedId}
              colour={imagineGame.surfaceColour}
              surfaceId={slot.surfaceId ?? imagineGame.surfaceId}
              numbersVisible={imagineGame.settings.numbers.visible}
              rewardSettings={imagineGame.settings.rewards}
               breakpoint={props.textSizeViewport ?? breakpoint}
              textColour={textColour ?? null}
                imagine={imagineGame.settings.imagine}
              margin={clampContentMargin(imagineGame.settings.contentMargin)}
               onMarginChange={onContentMarginChange}
              register={(el) => { refs.current[slot.id] = el; }}
              onSelect={() => onSelect({ kind: "slot", slotId: slot.id })}
            />
          ))}
        </div>
      </div>
      <RewardOverlay game={imagineGame} onRewardConsume={onRewardConsume} />
    </div>
  );
}

const SurfaceCard = memo(function SurfaceCard({
  slot, index, active, colour, surfaceId, numbersVisible, rewardSettings, breakpoint, textColour, imagine, margin, onMarginChange, register, onSelect,
}: {
  margin: number;
  slot: Slot; index: number; active: boolean; colour?: string; surfaceId: string; numbersVisible: boolean;
  rewardSettings: Game["settings"]["rewards"];
  breakpoint: "phone" | "tablet" | "desktop"; textColour: string | null;
  imagine: Game["settings"]["imagine"];
  onMarginChange?: (margin: number) => void;
  register: (el: HTMLDivElement | null) => void; onSelect: () => void;
}) {
  const text = slot.text || "";
  const visibleRewards = rewardSettings.visible ? slot.rewards.filter((r) => !r.hidden) : [];
  const surface = getSurface(surfaceId);
  const isPlain = surface.id === "plain" || surface.none;
  const finish = imagine?.finish ?? "framed";
  const picture = isPlain || surface.transparent ? null : surfacePicture(surface.id);
  const skin = picture ? "picture" : surfaceSkin(surface.id);
  const slice = surfaceSlice(surface.id);
  const grow = imagine?.growWithContent !== false && !slot.gameTable;
  const isPhone = breakpoint === "phone";
  const reservedFraction = mobileReservedFraction(margin);
  const labelScale = mobileLabelScale(margin);
  const dragMargin = (clientX: number, target: HTMLElement) => {
    if (!isPhone || !onMarginChange) return;
    const surfaceElement = target.closest<HTMLElement>("[data-slot]");
    if (!surfaceElement) return;
    const bounds = surfaceElement.getBoundingClientRect();
    onMarginChange(mobileMarginFromPointer(clientX, bounds.left, bounds.width));
  };
  const viewport = breakpoint === "phone" ? "phone" : breakpoint;
  const fallbackSize = breakpoint === "phone"
    ? slot.textConfig?.mobileSize
    : breakpoint === "tablet"
      ? slot.textConfig?.tabletSize
      : slot.textConfig?.desktopSize;
  const textSize = imagineSavedSize(imagine, viewport, fallbackSize);
  const surfaceScale = slot.gameTable ? 1 : imagineSurfaceScale(textSize, viewport);
  return (
    <div
      ref={register}
      data-slot={slot.id}
      onClick={onSelect}
      className={`imagine-surface imagine-surface--${finish} imagine-skin--${skin} relative cursor-pointer py-5 text-lg transition-[border-color,box-shadow,min-height] duration-150 sm:px-8 ${
        grow ? "imagine-surface--growing min-h-[72px] w-fit max-w-full" : slot.gameTable ? "w-full" : "h-24 w-full"
      } ${
        active ? "border-primary shadow-primary/20" : "border-border/70"
      }`}
      style={{
        // Scale the complete physical surface, not just its minimum height:
        // frame, margin, padding, labels and rewards shrink with the writing.
        zoom: surfaceScale,
        ...(picture ? {
          borderStyle: "solid",
          borderImageSource: `url(${picture})`,
          borderImageSlice: slice.slice,
          borderImageWidth: slice.width,
          borderImageRepeat: "stretch",
        } : {}),
        backgroundColor: picture ? "transparent" : isPlain ? (colour ?? "hsl(var(--card))") : surface.panel.background,
        backgroundImage: isPlain || picture ? undefined : `linear-gradient(hsl(var(--card) / .08), hsl(var(--card) / .08)), url(${surface.texture})`,
        backgroundSize: isPlain ? undefined : "cover",
        color: textColour ?? slot.textConfig?.colour ?? (isPlain ? "hsl(var(--card-foreground))" : surface.ink),
        borderColor: active ? surface.accent : surface.panel.border,
        borderRadius: surface.panel.radius,
        boxShadow: picture ? (active ? `0 0 0 2px ${surface.accent}` : "none") : `${surface.panel.inset === "none" ? "" : `${surface.panel.inset}, `}0 10px 26px hsl(var(--background) / .24)`,
        ["--imagine-frame" as string]: surface.frame,
        ["--imagine-accent" as string]: surface.accent,
        ["--imagine-margin" as string]: `calc(${margin} * 90vw)`,
        ["--imagine-mobile-reserved" as string]: `${reservedFraction * 100}%`,
        ["--imagine-label-scale" as string]: labelScale,
         ["--imagine-surface-scale" as string]: 1,
         ["--imagine-text-size" as string]: `${textSize / surfaceScale}px`,
        textShadow: imagine?.textTreatment === "flat"
          ? "none"
          : imagine?.textTreatment === "engraved"
            ? `0 1px 0 ${surface.inkHighlight}, 0 -1px 1px ${surface.inkShadow}`
            : `0 -1px 0 ${surface.inkHighlight}, 0 2px 2px ${surface.inkShadow}`,
      }}
    >
      <span
        role={isPhone ? "slider" : undefined}
        aria-label={isPhone ? "Writing margin" : undefined}
        aria-valuemin={isPhone ? 0 : undefined}
        aria-valuemax={isPhone ? 50 : undefined}
        aria-valuenow={isPhone ? Math.round(margin * 100) : undefined}
        tabIndex={isPhone && onMarginChange ? 0 : undefined}
        className={`imagine-margin-line absolute bottom-2 top-2 ${isPhone && onMarginChange ? "imagine-margin-line--draggable" : "pointer-events-none"}`}
        onPointerDown={(event) => {
          if (!isPhone || !onMarginChange) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragMargin(event.clientX, event.currentTarget);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          event.preventDefault();
          dragMargin(event.clientX, event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (!isPhone || !onMarginChange) return;
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          onMarginChange(clampContentMargin(margin + (event.key === "ArrowLeft" ? -0.025 : 0.025)));
        }}
      />
      {numbersVisible ? <span className="imagine-line-label absolute top-1/2 z-[1] grid h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-background/80 px-2 text-xs font-bold text-foreground shadow-sm">
        {index === 0 ? "Q" : index}
      </span> : null}
       <div className="imagine-writing-region relative z-[1] flex min-h-[40px] items-center whitespace-pre-wrap break-words pr-12 font-medium">
         <div className="imagine-writing-content min-w-0 break-words">
        {slot.gameTable ? (
          <div
            data-game-table-mount={slot.gameTable.objId}
            className="w-full overflow-x-auto"
            style={{
              height: gameTableSurfaceHeightPx({
                naturalHeightPx: slot.gameTable.naturalHeightPx ?? slot.gameTable.rows * 96 + 100,
                scale: slot.gameTable.scale,
                measuredHeightPx: slot.gameTable.measuredHeightPx,
              }),
              whiteSpace: "normal",
            }}
            onPointerDown={(event) => { event.stopPropagation(); onSelect(); }}
          />
        ) : slot.structuredMath?.rows.length
          ? slot.structuredMath.rows.map((r) => (
              <div key={r.sourceRow} className="flex flex-wrap items-baseline">
                 <MathTreeRender root={r.row} cursor={r.cursor ?? { path: [-1], index: -1 }} onCursorChange={() => {}} caretColor={active && imagine?.sensorVisible !== false ? (textColour ?? slot.textConfig?.colour ?? surface.ink) : "transparent"} readOnly showReadOnlyCaret={active && imagine?.sensorVisible !== false} />
              </div>
            ))
          : text ? <MathLine src={text} /> : <span className="opacity-30">…</span>}
        {slot.structuredNote ? <div className="mt-2 opacity-70">{slot.structuredNote}</div> : null}
        </div>
      </div>
      <div className="pointer-events-none absolute right-2 top-2 flex gap-1">
        {visibleRewards.map((r) => (
          <img
            key={r.id}
            data-reward={r.id}
            src={getReward(r.type).art}
            alt=""
            className="h-8 w-8 object-contain"
            style={{ opacity: Math.min(1, Math.max(0.1, rewardSettings.opacity)) }}
          />
        ))}
      </div>
    </div>
  );
});

interface Flight {
  id: number;
  art: string;
  x: number;
  y: number;
  motion: string;
  glow: string;
  kind: "reward" | "energy" | "collector";
  axis?: "x" | "y";
  direction?: 1 | -1;
  distance?: number;
  expression?: string;
}
interface Projectile { id: number; x: number; y: number; dx: number; dy: number; angle: number; art: string; glow: string }
interface Impact { id: number; x: number; y: number; glow: string }
interface RewardEventDetail { slotId: string; rewardId: string; chainId?: string; preview?: boolean }

const MOTION: Record<string, string> = {
  heart: "imr-pulse", seal: "imr-stamp", shard: "imr-spin", vault: "imr-unlock",
  core: "imr-burst", "chain-bomb": "imr-burst", "sweep-horizontal": "imr-sweepx", "sweep-vertical": "imr-sweepy",
  "energy-ball": "imr-orbit", calculator: "imr-calculate",
};

/** Own state only — listens to the shared reward event, never touches the board.
 *  Stages: light up on the surface → lift out → prominent centre → own motion → glide off. */
function RewardOverlay({ game, onRewardConsume }: { game: Game; onRewardConsume?: (slotId: string, rewardId: string) => void }) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [impacts, setImpacts] = useState<Impact[]>([]);
  const counter = useRef(0);
  const chains = useRef(new Map<string, Set<string>>());
  const timers = useRef<number[]>([]);
  const gameRef = useRef(game);
  gameRef.current = game;
  const consumeRef = useRef(onRewardConsume);
  consumeRef.current = onRewardConsume;
  useEffect(() => {
    const game = new Proxy({} as Game, { get: (_t, key) => (gameRef.current as never)[key as never] });
    const onRewardConsume = (slotId: string, rewardId: string) => consumeRef.current?.(slotId, rewardId);
    const slow = typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 2;
    const later = (work: () => void, delay: number) => {
      const timer = window.setTimeout(work, delay);
      timers.current.push(timer);
      return timer;
    };
    const screenRect = (element: HTMLElement | null): ImagineScreenRect | null => {
      const bounds = element?.getBoundingClientRect();
      if (!bounds
        || bounds.bottom <= 0
        || bounds.top >= window.innerHeight
        || bounds.right <= 0
        || bounds.left >= window.innerWidth) return null;
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const renderedTargets = () => game.slots.flatMap((slot) => slot.rewards.map((reward) => ({
      slotId: slot.id,
      reward,
      rect: screenRect(document.querySelector<HTMLElement>(`[data-slot="${CSS.escape(slot.id)}"] [data-reward="${CSS.escape(reward.id)}"]`)),
    })));
    const activateTarget = (
      slotId: string,
      rewardId: string,
      chainId: string,
      delay: number,
      impactAt?: ImagineScreenRect | null,
      glow = "#ffc857",
    ) => {
      later(() => {
        if (impactAt) {
          const impactId = ++counter.current;
          setImpacts((current) => [...current.slice(-7), {
            id: impactId,
            x: impactAt.left + impactAt.width / 2,
            y: impactAt.top + impactAt.height / 2,
            glow,
          }]);
          later(() => setImpacts((current) => current.filter((impact) => impact.id !== impactId)), slow ? 120 : 360);
        }
        onRewardConsume?.(slotId, rewardId);
        window.dispatchEvent(new CustomEvent("slate:activate-reward", {
          detail: { slotId, rewardId, chainId, preview: false },
        }));
      }, delay);
    };
    const onActivate = (e: Event) => {
      const detail = (e as CustomEvent<RewardEventDetail>).detail;
      if (!detail) return;
      const card = document.querySelector<HTMLElement>(`[data-slot="${CSS.escape(detail.slotId)}"]`);
      const icon = card?.querySelector<HTMLElement>(`[data-reward="${CSS.escape(detail.rewardId)}"]`);
      const rect = (icon ?? card)?.getBoundingClientRect();
      const sourceSlot = game.slots.find((slot) => slot.id === detail.slotId);
      const placedReward = sourceSlot?.rewards.find((reward) => reward.id === detail.rewardId)
        ?? game.slots.flatMap((slot) => slot.rewards).find((reward) => reward.id === detail.rewardId);
      const type = placedReward?.type ?? detail.rewardId.split("-").slice(1).join("-");
      const def: RewardDef = getReward(type);
      const soundKey = rewardSoundKeyForType(type);
      if (soundKey) playRewardSound(game.settings.sound, soundKey);
      const art = (icon as HTMLImageElement | null)?.src ?? def.art;
      const id = ++counter.current;
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      const energyBall = isImagineEnergyBall(type);
      const axis = imagineCollectorAxis(type);
      const direction: 1 | -1 = axis === "x"
        ? (x < window.innerWidth / 2 ? 1 : -1)
        : (y < window.innerHeight / 2 ? 1 : -1);
      const distance = axis === "x"
        ? (direction > 0 ? window.innerWidth - x + 80 : -(x + 80))
        : (direction > 0 ? window.innerHeight - y + 80 : -(y + 80));
      const kind: Flight["kind"] = energyBall ? "energy" : axis ? "collector" : "reward";
      setFlights((p) => [...p.slice(-5), {
        id,
        art,
        x,
        y,
        motion: MOTION[def.profile] ?? "imr-pulse",
        glow: def.glow ?? "#ffc857",
        kind,
        ...(type === "math-vault" && placedReward?.expression ? { expression: placedReward.expression } : {}),
        ...(axis ? { axis, direction, distance } : {}),
      }]);
      later(() => setFlights((p) => p.filter((f) => f.id !== id)), energyBall ? ENERGY_BALL_LIFETIME_MS : slow ? 500 : kind === "collector" ? 1250 : 2200);

      if (detail.preview) return;
      const chainId = detail.chainId ?? `imagine-chain-${id}`;
      const visited = chains.current.get(chainId) ?? new Set<string>();
      visited.add(detail.rewardId);
      chains.current.set(chainId, visited);

      if (axis && rect) {
        const sourceRect: ImagineScreenRect = {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
        const targets = imagineCollectorTargets(
          detail.rewardId,
          axis,
          direction,
          sourceRect,
          renderedTargets(),
          visited,
        ).slice(0, 24);
        targets.forEach(({ reward }) => visited.add(reward.id));
        const span = Math.max(1, Math.abs(distance));
        targets.forEach(({ slotId, reward, rect: targetRect, distance: targetDistance }) => {
          const contactDelay = slow ? 70 : 260 + Math.round((targetDistance / span) * 720);
          activateTarget(slotId, reward.id, chainId, contactDelay, targetRect, def.glow);
        });
        later(() => chains.current.delete(chainId), 4000);
        return;
      }

      if (!energyBall) return;
      const visibleRewards = renderedTargets();
      const targets = imagineEnergyBallTargets(
        detail.rewardId,
        visibleRewards.map(({ slotId, reward, rect: targetRect }) => ({ slotId, reward, visible: Boolean(targetRect) })),
        visited,
      );
      targets.forEach(({ reward }) => visited.add(reward.id));
      targets.forEach(({ slotId, reward }, index) => {
        later(() => {
          const targetRect = visibleRewards.find((candidate) => candidate.slotId === slotId && candidate.reward.id === reward.id)?.rect;
          if (!targetRect) return;
          const projectileId = ++counter.current;
          const tx = targetRect.left + targetRect.width / 2;
          const ty = targetRect.top + targetRect.height / 2;
           const ballRect = document.querySelector<HTMLElement>(`[data-energy-flight="${id}"] img`)?.getBoundingClientRect();
           const sourceX = ballRect ? ballRect.left + ballRect.width / 2 : x;
           const sourceY = ballRect ? ballRect.top + ballRect.height / 2 : y;
           const geometry = imagineProjectileGeometry(sourceX, sourceY, tx, ty);
          setProjectiles((current) => [...current, {
            id: projectileId,
             x: sourceX,
             y: sourceY,
            dx: geometry.dx,
            dy: geometry.dy,
            angle: geometry.angle,
            art: getReward("horizontal-collector").art,
            glow: def.glow,
          }]);
          later(() => setProjectiles((current) => current.filter((projectile) => projectile.id !== projectileId)), slow ? 180 : 520);
          activateTarget(slotId, reward.id, chainId, slow ? 100 : 440, {
            left: targetRect.left,
            top: targetRect.top,
            right: targetRect.right,
            bottom: targetRect.bottom,
            width: targetRect.width,
            height: targetRect.height,
          }, def.glow);
        }, slow ? index * 28 : ENERGY_BALL_ARRIVAL_MS + Math.round(index * Math.min(160, (ENERGY_BALL_CENTRE_MS - 700) / Math.max(1, targets.length))));
      });
      later(() => chains.current.delete(chainId), 5000);
    };
    window.addEventListener("slate:activate-reward", onActivate);
    return () => {
      window.removeEventListener("slate:activate-reward", onActivate);
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
      chains.current.clear();
    };
    // Stable listener: game updates (e.g. the ball being consumed) must never
    // cancel launches already scheduled; the latest game is read through refs.
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {flights.map((f) => {
        const dx = window.innerWidth / 2 - f.x;
        const dy = window.innerHeight / 2 - f.y;
        if (f.kind === "collector") {
          return (
            <div
              key={f.id}
              className={`imr-collector imr-collector--${f.axis}`}
              style={{
                left: f.x - 32,
                top: f.y - 32,
                color: f.glow,
                ["--sweep-distance" as string]: `${f.distance ?? 0}px`,
                ["--sweep-direction" as string]: f.direction ?? 1,
              }}
            >
              <span className="imr-collector-trail" />
              <img src={f.art} alt="" className="relative z-[1] h-16 w-16 object-contain" />
            </div>
          );
        }
        return (
          <div key={f.id} data-energy-flight={f.kind === "energy" ? f.id : undefined} className={`${f.kind === "energy" ? "imr-energy-hold" : "imr-travel"} absolute`} style={{ left: f.x - 32, top: f.y - 32, ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px` }}>
             <div className="imr-grow">
               <span className="imr-particles" />
              <img src={f.art} alt="" className={`${f.motion} h-16 w-16 object-contain`} style={{ filter: `drop-shadow(0 0 14px ${f.glow})` }} />
              {f.expression ? <span className="imr-vault-expression">{f.expression}</span> : null}
            </div>
          </div>
        );
      })}
      {projectiles.map((projectile) => (
        <span
          key={projectile.id}
          className="imr-projectile"
          style={{
            left: projectile.x - 22,
            top: projectile.y - 22,
            color: projectile.glow,
            ["--projectile-dx" as string]: `${projectile.dx}px`,
            ["--projectile-dy" as string]: `${projectile.dy}px`,
            ["--projectile-angle" as string]: `${projectile.angle}deg`,
          }}
        >
          <img src={projectile.art} alt="" className="h-11 w-11 object-contain" />
        </span>
      ))}
      {impacts.map((impact) => (
        <span key={impact.id} className="imr-impact" style={{ left: impact.x - 18, top: impact.y - 18, color: impact.glow }} />
      ))}
      <style>{`
.imr-travel{animation:imr-travel 2.2s cubic-bezier(.22,1,.36,1) forwards;will-change:transform,opacity}
 .imr-energy-hold{animation:imr-energy-arrive ${ENERGY_BALL_ARRIVAL_MS}ms cubic-bezier(.22,1,.36,1) forwards,imr-energy-disappear ${ENERGY_BALL_FADE_MS}ms ${ENERGY_BALL_ARRIVAL_MS + ENERGY_BALL_CENTRE_MS}ms linear forwards;will-change:transform,opacity}
 @keyframes imr-energy-arrive{0%{transform:translate(0,0);opacity:0}22%{transform:translate(0,-18px);opacity:1}100%{transform:translate(var(--dx),var(--dy));opacity:1}}
 @keyframes imr-energy-disappear{to{opacity:0}}
 .imr-energy-hold .imr-grow{animation:imr-energy-size ${ENERGY_BALL_ARRIVAL_MS}ms cubic-bezier(.22,1,.36,1) forwards}
 @keyframes imr-energy-size{0%{transform:scale(.7)}28%{transform:scale(1.15)}100%{transform:scale(4.2)}}
 .imr-energy-hold .imr-orbit{animation:imr-orbit ${ENERGY_BALL_SPIN_MS}ms ${ENERGY_BALL_ARRIVAL_MS}ms ease-in-out infinite both}
 .imr-vault-expression{position:absolute;left:50%;top:50%;max-width:min(72vw,520px);transform:translate(-50%,-50%);white-space:nowrap;border-radius:6px;background:hsl(var(--background)/.94);padding:.4rem .65rem;color:hsl(var(--foreground));font-size:clamp(1rem,3vw,2rem);font-weight:700;box-shadow:0 0 24px hsl(var(--background));opacity:0;animation:imr-vault-reveal 1.2s .65s ease both}
 @keyframes imr-vault-reveal{0%{opacity:0;transform:translate(-50%,-20%) scale(.8)}20%,75%{opacity:1;transform:translate(-50%,-115%) scale(1)}100%{opacity:0;transform:translate(-50%,-135%) scale(.96)}}
@keyframes imr-travel{0%{transform:translate(0,0);opacity:0}8%{opacity:1}14%{transform:translate(0,-18px)}36%{transform:translate(var(--dx),var(--dy))}78%{transform:translate(var(--dx),var(--dy));opacity:1}100%{transform:translate(calc(var(--dx) + 55vw),calc(var(--dy) - 70vh));opacity:0}}
.imr-grow{animation:imr-grow 2.2s cubic-bezier(.22,1,.36,1) forwards;will-change:transform}
@keyframes imr-grow{0%{transform:scale(.7)}10%{transform:scale(1.15)}36%{transform:scale(4.2)}78%{transform:scale(4)}100%{transform:scale(.6)}}
.imr-pulse,.imr-stamp,.imr-spin,.imr-unlock,.imr-burst,.imr-sweepx,.imr-sweepy,.imr-orbit,.imr-calculate{animation-delay:.8s;animation-duration:.9s;animation-fill-mode:both;animation-timing-function:ease-in-out}
.imr-pulse{animation-name:imr-pulse}@keyframes imr-pulse{0%,100%{transform:scale(1)}30%{transform:scale(1.18)}60%{transform:scale(.94)}}
.imr-stamp{animation-name:imr-stamp}@keyframes imr-stamp{0%{transform:scale(1) rotate(0)}40%{transform:scale(.8) rotate(-12deg)}70%{transform:scale(1.12) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
.imr-spin{animation-name:imr-spin}@keyframes imr-spin{to{transform:rotate(360deg)}}
.imr-unlock{animation-name:imr-unlock}@keyframes imr-unlock{0%,100%{transform:rotate(0)}25%{transform:rotate(-10deg)}50%{transform:rotate(10deg) scale(1.1)}}
.imr-burst{animation-name:imr-burst}@keyframes imr-burst{0%{transform:scale(1)}50%{transform:scale(1.35);filter:brightness(1.6)}100%{transform:scale(1)}}
.imr-orbit{animation-name:imr-orbit}@keyframes imr-orbit{0%{transform:rotate(0) scale(1)}50%{transform:rotate(190deg) scale(1.18)}100%{transform:rotate(360deg) scale(1)}}
.imr-calculate{animation-name:imr-calculate}@keyframes imr-calculate{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-10px) rotate(-4deg)}55%{transform:translateY(3px) rotate(3deg)}75%{transform:translateY(-4px) rotate(-2deg)}}
.imr-collector{position:absolute;width:64px;height:64px;animation-duration:1.25s;animation-timing-function:cubic-bezier(.2,.72,.18,1);animation-fill-mode:both;will-change:transform,opacity;filter:drop-shadow(0 0 8px currentColor)}
.imr-collector--x{animation-name:imr-collector-x}.imr-collector--y{animation-name:imr-collector-y}@keyframes imr-collector-x{0%{transform:translateX(0) scale(.82);opacity:0}14%{transform:translateX(0) scale(1.12);opacity:1}86%{transform:translateX(var(--sweep-distance)) scale(1);opacity:1}100%{transform:translateX(var(--sweep-distance)) scale(.7);opacity:0}}@keyframes imr-collector-y{0%{transform:translateY(0) scale(.82);opacity:0}14%{transform:translateY(0) scale(1.12);opacity:1}86%{transform:translateY(var(--sweep-distance)) scale(1);opacity:1}100%{transform:translateY(var(--sweep-distance)) scale(.7);opacity:0}}
.imr-collector-trail{position:absolute;z-index:0;display:block;background:linear-gradient(90deg,transparent,currentColor);opacity:.58;filter:drop-shadow(0 0 5px currentColor)}.imr-collector--x .imr-collector-trail{right:50%;top:25%;width:min(42vw,520px);height:50%;transform:scaleX(var(--sweep-direction));transform-origin:right center}.imr-collector--y .imr-collector-trail{bottom:50%;left:25%;width:50%;height:min(42vh,420px);background:linear-gradient(180deg,transparent,currentColor);transform:scaleY(var(--sweep-direction));transform-origin:center bottom}
.imr-charge-bolt{position:absolute;inset:-18px;border:2px solid currentColor;border-radius:50%;clip-path:polygon(0 46%,26% 38%,19% 55%,48% 44%,42% 62%,72% 46%,65% 64%,100% 50%,73% 74%,76% 55%,45% 76%,50% 54%,17% 70%,24% 49%);filter:drop-shadow(0 0 5px currentColor);animation:imr-charge .2s steps(2,end) 4 both}@keyframes imr-charge{0%{opacity:.2;transform:scale(.84)}100%{opacity:1;transform:scale(1.18)}}
.imr-projectile{position:absolute;width:44px;height:44px;filter:drop-shadow(0 0 7px currentColor);transform:translate(0,0) rotate(var(--projectile-angle));animation:imr-projectile .52s cubic-bezier(.2,.78,.18,1) both;will-change:transform,opacity}@keyframes imr-projectile{0%{transform:translate(0,0) rotate(var(--projectile-angle)) scale(.5);opacity:0}12%{opacity:1}90%{transform:translate(var(--projectile-dx),var(--projectile-dy)) rotate(var(--projectile-angle)) scale(1);opacity:1}100%{transform:translate(var(--projectile-dx),var(--projectile-dy)) rotate(var(--projectile-angle)) scale(.7);opacity:0}}
.imr-impact{position:absolute;width:36px;height:36px;border:2px solid currentColor;border-radius:50%;box-shadow:0 0 12px currentColor;animation:imr-impact .36s ease-out both}@keyframes imr-impact{0%{transform:scale(.2);opacity:1}100%{transform:scale(2.1);opacity:0}}
.imr-particles{position:absolute;inset:50%;width:5px;height:5px;border-radius:999px;background:currentColor;box-shadow:32px 0 currentColor,-32px 0 currentColor,0 32px currentColor,0 -32px currentColor,23px 23px currentColor,-23px -23px currentColor,23px -23px currentColor,-23px 23px currentColor;animation:imr-particles .9s .75s ease-out both}@keyframes imr-particles{0%{transform:scale(.15);opacity:0}35%{opacity:.85}100%{transform:scale(1.35);opacity:0}}
@media(prefers-reduced-motion:reduce){.imr-travel,.imr-grow,.imr-collector{animation-duration:.4s}.imr-pulse,.imr-stamp,.imr-spin,.imr-unlock,.imr-burst,.imr-orbit,.imr-calculate,.imr-particles,.imr-charge-bolt{animation:none}.imr-projectile,.imr-impact{animation-duration:.16s}}
 @media(prefers-reduced-motion:reduce){.imr-energy-hold .imr-orbit{animation:none}}
`}</style>
    </div>
  );
}
