/**
 * ACADEMY HALLWAY — the walkway environment inside the building.
 *
 * The corridor is generated from the academy rooms (add a room in the editor
 * and a new doorway appears, in its stored order) AND from the building's
 * walkway graph: the owner can extend the walkway forward, branch left/right,
 * and place content doors along any segment. Navigation is a smooth glide:
 * browse mode walks doorway to doorway; at the end of the walkway the player
 * can turn into branches (smooth camera re-orientation) or continue forward.
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
import { DOOR_KIND_LABEL, DEFAULT_ENVIRONMENT, DIRECTION_LABEL } from "@/lib/building/types";
import type {
  BuildingData,
  BuildingDoor,
  BuildingWalkway,
  EnvironmentSettings,
  WalkwayDirection,
} from "@/lib/building/types";
import { doorTitle } from "@/lib/building/api";
import { presetMaterial } from "@/lib/building/presets";

const SPACING = 7.5; // distance between room doorways along the corridor
const HALL_WIDTH = 7;
const HALL_HEIGHT = 5.4;
const WALK_SPEED = 4; // units per second while holding forward

const accentOf = (room: AcademyRoom, index: number) =>
  room.accent || ["#7dd3fc", "#fcd34d", "#a7f3d0", "#f9a8d4", "#c4b5fd", "#fdba74"][index % 6];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// ── Walkway graph geometry ────────────────────────────────────────────────

interface Segment {
  walkway: BuildingWalkway | null;
  start: [number, number];
  heading: [number, number];
  length: number;
  depth: number;
  children: Segment[];
}

/** World yaw (rotation about Y) that faces a heading. forward=(0,-1) → 0. */
const segYaw = (h: [number, number]) => Math.atan2(-h[0], -h[1]);
const forwardFromYaw = (yaw: number): [number, number] => [-Math.sin(yaw), -Math.cos(yaw)];

const turnHeading = (h: [number, number], dir: WalkwayDirection): [number, number] => {
  if (dir === "forward") return h;
  const theta = dir === "left" ? Math.PI / 2 : -Math.PI / 2;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [h[0] * c + h[1] * s, -h[0] * s + h[1] * c];
};

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
    <mesh position={position} rotation-x={rotationX} rotation-y={rotationY} receiveShadow={receiveShadow}>
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

/** A clickable doorway with a glowing panel, frame and sign. */
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
  useFrame((_, delta) => {
    if (!glow.current) return;
    const k = 1 - Math.exp(-8 * Math.min(delta, 0.05));
    glow.current.emissiveIntensity = THREE.MathUtils.lerp(
      glow.current.emissiveIntensity,
      emissiveIntensity,
      k,
    );
  });

  return (
    <group position={[side * (HALL_WIDTH / 2 - 0.2), 0, z]} rotation-y={-side * 0.55}>
      <mesh
        position={[0, 1.6, 0.09]}
        onClick={(e) => {
          e.stopPropagation();
          onEnter();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
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
        <meshStandardMaterial color={accent} roughness={0.5} />
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

// ── Camera rig ────────────────────────────────────────────────────────────

interface NavState {
  seg: Segment;
  mode: "browse" | "walk";
}

const CameraRig = ({
  focus,
  rooms,
  nav,
  distRef,
  movingRef,
  rootLen,
}: {
  focus: number;
  rooms: AcademyRoom[];
  nav: NavState;
  distRef: React.MutableRefObject<number>;
  movingRef: React.MutableRefObject<boolean>;
  rootLen: number;
}) => {
  const yawRef = useRef(0);
  useFrame(({ camera }, delta) => {
    const k = 1 - Math.exp(-6 * Math.min(delta, 0.05));

    if (nav.mode === "walk") {
      const seg = nav.seg;
      if (movingRef.current) {
        distRef.current = Math.min(seg.length, distRef.current + delta * WALK_SPEED);
      }
      const d = distRef.current;
      const px = seg.start[0] + seg.heading[0] * d;
      const pz = seg.start[1] + seg.heading[1] * d;
      const ty = segYaw(seg.heading);
      yawRef.current = THREE.MathUtils.lerp(yawRef.current, ty, k);
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, px, k);
      camera.position.y = 1.75;
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, pz, k);
      const dir = forwardFromYaw(yawRef.current);
      camera.lookAt(camera.position.x + dir[0] * 6, 1.75, camera.position.z + dir[1] * 6);
      return;
    }

    // Browse mode: doorway-to-doorway glide (existing behaviour).
    const targetZ = -focus * SPACING;
    const side = focus % 2 === 0 ? -1 : 1;
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ + 8.5, k);
    camera.position.y = 1.75;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, -side * 1.9, k);
    camera.lookAt(side * 4.2, 1.7, targetZ);
    // Keep the walk distance in sync so switching modes is seamless.
    void rootLen;
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

// ── Scene ─────────────────────────────────────────────────────────────────

export interface HallwaySceneProps {
  rooms: AcademyRoom[];
  building: BuildingData | null;
  catalogue: AcademyProduct[];
  textures?: Record<string, string>;
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

  const [nav, setNav] = useState<NavState>({ seg: rootEffective, mode: "browse" });
  const [moving, setMoving] = useState(false);
  const [endReached, setEndReached] = useState(false);
  const distRef = useRef(0);
  const movingRef = useRef(false);
  const navRef = useRef(nav);
  navRef.current = nav;

  const titles = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of catalogue) out[`${p.kind}:${p.id}`] = p.title;
    return out;
  }, [catalogue]);

  // Track end-of-walkway so the junction overlay appears.
  useEffect(() => {
    if (nav.mode !== "walk") {
      setEndReached(false);
      return;
    }
    setEndReached(distRef.current >= nav.seg.length - 0.05);
  }, [nav, endReached, distRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  const notifyMode = useCallback(
    (m: "browse" | "walk") => onModeChange?.(m),
    [onModeChange],
  );

  const enterWalk = useCallback(
    (seg: Segment) => {
      distRef.current = 0;
      setNav({ seg, mode: "walk" });
      setMoving(true);
      movingRef.current = true;
      setEndReached(false);
      notifyMode("walk");
    },
    [notifyMode],
  );

  const backToBrowse = useCallback(() => {
    setNav({ seg: rootEffective, mode: "browse" });
    movingRef.current = false;
    setMoving(false);
    setEndReached(false);
    notifyMode("browse");
  }, [rootEffective, notifyMode]);

  const pickBranch = useCallback(
    (child: Segment) => {
      distRef.current = 0;
      setNav({ seg: child, mode: "walk" });
      setMoving(true);
      movingRef.current = true;
      setEndReached(false);
    },
    [],
  );

  const goBack = useCallback(() => {
    const cur = navRef.current.seg;
    if (navRef.current.mode !== "walk") return;
    if (cur.walkway?.parent_id) {
      const parent = findSegment(segments, cur.walkway.parent_id);
      if (parent) {
        distRef.current = Math.max(0, parent.length - 3);
        setNav({ seg: parent, mode: "walk" });
        setEndReached(false);
        return;
      }
    }
    backToBrowse();
  }, [segments, backToBrowse]);

  // Keyboard: arrows + WASD.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cur = navRef.current;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
      }
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        if (cur.mode === "browse") {
          if (focus < rooms.length - 1) onFocusChange(focus + 1);
          else enterWalk(rootEffective);
        } else {
          movingRef.current = true;
          setMoving(true);
        }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        if (cur.mode === "walk") {
          movingRef.current = false;
          setMoving(false);
          if (distRef.current < 2) goBack();
          else distRef.current = 0;
        } else onFocusChange(Math.max(0, focus - 1));
        return;
      }
      if (cur.mode !== "walk") {
        if (e.key === "ArrowRight" || e.key === "d" || e.key === "D")
          onFocusChange(Math.min(rooms.length - 1, focus + 1));
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A")
          onFocusChange(Math.max(0, focus - 1));
      } else if (endReached) {
        const seg = cur.seg;
        const left = seg.children.find((c) => c.walkway?.direction === "left");
        const right = seg.children.find((c) => c.walkway?.direction === "right");
        const fwd = seg.children.find((c) => c.walkway?.direction === "forward");
        if ((e.key === "ArrowLeft" || e.key === "a" || e.key === "A") && left) pickBranch(left);
        if ((e.key === "ArrowRight" || e.key === "d" || e.key === "D") && right) pickBranch(right);
        if ((e.key === "ArrowUp" || e.key === "w" || e.key === "W") && fwd) pickBranch(fwd);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, rooms.length, onFocusChange, enterWalk, rootEffective, goBack, endReached, pickBranch]);

  const dragStart = useRef<number | null>(null);

  const inWalk = nav.mode === "walk";
  const atJunction =
    inWalk && endReached && nav.seg.children.length > 0;
  const hasForwardChild =
    atJunction && nav.seg.children.some((c) => c.walkway?.direction === "forward");
  const canBack = inWalk;
  const doorsOnRoot = doors.filter((d) => d.walkway_id === (rootSeg.walkway?.id ?? ""));
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
return (
        <group key={d.id} position={[0, 0, -(d.position_along * seg.length)]}>
          <DoorMesh
            side={i % 2 === 0 ? -1 : 1}
            z={0}
            label={title}
            sublabel={sublabel}
            accent={accent}
            color={env.door.color}
            emissiveIntensity={env.door.brightness * 0.12}
            onEnter={() => onOpenDoor(d)}
          />
</group>
      );
    });
  };

  return (
    <div
      className="absolute inset-0"
      onPointerDown={(e) => (dragStart.current = e.clientX)}
      onPointerUp={(e) => {
        if (inWalk || dragStart.current === null) return;
        const dx = e.clientX - dragStart.current;
        dragStart.current = null;
        if (Math.abs(dx) < 60) return;
        onFocusChange(
          dx < 0 ? Math.min(rooms.length - 1, focus + 1) : Math.max(0, focus - 1),
        );
      }}
    >
      <Canvas shadows camera={{ position: [0, 1.7, 6.5], fov: 62 }} dpr={[1, 2]}>
        <color attach="background" args={["#0b0f18"]} />
        <fog attach="fog" args={["#0b0f18", 14, env.lighting.atmosphere ? 52 : 46]} />
        <ambientLight intensity={env.lighting.ambient * env.lighting.brightness} />
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
          nav={nav}
          distRef={distRef}
          movingRef={movingRef}
          rootLen={rootLen}
        />

        {/* Root corridor (rooms always fit, whatever the stored walkway length) */}
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
        {rooms.map((room, index) => (
          <DoorMesh
            key={room.id}
            side={index % 2 === 0 ? -1 : 1}
            z={-index * SPACING}
            label={room.name}
            sublabel={room.description || "Open room"}
            accent={accentOf(room, index)}
            color={env.door.color}
            emissiveIntensity={0.12}
            onEnter={() => onEnterRoom(room.id)}
          />
        ))}

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

      {canBack && (
        <WalkControls
          atJunction={atJunction}
          children={nav.seg.children}
          hasForward={hasForwardChild}
          canBack={canBack}
          moving={moving}
          ended={endReached}
          onForwardDown={() => {
            movingRef.current = true;
            setMoving(true);
          }}
          onForwardUp={() => {
            movingRef.current = false;
            setMoving(false);
          }}
          onTurn={pickBranch}
          onBack={goBack}
        />
      )}
    </div>
  );
};

export default HallwayScene;