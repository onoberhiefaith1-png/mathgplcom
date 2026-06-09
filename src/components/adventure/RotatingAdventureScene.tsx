import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import adventureClouds from "@/assets/adventure-clouds.png.asset.json";
import algebraIsland from "@/assets/adventure/algebra-island.png.asset.json";
import calculusIsland from "@/assets/adventure/calculus-island.png.asset.json";
import geometryIsland from "@/assets/adventure/geometry-island.png.asset.json";
import statisticsIsland from "@/assets/adventure/statistics-island.png.asset.json";
import trigonometryIsland from "@/assets/adventure/trigonometry-island.png.asset.json";
import academyClouds from "@/assets/academy_clouds.png";

const islands = [
  { slug: "geometry", image: geometryIsland.url, scale: 2.8, y: -0.08 },
  { slug: "algebra", image: algebraIsland.url, scale: 2.8, y: 0.06 },
  { slug: "statistics", image: statisticsIsland.url, scale: 2.82, y: -0.02 },
  { slug: "calculus", image: calculusIsland.url, scale: 2.84, y: 0.04 },
  { slug: "trigonometry", image: trigonometryIsland.url, scale: 2.8, y: -0.04 },
];

const ringRadius = 4.15;
const ringSpeed = (Math.PI * 2) / 28;

const AdventureParticles = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const vertices = useMemo(() => {
    const positions = new Float32Array(190 * 3);
    for (let i = 0; i < 190; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = Math.random() * 5 - 1.6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
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
      <pointsMaterial size={0.035} color="#ffe0a6" transparent opacity={0.72} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

const CloudBasin = ({ speedRef }: { speedRef: React.MutableRefObject<number> }) => {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useLoader(THREE.TextureLoader, academyClouds);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 2.2);
  texture.anisotropy = 8;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y -= Math.abs(speedRef.current) * 0.82 * delta;
  });

  return (
    <group ref={groupRef} position={[0, -1.9, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[1.25, 8.25, 128]} />
        <meshBasicMaterial map={texture} transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, 0]}>
        <circleGeometry args={[5.55, 128]} />
        <meshBasicMaterial color="#f8dcc0" transparent opacity={0.13} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.32, 0]}>
        <circleGeometry args={[4.6, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
        <ringGeometry args={[1.35, 6.25, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.08} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const IslandPanel = ({ image, index, scale, yOffset }: { image: string; index: number; scale: number; yOffset: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const texture = useLoader(THREE.TextureLoader, image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const aspect = texture.image ? texture.image.height / texture.image.width : 0.67;
  const width = scale;
  const height = scale * aspect;
  const angle = -Math.PI / 2 + index * ((Math.PI * 2) / islands.length);

  useFrame((state, delta) => {
    if (!meshRef.current || !glowRef.current) return;
    const wave = Math.sin(state.clock.elapsedTime * 0.7 + index * 0.9) * 0.16;
    meshRef.current.position.y = yOffset + wave;
    glowRef.current.position.y = yOffset + wave;
    meshRef.current.position.z = Math.cos(angle) * ringRadius;
    glowRef.current.position.z = Math.cos(angle) * ringRadius - 0.04;
    const targetScale = 1 + Math.sin(state.clock.elapsedTime * 0.55 + index) * 0.012;
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), 1 - Math.pow(0.001, delta));
    glowRef.current.scale.lerp(new THREE.Vector3(targetScale * 1.03, targetScale * 1.03, 1), 1 - Math.pow(0.001, delta));
  });

  return (
    <group position={[Math.sin(angle) * ringRadius, yOffset, Math.cos(angle) * ringRadius]} rotation={[0, angle, 0]}>
      <mesh ref={glowRef} position={[0, 0, -0.04]}>
        <planeGeometry args={[width * 1.06, height * 1.06]} />
        <meshBasicMaterial color="#ffd06a" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={meshRef}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.04} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
};

const AdventureStructure = () => {
  const groupRef = useRef<THREE.Group>(null);
  const speedRef = useRef(ringSpeed);
  const { camera } = useThree();

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += speedRef.current * delta;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.42) * 0.05;
    }
    camera.position.z = THREE.MathUtils.damp(camera.position.z, 7.3, 2.8, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, -0.38, 2.8, delta);
    camera.lookAt(0, -0.1, 0);
  });

  return (
    <>
      <ambientLight intensity={1.9} />
      <pointLight position={[0, -0.4, 3.4]} intensity={16} color="#ffd06a" distance={11} />
      <pointLight position={[0, 3.2, 1.5]} intensity={8.5} color="#c287ff" distance={12} />
      <pointLight position={[0, 1.4, -3]} intensity={5.5} color="#87cefa" distance={12} />
      <AdventureParticles />
      <CloudBasin speedRef={speedRef} />
      <group ref={groupRef} position={[0, 0, 0]}>
        {islands.map((island, index) => (
          <IslandPanel key={island.slug} image={island.image} index={index} scale={island.scale} yOffset={island.y} />
        ))}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.52, 0]}>
        <ringGeometry args={[2.45, 5.65, 96]} />
        <meshBasicMaterial color="#ffd06a" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.32, 0]}>
        <circleGeometry args={[3.85, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.06} depthWrite={false} />
      </mesh>
      <fog attach="fog" args={["#f4b48f", 8, 17]} />
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
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.18),transparent_26%,transparent_72%,hsl(var(--background)/0.24))]" />
    <Canvas camera={{ position: [0, -0.38, 7.3], fov: 42, near: 0.1, far: 100 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
      <Suspense fallback={null}>
        <AdventureStructure />
      </Suspense>
    </Canvas>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--foreground)/0.02),transparent_44%,hsl(var(--background)/0.42)_100%)]" />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(180deg,transparent,hsl(var(--background)/0.18)_34%,hsl(var(--background)/0.62)_100%)]" />
  </main>
);
