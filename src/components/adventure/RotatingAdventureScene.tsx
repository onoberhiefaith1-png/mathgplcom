import { Suspense, useMemo, useRef } from "react";
import { Canvas, ThreeEvent, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useNavigate } from "react-router-dom";
import adventureClouds from "@/assets/adventure-clouds.png.asset.json";
import algebraIsland from "@/assets/adventure/algebra-island.png.asset.json";
import calculusIsland from "@/assets/adventure/calculus-island.png.asset.json";
import geometryIsland from "@/assets/adventure/geometry-island.png.asset.json";
import statisticsIsland from "@/assets/adventure/statistics-island.png.asset.json";
import trigonometryIsland from "@/assets/adventure/trigonometry-island.png.asset.json";
import mathgplPalace from "@/assets/adventure/mathgpl-palace.png.asset.json";

// ONE continuous floating mathematical world: eight curved segments tiled
// edge-to-edge around a single cylinder so the academies read as one connected
// civilization in the sky — never as separate floating islands.
//
// Subjects are the primary destinations; MathGPL hubs fill the remaining
// positions and act as transition/branding hubs between subjects.
//   Algebra → MathGPL → Geometry → MathGPL → Trigonometry → MathGPL → Statistics → Calculus
const academies = [
  { slug: "algebra", image: algebraIsland.url, route: "/subjects/algebra" },
  { slug: "mathgpl", image: mathgplPalace.url, route: "/teaching-hub" },
  { slug: "geometry", image: geometryIsland.url, route: "/subjects/geometry" },
  { slug: "mathgpl", image: mathgplPalace.url, route: "/teaching-hub" },
  { slug: "trigonometry", image: trigonometryIsland.url, route: "/subjects/trigonometry" },
  { slug: "mathgpl", image: mathgplPalace.url, route: "/teaching-hub" },
  { slug: "statistics", image: statisticsIsland.url, route: "/subjects/statistics" },
  { slug: "calculus", image: calculusIsland.url, route: "/subjects/calculus" },
];

const SEGMENTS = academies.length; // 8
const SEG_ANGLE = (Math.PI * 2) / SEGMENTS; // 45° per curved slice
const WORLD_RADIUS = 5.1; // radius of the connected cylinder world
const WORLD_HEIGHT = 4.4; // shared height so every slice connects top & bottom
const ringSpeed = (Math.PI * 2) / 60; // one full revolution ~60s — slow, cinematic

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
  // A tiny angular overlap removes hairline seams between neighbouring slices.
  const overlap = SEG_ANGLE * 0.04;
  const thetaStart = index * SEG_ANGLE - overlap / 2;
  const thetaLength = SEG_ANGLE + overlap;

  return (
    <mesh
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
        args={[WORLD_RADIUS, WORLD_RADIUS, WORLD_HEIGHT, 32, 1, true, thetaStart, thetaLength]}
      />
      <meshBasicMaterial map={texture} transparent alphaTest={0.02} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
};

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
        <bufferAttribute attach="attributes-position" count={vertices.length / 3} array={vertices} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={size} color={color} transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

const Showcase = () => {
  const worldRef = useRef<THREE.Group>(null);
  const speedRef = useRef(ringSpeed);
  const hoveredRef = useRef(false);
  const frontIndexRef = useRef(0);
  const navigate = useNavigate();
  const { camera } = useThree();

  // Six unique textures; the three MathGPL hubs reuse the palace texture.
  const uniqueUrls = useMemo(() => Array.from(new Set(academies.map((a) => a.image))), []);
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

  const handleActivate = () => {
    const academy = academies[frontIndexRef.current];
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
        {academies.map((academy, i) => (
          <WorldSegment
            key={i}
            index={i}
            texture={textureByUrl.get(academy.image)!}
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

export const RotatingAdventureScene = () => (
  <main className="relative h-screen w-screen overflow-hidden animate-fade-in bg-background">
    <img
      src={adventureClouds.url}
      alt="Sunset clouds over mountains with sacred geometry"
      className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
      loading="eager"
    />
    <Canvas camera={{ position: [0, -0.2, 10.5], fov: 42, near: 0.1, far: 100 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
      <Suspense fallback={null}>
        <Showcase />
      </Suspense>
    </Canvas>
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,hsl(var(--background)/0.18)_40%,hsl(var(--background)/0.55)_100%)]" />
  </main>
);
