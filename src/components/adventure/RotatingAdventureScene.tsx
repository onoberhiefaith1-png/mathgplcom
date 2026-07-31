import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useNavigate } from "@/lib/router-compat";
import adventureClouds from "@/assets/adventure-clouds.png.asset.json";
import SignedMedia from "@/components/gamebuilder/SignedMedia";
import { CORE_SLOTS, RING_SLOTS } from "@/lib/homepage/buildingSlots";
import { useHomepageConfig, useResolvedSlotUrls } from "@/lib/homepage/homepageConfig";

// ONE continuous floating mathematical world: eight curved segments tiled
// edge-to-edge around a single cylinder so the academies read as one connected
// civilization in the sky — never as separate floating islands.
//
// Subjects are the primary destinations; MathGPL hubs fill the remaining
// positions and act as transition/branding hubs between subjects.
//   Algebra → MathGPL → Geometry → MathGPL → Trigonometry → MathGPL → Statistics → Calculus
const academies = RING_SLOTS.map((slot) => ({
  slug: slot.id,
  image: slot.defaultUrl,
  route: slot.route ?? "/teaching-hub",
}));

const SEGMENTS = academies.length; // 8
const SEG_ANGLE = (Math.PI * 2) / SEGMENTS; // 45° per curved slice
const WORLD_RADIUS = 5.1; // radius of the connected cylinder world
const WORLD_HEIGHT = 4.4; // shared height so every slice connects top & bottom
const ringSpeed = (Math.PI * 2) / 60; // one full revolution ~60s — slow, cinematic

// ── INNER CENTRAL CORE ────────────────────────────────────────────────────
// One royal academy palace built from FOUR identical dome copies (N/S/E/W),
// each wrapped onto a 90° curved slice of a smaller inner cylinder. The slices
// overlap so their walls/roofs merge into a single continuous cylindrical core
// that sits INSIDE the outer ring city and rotates locked to it.
const CORE_SEGMENTS = 12; // many overlapping dome copies → roof closes into one ring
const CORE_SEG_ANGLE = (Math.PI * 2) / CORE_SEGMENTS; // 30° base step per dome copy
const CORE_RADIUS = 2.55; // well inside the outer ring (5.1) → hidden behind towers
const CORE_HEIGHT = 5.4; // taller than the city so the roof dominates the skyline
const CORE_Y_OFFSET = 0.95; // lift so the roof crowns above the outer towers, base hidden

// Each academy is a curved slice of the giant cylinder (a convex panel that
// bends backward at both edges and projects forward at its centre). Segments
// share radius + height, so they butt seamlessly with no sky gaps between them.
const WorldSegment = ({
  texture,
  index,
  interactive,
  onActivate,
  onHoverChange,
}: {
  texture: THREE.Texture;
  index: number;
  interactive: boolean;
  onActivate: (index: number) => void;
  onHoverChange: (hovered: boolean) => void;
}) => {
  // EDGE MERGING: widen each slice well past its 45° share so its outer towers
  // push deep into the neighbour's territory. Neighbouring towers then occupy
  // the same arc and interlock like jigsaw pieces instead of meeting edge-to-edge.
  const overlap = SEG_ANGLE * 0.5; // each edge reaches a quarter-segment into its neighbour
  const thetaStart = index * SEG_ANGLE - overlap / 2;
  const thetaLength = SEG_ANGLE + overlap;

  // Alternate segments sit on a marginally larger radius so they consistently
  // cover (rather than z-fight with) the edge towers of their neighbours — one
  // tower partially hides the other, reading as a single continuous structure.
  const radius = WORLD_RADIUS + (index % 2 === 0 ? 0.14 : 0);

  return (
    <mesh
      renderOrder={index % 2 === 0 ? 1 : 0}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        if (!interactive) return;
        e.stopPropagation();
        onHoverChange(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        if (!interactive) return;
        onHoverChange(false);
        document.body.style.cursor = "default";
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!interactive) return;
        e.stopPropagation();
        onActivate(index);
      }}
    >
      <cylinderGeometry
        args={[radius, radius, WORLD_HEIGHT, 48, 1, true, thetaStart, thetaLength]}
      />
      <meshBasicMaterial map={texture} transparent alphaTest={0.02} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
};

// The inner royal palace: four identical dome copies wrapped onto overlapping
// 90° slices of one smaller cylinder. Overlap merges their walls + roofs so the
// viewer reads a single continuous cylindrical core, not four buildings.
const CoreSegment = ({ texture, index }: { texture: THREE.Texture; index: number }) => {
  // Heavy overlap so each copy's edges wrap deep into both neighbours. With many
  // copies tiled around the full circle, their roofs and walls fuse into one
  // continuous, gapless cylindrical core — a single seamless spherical dome.
  const overlap = CORE_SEG_ANGLE * 3; // each copy spans 30° + 90° = 120°
  const thetaStart = index * CORE_SEG_ANGLE - overlap / 2;
  const thetaLength = CORE_SEG_ANGLE + overlap;
  // Alternate radius so neighbouring copies cover (not z-fight) each other.
  const radius = CORE_RADIUS + (index % 2 === 0 ? 0.06 : 0);

  return (
    <mesh renderOrder={index % 2 === 0 ? -1 : -2}>
      <cylinderGeometry args={[radius, radius, CORE_HEIGHT, 64, 1, true, thetaStart, thetaLength]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.04} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
};

const CentralCore = ({ textures }: { textures: THREE.Texture[] }) => (
  <group position={[0, CORE_Y_OFFSET, 0]}>
    {Array.from({ length: CORE_SEGMENTS }).map((_, i) => (
      <CoreSegment key={i} index={i} texture={textures[i % textures.length]} />
    ))}
  </group>
);

const FloatingParticles = ({ color, size, count, spread }: { color: string; size: number; count: number; spread: number }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const vertices = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = Math.random() * 6 - 2.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    return positions;
  }, [count, spread]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    pointsRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.26) * 0.1;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[vertices, 3]} />
      </bufferGeometry>
      <pointsMaterial size={size} color={color} transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

const Showcase = ({ ringUrls, coreUrls }: { ringUrls: string[]; coreUrls: string[] }) => {
  const worldRef = useRef<THREE.Group>(null);
  const speedRef = useRef(ringSpeed);
  const hoveredRef = useRef(false);
  const frontIndexRef = useRef(0);
  const navigate = useNavigate();
  const { camera } = useThree();

  // Artwork per slot; repeated urls (the MathGPL hubs, the dome copies) load once.
  const uniqueUrls = useMemo(
    () => Array.from(new Set([...ringUrls, ...coreUrls])),
    [ringUrls, coreUrls],
  );
  const loaded = useLoader(THREE.TextureLoader, uniqueUrls) as THREE.Texture[];
  const textureByUrl = useMemo(() => {
    const map = new Map<string, THREE.Texture>();
    uniqueUrls.forEach((url, i) => {
      const t = loaded[i];
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      map.set(url, t);
    });
    return map;
  }, [uniqueUrls, loaded]);
  const coreTextures = useMemo(
    () => coreUrls.map((u) => textureByUrl.get(u)!).filter(Boolean),
    [coreUrls, textureByUrl],
  );

  useFrame((state, delta) => {
    if (!worldRef.current) return;
    // Ease rotation to a gentle near-stop while a hovered academy invites a click.
    const targetSpeed = hoveredRef.current ? ringSpeed * 0.1 : ringSpeed;
    speedRef.current = THREE.MathUtils.damp(speedRef.current, targetSpeed, 3.2, delta);
    worldRef.current.rotation.y += speedRef.current * delta;

    // Determine which segment currently faces the camera (front = nearest +Z).
    // Cylinder vertex angle: pos = (R·sinθ, y, R·cosθ); front faces camera at θ = 0.
    const twoPi = Math.PI * 2;
    const baseRot = worldRef.current.rotation.y;
    let best = 0;
    let bestCos = -Infinity;
    for (let i = 0; i < SEGMENTS; i += 1) {
      const center = i * SEG_ANGLE + SEG_ANGLE / 2 + baseRot;
      const c = Math.cos(((center % twoPi) + twoPi) % twoPi);
      if (c > bestCos) {
        bestCos = c;
        best = i;
      }
    }
    frontIndexRef.current = best;

    // Gentle breathing bob of the whole world for a living, floating feel.
    worldRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.12;

    // Subtle cinematic camera drift + parallax + breathing zoom. Never jarring.
    const t = state.clock.elapsedTime;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, Math.sin(t * 0.12) * 0.45, 2, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, -0.2 + Math.sin(t * 0.17) * 0.16, 2, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, 10.5 + Math.sin(t * 0.1) * 0.35, 2, delta);
    camera.lookAt(0, 0, 0);
  });

  const handleActivate = (clickedIndex?: number) => {
    const idx = typeof clickedIndex === "number" ? clickedIndex : frontIndexRef.current;
    const academy = academies[idx];
    if (academy) navigate(academy.route);
  };

  return (
    <>
      <ambientLight intensity={1.7} />
      <pointLight position={[0, 1.2, 7]} intensity={20} color="#ffe0b0" distance={20} />
      <pointLight position={[-3, 2.4, 2]} intensity={9} color="#c287ff" distance={16} />
      <pointLight position={[3, -1.4, -2]} intensity={6} color="#87cefa" distance={16} />

      {/* Magical purple energy + floating mathematical sparks (no orbit rings). */}
      <FloatingParticles color="#ffe7c2" size={0.04} count={140} spread={16} />
      <FloatingParticles color="#c79bff" size={0.06} count={110} spread={13} />

      <group ref={worldRef}>
        {/* Inner royal palace core — locked to the same group so it rotates with the city. */}
        <CentralCore textures={coreTextures} />
        {academies.map((academy, i) => (
          <WorldSegment
            key={i}
            index={i}
            texture={textureByUrl.get(ringUrls[i] ?? academy.image)!}
            interactive
            onActivate={handleActivate}
            onHoverChange={(h) => (hoveredRef.current = h)}
          />
        ))}
      </group>

      <fog attach="fog" args={["#e9b58f", 13, 26]} />
    </>
  );
};

export const RotatingAdventureScene = () => {
  // Recover from "Web page caused context loss and was blocked" by remounting
  // the Canvas with a fresh key when the browser drops the WebGL context.
  const [ctxKey, setCtxKey] = useState(0);

  useEffect(() => {
    const onLost = () => setCtxKey((k) => k + 1);
    window.addEventListener("webglcontextlost", onLost);
    return () => window.removeEventListener("webglcontextlost", onLost);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden animate-fade-in bg-background">
      <img
        src={adventureClouds.url}
        alt="Sunset clouds over mountains with sacred geometry"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
        loading="eager"
      />
      <Canvas
        key={ctxKey}
        camera={{ position: [0, -0.2, 10.5], fov: 42, near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "default", failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: false }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          const handleLost = (e: Event) => {
            e.preventDefault();
            setCtxKey((k) => k + 1);
          };
          canvas.addEventListener("webglcontextlost", handleLost as EventListener);
        }}
      >
        <Suspense fallback={null}>
          <Showcase />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,hsl(var(--background)/0.18)_40%,hsl(var(--background)/0.55)_100%)]" />
    </main>
  );
};
