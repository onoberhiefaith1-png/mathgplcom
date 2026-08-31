/**
 * ACADEMY HALLWAY — the walkway environment inside the building.
 *
 * The corridor is generated from the academy rooms (add a room in the editor
 * and a new doorway appears, in its stored order) AND from the building's
 * walkway graph: the owner can extend the walkway forward, branch left/right,
 * and place content doors along any segment.
 *
 * NAVIGATION (path-based): movement is a small state machine — WALKING along a
 * segment, TURNING into a branch (smooth 90° corner sweep), RETRACING back to
 * the previous junction (180° turnaround + reverse glide + re-align), ZOOMING
 * onto a doorway before it opens, and IDLE at a junction. Every turn is
 * graph-valid: you can only turn where a walkway branch exists, and invalid
 * inputs surface a cue instead of rotating the camera. There is no free-fly.
 *
 * Walls, floor, roof, doors, lighting and effects all come from the building's
 * environment settings — never hard-coded. The player stops at walls and
 * walkway ends (collision); branches are the only way to change direction.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles, Text } from "@react-three/drei";
import * as THREE from "three";
import type { AcademyRoom, AcademyProduct } from "@/lib/academy/types";
import { mergeEnvironment, lightBudget, DEFAULT_ENDPOINT_NAME } from "@/lib/building/env";
import { DEFAULT_ENVIRONMENT, DIRECTION_LABEL, DOOR_KIND_LABEL } from "@/lib/building/types";
import type {
  BuildingData,
  BuildingDoor,
  BuildingWalkway,
  EnvironmentSettings,
} from "@/lib/building/types";
import { doorTitle } from "@/lib/building/api";
import { presetMaterial } from "@/lib/building/presets";
import { coverFit } from "@/lib/building/imageFit";
import {
  easeInOut,
  forwardFromYaw,
  layoutHallwayObjects,
  NavigationHistory,
  reverseHeading,
  segYaw,
  turnHeading,
} from "@/lib/building/navigation";
import type { HallwayObject } from "@/lib/building/navigation";

const SPACING = 7.5; // minimum distance between objects along a hallway
const HALL_WIDTH = 7;
const HALL_HEIGHT = 5.4;
const WALK_SPEED = 4; // units per second while holding forward

const accentOf = (room: AcademyRoom, index: number) =>
  room.accent || ["#7dd3fc", "#fcd34d", "#a7f3d0", "#f9a8d4", "#c4b5fd", "#fdba74"][index % 6];

// ── Hallway geometry ──────────────────────────────────────────────────────
// One hallway is a finite, enclosed corridor with a name. Doors and
// sub-hallway openings are objects attached to its walls, laid out by the
// shared layoutHallwayObjects() so the 3D view and the map can never disagree.

interface Segment {
  walkway: BuildingWalkway | null;
  start: [number, number];
  heading: [number, number];
  length: number;
  depth: number;
  children: Segment[];
}

interface DoorObjectInput {
  id: string;
  name: string;
  order: number;
}

interface HallwayLayout {
  segments: Segment[];
  layouts: Map<string, HallwayObject[]>;
}

const buildHallways = (
  walkways: BuildingWalkway[],
  doorObjects: (walkwayId: string) => DoorObjectInput[],
  rootRoomObjects: DoorObjectInput[],
  rootLen: number,
): HallwayLayout => {
  const segments: Segment[] = [];
  const layouts = new Map<string, HallwayObject[]>();

  const walk = (
    w: BuildingWalkway,
    start: [number, number],
    heading: [number, number],
    depth: number,
  ): Segment => {
    const length = w.parent_id ? w.length : Math.max(w.length, rootLen);
    const seg: Segment = { walkway: w, start, heading, length, depth, children: [] };
    segments.push(seg);

    const kids = walkways.filter((x) => x.parent_id === w.id).sort((a, b) => a.position - b.position);
    const objs = layoutHallwayObjects({
      length,
      doors: [...(w.parent_id ? [] : rootRoomObjects), ...doorObjects(w.id)],
      openings: kids.map((k, i) => ({
        id: k.id,
        name: k.name,
        direction: k.direction,
        order: 15 + i * 30,
      })),
      minGap: SPACING,
    });
    layouts.set(w.id, objs);

    const end: [number, number] = [start[0] + heading[0] * length, start[1] + heading[1] * length];
    for (const k of kids) {
      if (k.direction === "forward") {
        seg.children.push(walk(k, end, heading, depth + 1));
        continue;
      }
      const mouth = objs.find((o) => o.kind === "opening" && o.id === k.id);
      const along = mouth?.along ?? length;
      seg.children.push(
        walk(
          k,
          [start[0] + heading[0] * along, start[1] + heading[1] * along],
          turnHeading(heading, k.direction),
          depth + 1,
        ),
      );
    }
    return seg;
  };

  walkways
    .filter((w) => !w.parent_id)
    .sort((a, b) => a.position - b.position)
    .forEach((w) => walk(w, [0, 0], [0, -1], 0));

  return { segments, layouts };
};

const findSegment = (segs: Segment[], id: string): Segment | null => {
  for (const s of segs) {
    if (s.walkway?.id === id) return s;
    const hit = findSegment(s.children, id);
    if (hit) return hit;
  }
  return null;
};

// ── Surface texture loading ───────────────────────────────────────────────
// Each surface owns its own texture instance so it can fit/tile independently
// without disturbing another surface that shows the same image. Decoded images
// are cached by the browser, so loading the same URL twice is cheap.

const useLoadedTexture = (url: string | null | undefined): THREE.Texture | null => {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let live = true;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.anisotropy = 4;
        t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        if (!live) {
          t.dispose();
          return;
        }
        loaded = t;
        setTex(t);
      },
      undefined,
      () => {
        if (live) setTex(null);
      },
    );
    return () => {
      live = false;
      loaded?.dispose();
    };
  }, [url]);
  return tex;
};

/**
 * Tint applied to a textured surface. The image keeps its own colours (a hard
 * white tint would be faithful but ignores the chosen colour, a full tint would
 * stain the image) so the surface colour is applied as a light wash.
 */
const textureTint = (color?: string): string => {
  if (!color) return "#ffffff";
  try {
    return `#${new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.72).getHexString()}`;
  } catch {
    return "#ffffff";
  }
};

/** One surface (wall / floor / roof) of a corridor segment. */
const Surface = ({
  url,
  presetKey,
  color,
  scale,
  offsetX,
  offsetY,
  repeat,
  fit,
  planeW,
  planeH,
  position,
  "rotation-x": rotationX,
  "rotation-y": rotationY,
children,
}: {
  url?: string | null;
  presetKey: string;
  color?: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  repeat: boolean;
  fit: "cover" | "stretch";
  planeW: number;
  planeH: number;
  position?: [number, number, number];
  "rotation-x"?: number;
  "rotation-y"?: number;
children?: React.ReactNode;
}) => {
  const tex = useLoadedTexture(url);
  const mat = presetMaterial(presetKey, color);
  const map = tex ?? null;
  // Fit the texture to the plane. Runs when the texture or its placement
  // changes — never during render.
  useEffect(() => {
    if (!tex) return;
    const img = tex.image as { width?: number; height?: number } | undefined;
    const iw = img?.width ?? planeW;
    const ih = img?.height ?? planeH;
    if (repeat) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const s = Math.max(0.1, scale);
      tex.repeat.set(s, s);
      tex.offset.set(offsetX, offsetY);
      return;
    }
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    if (fit === "stretch") {
      tex.repeat.set(1, 1);
      tex.offset.set(0, 0);
      return;
    }
    const fitted = coverFit(planeW, planeH, iw, ih, scale, offsetX, offsetY);
    tex.repeat.set(fitted.repeat[0], fitted.repeat[1]);
    tex.offset.set(fitted.offset[0], fitted.offset[1]);
  }, [tex, repeat, fit, scale, offsetX, offsetY, planeW, planeH]);
return (
    <mesh position={position} rotation-x={rotationX} rotation-y={rotationY}>
      {children}
      <meshStandardMaterial
        color={map ? textureTint(mat.color) : mat.color}
        map={map}
        roughness={mat.roughness}
        metalness={mat.metalness}
        emissive={mat.emissive ?? "#000000"}
        emissiveIntensity={mat.emissiveIntensity ?? 0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// ── Corridor pieces ───────────────────────────────────────────────────────

const SegmentCorridor = ({
  start,
  yaw,
  length,
  env,
  textures,
  capEnd = true,
  capStart = false,
  name,
  endName,
}: {
  start: [number, number];
  yaw: number;
  length: number;
  env: EnvironmentSettings;
  textures: Record<string, string>;
  /** Solid wall at the far end (no forward continuation). */
  capEnd?: boolean;
  /** Solid wall behind the entrance. */
  capStart?: boolean;
  name?: string;
  /** Name of this hallway's ENDPOINT, shown on the capped far wall. */
  endName?: string;
}) => (
  <group position={[start[0], 0, start[1]]} rotation-y={yaw}>
    {/* enclosing end walls — the hallway is finite, never an open void */}
    {capEnd && (
      <mesh position={[0, HALL_HEIGHT / 2, -length]}>
        <planeGeometry args={[HALL_WIDTH, HALL_HEIGHT]} />
        <meshStandardMaterial color={env.leftWall.color} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
    )}
    {capEnd && endName && (
      <Suspense fallback={null}>
        <Text
          renderOrder={11}
          material-depthTest={false}
          position={[0, HALL_HEIGHT / 2 + 0.2, -length + 0.06]}
          fontSize={0.34}
          maxWidth={HALL_WIDTH - 1}
          anchorX="center"
          anchorY="middle"
          color="#fde68a"
        >
          {endName}
        </Text>
      </Suspense>
    )}
    {capStart && (
      <mesh position={[0, HALL_HEIGHT / 2, 1.6]}>
        <planeGeometry args={[HALL_WIDTH, HALL_HEIGHT]} />
        <meshStandardMaterial color={env.leftWall.color} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
    )}
    {name && (
      <Suspense fallback={null}>
        <Text
          renderOrder={10}
          material-depthTest={false}
          position={[0, HALL_HEIGHT - 0.55, -1.5]}
          fontSize={0.3}
          anchorX="center"
          anchorY="middle"
          color="#dbeafe"
        >
          {name}
        </Text>
      </Suspense>
    )}
    <group position={[0, 0, -length / 2]}>
      {/* floor */}
<Surface
        rotation-x={-Math.PI / 2}
        url={env.floor.texture ? textures[env.floor.texture.path] : undefined}
        presetKey={env.floor.preset}
        color={env.floor.color}
        scale={env.floor.scale}
        offsetX={env.floor.offsetX}
        offsetY={env.floor.offsetY}
        repeat={env.floor.repeat}
        fit={env.floor.fit}
        planeW={HALL_WIDTH}
        planeH={length + 6}
      >
        <planeGeometry args={[HALL_WIDTH, length + 6]} />
      </Surface>
      {/* roof / ceiling */}
      <Surface
        rotation-x={Math.PI / 2}
        position={[0, HALL_HEIGHT, 0]}
        url={env.roof.texture ? textures[env.roof.texture.path] : undefined}
        presetKey={env.roof.preset}
        color={env.roof.color}
        scale={env.roof.scale}
        offsetX={env.roof.offsetX}
        offsetY={env.roof.offsetY}
        repeat={env.roof.repeat}
        fit={env.roof.fit}
        planeW={HALL_WIDTH}
        planeH={length + 6}
      >
        <planeGeometry args={[HALL_WIDTH, length + 6]} />
      </Surface>
      {/* left / right walls */}
      {([-1, 1] as const).map((side) => {
        const wall = side === -1 ? env.leftWall : env.rightWall;
        return (
          <Surface
            key={side}
            position={[(side * HALL_WIDTH) / 2, HALL_HEIGHT / 2, 0]}
            rotation-y={(-side * Math.PI) / 2}
            url={wall.texture ? textures[wall.texture.path] : undefined}
            presetKey={wall.preset}
            color={wall.color}
            scale={wall.scale}
            offsetX={wall.offsetX}
            offsetY={wall.offsetY}
            repeat={wall.repeat}
            fit={wall.fit}
            planeW={length + 6}
            planeH={HALL_HEIGHT}
          >
            <planeGeometry args={[length + 6, HALL_HEIGHT]} />
          </Surface>
        );
      })}
    </group>
  </group>
);

/** A clickable doorway with a glowing panel, frame and sign. Hovers light up. */
const DoorMesh = ({
  side,
  z,
  label,
  sublabel,
  accent,
  color,
  emissiveIntensity,
  onEnter,
}: {
  side: number;
  z: number;
  label: string;
  sublabel: string;
  accent: string;
  color: string;
  emissiveIntensity: number;
  onEnter: () => void;
}) => {
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const frame = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-8 * Math.min(delta, 0.05));
    const target = hovered ? Math.max(0.4, emissiveIntensity * 5) : emissiveIntensity;
    if (glow.current) {
      glow.current.emissiveIntensity = THREE.MathUtils.lerp(glow.current.emissiveIntensity, target, k);
    }
    if (frame.current) {
      const ft = hovered ? Math.min(1.6, (frame.current.emissiveIntensity ?? 0) + 0.8) : 0;
      frame.current.emissiveIntensity = THREE.MathUtils.lerp(frame.current.emissiveIntensity ?? 0, ft, k);
    }
  });

  return (
    <group position={[side * (HALL_WIDTH / 2 - 0.2), 0, z]} rotation-y={-side * 0.55}>
      <mesh
        position={[0, 1.6, 0.09]}
        onClick={(e) => {
          e.stopPropagation();
          onEnter();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
          setHovered(true);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
          setHovered(false);
        }}
      >
        <planeGeometry args={[2.9, 3.2]} />
        <meshStandardMaterial
          ref={glow}
          color={color}
          emissive={accent}
          emissiveIntensity={0.07}
          roughness={0.9}
          metalness={0}
        />
      </mesh>
      <mesh position={[0, 1.6, 0.02]}>
        <planeGeometry args={[3.2, 3.5]} />
        <meshStandardMaterial ref={frame} color={accent} roughness={0.5} />
      </mesh>
      <Suspense fallback={null}>
        <Text
          renderOrder={10}
          material-depthTest={false}
          position={[0, 2.55, 0.12]}
          fontSize={0.21}
          maxWidth={2.1}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
          color="#f4f8ff"
        >
          {label}
        </Text>
        <Text
          renderOrder={10}
          material-depthTest={false}
          position={[0, 1.6, 0.12]}
          fontSize={0.15}
          maxWidth={2.0}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
          color="#e6edf7"
        >
          {sublabel}
        </Text>
      </Suspense>
    </group>
  );
};

/**
 * A physical opening in a hallway wall leading into a sub-hallway. Wider than a
 * door, unlit inside, with the sub-hallway's name on the lintel. Clicking it
 * walks through — the camera never visibly rotates 90°.
 */
const BranchOpening = ({
  side,
  along,
  name,
  onEnter,
}: {
  side: -1 | 1;
  along: number;
  name: string;
  onEnter: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={[side * (HALL_WIDTH / 2 - 0.06), 0, -along]} rotation-y={(-side * Math.PI) / 2}>
      <mesh
        position={[0, HALL_HEIGHT / 2 - 0.4, 0.02]}
        onClick={(e) => {
          e.stopPropagation();
          onEnter();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
          setHovered(true);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
          setHovered(false);
        }}
      >
        <planeGeometry args={[5.4, HALL_HEIGHT - 0.8]} />
        <meshStandardMaterial
          color="#080d17"
          emissive="#7dd3fc"
          emissiveIntensity={hovered ? 0.5 : 0.14}
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Suspense fallback={null}>
        <Text
          renderOrder={10}
          material-depthTest={false}
          position={[0, HALL_HEIGHT - 0.55, 0.06]}
          fontSize={0.24}
          maxWidth={5}
          anchorX="center"
          anchorY="middle"
          color="#bae6fd"
        >
          {name}
        </Text>
      </Suspense>
    </group>
  );
};

// ── Navigation machine ────────────────────────────────────────────────────

export type NavPhase = "browse" | "walking" | "turning" | "retracing" | "zooming" | "idle";

interface TurnSpec {
  pivot: [number, number];
  fromYaw: number;
  toYaw: number;
  radius: number;
  duration: number;
  elapsed: number;
  onDone: () => void;
}

interface ZoomSpec {
  from: [number, number, number];
  to: [number, number, number];
  look: [number, number, number];
  duration: number;
  elapsed: number;
  started: boolean;
  restorePhase: NavPhase;
  onDone: () => void;
}

interface Machine {
  phase: NavPhase;
  seg: Segment;
  dist: number;
  moving: boolean;
  yaw: number;
  turn: TurnSpec | null;
  zoom: ZoomSpec | null;
}

// ── Camera rig ────────────────────────────────────────────────────────────

interface NavState {
  seg: Segment;
  mode: "browse" | "walk";
}

const CameraRig = ({
  focus,
  rooms,
  m,
  rootLen,
  onWalkEnd,
  onRetraceEnd,
  setPhase,
}: {
  focus: number;
  rooms: AcademyRoom[];
  m: React.RefObject<Machine>;
  rootLen: number;
  onWalkEnd: () => void;
  onRetraceEnd: () => void;
  setPhase: (p: NavPhase) => void;
}) => {
  useFrame(({ camera }, rawDelta) => {
    const st = m.current;
    if (!st) return;
    const dt = Math.min(rawDelta, 0.05);
    const k = 1 - Math.exp(-6 * dt);

    if (st.phase === "browse") {
      // Standing in the hallway looking straight down it — never angled at a
      // wall, so entering walk mode is seamless.
      const targetZ = -Math.min(focus * SPACING, Math.max(0, rootLen - 6));
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, k);
      camera.position.y = 1.75;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, k);
      st.yaw = 0;
      camera.lookAt(0, 1.7, camera.position.z - 8);
      return;
    }

if (st.phase === "walking" || st.phase === "idle") {
      const seg = st.seg;
      if (st.phase === "walking" && st.moving) {
        st.dist = Math.min(seg.length, st.dist + dt * WALK_SPEED);
      }
      const d = st.dist;
      const px = seg.start[0] + seg.heading[0] * d;
      const pz = seg.start[1] + seg.heading[1] * d;
      st.yaw = THREE.MathUtils.lerp(st.yaw, segYaw(seg.heading), k);
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, px, k);
      camera.position.y = 1.75;
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, pz, k);
      const dir = forwardFromYaw(st.yaw);
      camera.lookAt(camera.position.x + dir[0] * 6, 1.75, camera.position.z + dir[1] * 6);
      if (st.phase === "walking" && d >= seg.length - 0.05) onWalkEnd();
      return;
    }

    if (st.phase === "turning") {
      const t = st.turn;
      if (!t) {
        setPhase("walking");
        st.phase = "walking";
        return;
      }
      t.elapsed += dt;
      const p = Math.min(1, t.elapsed / t.duration);
      const eased = easeInOut(p);
      const yaw = t.fromYaw + (t.toYaw - t.fromYaw) * eased;
      st.yaw = yaw;
      const f = forwardFromYaw(yaw);
      const cx = t.pivot[0] + f[0] * t.radius;
      const cz = t.pivot[1] + f[1] * t.radius;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, cx, k);
      camera.position.y = 1.75;
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, cz, k);
      camera.lookAt(camera.position.x + f[0] * 6, 1.75, camera.position.z + f[1] * 6);
      if (p >= 1) {
        st.turn = null;
        t.onDone();
      }
      return;
    }

    if (st.phase === "retracing") {
      const seg = st.seg;
      st.dist = Math.max(0, st.dist - dt * WALK_SPEED);
      const d = st.dist;
      const px = seg.start[0] + seg.heading[0] * d;
      const pz = seg.start[1] + seg.heading[1] * d;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, px, k);
      camera.position.y = 1.75;
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, pz, k);
      const dir = forwardFromYaw(st.yaw); // kept at the reverse heading
      camera.lookAt(camera.position.x + dir[0] * 6, 1.75, camera.position.z + dir[1] * 6);
      if (d <= 0) onRetraceEnd();
      return;
    }

    if (st.phase === "zooming") {
      const z = st.zoom;
      if (!z) {
        setPhase(st.moving ? "walking" : "idle");
        st.phase = st.moving ? "walking" : "idle";
        return;
      }
      if (!z.started) {
        z.from = [camera.position.x, camera.position.y, camera.position.z];
        z.started = true;
      }
      z.elapsed += dt;
      const p = Math.min(1, z.elapsed / z.duration);
      const eased = easeInOut(p);
      camera.position.x = THREE.MathUtils.lerp(z.from[0], z.to[0], eased);
      camera.position.y = THREE.MathUtils.lerp(z.from[1], z.to[1], eased);
      camera.position.z = THREE.MathUtils.lerp(z.from[2], z.to[2], eased);
      camera.lookAt(z.look[0], z.look[1], z.look[2]);
      if (p >= 1) {
        st.zoom = null;
        z.onDone();
      }
      return;
    }
  });
  void rooms;
  return null;
};

// ── Walk controls overlay ─────────────────────────────────────────────────

const WalkControls = ({
  atJunction,
  children,
  hasForward,
  canBack,
  moving,
  onForwardDown,
  onForwardUp,
  onTurn,
  onBack,
  ended,
}: {
  atJunction: boolean;
  children: Segment[];
  hasForward: boolean;
  canBack: boolean;
  moving: boolean;
  onForwardDown: () => void;
  onForwardUp: () => void;
  onTurn: (seg: Segment) => void;
  onBack: () => void;
  ended: boolean;
}) => (
  <div className="absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-4">
    {atJunction && (
      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 p-1.5 backdrop-blur">
        {children
          .filter((c) => c.walkway?.direction === "left")
          .map((c) => (
            <button
              key={c.walkway!.id}
              type="button"
              onClick={() => onTurn(c)}
              className="min-h-[52px] rounded-full bg-sky-500/20 px-4 text-sm font-semibold text-sky-200"
            >
              ◀ Left branch
            </button>
          ))}
        {hasForward && (
          <button
            type="button"
            onClick={() => onTurn(children.find((c) => c.walkway?.direction === "forward")!)}
            className="min-h-[52px] rounded-full bg-emerald-500/25 px-4 text-sm font-semibold text-emerald-200"
          >
            Forward ▶
          </button>
        )}
        {children
          .filter((c) => c.walkway?.direction === "right")
          .map((c) => (
            <button
              key={c.walkway!.id}
              type="button"
              onClick={() => onTurn(c)}
              className="min-h-[52px] rounded-full bg-sky-500/20 px-4 text-sm font-semibold text-sky-200"
            >
              Right branch ▶
            </button>
          ))}
      </div>
    )}
    {!atJunction && ended && (
      <p className="rounded-full border border-border/60 bg-background/80 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
        End of walkway — add branches or extend it in the editor
      </p>
    )}
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 p-1.5 backdrop-blur">
      {canBack && (
        <button
          type="button"
          aria-label="Walk back"
          onClick={onBack}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          ▼
        </button>
      )}
      <button
        type="button"
        aria-label="Walk forward"
        onPointerDown={onForwardDown}
        onPointerUp={onForwardUp}
        onPointerLeave={onForwardUp}
        className={`inline-flex h-14 w-14 items-center justify-center rounded-full text-lg ${moving ? "bg-primary text-primary-foreground" : "bg-primary/80 text-primary-foreground"}`}
      >
        ▲
      </button>
    </div>
  </div>
);

// ── Fixed structural map (top-right HUD) ──────────────────────────────────

/** Re-render at ~12fps so the player marker tracks the walk smoothly. */
const useMapTick = (active: boolean) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 80);
    return () => window.clearInterval(id);
  }, [active]);
};

const MiniMap = ({
  segments,
  layouts,
  m,
  show,
  ended = false,
}: {
  segments: Segment[];
  layouts: Map<string, HallwayObject[]>;
  m: React.RefObject<Machine>;
  show: boolean;
  /** True when the walker is standing at the end of the current hallway. */
  ended?: boolean;
}) => {
  useMapTick(show);
  const svg = useMemo(() => {
    const pts: number[] = [];
    const lines: { x1: number; y1: number; x2: number; y2: number; name: string }[] = [];
    const doorDots: { x: number; z: number }[] = [];
    /** Terminal navigation nodes — the editable ENDPOINT of each route. */
    const ends: { id: string; x: number; z: number; name: string }[] = [];
    const walk = (s: Segment) => {
      const ex = s.start[0] + s.heading[0] * s.length;
      const ez = s.start[1] + s.heading[1] * s.length;
      lines.push({ x1: s.start[0], y1: s.start[1], x2: ex, y2: ez, name: s.walkway?.name ?? "Hallway" });
      pts.push(s.start[0], s.start[1], ex, ez);
      for (const o of layouts.get(s.walkway?.id ?? "") ?? []) {
        if (o.kind !== "door") continue;
        doorDots.push({
          x: s.start[0] + s.heading[0] * o.along + o.side * 1.2 * -s.heading[1],
          z: s.start[1] + s.heading[1] * o.along + o.side * 1.2 * s.heading[0],
        });
      }
      if (!s.children.some((c) => c.walkway?.direction === "forward")) {
        ends.push({
          id: s.walkway?.id ?? "root",
          x: ex,
          z: ez,
          name: s.walkway?.end_label ?? DEFAULT_ENDPOINT_NAME,
        });
      }
      s.children.forEach(walk);
    };
    segments.filter((s) => s.depth === 0).forEach(walk);
    if (pts.length === 0) pts.push(0, 0, 0, -10);
    const xs = pts.filter((_, i) => i % 2 === 0);
    const zs = pts.filter((_, i) => i % 2 === 1);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const W = 210;
    const H = 170;
    const PAD = 20;
    // A single short hallway must not stretch edge to edge, so the layout is
    // measured against a minimum span before it is scaled.
    const spanX = Math.max(10, maxX - minX);
    const spanZ = Math.max(10, maxZ - minZ);
    const sc = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanZ);
    // Centre the drawing inside the panel: balanced padding on all four sides.
    const offX = (W - spanX * sc) / 2 + ((spanX - (maxX - minX)) / 2) * sc;
    const offY = (H - spanZ * sc) / 2 + ((spanZ - (maxZ - minZ)) / 2) * sc;
    const px = (x: number) => (x - minX) * sc + offX;
    const py = (z: number) => (maxZ - z) * sc + offY; // forward (−z) renders up: north is always up
    return { W, H, px, py, lines, doorDots, ends };
  }, [segments, layouts]);

  if (!show) return null;
  const st = m.current;
  const you: [number, number] = st
    ? [st.seg.start[0] + st.seg.heading[0] * st.dist, st.seg.start[1] + st.seg.heading[1] * st.dist]
    : [0, 0];
  const heading = st?.seg.heading ?? [0, -1];
  // The endpoint is a terminal node: reached only when the walker is at the end
  // of a hallway that does not continue forward.
  const atEnd =
    ended && !(st?.seg.children ?? []).some((c) => c.walkway?.direction === "forward");
  const reachedId = atEnd ? (st?.seg.walkway?.id ?? "root") : null;
  const reachedName = reachedId ? (svg.ends.find((e) => e.id === reachedId)?.name ?? null) : null;
  const ax = svg.px(you[0]);
  const ay = svg.py(you[1]);
  // map-space direction: x follows world x, y is inverted (−z is up)
  const arrow = `${ax + heading[0] * 7},${ay - heading[1] * 7} ${ax - heading[0] * 4 - heading[1] * 4},${ay + heading[1] * 4 - heading[0] * 4} ${ax - heading[0] * 4 + heading[1] * 4},${ay + heading[1] * 4 + heading[0] * 4}`;

  return (
    <div className="pointer-events-none absolute right-3 top-16 z-10 rounded-xl border border-border/60 bg-background/85 p-2 shadow-xl backdrop-blur">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Building map
      </span>
      <svg width={svg.W} height={svg.H} viewBox={`0 0 ${svg.W} ${svg.H}`} className="rounded-lg bg-black/40">
        {svg.lines.map((l, i) => (
          <g key={i}>
            <line
              x1={svg.px(l.x1)}
              y1={svg.py(l.y1)}
              x2={svg.px(l.x2)}
              y2={svg.py(l.y2)}
              stroke="#64748b"
              strokeWidth={7}
              strokeLinecap="square"
            />
            <text
              x={(svg.px(l.x1) + svg.px(l.x2)) / 2}
              y={(svg.py(l.y1) + svg.py(l.y2)) / 2 - 6}
              textAnchor="middle"
              fontSize={8}
              fill="#cbd5e1"
            >
              {l.name}
            </text>
          </g>
        ))}
        {svg.doorDots.map((d, i) => (
          <rect key={i} x={svg.px(d.x) - 3} y={svg.py(d.z) - 3} width={6} height={6} rx={1} fill="#fbbf24" />
        ))}
        {/* ENDPOINT markers — highlighted once the walker reaches that end */}
        {svg.ends.map((e) => {
          const here = reachedId === e.id;
          return (
            <g key={`end-${e.id}`}>
              <circle
                cx={svg.px(e.x)}
                cy={svg.py(e.z)}
                r={here ? 6 : 4.5}
                fill={here ? "#f87171" : "#0b0f18"}
                stroke={here ? "#fecaca" : "#f87171"}
                strokeWidth={1.5}
              />
              <text
                x={svg.px(e.x)}
                y={svg.py(e.z) - 9}
                textAnchor="middle"
                fontSize={7.5}
                fill={here ? "#fecaca" : "#fca5a5"}
              >
                {e.name}
              </text>
            </g>
          );
        })}
        <circle cx={svg.px(0)} cy={svg.py(0)} r={4} fill="#34d399" />
        <polygon points={arrow} fill="#7dd3fc" stroke="#0b0f18" strokeWidth={1} />
      </svg>
      {reachedName && (
        <span className="mt-1 block text-center text-[10px] font-semibold text-red-300">
          Route end reached · {reachedName}
        </span>
      )}
    </div>
  );
};

// ── Scene ─────────────────────────────────────────────────────────────────

export interface HallwaySceneProps {
  rooms: AcademyRoom[];
  building: BuildingData | null;
  catalogue: AcademyProduct[];
  textures?: Record<string, string>;
  /** Live section counts per room id (from the database). */
  roomCounts?: Record<string, string>;
  focus: number;
  onFocusChange: (index: number) => void;
  onEnterRoom: (roomId: string) => void;
  onOpenDoor: (door: BuildingDoor) => void;
  onModeChange?: (mode: "browse" | "walk") => void;
}

const HallwayScene = ({
  rooms,
  building,
  catalogue,
  textures = {},
  roomCounts = {},
  focus,
  onFocusChange,
  onEnterRoom,
  onOpenDoor,
  onModeChange,
}: HallwaySceneProps) => {
  // Saved configuration is the source of truth: merge it field-by-field over
  // the defaults so a partial/legacy record never loses its custom materials.
  const env = useMemo(
    () => mergeEnvironment(building?.building.environment ?? null),
    [building],
  );
  const lights = useMemo(() => lightBudget(env.lighting), [env.lighting]);
  const walkways = building?.walkways ?? [];
  const doors = building?.doors ?? [];

  const productTitles = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of catalogue) out[`${p.kind}:${p.id}`] = p.title;
    return out;
  }, [catalogue]);

  const doorsByWalkway = useMemo(() => {
    const map = new Map<string, BuildingDoor[]>();
    for (const d of doors) {
      const arr = map.get(d.walkway_id) ?? [];
      arr.push(d);
      map.set(d.walkway_id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position_along - b.position_along);
    return map;
  }, [doors]);

  const rootLen = Math.max(
    walkways.find((w) => !w.parent_id)?.length ?? 12,
    (rooms.length + doors.length) * SPACING + 12,
  );

  const { segments, layouts } = useMemo(
    () =>
      buildHallways(
        walkways,
        (walkwayId) =>
          (doorsByWalkway.get(walkwayId) ?? []).map((d) => ({
            id: d.id,
            name: doorTitle(d, productTitles),
            order: 5 + d.position_along * 100,
          })),
        rooms.map((r, i) => ({ id: `room:${r.id}`, name: r.name, order: i * 10 })),
        rootLen,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walkways, doorsByWalkway, productTitles, rooms, rootLen],
  );

  const rootSeg: Segment = useMemo(
    () =>
      segments.find((s) => s.depth === 0) ?? {
        walkway: null,
        start: [0, 0] as [number, number],
        heading: [0, -1] as [number, number],
        length: rootLen,
        depth: 0,
        children: [],
      },
    [segments, rootLen],
  );
  const rootEffective = rootSeg;

  const [phase, setPhase] = useState<NavPhase>("browse");
  const [nav, setNav] = useState<NavState>({ seg: rootEffective, mode: "browse" });
  const [moving, setMoving] = useState(false);
  const [endReached, setEndReached] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<string[]>(["Entrance"]);
  const [cue, setCue] = useState<string | null>(null);
  const [showMap] = useState(true);
  const machineRef = useRef<Machine>({
    phase: "browse",
    seg: rootEffective,
    dist: 0,
    moving: false,
    yaw: 0,
    turn: null,
    zoom: null,
  });
  const historyRef = useRef(new NavigationHistory());
  const cueTimer = useRef<number | null>(null);

  const setMachinePhase = useCallback((p: NavPhase) => {
    machineRef.current.phase = p;
    setPhase(p);
  }, []);

  const showCue = useCallback((msg: string) => {
    setCue(msg);
    if (cueTimer.current) window.clearTimeout(cueTimer.current);
    cueTimer.current = window.setTimeout(() => setCue(null), 1600);
  }, []);
  useEffect(() => () => {
    if (cueTimer.current) window.clearTimeout(cueTimer.current);
  }, []);

  // Keep the machine's segment aligned with a rebuilt graph (editor adds a
  // walkway while the world is open and the live refresh reloads the building).
  useEffect(() => {
    if (machineRef.current.phase === "browse") {
      machineRef.current.seg = rootEffective;
    }
  }, [rootEffective]);


  const notifyMode = useCallback((m: "browse" | "walk") => onModeChange?.(m), [onModeChange]);

  const syncBreadcrumb = useCallback(() => {
    const path = historyRef.current.path;
    const labels: string[] = [];
    for (const id of path) {
      const seg = findSegment(segments, id);
      labels.push(
        seg?.walkway?.name ||
          (seg?.walkway?.direction ? DIRECTION_LABEL[seg.walkway.direction] : "Hallway"),
      );
    }
    setBreadcrumb(labels.length ? labels : ["Entrance"]);
  }, [segments]);

  const backToBrowse = useCallback(() => {
    const st = machineRef.current;
    st.phase = "browse";
    st.seg = rootEffective;
    st.dist = 0;
    st.moving = false;
    st.yaw = 0;
    st.turn = null;
    st.zoom = null;
    historyRef.current.clear();
    setMoving(false);
    setEndReached(false);
    setNav({ seg: rootEffective, mode: "browse" });
    setPhase("browse");
    notifyMode("browse");
    syncBreadcrumb();
  }, [rootEffective, notifyMode, syncBreadcrumb]);

  const enterWalk = useCallback(
    (seg: Segment) => {
      const st = machineRef.current;
      st.seg = seg;
      st.dist = 0;
      st.moving = true;
      st.yaw = segYaw(seg.heading);
      historyRef.current.clear();
      historyRef.current.push(seg.walkway?.id ?? "entrance");
      setMoving(true);
      setEndReached(false);
      setNav({ seg, mode: "walk" });
      setMachinePhase("walking");
      notifyMode("walk");
      syncBreadcrumb();
    },
    [setMachinePhase, notifyMode, syncBreadcrumb],
  );

  /**
   * Enter a connected hallway. Forward continuations simply carry on. Side
   * hallways are entered by gliding into the opening and resuming down the new
   * hallway — the camera never performs a visible 90° rotation, so the turn is
   * only ever explicit on the map.
   */
  const pickBranch = useCallback(
    (child: Segment) => {
      const st = machineRef.current;
      if (st.phase === "turning" || st.phase === "retracing" || st.phase === "zooming") return;

      const resume = () => {
        st.seg = child;
        st.dist = 0;
        st.yaw = segYaw(child.heading);
        st.moving = true;
        historyRef.current.push(child.walkway?.id ?? child.heading.join(","));
        setMoving(true);
        setNav({ seg: child, mode: "walk" });
        setEndReached(false);
        setMachinePhase("walking");
        syncBreadcrumb();
      };

      if (child.walkway?.direction === "forward") {
        if (st.dist < st.seg.length - 0.6) {
          showCue("Keep walking to the end of the hallway");
          return;
        }
        resume();
        return;
      }

      // glide into the opening, then continue inside the side hallway
      st.moving = false;
      setMoving(false);
      st.zoom = {
        from: [0, 0, 0],
        to: [child.start[0], 1.75, child.start[1]],
        look: [
          child.start[0] + child.heading[0] * 6,
          1.7,
          child.start[1] + child.heading[1] * 6,
        ],
        duration: 0.55,
        elapsed: 0,
        started: false,
        restorePhase: "walking",
        onDone: resume,
      };
      setMachinePhase("zooming");
    },
    [setMachinePhase, showCue, syncBreadcrumb],
  );

  /** Paused camera zoom onto a doorway, then navigate. */
  const startDoorZoom = useCallback(
    (world: [number, number], front: [number, number], onDone: () => void) => {
      const st = machineRef.current;
      if (st.phase === "turning" || st.phase === "retracing" || st.phase === "zooming") return;
      const restore = st.phase;
      st.moving = false;
      setMoving(false);
      st.zoom = {
        from: [0, 0, 0],
        to: [world[0] + front[0] * 2.2, 1.7, world[1] + front[1] * 2.2],
        look: [world[0], 1.6, world[1]],
        duration: 0.8,
        elapsed: 0,
        started: false,
        restorePhase: restore,
        onDone: () => {
          const st2 = machineRef.current;
          setMachinePhase(st2.phase === "zooming" ? restore : st2.phase);
          onDone();
        },
      };
      setMachinePhase("zooming");
    },
    [setMachinePhase],
  );

  /** Back = 180° turnaround, glide back to the junction, re-align into parent. */
  const goBack = useCallback(() => {
    const st = machineRef.current;
    if (st.phase === "turning" || st.phase === "retracing" || st.phase === "zooming") return;
    if (st.phase === "browse") return;
    st.moving = false;
    setMoving(false);
    const seg = st.seg;
    const pos: [number, number] = [
      seg.start[0] + seg.heading[0] * st.dist,
      seg.start[1] + seg.heading[1] * st.dist,
    ];
    if (!seg.walkway?.parent_id && st.dist < 1.5) {
      backToBrowse();
      return;
    }
    st.turn = {
      pivot: pos,
      fromYaw: st.yaw,
      toYaw: st.yaw + Math.PI,
      radius: 0.25,
      duration: 0.5,
      elapsed: 0,
      onDone: () => setMachinePhase("retracing"),
    };
    setMachinePhase("turning");
  }, [backToBrowse, setMachinePhase]);

  /** Reached the end of a segment while walking → show the junction. */
  const handleWalkEnd = useCallback(() => {
    const st = machineRef.current;
    if (st.phase !== "walking") return;
    setEndReached(true);
    if (!st.moving) {
      setMachinePhase("idle");
    }
  }, [setMachinePhase]);

  /** Retrace reached the junction → re-align to face back down the parent. */
  const finishRetrace = useCallback(() => {
    const st = machineRef.current;
    const seg = st.seg;
    const parent = seg.walkway?.parent_id ? findSegment(segments, seg.walkway.parent_id) : null;
    if (!parent) {
      backToBrowse();
      return;
    }
    st.turn = {
      pivot: [seg.start[0], seg.start[1]],
      fromYaw: st.yaw,
      toYaw: segYaw(reverseHeading(parent.heading)),
      radius: 0.3,
      duration: 0.5,
      elapsed: 0,
      onDone: () => {
        st.seg = parent;
        st.dist = parent.length;
        st.moving = false;
        historyRef.current.pop();
        setMoving(false);
        setNav({ seg: parent, mode: "walk" });
        setEndReached(true);
        setMachinePhase("idle");
        syncBreadcrumb();
      },
    };
    setMachinePhase("turning");
  }, [segments, backToBrowse, setMachinePhase, syncBreadcrumb]);

  // Keyboard: arrows + WASD, routed through the graph (no free-fly).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = machineRef.current;
      const key = e.key;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) e.preventDefault();
      if (key === "ArrowUp" || key === "w" || key === "W") {
        if (st.phase === "browse") {
          if (focus < rooms.length - 1) onFocusChange(focus + 1);
          else enterWalk(rootEffective);
        } else if (st.phase === "walking" || st.phase === "idle") {
          if (endReached) {
            const fwd = st.seg.children.find((c) => c.walkway?.direction === "forward");
            if (fwd) pickBranch(fwd);
            else if (st.seg.children.length === 0) showCue("End of walkway");
          } else {
            st.moving = true;
            setMoving(true);
          }
        }
        return;
      }
      if (key === "ArrowDown" || key === "s" || key === "S") {
        if (st.phase === "browse") onFocusChange(Math.max(0, focus - 1));
        else if (st.phase === "walking" || st.phase === "idle") goBack();
        return;
      }
      if (key === "ArrowLeft" || key === "a" || key === "A") {
        if (st.phase === "browse") {
          onFocusChange(Math.max(0, focus - 1));
          return;
        }
        if (st.phase !== "walking" && st.phase !== "idle") return;
        const left = st.seg.children.find((c) => c.walkway?.direction === "left");
        if (left) pickBranch(left);
        else showCue("No walkway to the left");
        return;
      }
      if (key === "ArrowRight" || key === "d" || key === "D") {
        if (st.phase === "browse") {
          onFocusChange(Math.min(rooms.length - 1, focus + 1));
          return;
        }
        if (st.phase !== "walking" && st.phase !== "idle") return;
        const right = st.seg.children.find((c) => c.walkway?.direction === "right");
        if (right) pickBranch(right);
        else showCue("No walkway to the right");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    focus,
    rooms.length,
    onFocusChange,
    enterWalk,
    rootEffective,
    goBack,
    endReached,
    pickBranch,
    showCue,
  ]);

  const dragStart = useRef<number | null>(null);

  const inWalk = phase !== "browse";
  const atJunction =
    (phase === "walking" || phase === "idle") && endReached && nav.seg.children.length > 0;
  const hasForwardChild =
    atJunction && nav.seg.children.some((c) => c.walkway?.direction === "forward");
  const canBack = phase === "walking" || phase === "idle";
  const roomsById = useMemo(() => {
    const map = new Map<string, { room: AcademyRoom; index: number }>();
    rooms.forEach((room, index) => map.set(room.id, { room, index }));
    return map;
  }, [rooms]);

  const doorsById = useMemo(() => {
    const map = new Map<string, BuildingDoor>();
    for (const d of doors) map.set(d.id, d);
    return map;
  }, [doors]);

  /** Doors and sub-hallway openings of one hallway, from the shared layout. */
  const renderObjects = (seg: Segment) => {
    if (!seg.walkway) return null;
    const objs = layouts.get(seg.walkway.id) ?? [];
    const yaw = segYaw(seg.heading);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);

    return objs.map((o, i) => {
      if (o.kind === "opening") {
        const child = seg.children.find((c) => c.walkway?.id === o.id);
        if (!child) return null;
        return (
          <BranchOpening
            key={o.id}
            side={o.side}
            along={o.along}
            name={o.name}
            onEnter={() => pickBranch(child)}
          />
        );
      }

      const wx = seg.start[0] + seg.heading[0] * o.along + o.side * (HALL_WIDTH / 2 - 0.2) * cy;
      const wz = seg.start[1] + seg.heading[1] * o.along - o.side * (HALL_WIDTH / 2 - 0.2) * sy;
      const front: [number, number] = turnHeading(seg.heading, o.side === -1 ? "right" : "left");

      if (o.id.startsWith("room:")) {
        const entry = roomsById.get(o.id.slice(5));
        if (!entry) return null;
        return (
          <group key={o.id} position={[0, 0, -o.along]}>
            <DoorMesh
              side={o.side}
              z={0}
              label={entry.room.name}
              sublabel={roomCounts[entry.room.id] ?? (entry.room.description || "Open room")}
              accent={accentOf(entry.room, entry.index)}
              color={env.door.color}
              emissiveIntensity={env.door.brightness * 0.12}
              onEnter={() => startDoorZoom([wx, wz], front, () => onEnterRoom(entry.room.id))}
            />
          </group>
        );
      }

      const d = doorsById.get(o.id);
      if (!d) return null;
      const sublabel = d.content_kind
        ? `${DOOR_KIND_LABEL[d.content_kind]}${d.content_kind === "adventure" || d.content_kind === "assessment" ? " · runs in class" : ""}`
        : "Add content in the editor";
      return (
        <group key={o.id} position={[0, 0, -o.along]}>
          <DoorMesh
            side={o.side}
            z={0}
            label={o.name}
            sublabel={sublabel}
            accent={d.content_kind ? ["#7dd3fc", "#fcd34d", "#a7f3d0", "#f9a8d4"][i % 4] : "#64748b"}
            color={env.door.color}
            emissiveIntensity={env.door.brightness * 0.12}
            onEnter={() => startDoorZoom([wx, wz], front, () => onOpenDoor(d))}
          />
        </group>
      );
    });
  };

  const dirPill = atJunction ? (
    <div className="pointer-events-none absolute left-3 top-28 z-10 flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-[11px] font-medium text-foreground/90 backdrop-blur">
      {nav.seg.children.map((c) => (
        <span
          key={c.walkway!.id}
          className={c.walkway?.direction === "forward" ? "text-emerald-300" : "text-sky-300"}
        >
          {c.walkway?.direction === "left" ? "← " : ""}
          {c.walkway?.name}
          {c.walkway?.direction === "right" ? " →" : ""}
          {c.walkway?.direction === "forward" ? " ▶" : ""}
        </span>
      ))}
    </div>
  ) : null;

  // The endpoint is the final node of the walked route.
  const endpointName =
    endReached && !nav.seg.children.some((c) => c.walkway?.direction === "forward")
      ? (nav.seg.walkway?.end_label ?? DEFAULT_ENDPOINT_NAME)
      : null;
  const trail = endpointName ? [...breadcrumb, endpointName] : breadcrumb;

  return (
    <div
      className="absolute inset-0"
      onPointerDown={(e) => (dragStart.current = e.clientX)}
      onPointerUp={(e) => {
        if (phase !== "browse" || dragStart.current === null) return;
        const dx = e.clientX - dragStart.current;
        dragStart.current = null;
        if (Math.abs(dx) < 60) return;
        onFocusChange(
          dx < 0 ? Math.min(rooms.length - 1, focus + 1) : Math.max(0, focus - 1),
        );
      }}
    >
      <Canvas
        shadows
        camera={{ position: [0, 1.7, 6.5], fov: 62 }}
        dpr={[1, 2]}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
      >
        <color attach="background" args={["#131a2b"]} />
        <fog attach="fog" args={["#131a2b", 16, env.lighting.atmosphere ? 56 : 50]} />
        <ambientLight intensity={lights.ambient} />
        <hemisphereLight args={["#cfe3ff", "#2a3042", lights.hemisphere]} />
        <directionalLight
          position={[3, 8, 4]}
          intensity={lights.directional}
          castShadow
        />
        {env.lighting.atmosphere && (
          <pointLight position={[0, HALL_HEIGHT - 1, -rootLen / 2]} intensity={lights.point * 1.4} distance={22} color="#cfe3ff" />
        )}
        {env.effects.enabled && env.effects.effect === "soft-particles" && (
          <Sparkles count={70} scale={[HALL_WIDTH, HALL_HEIGHT, rootLen + 10]} size={2.2} speed={0.35} color="#7dd3fc" />
        )}
        {env.effects.enabled && env.effects.effect === "sun-beams" && (
          <group>
            <Sparkles count={40} scale={[HALL_WIDTH, HALL_HEIGHT, rootLen + 10]} size={3.5} speed={0.15} color="#fde68a" />
            <pointLight position={[0, HALL_HEIGHT, -rootLen / 2]} intensity={lights.point * 1.2} distance={26} color="#fde68a" />
          </group>
        )}
        {rooms.map((_, i) => (
          <pointLight key={i} position={[0, HALL_HEIGHT - 0.6, -i * SPACING]} intensity={lights.point} distance={11} color="#cfe3ff" />
        ))}

        <CameraRig
          focus={focus}
          rooms={rooms}
          m={machineRef}
          rootLen={rootLen}
          onWalkEnd={handleWalkEnd}
          onRetraceEnd={finishRetrace}
          setPhase={setMachinePhase}
        />

{/* Enclosed hallways — each finite, named, walled at its far end */}
        {segments.map((seg) => (
          <SegmentCorridor
            key={seg.walkway?.id ?? "root"}
            start={seg.start}
            yaw={segYaw(seg.heading)}
            length={seg.length}
            env={env}
            textures={textures}
            capEnd={!seg.children.some((c) => c.walkway?.direction === "forward")}
            capStart={seg.depth === 0}
            name={seg.walkway?.name}
            endName={
              seg.children.some((c) => c.walkway?.direction === "forward")
                ? undefined
                : (seg.walkway?.end_label ?? DEFAULT_ENDPOINT_NAME)
            }
          />
        ))}

        {/* Doors and sub-hallway openings along each hallway */}
        {segments.map((seg) => (
          <group
            key={`objs-${seg.walkway?.id ?? "root"}`}
            position={[seg.start[0], 0, seg.start[1]]}
            rotation-y={segYaw(seg.heading)}
          >
            {renderObjects(seg)}
          </group>
        ))}
      </Canvas>

      {/* Navigation HUD */}
      {inWalk && (
        <>
          <div className="pointer-events-none absolute left-3 top-16 z-10 flex max-w-[60vw] items-center gap-1.5 overflow-hidden rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
            {trail.map((b, i) => (
              <span key={`${b}-${i}`} className="flex items-center gap-1.5 whitespace-nowrap">
                {i > 0 && <span className="text-muted-foreground/50">/</span>}
                <span className={i === trail.length - 1 ? "font-semibold text-foreground" : ""}>{b}</span>
              </span>
            ))}
          </div>
          {dirPill}
          {cue && (
            <div className="pointer-events-none absolute left-1/2 top-1/4 z-20 -translate-x-1/2 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-xs font-medium text-amber-200 backdrop-blur">
              {cue}
            </div>
          )}
        </>
      )}

      {canBack && (
        <WalkControls
          atJunction={atJunction}
          children={nav.seg.children}
          hasForward={hasForwardChild}
          canBack={canBack}
          moving={moving}
          ended={endReached}
          onForwardDown={() => {
            machineRef.current.moving = true;
            setMoving(true);
          }}
          onForwardUp={() => {
            machineRef.current.moving = false;
            setMoving(false);
            if (endReached) setMachinePhase("idle");
          }}
          onTurn={pickBranch}
          onBack={goBack}
        />
      )}

      {/* Fixed structural map — always on, top-right, like a racing minimap */}
      <MiniMap
        segments={segments}
        layouts={layouts}
        m={machineRef}
        show={showMap}
        ended={endReached}
      />
    </div>
  );
};

export default HallwayScene;