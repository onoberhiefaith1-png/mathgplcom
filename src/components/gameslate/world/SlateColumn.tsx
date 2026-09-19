import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { RoomDef } from "@/lib/slate/rooms";
import { getSurface } from "@/lib/slate/surfaces";
import { REWARDS, getReward, isWorldInteractionEligible } from "@/lib/slate/rewards";
import { WritingRegion } from "@/components/slate/text3d/WritingRegion";
import { defaultTextSettings } from "@/lib/slate/text3d";
import type { TextBounds } from "@/lib/slate/text3d";
import { defaultNumberSettings } from "@/lib/slate/defaults";
import { noiseNormalMap, surfaceMaterial } from "./materials";
import { useTextureMap } from "./textures";
import { usePbr } from "./pbr";
import { SlateSection } from "./sections/SlateSection";
import { NewWritingSurface } from "./sections/NewWritingSurface";
import { getConstruction } from "./sections/construction";
import { surfaceFamily } from "@/lib/slate/pbr";
import {
  CORE_DURATION,
  CoreEffect,
  PulseEffect,
  SWEEP_DURATION,
  SweepEffect,
  VAULT_DURATION,
  VaultEffect,
} from "./Effects";
import { playSfx } from "@/lib/slate/audio";
import { ensureEffectReady } from "@/lib/slate/vfx/prepare";
import { setPerf } from "@/lib/slate/vfx/perf";
import { ScriptStage } from "./ScriptStage";
import { compileScript } from "@/lib/slate/vfx/script";
import { choreography, objectMotion } from "@/lib/slate/vfx/profiles";
import { FragmentBurst, OrbitRings } from "./RewardBody";
import { PremiumBombBody } from "./PremiumBombBody";
import { useVfxTextures } from "./vfxTextures";
import { advanceEffectClock, effectNow, effectsPaused, setEffectsPaused } from "@/lib/slate/vfx/clock";
import {
  CHAIN_BOMB_DURATION,
  PremiumChainBombEffect,
  type PremiumTarget,
} from "./EffectsPremium";
import {
  INNER_W,
  SLATE_D,
  SLATE_FRONT,
  SLATE_W,
  SLATE_Z,
  
  VIEW_BOTTOM,
  VIEW_H,
  VIEW_TOP,
  buildLayout,
  gameSurfaceWidth,
  gameWritingWidth,
} from "@/lib/slate/layout";
import type {
  EditorMode,
  Game,
  NumberSettings,
  PremiumBombStyle,
  RewardInstance,
  Selection,
  Slot,
} from "@/lib/slate/types";

export interface ScrollState {
  target: number;
  current: number;
  max: number;
  /** Set while a reward is being dragged, so the slate itself stays put. */
  locked: boolean;
}

interface Props {
  room: RoomDef;
  /** true when the game has no room — wall-only effects are skipped */
  roomless?: boolean;
  game: Game;
  mode: EditorMode;
  selection: Selection;
  scroll: React.MutableRefObject<ScrollState>;
  onSelect: (selection: Selection) => void;
  onSlotChange: (slotId: string, patch: Partial<Slot>) => void;
  onRewardMove: (slotId: string, rewardId: string, x: number, y: number) => void;
  onRewardActivate: (slotId: string, rewardId: string, type: string) => void;
  onRewardConsume: (slotId: string, rewardId: string) => void;
  /** Game Play: the slate glides until this region sits in the middle of view. */
  focusSlotId?: string | null;
  /** Game Play: the region the slate has settled on, reported once per change. */
  onFocusSlot?: (slotId: string) => void;
  /** Game Play: the mathematics comes from Floating Numbers, not the keyboard. */
  readOnlyWriting?: boolean;
}

interface ActiveEffect {
  profile: string;
  colour: string;
  power: number;
  start: number;
  /** Effect-clock time this effect finishes; it is retired on the frame it passes. */
  end: number;
  slotId: string;
  /** Local offset the object is dragged toward, when a collector claims it. */
  pull?: { x: number; y: number };
  /** Travel direction for objects that launch along an axis. */
  direction?: number;
  targets?: PremiumTarget[];
  preview?: boolean;
  style?: PremiumBombStyle;
}

const baseLife = (profile: string) =>
  profile === "chain-bomb"
    ? CHAIN_BOMB_DURATION
    : profile === "core"
    ? CORE_DURATION
    : profile.startsWith("sweep")
      ? SWEEP_DURATION
      : profile === "vault"
        ? VAULT_DURATION
        : 1.3;

/** A long script must never be cut off by the effect it rides on. */
const effectLife = (profile: string, script?: string) =>
  Math.max(baseLife(profile), compileScript(script)?.duration ?? 0);

/**
 * One reward: a physical object attached to the slate that is the actor
 * inside its own effect. The object reveals, charges, transforms and — for
 * the bomb — breaks apart; the effect is mounted as its child, so it is born
 * at the object's position and travels with it.
 */
function RewardObject({
  reward,
  texture,
  openTexture,
  size,
  opacity,
  glow,
  selected,
  editable,
  showExpression,
  speed,
  effect,
  onDown,
  onActivate,
  onExpire,
  premiumStyle,
  onPremiumImpact,
}: {
  reward: RewardInstance;
  texture: THREE.Texture;
  openTexture?: THREE.Texture | undefined;
  size: number;
  opacity: number;
  glow: number;
  selected: boolean;
  editable: boolean;
  /** Vault only: show the teacher's expression while it is being edited. */
  showExpression: boolean;
  /** Global effect speed, so scripted content keeps pace with its effect. */
  speed: number;
  effect: ActiveEffect | undefined;
  onDown: (event: ThreeEvent<PointerEvent>) => void;
  onActivate: () => void;
  /** Hourglass only: its stored time ran out before it was collected. */
  onExpire?: () => void;
  premiumStyle: PremiumBombStyle;
  onPremiumImpact: (target: PremiumTarget, preview: boolean) => void;
}) {
  const def = getReward(reward.type);
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const fx = useRef<THREE.Group>(null);

  const sprite = useRef<THREE.Mesh>(null);
  const aura = useRef<THREE.PointLight>(null);
  const sand = useRef<THREE.Mesh>(null);
  const band = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const active = Boolean(effect);
  const vault = def.profile === "vault";
  const hourglass = def.profile === "shard";
  const premium = def.profile === "chain-bomb";
  const width = size * def.ratio;
  // the vault unlocks and blazes; every other object stays itself throughout
  const map = vault && active && openTexture ? openTexture : texture;
  const sealed = useMemo(() => (vault ? glyphShimmer() : null), [vault]);
  const chor = useMemo(() => choreography(def.profile), [def.profile]);
  const rate = Math.max(0.4, speed);

  // hourglass: its stored time runs down while it waits to be collected
  const total = hourglass ? Math.max(1000, reward.durationMs ?? 15_000) : 0;
  const started = useRef<number | null>(null);
  const [left, setLeft] = useState(total);
  const fading = useRef(false);
  useEffect(() => {
    if (!hourglass || editable || reward.state !== "dormant") return;
    started.current = Date.now();
    const id = window.setInterval(() => {
      const remaining = total - (Date.now() - (started.current ?? Date.now()));
      // only re-render when the displayed second actually changes: a tenth-second
      // rebuild of the slate is a visible hitch inside a running effect
      setLeft((previous) =>
        Math.ceil(previous / 1000) === Math.ceil(Math.max(0, remaining) / 1000) && remaining > 400
          ? previous
          : Math.max(0, remaining),
      );
      if (remaining <= 0 && !fading.current) {
        fading.current = true;
        window.clearInterval(id);
        // its stored energy expires: a last glow, then it dissolves
        window.setTimeout(() => onExpire?.(), 900);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [editable, hourglass, onExpire, reward.state, total]);

  useFrame(({ clock }) => {
    const node = group.current;
    if (!node) return;
    const life = 0.4 + (reward.animation ?? 1) * 0.6;
    // idle motion rides the same clock, so Pause holds the whole object still
    const bob = Math.sin(effectNow(clock) * 1.3 + reward.x) * 0.012 * life;
    const lift = hovered ? 0.09 : 0;
    node.position.z = THREE.MathUtils.lerp(node.position.z, 0.06 + lift, 0.18);

    const t = effect ? (effectNow(clock) - effect.start) * rate : 0;
    const motion = effect ? objectMotion(chor, t, effect.direction ?? 1) : null;

    // a collector claims this object: it accelerates along a curved path
    if (effect?.pull) {
      const age = effectNow(clock) - effect.start;
      const k = Math.min(1, Math.pow(Math.max(0, age) / 0.42, 2.2));
      node.position.x = effect.pull.x * k;
      node.position.y = bob + effect.pull.y * k + Math.sin(k * Math.PI) * 0.22;
      node.rotation.z = k * 1.3;
    } else if (motion) {
      // the object travels inside its own effect
      node.position.x = motion.x;
      node.position.y = bob + motion.y;
      node.rotation.z = motion.spin;
    } else {
      node.position.x = 0;
      node.position.y = bob;
      node.rotation.z = 0;
    }

    // the sealed band: something is inside, but it stays unreadable
    if (band.current) {
      const material = band.current.material as THREE.MeshBasicMaterial;
      if (material.map) material.map.offset.x = (effectNow(clock) * 0.09) % 1;
      material.opacity = active ? 0 : 0.32 + Math.sin(effectNow(clock) * 2.1 + reward.x) * 0.1;
    }

    // clarity: dormant objects are faint, activation sharpens them first
    if (sprite.current && !premium) {
      const material = sprite.current.material as THREE.MeshBasicMaterial;
      const clarity = motion ? motion.clarity : hovered ? 0.6 : 0;
      const dormant = reward.hidden ? 0.16 : opacity;
      const dissolve = fading.current ? Math.max(0, left / 400) : 1;
      material.opacity = THREE.MathUtils.lerp(dormant, 1, clarity) * dissolve;
      const tint = 0.62 + 0.38 * clarity;
      material.color.setRGB(tint, tint, tint);
    }

    // its own light spills onto the surface around it
    if (aura.current) {
      aura.current.intensity = motion ? 26 * motion.emission * (effect?.power ?? 1) : 0;
    }

    // hourglass: the sand falls as its stored time runs down
    if (sand.current && hourglass) {
      const used = total > 0 ? 1 - left / total : 0;
      sand.current.scale.y = Math.max(0.05, 1 - used);
      sand.current.position.y = -size * 0.18 * used;
    }

    const target =
      (hovered ? 1.16 : 1) * (premium ? 1 : motion ? motion.scale : 1) * (vault && active ? 1.28 : 1);
    node.scale.setScalar(THREE.MathUtils.lerp(node.scale.x, target, 0.28));

    // Collector trails must stay axis-locked. The bomb's energy follows its
    // charging body, then detaches from scale/spin at the shatter origin.
    if (fx.current) {
      const compensate = def.profile.startsWith("sweep") || def.profile === "chain-bomb" || (def.profile === "core" && t >= chor.transform);
      fx.current.rotation.z = compensate ? -node.rotation.z : 0;
      const s = compensate ? node.scale.x || 1 : 1;
      fx.current.scale.setScalar(1 / s);
    }


    if (body.current) body.current.visible = !motion || motion.visible;
  });

  return (
    <group>
      <group
        ref={group}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = editable ? "grab" : "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        onPointerDown={onDown}
        onClick={(event) => {
          event.stopPropagation();
          onActivate();
        }}
      >
        <pointLight ref={aura} color={chor.light} intensity={0} distance={5} decay={2} />

        <group ref={body}>
          {premium ? (
            <PremiumBombBody
              size={size}
              active={active}
              startedAt={effect?.start ?? 0}
              speed={rate}
              lighting={reward.lighting ?? 1}
            />
          ) : (
          <mesh ref={sprite} rotation={[0, 0, ((reward.rotation ?? 0) * Math.PI) / 180]}>
            <planeGeometry args={[width, size]} />
            <meshBasicMaterial
              map={map}
              transparent
              depthWrite={false}
              opacity={reward.hidden ? 0.16 : opacity}
              toneMapped={false}
            />
          </mesh>
          )}

          {/* the hourglass shows the time it is holding */}
          {hourglass && !editable && reward.state === "dormant" ? (
            <>
              <mesh ref={sand} position={[0, 0, 0.012]}>
                <planeGeometry args={[width * 0.26, size * 0.34]} />
                <meshBasicMaterial
                  color={def.glow}
                  transparent
                  opacity={0.5}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
              <Text
                position={[0, -size * 0.62, 0.03]}
                fontSize={size * 0.26}
                font="/fonts/technical.ttf"
                color="#dff4ff"
                anchorX="center"
                anchorY="middle"
                outlineWidth={size * 0.014}
                outlineColor="#03151f"
              >
                {clockLabel(left)}
              </Text>
            </>
          ) : null}

          {active ? (
            <OrbitRings
              colour={def.glow}
              size={Math.max(width, size)}
               startedAt={effect?.start ?? 0}
               chargeDuration={chor.transform}
               rate={rate}
            />
          ) : null}

          {/* the sealed centre band: illegible shifting glyphs, never the text */}
          {vault && !showExpression && sealed ? (
            <mesh ref={band} position={[0, 0, 0.025]}>
              <planeGeometry args={[width * 0.44, size * 0.3]} />
              <meshBasicMaterial
                map={sealed}
                color={def.glow}
                transparent
                opacity={0}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ) : null}

          {/* the teacher's expression, readable only while this vault is edited */}
          {vault && showExpression && reward.expression ? (
            <Text
              position={[0, 0, 0.03]}
              fontSize={size * 0.3}
              maxWidth={width * 0.5}
              font="/fonts/technical.ttf"
              color="#cfe8ff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={size * 0.012}
              outlineColor="#04121f"
            >
              {reward.expression}
            </Text>
          ) : null}

          {/* dormant ambient glow, brighter on hover */}
          {!premium ? <mesh position={[0, 0, -0.01]}>
            {vault ? (
              <planeGeometry args={[width * 1.1, size * 0.72]} />
            ) : (
              <circleGeometry args={[size * 0.62, 24]} />
            )}
            <meshBasicMaterial
              color={def.glow}
              transparent
              opacity={(hovered ? 0.3 : 0.11) * glow}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh> : null}
        </group>

        {selected ? (
          <mesh position={[0, 0, 0.02]}>
            <ringGeometry args={[width * 0.52, width * 0.56, 40]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} toneMapped={false} />
          </mesh>
        ) : null}

        {/* the effect is a child of the object, so it is born where the
            object is and travels with it. The wrapper cancels the object's
            own spin and growth, so a sweep trail stays true to its axis. */}
        {effect ? (
          <group ref={fx}>
            {effect.profile === "core" ? (
              <>
                <FragmentBurst
                  size={size * chor.grow}
                  power={effect.power}
                  delay={chor.transform}
                  rate={rate}
                />
                <CoreEffect key={effect.start} startedAt={effect.start} colour={def.glow} power={effect.power} />
              </>
            ) : effect.profile === "chain-bomb" ? (
              <PremiumChainBombEffect
                key={effect.start}
                startedAt={effect.start}
                style={effect.style ?? premiumStyle}
                power={effect.power}
                speed={rate}
                targets={effect.targets ?? []}
                onImpact={(target) => onPremiumImpact(target, effect.preview ?? false)}
              />
            ) : effect.profile === "sweep-horizontal" || effect.profile === "sweep-vertical" ? (
              <SweepEffect
                key={effect.start}
                startedAt={effect.start}
                colour={def.glow}
                power={effect.power}
                axis={chor.travel?.axis ?? "x"}
                span={chor.travel?.span ?? 4.4}
                direction={effect.direction ?? 1}
                rate={rate}
                timing={{
                  reveal: chor.reveal,
                  anticipation: chor.anticipation,
                  transform: chor.transform,
                  duration: chor.duration,
                }}
              />
            ) : effect.profile === "vault" ? (
              <VaultEffect
                key={effect.start}
                startedAt={effect.start}
                colour={def.glow}
                power={effect.power}
                expression={reward.expression}
                width={width}
                height={size}
              />
            ) : (
              <PulseEffect key={effect.start} startedAt={effect.start} colour={def.glow} power={effect.power} />
            )}
          </group>
        ) : null}


        {/* the hidden effect content rides inside the effect that released it */}
        {effect ? (
          <ScriptStage
            key={`script-${effect.start}`}
            source={reward.script}
            startedAt={effect.start}
            colour={def.glow}
            size={size}
            speed={speed}
          />
        ) : null}
      </group>
    </group>
  );
}

/** mm:ss for the time an hourglass is holding. */
const clockLabel = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** An illegible, shifting glyph strip: the sealed contents of a vault. */
let shimmer: THREE.Texture | null = null;
function glyphShimmer() {
  if (shimmer) return shimmer;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * 256;
      const y = 14 + Math.random() * 36;
      const w = 2 + Math.random() * 9;
      const h = 2 + Math.random() * 3;
      ctx.globalAlpha = 0.25 + Math.random() * 0.6;
      ctx.fillRect(x, y, w, h);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  shimmer = texture;
  return texture;
}

/**
 * ONE writing surface, built out of its OWN saved material. A Game Line may
 * carry its own surface; when it does not, it uses the Game's surface. The line
 * number is part of this physical object: same material, depth and light.
 */
function RegionSurface({
  surface,
  build,
  recipe,
  index,
  width,
  height,
  numbers,
  selected,
  colour,
  displayNumber,
}: {
  surface: ReturnType<typeof getSurface>;
  build: ReturnType<typeof getConstruction>;
  recipe: ReturnType<typeof surfaceMaterial>;
  index: number;
  width: number;
  height: number;
  numbers: NumberSettings;
  selected: boolean;
  colour: string | undefined;
  displayNumber: number;
}) {
  const pbr = usePbr(
    surfaceFamily(surface.id),
    Math.max(0.5, width * 0.52),
    Math.max(0.35, height * 0.52),
  );
  // the marker rides on the surface's own left edge, never in a far-off column
  const numberX = -width / 2 + Math.max(0.12, build.inset * 0.5);
  if (surface.newKind) {
    return (
      <>
        <NewWritingSurface
          kind={surface.newKind}
          width={width}
          height={height}
          maps={pbr}
          accent={selected ? "#ffe9bd" : surface.accent}
          colour={colour}
        />
        {numbers.visible ? (
          <Text
            position={[numberX, height / 2 - Math.max(0.12, build.inset * 0.5), 0.025]}
            fontSize={0.18 * numbers.size}
            font="/fonts/technical.ttf"
            color={numbers.colour ?? surface.ink}
            anchorX="center"
            anchorY="middle"
            fillOpacity={numbers.opacity}
          >
            {displayNumber}
          </Text>
        ) : null}
      </>
    );
  }
  return (
    <SlateSection
      index={index}
      width={width}
      height={height}
      maps={pbr}
      build={build}
      physical={recipe.physical}
      accent={selected ? "#ffe9bd" : surface.accent}
      numbers={numbers}
      numberOffsetX={numberX}
      displayNumber={displayNumber}
      transparent={surface.transparent ?? false}
      none={surface.none ?? false}
      ornament={surface.ornament}
    />
  );
}

/**
 * The slate: one long physical object in the room. The camera and the room
 * never move — this object slides vertically through the fixed viewpoint,
 * carrying its writing regions, its live text and its rewards with it.
 */
export function SlateColumn({
  room,
  roomless = false,
  game,
  mode,
  selection,
  scroll,
  onSelect,
  onSlotChange,
  onRewardMove,
  onRewardActivate,
  onRewardConsume,
  focusSlotId = null,
  onFocusSlot,
  readOnlyWriting = false,
}: Props) {
  const surface = getSurface(game.surfaceId);
  const recipe = surfaceMaterial(surface.id);
  const { rewards: rewardSettings, effects } = game.settings;
  const textSettings = game.settings.text ?? defaultTextSettings();
  const numberSettings = game.settings.numbers ?? defaultNumberSettings();
  // authoring = arranging the world (edit mode only). Writing is always live:
  // the surface exists to be written on, in view mode as much as in edit mode.
  const editable = mode === "edit";

  /** Real rendered bounds per slot; Game Line layout uses height, material uses all four edges. */
  const [textBounds, setTextBounds] = useState<Record<string, TextBounds>>({});
  const measure = useCallback((slotId: string, bounds: TextBounds) => {
    setTextBounds((previous) => {
      const current = previous[slotId];
      if (
        current &&
        Math.abs(current.width - bounds.width) < 0.02 &&
        Math.abs(current.height - bounds.height) < 0.02 &&
        Math.abs(current.left - bounds.left) < 0.02 &&
        Math.abs(current.top - bounds.top) < 0.02
      ) return previous;
      return { ...previous, [slotId]: bounds };
    });
  }, []);

  const textures = useTextureMap();
  const rewardArt = useTexture(REWARDS.map((r) => r.art));
  const artById = useMemo(() => {
    const map: Record<string, THREE.Texture> = {};
    REWARDS.forEach((r, index) => {
      const texture = rewardArt[index];
      if (texture) map[r.id] = texture;
    });
    return map;
  }, [rewardArt]);

  // the opened presentation, for objects that physically unlock
  const openDefs = useMemo(() => REWARDS.filter((r) => r.openArt), []);
  const openArt = useTexture(openDefs.map((r) => r.openArt as string));
  const openArtById = useMemo(() => {
    const map: Record<string, THREE.Texture> = {};
    openDefs.forEach((r, index) => {
      const texture = openArt[index];
      if (texture) map[r.id] = texture;
    });
    return map;
  }, [openArt, openDefs]);

  // how this material is physically built into writing sections
  const build = useMemo(() => getConstruction(surface.id), [surface.id]);
  const renderedTextSettings = readOnlyWriting
    ? { ...textSettings, align: "left" as const }
    : textSettings;
  const viewport = useThree((state) => state.viewport);
  const camera = useThree((state) => state.camera);
  const visibleAtSlate = viewport.getCurrentViewport(camera, new THREE.Vector3(0, 0, SLATE_Z));
  const playWritingWidth = gameWritingWidth(visibleAtSlate.width);
  const writingWidth = readOnlyWriting
    ? playWritingWidth
    : SLATE_W - build.inset * 2 - 0.3;

  const layout = useMemo(
    () => buildLayout(
      game.slots,
      textSettings.size,
      build.gap + 0.05,
      Object.fromEntries(Object.entries(textBounds).map(([id, bounds]) => [id, bounds.height])),
      writingWidth,
      !readOnlyWriting,
    ),
    [game.slots, textSettings.size, build.gap, textBounds, writingWidth],
  );

  // the slate is made of a real scanned material, lit by the room
  const pbr = usePbr(surfaceFamily(surface.id), 3.1, 0.72);
  const normal = useMemo(
    () => noiseNormalMap(recipe.normalKey, recipe.normalScale, recipe.grain),
    [recipe],
  );
  void normal;

  const group = useRef<THREE.Group>(null);
  const clock = useThree((state) => state.clock);
  const [scrollTick, setScrollTick] = useState(0);
  const lastTick = useRef(0);
  const lastCount = useRef(0);
  const [active, setActive] = useState<Record<string, ActiveEffect>>({});
  const rewardNodes = useRef(new Map<string, { node: THREE.Group; slotId: string; reward: RewardInstance }>());
  /** Every effect texture is resident before anything can play. */
  useVfxTextures();
  /** The last previewed effect, so Reset can replay it from the beginning. */
  const lastPreview = useRef<{ slotId: string; rewardId: string; style?: PremiumBombStyle } | null>(null);
  const [dragging, setDragging] = useState<{ slotId: string; rewardId: string } | null>(null);

  scroll.current.max = layout.maxScroll;

  // GAME PLAY. One physical writing surface per Floating Numbers line: the
  // active Game Line is brought into the middle of the view by moving the
  // slate itself, exactly as a hand scroll would. The region the slate settles
  // on is reported back, so scrolling to surface 9 selects Line 9.
  const focused = useRef<string | null>(null);
  useEffect(() => {
    if (!focusSlotId) return;
    const region = layout.regions.find((item) => item.slot.id === focusSlotId);
    if (!region) return;
    focused.current = focusSlotId;
    scroll.current.target = Math.min(
      layout.maxScroll,
      Math.max(0, region.centre - VIEW_H / 2),
    );
  }, [focusSlotId, layout, scroll]);

  // leaving the world never leaves the clock paused
  useEffect(() => () => setEffectsPaused(false), []);

  const activeRef = useRef(active);
  activeRef.current = active;

  useFrame(({ clock: frameClock }, raw) => {
    // one authoritative clock for every effect on screen
    advanceEffectClock(frameClock.elapsedTime);
    const dt = Math.min(raw, 0.05);
    const state = scroll.current;
    state.target = Math.min(state.max, Math.max(0, state.target));
    // heavy physical object: exponential settle, never a snap
    state.current += (state.target - state.current) * (1 - Math.exp(-11 * dt));
    if (group.current) group.current.position.y = VIEW_TOP + state.current;
    // the surface nearest the middle of the view IS the active Game Line
    if (onFocusSlot && Math.abs(state.target - state.current) < 0.04) {
      let best: string | null = null;
      let bestDistance = Infinity;
      for (const region of layout.regions) {
        const distance = Math.abs(VIEW_TOP + state.current - region.centre);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = region.slot.id;
        }
      }
      if (best && best !== focused.current) {
        focused.current = best;
        onFocusSlot(best);
      }
    }
    const count = Object.keys(activeRef.current).length;
    const running = count > 0;
    if (count !== lastCount.current) {
      lastCount.current = count;
      setPerf({ activeEffects: count });
    }
    // culling re-renders the slate: never do it while an effect is playing
    if (!running && Math.abs(state.current - lastTick.current) > 0.3) {
      lastTick.current = state.current;
      setScrollTick((v) => v + 1);
    }
    // effects retire off the same clock they animate on, so a pause holds them
    if (running && !effectsPaused()) {
      const now = effectNow(frameClock);
      const done = Object.entries(activeRef.current).filter(([, effect]) => now >= effect.end);
      if (done.length) {
        setActive((previous) => {
          const next = { ...previous };
          for (const [id] of done) delete next[id];
          return next;
        });
      }
    }
  });

  const fire = useCallback(
    (slotId: string, reward: RewardInstance, pull?: { x: number; y: number }, targets?: PremiumTarget[], preview = false, style?: PremiumBombStyle) => {
      const def = getReward(reward.type);
      // this effect's images are prepared once, in the background; playback
      // itself never waits for an asset
      void ensureEffectReady(def.profile, def.label);
      const power = (reward.effectIntensity ?? 1) * Math.max(0.4, effects.glow);
      if (def.profile === "heart") playSfx("heart");
      if (def.profile === "shard") playSfx("time");
      if (def.profile === "seal") playSfx("seal");
      // a collector launches away from the edge it sits closest to
      const direction = reward.x < 50 ? 1 : -1;
      // playing again always starts from the beginning, unpaused
      setEffectsPaused(false);
      const start = effectNow(clock);
      const life = effectLife(def.profile, reward.script) / Math.max(0.4, effects.speed);
      setActive((previous) => ({
        ...previous,
        [reward.id]: {
          profile: def.profile,
          colour: def.glow,
          power,
          start,
          end: start + life,
          slotId,
          direction,
          ...(pull ? { pull } : {}),
          ...(targets ? { targets } : {}),
          preview,
          ...(style ? { style } : {}),
        },
      }));
      return def.profile;
    },
    [clock, effects.glow, effects.speed],
  );

  /** Open one object: effect, status update, then it is consumed. */
  const run = useCallback(
    (slotId: string, reward: RewardInstance, pull?: { x: number; y: number }) => {
      const profile = fire(slotId, reward, pull);
      onRewardActivate(slotId, reward.id, reward.type);
      window.setTimeout(
        () => onRewardConsume(slotId, reward.id),
        (effectLife(profile, reward.script) / Math.max(0.4, effects.speed)) * 1000,
      );
      return profile;
    },
    [effects.speed, fire, onRewardActivate, onRewardConsume],
  );

  /** Where an object physically sits on the slate, in slate-local units. */
  const localOf = useCallback(
    (reward: RewardInstance, region: { centre: number; height: number }) => ({
      x: (reward.x / 100 - 0.5) * INNER_W,
      y: -region.centre + region.height / 2 - (reward.y / 100) * region.height,
    }),
    [],
  );

  /** Eligible rewards the energy can physically reach while visible. */
  const reachRewards = useCallback(
    (
      sourceId: string,
      inPath: (x: number, regionY: number) => boolean,
      collector?: { x: number; y: number } | null,
      preview = false,
      /** When the energy is a travelling collector, so each object is claimed
          at the moment the collector actually reaches it. */
      sweep?: { axis: "x" | "y"; direction: number; span: number; anticipation: number; transform: number },
    ) => {
      const offset = scroll.current.current;
      const claimed: Array<{
        slotId: string;
        reward: RewardInstance;
        pull?: { x: number; y: number };
        reach: number;
      }> = [];
      layout.regions.forEach((region) => {
        const y = VIEW_TOP + offset - region.centre;
        if (y > VIEW_TOP + 0.4 || y < VIEW_BOTTOM - 0.4) return;
        region.slot.rewards.forEach((other) => {
          if (other.id === sourceId || other.hidden || other.state !== "dormant") return;
          if (!isWorldInteractionEligible(other.type)) return;
          if (!inPath(other.x, y)) return;
          const local = localOf(other, region);
          // how far along its own axis the collector must travel to arrive
          let reach = 0;
          if (sweep && collector) {
            const along =
              sweep.axis === "x"
                ? (local.x - collector.x) * sweep.direction
                : (local.y - collector.y) * sweep.direction;
            const fraction = Math.min(1, Math.max(0, along / Math.max(0.001, sweep.span)));
            // invert the travel easing (easeIn = k^2.4) to get the moment
            const k = Math.pow(fraction, 1 / 2.4);
            reach = sweep.anticipation + k * (sweep.transform - sweep.anticipation);
          }
          claimed.push({
            slotId: region.slot.id,
            reward: other,
            reach,
            ...(collector
              ? { pull: { x: collector.x - local.x, y: collector.y - local.y } }
              : {}),
          });
        });
      });

      claimed.sort((a, b) => a.reach - b.reach);

      // each object is taken as the energy arrives at it
      claimed.forEach((item, index) => {
        const delay = sweep
          ? (item.reach / Math.max(0.4, effects.speed)) * 1000
          : index * 130;
        window.setTimeout(() => {
          if (collector) playSfx("collector-hit");
          if (preview) fire(item.slotId, item.reward, item.pull);
          else run(item.slotId, item.reward, item.pull);
          if (collector && index === claimed.length - 1) {
            window.setTimeout(() => playSfx("collector-burst"), 380);
          }
        }, delay);
      });
      return claimed.length;
    },
    [effects.speed, fire, layout.regions, localOf, run, scroll],
  );



  const activate = useCallback(
    (slotId: string, reward: RewardInstance, preview = false, style?: PremiumBombStyle) => {
      if (reward.state !== "dormant" || active[reward.id]) return;
      // preview replays the whole sequence without consuming anything
      const def = getReward(reward.type);
      let premiumTargets: PremiumTarget[] | undefined;
      if (def.profile === "chain-bomb") {
        const source = rewardNodes.current.get(reward.id)?.node;
        if (source) {
          source.updateWorldMatrix(true, false);
          camera.updateMatrixWorld();
          const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
          const frustum = new THREE.Frustum().setFromProjectionMatrix(matrix);
          const sourceWorld = source.getWorldPosition(new THREE.Vector3());
          premiumTargets = [];
          rewardNodes.current.forEach((entry, id) => {
            const other = entry.reward;
            if (id === reward.id || other.hidden || other.state !== "dormant") return;
            if (!isWorldInteractionEligible(other.type)) return;
            entry.node.updateWorldMatrix(true, false);
            const world = entry.node.getWorldPosition(new THREE.Vector3());
            if (!frustum.containsPoint(world)) return;
            const ndc = world.clone().project(camera);
            if (Math.abs(ndc.x) > 0.96 || Math.abs(ndc.y) > 0.96 || ndc.z < -1 || ndc.z > 1) return;
            premiumTargets?.push({
              id,
              slotId: entry.slotId,
              point: [world.x - sourceWorld.x, world.y - sourceWorld.y, world.z - sourceWorld.z],
            });
          });
        }
      }
      const profile = preview
        ? fire(slotId, reward, undefined, premiumTargets, true, style)
        : (() => {
            const fired = fire(slotId, reward, undefined, premiumTargets, false);
            onRewardActivate(slotId, reward.id, reward.type);
            window.setTimeout(() => onRewardConsume(slotId, reward.id), (effectLife(fired, reward.script) / Math.max(0.4, effects.speed)) * 1000);
            return fired;
          })();

      if (profile === "core") {
        // the blast reaches only objects currently inside the fixed viewport
        window.setTimeout(() => {
          reachRewards(reward.id, () => true, null, preview);
        }, 1700);
        return;
      }

      const sourceRegion = layout.regions.find((region) => region.slot.id === slotId);
      const collector = sourceRegion ? localOf(reward, sourceRegion) : null;

      // a collector launches away from the edge it sits closest to
      const direction = reward.x < 50 ? 1 : -1;

      if (profile === "sweep-horizontal") {
        // energy crosses this band: each eligible reward is claimed on contact
        const centre = sourceRegion ? VIEW_TOP + scroll.current.current - sourceRegion.centre : 0;
        const c = choreography("sweep-horizontal");
        reachRewards(reward.id, (_x, y) => Math.abs(y - centre) < 0.9, collector, preview, {
          axis: "x",
          direction,
          span: c.travel?.span ?? 4.4,
          anticipation: c.anticipation,
          transform: c.transform,
        });
        return;
      }

      if (profile === "sweep-vertical") {
        // energy travels the column: each eligible reward is claimed on contact
        const c = choreography("sweep-vertical");
        reachRewards(reward.id, (x) => Math.abs(x - reward.x) < 14, collector, preview, {
          axis: "y",
          direction,
          span: c.travel?.span ?? 2.6,
          anticipation: c.anticipation,
          transform: c.transform,
        });
      }

    },
    [active, camera, effects.speed, fire, layout.regions, localOf, onRewardActivate, onRewardConsume, reachRewards, run, scroll],
  );

  const onPremiumImpact = useCallback((target: PremiumTarget, preview: boolean) => {
    window.dispatchEvent(new CustomEvent("slate:activate-reward", {
      detail: { slotId: target.slotId, rewardId: target.id, preview },
    }));
  }, []);

  // "Test" replays the complete sequence on the real object, in place, from
  // the beginning — nothing is consumed and no status changes.
  useEffect(() => {
    const onTest = (event: Event) => {
      const detail = (event as CustomEvent<{ slotId: string; rewardId: string; style?: PremiumBombStyle }>).detail;
      if (!detail) return;
      const slot = game.slots.find((s) => s.id === detail.slotId);
      const reward = slot?.rewards.find((r) => r.id === detail.rewardId);
      if (!slot || !reward) return;
      lastPreview.current = { slotId: slot.id, rewardId: reward.id, ...(detail.style ? { style: detail.style } : {}) };
      activate(slot.id, reward, true, detail.style);
    };
    window.addEventListener("slate:test-effect", onTest as EventListener);
    return () => window.removeEventListener("slate:test-effect", onTest as EventListener);
  }, [activate, game.slots]);

  // Pause freezes the playhead exactly where it is; Play resumes from there;
  // Editor Reset replays the last preview. Game Reset clears every live effect.
  useEffect(() => {
    const onTransport = (event: Event) => {
      const action = (event as CustomEvent<{ action: "play" | "pause" | "reset" | "clear" }>).detail?.action;
      if (action === "pause") {
        setEffectsPaused(true);
        return;
      }
      if (action === "play") {
        setEffectsPaused(false);
        return;
      }
      if (action === "clear") {
        setEffectsPaused(false);
        setActive({});
        lastPreview.current = null;
        return;
      }
      if (action === "reset") {
        setEffectsPaused(false);
        setActive({});
        const last = lastPreview.current;
        if (!last) return;
        const slot = game.slots.find((s) => s.id === last.slotId);
        const reward = slot?.rewards.find((r) => r.id === last.rewardId);
        if (slot && reward) activate(slot.id, reward, true, last.style);
      }
    };
    window.addEventListener("slate:effect-transport", onTransport as EventListener);
    return () => window.removeEventListener("slate:effect-transport", onTransport as EventListener);
  }, [activate, game.slots]);

  useEffect(() => {
    const onActivate = (event: Event) => {
      const detail = (event as CustomEvent<{ slotId: string; rewardId: string; preview: boolean }>).detail;
      if (!detail) return;
      const slot = game.slots.find((item) => item.id === detail.slotId);
      const reward = slot?.rewards.find((item) => item.id === detail.rewardId);
      if (!slot || !reward || reward.type === "time-shard") return;
      activate(slot.id, reward, detail.preview);
    };
    window.addEventListener("slate:activate-reward", onActivate as EventListener);
    return () => window.removeEventListener("slate:activate-reward", onActivate as EventListener);
  }, [activate, game.slots]);

  const onDragMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!dragging || !group.current) return;
      const local = group.current.worldToLocal(event.point.clone());
      const region = layout.regions.find((r) => r.slot.id === dragging.slotId);
      if (!region) return;
      const down = -local.y;
      const x = Math.min(97, Math.max(3, (local.x / INNER_W + 0.5) * 100));
      const y = Math.min(94, Math.max(6, ((down - region.top) / region.height) * 100));
      onRewardMove(dragging.slotId, dragging.rewardId, x, y);
    },
    [dragging, layout.regions, onRewardMove],
  );

  const offset = scroll.current.current;
  const visible = layout.regions.filter((region) => {
    const y = VIEW_TOP + offset - region.centre;
    return y < VIEW_TOP + region.height + 2.4 && y > VIEW_BOTTOM - region.height - 2.4;
  });
  void scrollTick;

  return (
    <group position={[0, 0, SLATE_Z]}>
      {/* the slate is bolted to the wall: soft occlusion pools around it;
          with no room there is no wall, so no contact shadow */}
      <group ref={group}>
        {visible.map((region) => {
          const slot = region.slot;
          // This Line's OWN saved surface, when the teacher gave it one.
          const lineSurface = slot.surfaceId ? getSurface(slot.surfaceId) : surface;
          const lineRecipe = lineSurface.id === surface.id ? recipe : surfaceMaterial(lineSurface.id);
          const lineBuild = lineSurface.id === surface.id ? build : getConstruction(lineSurface.id);
          const bounds = textBounds[slot.id];
          const padX = Math.max(0.18, Math.min(0.34, textSettings.size / 520));
          const padY = Math.max(0.13, Math.min(0.26, textSettings.size / 650));
          const emptyWidth = Math.max(0.9, textSettings.size / 145);
          const minimumWidth = Math.max(lineBuild.inset * 2 + 0.32, emptyWidth);
          const contentSurfaceWidth = Math.max(minimumWidth, (bounds?.width ?? 0) + padX * 2);
          const surfaceWidth = readOnlyWriting
            ? gameSurfaceWidth(writingWidth, contentSurfaceWidth)
            : Math.min(SLATE_W, contentSurfaceWidth);
          const surfaceHeight = Math.max(
            Math.max(0.42, textSettings.size / 175),
            (bounds?.height ?? 0) + padY * 2,
          );
          const surfaceX = readOnlyWriting
            ? -writingWidth / 2 + surfaceWidth / 2
            : bounds ? (bounds.left + bounds.right) / 2 : 0;
          const surfaceY = readOnlyWriting ? 0 : bounds ? (bounds.top + bounds.bottom) / 2 : 0;
          const selected =
            selection.kind !== "none" && "slotId" in selection && selection.slotId === slot.id;
          const revealed = slot.contentState === "visible" || slot.contentState === "revealed";
          return (
            <group key={slot.id} position={[0, -region.centre, SLATE_FRONT]}>
              {/* the section is built out of the material itself */}
              <group
                position={[surfaceX, surfaceY, 0]}
                onPointerDown={(event) => {
                  if (!readOnlyWriting) return;
                  event.stopPropagation();
                  onSelect({ kind: "slot", slotId: slot.id });
                }}
              >
                <RegionSurface
                  surface={lineSurface}
                  build={lineBuild}
                  recipe={lineRecipe}
                  index={region.index}
                  width={surfaceWidth}
                  height={surfaceHeight}
                  numbers={numberSettings}
                  selected={selected}
                  colour={lineSurface.newKind === "plain" ? game.surfaceColour : undefined}
                  displayNumber={readOnlyWriting ? region.index : region.index + 1}
                />
              </group>


              <WritingRegion
                slotId={slot.id}
                text={slot.text}
                width={writingWidth}
                height={region.height}
                pad={lineBuild.gap + 0.18}
                /* the slab body is solid, so the inscription sits just proud of
                   its face; depth comes from the shading, not from hiding it */
                z={0.012}
                surface={lineSurface}
                settings={renderedTextSettings}
                editable={!readOnlyWriting}
                active={selection.kind === "slot" && selection.slotId === slot.id}
                placeholder={slot.hiddenContent && revealed ? slot.hiddenContent : undefined}
                onChange={(text) => onSlotChange(slot.id, { text })}
                onActivate={() => onSelect({ kind: "slot", slotId: slot.id })}
                onMeasure={(bounds) => measure(slot.id, bounds)}
              />

              {rewardSettings.visible
                ? slot.rewards.map((reward) => {
                    if (reward.hidden && !editable) return null;
                    if (reward.state === "archived" && !editable) return null;
                    const texture = artById[reward.type];
                    if (!texture) return null;
                    const size = 0.42 * rewardSettings.scale * (reward.scale ?? 1);
                    return (
                      <group
                        key={reward.id}
                        position={[
                          (reward.x / 100 - 0.5) * INNER_W,
                          region.height / 2 - (reward.y / 100) * region.height,
                          0.06 + (reward.z ?? 0) / 400,
                        ]}
                        ref={(node) => {
                          if (node) rewardNodes.current.set(reward.id, { node, slotId: slot.id, reward });
                          else rewardNodes.current.delete(reward.id);
                        }}
                      >
                        <RewardObject
                          reward={reward}
                          texture={texture}
                          openTexture={openArtById[reward.type]}
                          size={size}
                          opacity={rewardSettings.opacity}
                          glow={rewardSettings.glow}
                          editable={editable}
                          speed={effects.speed}
                          showExpression={
                            editable &&
                            selection.kind === "reward" &&
                            selection.rewardId === reward.id
                          }
                          effect={active[reward.id]}
                          selected={
                            selection.kind === "reward" && selection.rewardId === reward.id
                          }
                          onDown={(event) => {
                            if (!editable) return;
                            event.stopPropagation();
                            onSelect({ kind: "reward", slotId: slot.id, rewardId: reward.id });
                            scroll.current.locked = true;
                            setDragging({ slotId: slot.id, rewardId: reward.id });
                          }}
                          onActivate={() => {
                            if (editable) onSelect({ kind: "reward", slotId: slot.id, rewardId: reward.id });
                            else if (reward.state === "dormant" && reward.type !== "math-vault")
                              activate(slot.id, reward, effects.testMode);
                          }}
                          onExpire={() => onRewardConsume(slot.id, reward.id)}
                          premiumStyle={effects.premiumBombStyle ?? "radiant-chain"}
                          onPremiumImpact={onPremiumImpact}
                        />
                      </group>
                    );
                  })
                : null}
            </group>
          );
        })}

        {/* invisible drag plane, mounted only while a reward is being moved */}
        {dragging ? (
          <mesh
            position={[0, -layout.total / 2, SLATE_FRONT + 0.3]}
            onPointerMove={onDragMove}
            onPointerUp={() => {
              scroll.current.locked = false;
              setDragging(null);
            }}
          >
            <planeGeometry args={[SLATE_W * 2, layout.total + 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        ) : null}
      </group>

      {/* room light picking out the slate face */}
      <pointLight position={[0, 1.6, 3.2]} color={room.key.colour} intensity={3.4} distance={10} decay={2} />
      <pointLight position={[0, -1.8, 2.4]} color={room.accent} intensity={1.2} distance={7} decay={2} />
    </group>
  );
}
