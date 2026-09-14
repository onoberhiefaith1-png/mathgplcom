import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { RoomDef } from "@/lib/slate/rooms";
import { getSurface } from "@/lib/slate/surfaces";
import { REWARDS, getReward } from "@/lib/slate/rewards";
import { WritingRegion } from "@/components/slate/text3d/WritingRegion";
import { defaultTextSettings } from "@/lib/slate/text3d";
import { defaultNumberSettings } from "@/lib/slate/defaults";
import { noiseNormalMap, surfaceMaterial } from "./materials";
import { useTextureMap } from "./textures";
import { usePbr } from "./pbr";
import { SlateSection } from "./sections/SlateSection";
import { getConstruction } from "./sections/construction";
import { contactBlob } from "./RoomShell";
import { surfaceFamily } from "@/lib/slate/pbr";
import { CORE_DURATION, CoreEffect, PulseEffect, SWEEP_DURATION, SweepEffect } from "./Effects";
import {
  INNER_W,
  SLATE_D,
  SLATE_FRONT,
  SLATE_W,
  SLATE_Z,
  
  VIEW_BOTTOM,
  VIEW_TOP,
  buildLayout,
} from "@/lib/slate/layout";
import type { EditorMode, Game, RewardInstance, Selection, Slot } from "@/lib/slate/types";

export interface ScrollState {
  target: number;
  current: number;
  max: number;
  /** Set while a reward is being dragged, so the slate itself stays put. */
  locked: boolean;
}

interface Props {
  room: RoomDef;
  game: Game;
  mode: EditorMode;
  selection: Selection;
  scroll: React.MutableRefObject<ScrollState>;
  onSelect: (selection: Selection) => void;
  onSlotChange: (slotId: string, patch: Partial<Slot>) => void;
  onRewardMove: (slotId: string, rewardId: string, x: number, y: number) => void;
  onRewardActivate: (slotId: string, rewardId: string, type: string) => void;
  onRewardConsume: (slotId: string, rewardId: string) => void;
}

interface ActiveEffect {
  profile: string;
  colour: string;
  power: number;
  start: number;
  slotId: string;
}

const effectLife = (profile: string) =>
  profile === "core" ? CORE_DURATION : profile.startsWith("sweep") ? SWEEP_DURATION : 1.3;

/** One reward: a physical object attached to the slate, plus its live effect. */
function RewardObject({
  reward,
  texture,
  size,
  opacity,
  glow,
  selected,
  editable,
  effect,
  onDown,
  onActivate,
}: {
  reward: RewardInstance;
  texture: THREE.Texture;
  size: number;
  opacity: number;
  glow: number;
  selected: boolean;
  editable: boolean;
  effect: ActiveEffect | undefined;
  onDown: (event: ThreeEvent<PointerEvent>) => void;
  onActivate: () => void;
}) {
  const def = getReward(reward.type);
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const active = Boolean(effect);

  useFrame(({ clock }) => {
    const node = group.current;
    if (!node) return;
    const life = 0.4 + (reward.animation ?? 1) * 0.6;
    const bob = Math.sin(clock.elapsedTime * 1.3 + reward.x) * 0.012 * life;
    const lift = hovered ? 0.09 : 0;
    node.position.z = THREE.MathUtils.lerp(node.position.z, 0.06 + lift, 0.18);
    node.position.y = bob;
    const target = (hovered ? 1.16 : 1) * (active ? 0.35 : 1);
    node.scale.setScalar(THREE.MathUtils.lerp(node.scale.x, target, 0.2));
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
        <mesh rotation={[0, 0, ((reward.rotation ?? 0) * Math.PI) / 180]}>
          <planeGeometry args={[size, size]} />
          <meshBasicMaterial
            map={texture}
            transparent
            depthWrite={false}
            opacity={reward.hidden ? 0.16 : active ? 1 : opacity}
            color={active || hovered ? "#ffffff" : new THREE.Color("#ffffff").multiplyScalar(0.62)}
            toneMapped={false}
          />
        </mesh>
        {/* dormant ambient glow, brighter on hover */}
        <mesh position={[0, 0, -0.01]}>
          <circleGeometry args={[size * 0.62, 24]} />
          <meshBasicMaterial
            color={def.glow}
            transparent
            opacity={(hovered ? 0.3 : 0.11) * glow}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {selected ? (
          <mesh position={[0, 0, 0.02]}>
            <ringGeometry args={[size * 0.66, size * 0.72, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} toneMapped={false} />
          </mesh>
        ) : null}
      </group>

      {effect ? (
        effect.profile === "core" ? (
          <CoreEffect key={effect.start} startedAt={effect.start} colour={def.glow} power={effect.power} />
        ) : effect.profile === "sweep-horizontal" ? (
          <SweepEffect key={effect.start} startedAt={effect.start} colour={def.glow} power={effect.power} axis="x" span={9.5} />
        ) : effect.profile === "sweep-vertical" ? (
          <SweepEffect key={effect.start} startedAt={effect.start} colour={def.glow} power={effect.power} axis="y" span={5.6} />
        ) : (
          <PulseEffect key={effect.start} startedAt={effect.start} colour={def.glow} power={effect.power} />
        )
      ) : null}
    </group>
  );
}

/**
 * The slate: one long physical object in the room. The camera and the room
 * never move — this object slides vertically through the fixed viewpoint,
 * carrying its writing regions, its live text and its rewards with it.
 */
export function SlateColumn({
  room,
  game,
  mode,
  selection,
  scroll,
  onSelect,
  onSlotChange,
  onRewardMove,
  onRewardActivate,
  onRewardConsume,
}: Props) {
  const surface = getSurface(game.surfaceId);
  const recipe = surfaceMaterial(surface.id);
  const { rewards: rewardSettings, effects } = game.settings;
  const textSettings = game.settings.text ?? defaultTextSettings();
  const numberSettings = game.settings.numbers ?? defaultNumberSettings();
  // authoring = arranging the world (edit mode only). Writing is always live:
  // the surface exists to be written on, in view mode as much as in edit mode.
  const editable = mode === "edit";

  /** Real rendered text height per slot, in world units. */
  const [heights, setHeights] = useState<Record<string, number>>({});
  const measure = useCallback((slotId: string, height: number) => {
    setHeights((previous) => {
      const current = previous[slotId] ?? 0;
      if (Math.abs(current - height) < 0.02) return previous;
      return { ...previous, [slotId]: height };
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

  // how this material is physically built into writing sections
  const build = useMemo(() => getConstruction(surface.id), [surface.id]);

  const layout = useMemo(
    () => buildLayout(game.slots, textSettings.size, build.gap + 0.05, heights),
    [game.slots, textSettings.size, build.gap, heights],
  );

  // the slate is made of a real scanned material, lit by the room
  const pbr = usePbr(surfaceFamily(surface.id), 3.1, 0.72);
  const spine = usePbr(surfaceFamily(surface.id), 2.8, Math.max(2, layout.total * 0.32), 0.21);
  const normal = useMemo(
    () => noiseNormalMap(recipe.normalKey, recipe.normalScale, recipe.grain),
    [recipe],
  );
  void normal;

  const group = useRef<THREE.Group>(null);
  const clock = useThree((state) => state.clock);
  const [scrollTick, setScrollTick] = useState(0);
  const lastTick = useRef(0);
  const [active, setActive] = useState<Record<string, ActiveEffect>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [dragging, setDragging] = useState<{ slotId: string; rewardId: string } | null>(null);

  scroll.current.max = layout.maxScroll;

  useEffect(() => {
    const running = timers.current;
    return () => Object.values(running).forEach(clearTimeout);
  }, []);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const state = scroll.current;
    state.target = Math.min(state.max, Math.max(0, state.target));
    // heavy physical object: exponential settle, never a snap
    state.current += (state.target - state.current) * (1 - Math.exp(-11 * dt));
    if (group.current) group.current.position.y = VIEW_TOP + state.current;
    if (Math.abs(state.current - lastTick.current) > 0.3) {
      lastTick.current = state.current;
      setScrollTick((v) => v + 1);
    }
  });

  const fire = useCallback(
    (slotId: string, reward: RewardInstance) => {
      const def = getReward(reward.type);
      const power = (reward.effectIntensity ?? 1) * Math.max(0.4, effects.glow);
      setActive((previous) => ({
        ...previous,
        [reward.id]: {
          profile: def.profile,
          colour: def.glow,
          power,
          start: clock.elapsedTime,
          slotId,
        },
      }));
      clearTimeout(timers.current[reward.id]);
      timers.current[reward.id] = setTimeout(
        () =>
          setActive((previous) => {
            const next = { ...previous };
            delete next[reward.id];
            return next;
          }),
        (effectLife(def.profile) / Math.max(0.4, effects.speed)) * 1000,
      );
      return def.profile;
    },
    [clock, effects.glow, effects.speed],
  );

  const activate = useCallback(
    (slotId: string, reward: RewardInstance) => {
      if (reward.state !== "dormant" || active[reward.id]) return;
      const profile = fire(slotId, reward);
      onRewardActivate(slotId, reward.id, reward.type);
      window.setTimeout(
        () => onRewardConsume(slotId, reward.id),
        (effectLife(profile) / Math.max(0.4, effects.speed)) * 1000,
      );
      if (profile !== "core") return;
      // the blast reaches only rewards currently inside the fixed viewport
      window.setTimeout(() => {
        const offset = scroll.current.current;
        layout.regions.forEach((region) => {
          const y = VIEW_TOP + offset - region.centre;
          if (y > VIEW_TOP + 0.4 || y < VIEW_BOTTOM - 0.4) return;
          region.slot.rewards.forEach((other) => {
            if (other.id === reward.id || other.hidden || other.state === "archived") return;
            fire(region.slot.id, other);
          });
        });
      }, 1700);
    },
    [active, effects.speed, fire, layout.regions, onRewardActivate, onRewardConsume, scroll],
  );

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

  const frameColour = useMemo(
    () => new THREE.Color(room.accent).multiplyScalar(0.4),
    [room.accent],
  );

  return (
    <group position={[0, 0, SLATE_Z]}>
      {/* the slate is bolted to the wall: soft occlusion pools around it */}
      <mesh position={[0, 0, -SLATE_D / 2 - 0.015]} renderOrder={1}>
        <planeGeometry args={[SLATE_W + 3.6, 10]} />
        <meshBasicMaterial
          map={contactBlob()}
          color="#000000"
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>
      <group ref={group}>
        {/* the structure the sections are built into — one continuous body */}
        <mesh
          position={[0, -layout.total / 2, SLATE_FRONT - build.depth - 0.16]}
          receiveShadow
        >
          <boxGeometry args={[SLATE_W + 0.3, layout.total, 0.34]} />
          <meshStandardMaterial
            {...spine}
            color={frameColour.clone().lerp(new THREE.Color(spine.color), 0.7)}
            roughness={Math.min(1, spine.roughness * 1.08)}
          />
        </mesh>

        {visible.map((region) => {
          const slot = region.slot;
          const selected =
            selection.kind !== "none" && "slotId" in selection && selection.slotId === slot.id;
          const revealed = slot.contentState === "visible" || slot.contentState === "revealed";
          return (
            <group key={slot.id} position={[0, -region.centre, SLATE_FRONT]}>
              {/* the section is built out of the material itself */}
              <SlateSection
                index={region.index}
                width={SLATE_W}
                height={region.height}
                maps={pbr}
                build={build}
                physical={recipe.physical}
                accent={selected ? "#ffe9bd" : room.accent}
                numbers={numberSettings}
              />

              <WritingRegion
                slotId={slot.id}
                text={slot.text}
                width={SLATE_W - build.inset * 2 - 0.3}
                height={region.height}
                pad={build.gap + 0.18}
                /* the slab body is solid, so the inscription sits just proud of
                   its face; depth comes from the shading, not from hiding it */
                z={0.012}
                surface={surface}
                settings={textSettings}
                editable
                active={selection.kind === "slot" && selection.slotId === slot.id}
                placeholder={slot.hiddenContent && revealed ? slot.hiddenContent : undefined}
                onChange={(text) => onSlotChange(slot.id, { text })}
                onActivate={() => onSelect({ kind: "slot", slotId: slot.id })}
                onMeasure={(h) => measure(slot.id, h)}
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
                      >
                        <RewardObject
                          reward={reward}
                          texture={texture}
                          size={size}
                          opacity={rewardSettings.opacity}
                          glow={rewardSettings.glow}
                          editable={editable}
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
                            else if (effects.testMode && reward.state === "dormant") activate(slot.id, reward);
                          }}
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
