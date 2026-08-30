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
  NavigationHistory,
  reverseHeading,
  segYaw,
  turnHeading,
} from "@/lib/building/navigation";

const SPACING = 7.5; // distance between room doorways along the corridor
const HALL_WIDTH = 7;
const HALL_HEIGHT = 5.4;
const WALK_SPEED = 4; // units per second while holding forward

const accentOf = (room: AcademyRoom, index: number) =>
  room.accent || ["#7dd3fc", "#fcd34d", "#a7f3d0", "#f9a8d4", "#c4b5fd", "#fdba74"][index % 6];

// ── Walkway graph geometry ────────────────────────────────────────────────

interface Segment {
  walkway: BuildingWalkway | null;
  start: [number, number];
  heading: [number, number];
  length: number;
  depth: number;
  children: Segment[];
}

const computeSegments = (walkways: BuildingWalkway[]): Segment[] => {
  const segs: Segment[] = [];
  const walk = (
    w: BuildingWalkway,
    start: [number, number],
    heading: [number, number],
    depth: number,
  ): Segment => {
    const seg: Segment = { walkway: w, start, heading, length: w.length, depth, children: [] };
    segs.push(seg);
    const end: [number, number] = [start[0] + heading[0] * w.length, start[1] + heading[1] * w.length];
    walkways
      .filter((x) => x.parent_id === w.id)
      .sort((a, b) => a.position - b.position)
      .forEach((child) => seg.children.push(walk(child, end, turnHeading(heading, child.direction), depth + 1)));
    return seg;
  };
  walkways
    .filter((w) => !w.parent_id)
    .sort((a, b) => a.position - b.position)
    .forEach((w) => walk(w, [0, 0], [0, -1], 0));
  return segs;
};

const findSegment = (segs: Segment[], id: string): Segment | null => {
  for (const s of segs) {
    if (s.walkway?.id === id) return s;
    const hit = findSegment(s.children, id);
    if (hit) return hit;
  }
  return null;
};

// ── Shared texture loading ────────────────────────────────────────────────
// The same image (e.g. a built-in sample) may appear on several segments and
// surfaces. Decode once per URL, hand every subscriber its own clone so each
// surface can fit/tile independently.

const textureCache = new Map<string, THREE.Texture>();
const textureWaiters = new Map<string, Set<(t: THREE.Texture | null) => void>>();

const requestTexture = (url: string, cb: (t: THREE.Texture | null) => void): void => {
  const hit = textureCache.get(url);
  if (hit) {
    cb(hit.clone());
    return;
  }
  let waiters = textureWaiters.get(url);
  if (waiters) {
    waiters.add(cb);
    return;
  }
  waiters = new Set([cb]);
  textureWaiters.set(url, waiters);
  new THREE.TextureLoader().load(
    url,
    (base) => {
      base.anisotropy = 4;
      textureCache.set(url, base);
      textureWaiters.delete(url);
      waiters!.forEach((w) => w(base.clone()));
    },
    undefined,
    () => {
      textureWaiters.delete(url);
      waiters!.forEach((w) => w(null));
    },
  );
};

const useLoadedTexture = (url: string | null | undefined): THREE.Texture | null => {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    requestTexture(url, setTex);
  }, [url]);
  return tex;
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
  receiveShadow,
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
  receiveShadow?: boolean;
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
        color={map ? "#ffffff" : mat.color}
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
}: {
  start: [number, number];
  yaw: number;
  length: number;
  env: EnvironmentSettings;
  textures: Record<string, string>;
}) => (
  <group position={[start[0], 0, start[1]]} rotation-y={yaw}>
    <group position={[0, 0, -length / 2]}>
      {/* floor */}
      <Surface
        rotation-x={-Math.PI / 2}
        receiveShadow
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

/** A glowing branch arch at a junction, pointing into the branch. */
const BranchArch = ({
  seg,
  label,
  onClick,
}: {
  seg: Segment;
  label: string;
  onClick: () => void;
}) => {
  const yaw = segYaw(seg.heading);
  const dir = forwardFromYaw(yaw);
  return (
    <group position={[seg.start[0], 0, seg.start[1]]} rotation-y={yaw}>
      <mesh
        position={[0, 1.7, 0.4]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <planeGeometry args={[HALL_WIDTH - 0.6, HALL_HEIGHT - 0.4]} />
        <meshStandardMaterial
          color="#0d1524"
          emissive={label === "Continue" ? "#34d399" : "#7dd3fc"}
          emissiveIntensity={0.5}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Suspense fallback={null}>
        <Text
          renderOrder={10}
          material-depthTest={false}
          position={[0, HALL_HEIGHT - 0.7, 0.5]}
          fontSize={0.22}
          anchorX="center"
          anchorY="middle"
          color={label === "Continue" ? "#a7f3d0" : "#bae6fd"}
        >
          {label}
        </Text>
      </Suspense>
      {/* keep the dir import honest for potential future use */}
      <span data-dir={dir.join(",")} className="hidden" />
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
      const targetZ = -focus * SPACING;
      const side = focus % 2 === 0 ? -1 : 1;
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ + 8.5, k);
      camera.position.y = 1.75;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, -side * 1.9, k);
      camera.lookAt(side * 4.2, 1.7, targetZ);
      void rootLen;
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

// ── Mini-map ──────────────────────────────────────────────────────────────

const MiniMap = ({
  segments,
  m,
  doors,
  show,
  onClose,
}: {
  segments: Segment[];
  m: React.RefObject<Machine>;
  doors: BuildingDoor[];
  show: boolean;
  onClose: () => void;
}) => {
  const svg = useMemo(() => {
    const pts: number[] = [];
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const walk = (s: Segment) => {
      const ex = s.start[0] + s.heading[0] * s.length;
      const ez = s.start[1] + s.heading[1] * s.length;
      lines.push({ x1: s.start[0], y1: s.start[1], x2: ex, y2: ez });
      pts.push(s.start[0], s.start[1], ex, ez);
      s.children.forEach(walk);
    };
    segments.forEach(walk);
    if (pts.length === 0) pts.push(0, 0, 0, -10);
    const xs = pts.filter((_, i) => i % 2 === 0);
    const zs = pts.filter((_, i) => i % 2 === 1);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const W = 220;
    const H = 170;
    const sc = Math.min((W - 24) / Math.max(1, maxX - minX), (H - 24) / Math.max(1, maxZ - minZ));
    const px = (x: number) => (x - minX) * sc + 12;
    const py = (z: number) => (maxZ - z) * sc + 12; // forward (−z) renders up
    const doorDots = doors
      .map((d) => {
        const seg = findSegment(segments, d.walkway_id);
        if (!seg) return null;
        const along = d.position_along * seg.length;
        return [seg.start[0] + seg.heading[0] * along, seg.start[1] + seg.heading[1] * along] as const;
      })
      .filter((v): v is readonly [number, number] => v !== null);
    return { W, H, px, py, lines, doorDots, nodes: segments.map((s) => s.start) };
  }, [segments, doors]);

  if (!show) return null;
  const st = m.current;
  const you: [number, number] = st
    ? [st.seg.start[0] + st.seg.heading[0] * st.dist, st.seg.start[1] + st.seg.heading[1] * st.dist]
    : [0, 0];

  return (
    <div className="absolute bottom-24 right-3 z-20 rounded-xl border border-border/60 bg-background/85 p-2 shadow-xl backdrop-blur">
      <div className="mb-1 flex items-center justify-between gap-6">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Walkway map
        </span>
        <button
          type="button"
          aria-label="Close map"
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          ✕
        </button>
      </div>
      <svg width={220} height={170} viewBox={`0 0 ${svg.W} ${svg.H}`} className="rounded-lg bg-black/30">
        {svg.lines.map((l, i) => (
          <line
            key={i}
            x1={svg.px(l.x1)}
            y1={svg.py(l.y1)}
            x2={svg.px(l.x2)}
            y2={svg.py(l.y2)}
            stroke="#64748b"
            strokeWidth={4}
            strokeLinecap="round"
          />
        ))}
        {svg.nodes.map((n, i) => (
          <circle key={i} cx={svg.px(n[0])} cy={svg.py(n[1])} r={3} fill="#94a3b8" />
        ))}
        {svg.doorDots.map((d, i) => (
          <rect key={i} x={svg.px(d[0]) - 3} y={svg.py(d[1]) - 3} width={6} height={6} rx={1} fill="#fbbf24" />
        ))}
        <circle cx={svg.px(you[0])} cy={svg.py(you[1])} r={5} fill="#7dd3fc" stroke="#0b0f18" strokeWidth={1.5} />
      </svg>
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
  const env = building?.building.environment ?? DEFAULT_ENVIRONMENT;
  const walkways = building?.walkways ?? [];
  const doors = building?.doors ?? [];

  const segments = useMemo(() => computeSegments(walkways), [walkways]);
  const rootSeg: Segment = useMemo(
    () =>
      segments[0] ?? {
        walkway: null,
        start: [0, 0] as [number, number],
        heading: [0, -1] as [number, number],
        length: 12,
        depth: 0,
        children: [],
      },
    [segments],
  );
  const rootLen = Math.max(rootSeg.length, rooms.length * SPACING + 10);
  const rootEffective: Segment = useMemo(
    () => ({ ...rootSeg, length: rootLen }),
    [rootSeg, rootLen],
  );

  const [phase, setPhase] = useState<NavPhase>("browse");
  const [nav, setNav] = useState<NavState>({ seg: rootEffective, mode: "browse" });
  const [moving, setMoving] = useState(false);
  const [endReached, setEndReached] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<string[]>(["Entrance"]);
  const [cue, setCue] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
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

  const titles = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of catalogue) out[`${p.kind}:${p.id}`] = p.title;
    return out;
  }, [catalogue]);

  const notifyMode = useCallback((m: "browse" | "walk") => onModeChange?.(m), [onModeChange]);

  const syncBreadcrumb = useCallback(() => {
    const path = historyRef.current.path;
    const labels = ["Entrance"];
    const counts: Record<string, number> = {};
    for (const id of path.slice(1)) {
      const seg = findSegment(segments, id);
      const base = seg?.walkway?.direction ? DIRECTION_LABEL[seg.walkway.direction] : "Walkway";
      counts[base] = (counts[base] ?? 0) + 1;
      labels.push(counts[base] > 1 ? `${base} ${counts[base]}` : base);
    }
    setBreadcrumb(labels);
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

  /** Smooth 90° corner sweep into a branch at the current junction. */
  const pickBranch = useCallback(
    (child: Segment) => {
      const st = machineRef.current;
      if (st.phase === "turning" || st.phase === "retracing" || st.phase === "zooming") return;
      if (st.dist < st.seg.length - 0.5) {
        showCue("Turn at the end of the walkway");
        return;
      }
      st.moving = false;
      setMoving(false);
      st.turn = {
        pivot: [st.seg.start[0], st.seg.start[1]],
        fromYaw: st.yaw,
        toYaw: segYaw(child.heading),
        radius: 0.6,
        duration: 0.7,
        elapsed: 0,
        onDone: () => {
          st.seg = child;
          st.dist = 0;
          st.moving = true;
          setMoving(true);
          historyRef.current.push(child.walkway?.id ?? child.heading.join(","));
          setNav({ seg: child, mode: "walk" });
          setEndReached(false);
          setMachinePhase("walking");
          syncBreadcrumb();
        },
      };
      setMachinePhase("turning");
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
  const rootDoorsById = useMemo(() => {
    const map = new Map<string, BuildingDoor[]>();
    for (const d of doors) {
      const arr = map.get(d.walkway_id) ?? [];
      arr.push(d);
      map.set(d.walkway_id, arr);
    }
    return map;
  }, [doors]);

  const renderDoors = (seg: Segment) => {
    if (!seg.walkway) return null;
    const segDoors = (rootDoorsById.get(seg.walkway.id) ?? []).sort(
      (a, b) => a.position_along - b.position_along,
    );
    return segDoors.map((d, i) => {
      const accent = d.content_kind
        ? ["#7dd3fc", "#fcd34d", "#a7f3d0", "#f9a8d4"][i % 4]
        : "#64748b";
      const title = doorTitle(d, titles);
      const sublabel = d.content_kind
        ? `${DOOR_KIND_LABEL[d.content_kind]}${d.content_kind === "adventure" || d.content_kind === "assessment" ? " · runs in class" : ""}`
        : "Add content in the editor";
      const yaw = segYaw(seg.heading);
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const side = i % 2 === 0 ? -1 : 1;
      const along = d.position_along * seg.length;
      const bx = seg.start[0] + seg.heading[0] * along + side * (HALL_WIDTH / 2 - 0.2) * cy;
      const bz = seg.start[1] + seg.heading[1] * along - side * (HALL_WIDTH / 2 - 0.2) * sy;
      const front: [number, number] = turnHeading(seg.heading, side === -1 ? "right" : "left");
      return (
        <group key={d.id} position={[0, 0, -along]}>
          <DoorMesh
            side={side}
            z={0}
            label={title}
            sublabel={sublabel}
            accent={accent}
            color={env.door.color}
            emissiveIntensity={env.door.brightness * 0.12}
            onEnter={() => startDoorZoom([bx, bz], front, () => onOpenDoor(d))}
          />
        </group>
      );
    });
  };

  const dirPill = atJunction ? (
    <div className="pointer-events-none absolute top-16 z-10 flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-[11px] font-medium text-foreground/90 backdrop-blur">
      {nav.seg.children
        .filter((c) => c.walkway?.direction === "left")
        .map((c) => (
          <span key={c.walkway!.id} className="text-sky-300">
            ← Left branch
          </span>
        ))}
      {hasForwardChild && <span className="text-emerald-300">Forward ▶</span>}
      {nav.seg.children
        .filter((c) => c.walkway?.direction === "right")
        .map((c) => (
          <span key={c.walkway!.id} className="text-sky-300">
            Right branch →
          </span>
        ))}
    </div>
  ) : null;

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
      <Canvas shadows camera={{ position: [0, 1.7, 6.5], fov: 62 }} dpr={[1, 2]}>
        <color attach="background" args={["#131a2b"]} />
        <fog attach="fog" args={["#131a2b", 16, env.lighting.atmosphere ? 56 : 50]} />
        <ambientLight intensity={env.lighting.ambient * env.lighting.brightness} />
        <hemisphereLight args={["#cfe3ff", "#2a3042", 0.85 * env.lighting.brightness]} />
        <directionalLight
          position={[3, 8, 4]}
          intensity={env.lighting.intensity * env.lighting.brightness}
          castShadow
        />
        {env.lighting.atmosphere && (
          <pointLight position={[0, HALL_HEIGHT - 1, -rootLen / 2]} intensity={6} distance={22} color="#cfe3ff" />
        )}
        {env.effects.enabled && env.effects.effect === "soft-particles" && (
          <Sparkles count={70} scale={[HALL_WIDTH, HALL_HEIGHT, rootLen + 10]} size={2.2} speed={0.35} color="#7dd3fc" />
        )}
        {env.effects.enabled && env.effects.effect === "sun-beams" && (
          <group>
            <Sparkles count={40} scale={[HALL_WIDTH, HALL_HEIGHT, rootLen + 10]} size={3.5} speed={0.15} color="#fde68a" />
            <pointLight position={[0, HALL_HEIGHT, -rootLen / 2]} intensity={5} distance={26} color="#fde68a" />
          </group>
        )}
        {rooms.map((_, i) => (
          <pointLight key={i} position={[0, HALL_HEIGHT - 0.6, -i * SPACING]} intensity={4.5} distance={16} color="#cfe3ff" />
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

{/* Root corridor (rooms always fit, whatever the stored walkway length) */}
        <mesh position={[0, 2, -6]}>
          <boxGeometry args={[2, 2, 2]} />
          <meshBasicMaterial color="#ff2200" />
        </mesh>
        <SegmentCorridor
          start={[0, 0]}
          yaw={0}
          length={rootLen}
          env={env}
          textures={textures}
        />

        {/* Branch corridors */}
        {segments.slice(1).map((seg) => (
          <SegmentCorridor
            key={seg.walkway!.id}
            start={seg.start}
            yaw={segYaw(seg.heading)}
            length={seg.length}
            env={env}
            textures={textures}
          />
        ))}

        {/* Room doorways (existing academy rooms) */}
        {rooms.map((room, index) => {
          const side = index % 2 === 0 ? -1 : 1;
          const wx = side * (HALL_WIDTH / 2 - 0.2);
          const wz = -index * SPACING;
          return (
            <DoorMesh
              key={room.id}
              side={side}
              z={wz}
              label={room.name}
              sublabel={roomCounts[room.id] ?? (room.description || "Open room")}
              accent={accentOf(room, index)}
              color={env.door.color}
              emissiveIntensity={0.12}
              onEnter={() => startDoorZoom([wx, wz], [-side, 0], () => onEnterRoom(room.id))}
            />
          );
        })}

        {/* Walkway content doors */}
        {segments.map((seg) => (
          <group key={seg.walkway?.id ?? "root"} position={[seg.start[0], 0, seg.start[1]]} rotation-y={segYaw(seg.heading)}>
            {renderDoors(seg)}
          </group>
        ))}

        {/* Junction arches into branches */}
        {segments.map((seg) =>
          seg.children
            .filter((c) => c.walkway?.direction !== "forward")
            .map((c) => (
              <BranchArch
                key={c.walkway!.id}
                seg={c}
                label={c.walkway!.direction === "left" ? "Left branch" : "Right branch"}
                onClick={() => pickBranch(c)}
              />
            )),
        )}
      </Canvas>

      {/* Navigation HUD */}
      {inWalk && (
        <>
          <div className="pointer-events-none absolute left-3 top-16 z-10 flex max-w-[60vw] items-center gap-1.5 overflow-hidden rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
            {breadcrumb.map((b, i) => (
              <span key={`${b}-${i}`} className="flex items-center gap-1.5 whitespace-nowrap">
                {i > 0 && <span className="text-muted-foreground/50">/</span>}
                <span className={i === breadcrumb.length - 1 ? "font-semibold text-foreground" : ""}>{b}</span>
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

      {/* Mini-map toggle */}
      {inWalk && (
        <button
          type="button"
          aria-label="Toggle walkway map"
          onClick={() => setShowMap((s) => !s)}
          className="absolute bottom-24 right-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground"
        >
          <span className="text-sm">🗺</span>
        </button>
      )}
      <MiniMap segments={segments} m={machineRef} doors={doors} show={showMap} onClose={() => setShowMap(false)} />
    </div>
  );
};

export default HallwayScene;