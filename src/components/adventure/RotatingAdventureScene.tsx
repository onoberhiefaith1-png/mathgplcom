import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import adventureClouds from "@/assets/adventure-clouds.png.asset.json";
import academyClouds from "@/assets/academy_clouds.png";
import algebraIsland from "@/assets/adventure/algebra-island.png.asset.json";
import calculusIsland from "@/assets/adventure/calculus-island.png.asset.json";
import geometryIsland from "@/assets/adventure/geometry-island.png.asset.json";
import statisticsIsland from "@/assets/adventure/statistics-island.png.asset.json";
import trigonometryIsland from "@/assets/adventure/trigonometry-island.png.asset.json";
import mathgplPalace from "@/assets/adventure/mathgpl-palace.png.asset.json";

// Six identical-style building faces wrapped onto ONE cylinder so they mesh and
// rotate together as a single structure (mirrors the homepage academy guide).
const panels = [
  { slug: "geometry", image: geometryIsland.url },
  { slug: "algebra", image: algebraIsland.url },
  { slug: "mathgpl", image: mathgplPalace.url },
  { slug: "statistics", image: statisticsIsland.url },
  { slug: "calculus", image: calculusIsland.url },
  { slug: "trigonometry", image: trigonometryIsland.url },
];

const panelArc = (Math.PI * 2) / panels.length;
// Large enough that the building spans ~2/3 of the screen width.
const adventureRadius = 3.85;
const adventureHeight = 3.0;
const ringSpeed = (Math.PI * 2) / 30;

const AdventureParticles = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const vertices = useMemo(() => {
    const positions = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 13;
      positions[i * 3 + 1] = Math.random() * 5 - 1.6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 11;
    }
    return positions;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    pointsRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.28) * 0.08;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={vertices.length / 3} array={vertices} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#ffe0a6" transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

// Low cloud belt that hugs the base of the building and rotates with it, so the
// cloud reads as part of the rotating structure (no spherical disk basin).
const CloudFloor = ({ speedRef }: { speedRef: React.MutableRefObject<number> }) => {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useLoader(THREE.TextureLoader, academyClouds);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.4, 2.4);
  texture.anisotropy = 8;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y -= Math.abs(speedRef.current) * 0.85 * delta;
  });

  return (
    <group ref={groupRef} position={[0, -adventureHeight / 2 - 0.05, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[adventureRadius - 0.6, adventureRadius + 5.2, 128]} />
        <meshBasicMaterial map={texture} transparent opacity={0.92} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const BuildingPanel = ({ image, index }: { image: string; index: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useLoader(THREE.TextureLoader, image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const thetaStart = -Math.PI / 2 - panelArc / 2 + index * panelArc;
  const geometry = useMemo(
    () => new THREE.CylinderGeometry(adventureRadius, adventureRadius, adventureHeight, 40, 8, true, thetaStart, panelArc),
    [thetaStart],
  );

  useFrame((state) => {
    if (!meshRef.current) return;
    // Subtle breathing so the building feels alive without breaking the seams.
    const s = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.006;
    meshRef.current.scale.set(s, 1, s);
  });

  return (
    <mesh ref={meshRef}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial map={texture} transparent alphaTest={0.04} side={THREE.FrontSide} toneMapped={false} />
    </mesh>
  );
};

const AdventureStructure = () => {
  const groupRef = useRef<THREE.Group>(null);
  const speedRef = useRef(ringSpeed);
  const { camera } = useThree();

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += speedRef.current * delta;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.05;
    }
    camera.position.z = THREE.MathUtils.damp(camera.position.z, 8.2, 2.8, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, -0.3, 2.8, delta);
    camera.lookAt(0, 0.05, 0);
  });

  return (
    <>
      <ambientLight intensity={1.85} />
      <pointLight position={[0, -0.6, 3.6]} intensity={20} color="#ffd06a" distance={13} />
      <pointLight position={[0, 3.4, 1.6]} intensity={9} color="#c287ff" distance={13} />
      <pointLight position={[0, 1.6, -3.2]} intensity={6} color="#87cefa" distance={13} />
      <AdventureParticles />
      <CloudFloor speedRef={speedRef} />
      <group ref={groupRef} position={[0, 0, 0]}>
        {panels.map((panel, index) => (
          <BuildingPanel key={panel.slug} image={panel.image} index={index} />
        ))}
      </group>
      <fog attach="fog" args={["#f4b48f", 10, 20]} />
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
    <Canvas camera={{ position: [0, -0.3, 8.2], fov: 42, near: 0.1, far: 100 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
      <Suspense fallback={null}>
        <AdventureStructure />
      </Suspense>
    </Canvas>
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,hsl(var(--background)/0.18)_40%,hsl(var(--background)/0.55)_100%)]" />
  </main>
);
