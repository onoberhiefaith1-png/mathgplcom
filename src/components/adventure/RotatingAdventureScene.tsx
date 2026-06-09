import { Suspense, useMemo, useRef, useState } from "react";
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

// The six academies cycle through the showcase, but only TWO are ever rendered
// at once (one Front, one Back). Front displays each island in this order over
// time as the carousel turns; the hidden swap happens while an island faces away.
const academies = [
  { slug: "mathgpl", image: mathgplPalace.url, hero: true, route: "/teaching-hub" },
  { slug: "algebra", image: algebraIsland.url, route: "/subjects/algebra" },
  { slug: "trigonometry", image: trigonometryIsland.url, route: "/subjects/trigonometry" },
  { slug: "statistics", image: statisticsIsland.url, route: "/subjects/statistics" },
  { slug: "geometry", image: geometryIsland.url, route: "/subjects/geometry" },
  { slug: "calculus", image: calculusIsland.url, route: "/subjects/calculus" },
];

const ringRadius = 3.6;
const ringSpeed = (Math.PI * 2) / 26; // one full island change per ~13s

// Soft radial shadow blob (canvas texture) used as the contact shadow beneath each island.
const makeShadowTexture = () => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(40,20,70,0.55)");
  grad.addColorStop(0.5, "rgba(40,20,70,0.22)");
  grad.addColorStop(1, "rgba(40,20,70,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

type SlotProps = {
  texture: THREE.Texture;
  baseAngle: number; // 0 = starts at front, PI = starts at back
  thetaRef: React.MutableRefObject<number>;
  shadowTexture: THREE.Texture;
  interactive: boolean;
  onActivate: () => void;
  onHoverChange: (hovered: boolean) => void;
};

// A single floating island plane that orbits the central axis, always facing
// radially outward (Front faces the camera, Back faces away).
const IslandSlot = ({ texture, baseAngle, thetaRef, shadowTexture, interactive, onActivate, onHoverChange }: SlotProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const shadowMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const aspect = useMemo(() => {
    const img = texture.image as HTMLImageElement | undefined;
    if (img && img.width && img.height) return img.width / img.height;
    return 1.4;
  }, [texture]);

  const planeWidth = 4.4;
  const planeHeight = planeWidth / aspect;

  useFrame((state) => {
    if (!groupRef.current) return;
    const phi = thetaRef.current + baseAngle;
    const x = Math.sin(phi) * ringRadius;
    const z = Math.cos(phi) * ringRadius;
    // 1 at front (facing camera), 0 at back (facing away).
    const front = (Math.cos(phi) + 1) / 2;

    const bob = Math.sin(state.clock.elapsedTime * 0.5 + baseAngle) * 0.12;
    groupRef.current.position.set(x, bob - 0.1, z);
    groupRef.current.rotation.y = phi; // face radially outward

    // Depth cues: front island is larger + fully opaque, back island recedes.
    const scale = 0.78 + front * 0.34;
    groupRef.current.scale.setScalar(scale);

    if (matRef.current) {
      matRef.current.opacity = 0.18 + front * 0.82;
    }
    if (shadowMatRef.current) {
      shadowMatRef.current.opacity = 0.1 + front * 0.4;
    }
  });

  return (
    <group ref={groupRef}>
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
          onActivate();
        }}
      >
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial ref={matRef} map={texture} transparent alphaTest={0.02} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* Soft contact shadow drifting just beneath the island */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -planeHeight / 2 - 0.15, 0]}>
        <planeGeometry args={[planeWidth * 0.9, planeWidth * 0.5]} />
        <meshBasicMaterial ref={shadowMatRef} map={shadowTexture} transparent depthWrite={false} />
      </mesh>
    </group>
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

// Slow swirling purple energy trail ribbon around the showcase.
const PurpleTrails = () => {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (groupRef.current) groupRef.current.rotation.y = state.clock.elapsedTime * 0.08;
  });
  const rings = useMemo(
    () => [
      { r: 4.6, y: 0.4, tilt: 0.2 },
      { r: 5.2, y: -0.6, tilt: -0.15 },
    ],
    [],
  );
  return (
    <group ref={groupRef}>
      {rings.map((ring, i) => (
        <mesh key={i} rotation={[Math.PI / 2 + ring.tilt, 0, 0]} position={[0, ring.y, 0]}>
          <torusGeometry args={[ring.r, 0.012, 8, 120]} />
          <meshBasicMaterial color="#b07cff" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

const Showcase = () => {
  const thetaRef = useRef(0);
  const speedRef = useRef(ringSpeed);
  const hoveredRef = useRef(false);
  const shadowTexture = useMemo(() => makeShadowTexture(), []);
  const navigate = useNavigate();
  const { camera } = useThree();

  const textures = useLoader(
    THREE.TextureLoader,
    academies.map((a) => a.image),
  ) as THREE.Texture[];
  textures.forEach((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
  });

  // Slot A starts at the front, slot B starts at the back. Each slot tracks which
  // academy it currently shows and swaps to the next queue item while hidden.
  const [slotAIndex, setSlotAIndex] = useState(0);
  const [slotBIndex, setSlotBIndex] = useState(1);
  const queueRef = useRef(2); // next academy to reveal
  const swappedRef = useRef({ a: false, b: false });

  const frontIndexRef = useRef(0);
  const slotAIndexRef = useRef(0);
  const slotBIndexRef = useRef(1);
  slotAIndexRef.current = slotAIndex;
  slotBIndexRef.current = slotBIndex;

  useFrame((state, delta) => {
    // Ease rotation to a gentle near-stop while a hovered island invites a click.
    const targetSpeed = hoveredRef.current ? ringSpeed * 0.12 : ringSpeed;
    speedRef.current = THREE.MathUtils.damp(speedRef.current, targetSpeed, 3.2, delta);
    thetaRef.current += speedRef.current * delta;

    const twoPi = Math.PI * 2;
    const phiA = (((thetaRef.current % twoPi) + twoPi) % twoPi);
    const phiB = ((((thetaRef.current + Math.PI) % twoPi) + twoPi) % twoPi);

    // Hidden-swap zone: an island is fully turned away near phi = PI.
    const inBack = (phi: number) => Math.abs(phi - Math.PI) < 0.18;

    if (inBack(phiA)) {
      if (!swappedRef.current.a) {
        const next = queueRef.current % academies.length;
        setSlotAIndex(next);
        queueRef.current = (queueRef.current + 1) % academies.length;
        swappedRef.current.a = true;
      }
    } else {
      swappedRef.current.a = false;
    }

    if (inBack(phiB)) {
      if (!swappedRef.current.b) {
        const next = queueRef.current % academies.length;
        setSlotBIndex(next);
        queueRef.current = (queueRef.current + 1) % academies.length;
        swappedRef.current.b = true;
      }
    } else {
      swappedRef.current.b = false;
    }

    // Track which slot is currently at the front for click navigation.
    frontIndexRef.current = phiA < Math.PI / 2 || phiA > (3 * Math.PI) / 2 ? slotAIndexRef.current : slotBIndexRef.current;

    // Subtle cinematic camera drift + parallax + breathing zoom.
    const t = state.clock.elapsedTime;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, Math.sin(t * 0.12) * 0.5, 2, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, -0.25 + Math.sin(t * 0.17) * 0.18, 2, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, 9 + Math.sin(t * 0.1) * 0.35, 2, delta);
    camera.lookAt(0, 0, 0);
  });

  const handleActivate = () => {
    const academy = academies[frontIndexRef.current];
    if (academy) navigate(academy.route);
  };

  return (
    <>
      <ambientLight intensity={1.7} />
      <pointLight position={[0, 1.2, 5]} intensity={18} color="#ffe0b0" distance={16} />
      <pointLight position={[-3, 2.4, 1]} intensity={9} color="#c287ff" distance={15} />
      <pointLight position={[3, -1.4, -2]} intensity={6} color="#87cefa" distance={15} />

      <FloatingParticles color="#ffe7c2" size={0.04} count={140} spread={14} />
      <FloatingParticles color="#c79bff" size={0.055} count={90} spread={11} />
      <PurpleTrails />

      <IslandSlot
        texture={textures[slotAIndex]}
        baseAngle={0}
        thetaRef={thetaRef}
        shadowTexture={shadowTexture}
        interactive
        onActivate={handleActivate}
        onHoverChange={(h) => (hoveredRef.current = h)}
      />
      <IslandSlot
        texture={textures[slotBIndex]}
        baseAngle={Math.PI}
        thetaRef={thetaRef}
        shadowTexture={shadowTexture}
        interactive
        onActivate={handleActivate}
        onHoverChange={(h) => (hoveredRef.current = h)}
      />

      <fog attach="fog" args={["#e9b58f", 11, 22]} />
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
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.16),transparent_26%,transparent_72%,hsl(var(--background)/0.22))]" />
    <Canvas camera={{ position: [0, -0.25, 9], fov: 42, near: 0.1, far: 100 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
      <Suspense fallback={null}>
        <Showcase />
      </Suspense>
    </Canvas>
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,hsl(var(--background)/0.18)_40%,hsl(var(--background)/0.55)_100%)]" />
  </main>
);
