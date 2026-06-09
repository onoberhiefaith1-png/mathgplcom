import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import adventureClouds from "@/assets/adventure-clouds.png.asset.json";
import algebraIsland from "@/assets/adventure/algebra-island.png.asset.json";
import calculusIsland from "@/assets/adventure/calculus-island.png.asset.json";
import geometryIsland from "@/assets/adventure/geometry-island.png.asset.json";
import statisticsIsland from "@/assets/adventure/statistics-island.png.asset.json";
import trigonometryIsland from "@/assets/adventure/trigonometry-island.png.asset.json";
import mathgplPalace from "@/assets/adventure/mathgpl-palace.png.asset.json";
import staircaseEntry from "@/assets/adventure/staircase-entry.jpg";

const academies = [
  { slug: "algebra", label: "Algebra", image: algebraIsland.url },
  { slug: "mathgpl", label: "MathGPL", image: mathgplPalace.url },
  { slug: "geometry", label: "Geometry", image: geometryIsland.url },
  { slug: "mathgpl", label: "MathGPL", image: mathgplPalace.url },
  { slug: "trigonometry", label: "Trigonometry", image: trigonometryIsland.url },
  { slug: "mathgpl", label: "MathGPL", image: mathgplPalace.url },
  { slug: "statistics", label: "Statistics", image: statisticsIsland.url },
  { slug: "calculus", label: "Calculus", image: calculusIsland.url },
];

const SEGMENTS = academies.length;
const SEG_ANGLE = (Math.PI * 2) / SEGMENTS;
const WORLD_RADIUS = 5.1;
const WORLD_HEIGHT = 4.4;
const ringSpeed = (Math.PI * 2) / 60;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const shortestAngleDiff = (current: number, target: number) => {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
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

const WorldSegment = ({
  texture,
  index,
  interactive,
  getSelectionProgress,
  getPortalProgress,
  getOpacity,
  onActivate,
  onHoverChange,
}: {
  texture: THREE.Texture;
  index: number;
  interactive: boolean;
  getSelectionProgress: (index: number) => number;
  getPortalProgress: (index: number) => number;
  getOpacity: (index: number) => number;
  onActivate: (index: number) => void;
  onHoverChange: (hovered: boolean) => void;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const portalRef = useRef<THREE.Group>(null);
  const portalCoreRef = useRef<THREE.Mesh>(null);
  const portalDoorGlowRef = useRef<THREE.Mesh>(null);
  const portalRingARef = useRef<THREE.Mesh>(null);
  const portalRingBRef = useRef<THREE.Mesh>(null);
  const portalLightRef = useRef<THREE.PointLight>(null);
  const overlap = SEG_ANGLE * 0.5;
  const thetaStart = index * SEG_ANGLE - overlap / 2;
  const thetaLength = SEG_ANGLE + overlap;
  const radius = WORLD_RADIUS + (index % 2 === 0 ? 0.14 : 0);

  const localTexture = useMemo(() => {
    const cloned = texture.clone();
    cloned.colorSpace = THREE.SRGBColorSpace;
    cloned.anisotropy = 8;
    cloned.wrapS = THREE.ClampToEdgeWrapping;
    cloned.wrapT = THREE.ClampToEdgeWrapping;
    cloned.needsUpdate = true;
    return cloned;
  }, [texture]);

  const portalPoints = useMemo(() => {
    const positions = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i += 1) {
      const angle = (i / 120) * Math.PI * 2;
      const radiusJitter = 0.56 + (Math.random() - 0.5) * 0.14;
      positions[i * 3] = Math.cos(angle) * radiusJitter;
      positions[i * 3 + 1] = Math.sin(angle) * radiusJitter * 1.25;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
    }
    return positions;
  }, []);

  useFrame((state, delta) => {
    const selectionProgress = getSelectionProgress(index);
    const portalProgress = getPortalProgress(index);
    const opacity = getOpacity(index);

    if (groupRef.current) {
      const targetScale = 1 + selectionProgress * 2.35;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1 + selectionProgress * 0.2), 1 - Math.pow(0.001, delta));
      groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, selectionProgress * 4.9, 4.8, delta);
      groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, selectionProgress * 0.18, 4.2, delta);
    }

    if (materialRef.current) {
      materialRef.current.opacity = THREE.MathUtils.damp(materialRef.current.opacity, opacity, 6, delta);
    }

    localTexture.repeat.set(
      THREE.MathUtils.lerp(1, 0.34, selectionProgress),
      THREE.MathUtils.lerp(1, 0.58, selectionProgress),
    );
    localTexture.offset.set(
      THREE.MathUtils.lerp(0, 0.33, selectionProgress),
      THREE.MathUtils.lerp(0, 0.16, selectionProgress),
    );

    if (portalRef.current) {
      portalRef.current.visible = portalProgress > 0.002;
      portalRef.current.scale.setScalar(0.65 + portalProgress * 1.45);
      portalRef.current.rotation.z += delta * (0.35 + portalProgress * 0.8);
    }

    if (portalRingARef.current) portalRingARef.current.rotation.z += delta * (0.55 + portalProgress * 1.9);
    if (portalRingBRef.current) portalRingBRef.current.rotation.z -= delta * (0.45 + portalProgress * 1.5);

    const pulse = 0.84 + Math.sin(state.clock.elapsedTime * 7.5) * 0.16;
    if (portalCoreRef.current) {
      const coreMaterial = portalCoreRef.current.material as THREE.MeshBasicMaterial;
      coreMaterial.opacity = portalProgress * 0.45 * pulse;
    }
    if (portalDoorGlowRef.current) {
      const glowMaterial = portalDoorGlowRef.current.material as THREE.MeshBasicMaterial;
      glowMaterial.opacity = portalProgress * 0.88 * pulse;
      portalDoorGlowRef.current.scale.set(1 + portalProgress * 0.16, 1 + portalProgress * 0.16, 1);
    }
    if (portalRingARef.current) {
      const ringMaterial = portalRingARef.current.material as THREE.MeshBasicMaterial;
      ringMaterial.opacity = portalProgress * 0.8;
    }
    if (portalRingBRef.current) {
      const ringMaterial = portalRingBRef.current.material as THREE.MeshBasicMaterial;
      ringMaterial.opacity = portalProgress * 0.68;
    }
    if (portalLightRef.current) {
      portalLightRef.current.intensity = THREE.MathUtils.damp(portalLightRef.current.intensity, portalProgress * 18, 6, delta);
    }
  });

  return (
    <group ref={groupRef} renderOrder={getSelectionProgress(index) > 0.01 ? 20 : index % 2 === 0 ? 1 : 0}>
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
        <cylinderGeometry args={[radius, radius, WORLD_HEIGHT, 48, 1, true, thetaStart, thetaLength]} />
        <meshBasicMaterial ref={materialRef} map={localTexture} transparent alphaTest={0.02} opacity={1} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      <group ref={portalRef} position={[0, 0.22, WORLD_RADIUS + 0.24]} visible={false}>
        <pointLight ref={portalLightRef} color="#f8c56d" distance={6} intensity={0} />
        <mesh ref={portalDoorGlowRef} position={[0, 0, 0.02]}>
          <planeGeometry args={[1.08, 1.95]} />
          <meshBasicMaterial color="#f7e4be" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={portalCoreRef}>
          <sphereGeometry args={[0.46, 32, 32]} />
          <meshBasicMaterial color="#c58cff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={portalRingARef}>
          <torusGeometry args={[0.78, 0.03, 18, 72]} />
          <meshBasicMaterial color="#b579ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={portalRingBRef} rotation={[0, 0, Math.PI / 3]}>
          <torusGeometry args={[0.56, 0.025, 18, 72]} />
          <meshBasicMaterial color="#ffd36f" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={portalPoints.length / 3} array={portalPoints} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial size={0.045} color="#ffd36f" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      </group>
    </group>
  );
};

const Showcase = ({ onEnterAdventure }: { onEnterAdventure: (academy: (typeof academies)[number]) => void }) => {
  const worldRef = useRef<THREE.Group>(null);
  const speedRef = useRef(ringSpeed);
  const hoveredRef = useRef(false);
  const interactionLockedRef = useRef(false);
  const selectedIndexRef = useRef<number | null>(null);
  const sequenceRef = useRef<"rotate" | "centering" | "approach" | "flash">("rotate");
  const targetRotationRef = useRef(0);
  const approachProgressRef = useRef(0);
  const flashOpacityRef = useRef(0);
  const enteredRef = useRef(false);
  const flashPlaneRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

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

  const getSelectionProgress = (index: number) => {
    if (selectedIndexRef.current !== index) return 0;
    return smoothstep(0, 1, approachProgressRef.current);
  };

  const getPortalProgress = (index: number) => {
    if (selectedIndexRef.current !== index) return 0;
    return smoothstep(0.56, 0.96, approachProgressRef.current);
  };

  const getOpacity = (index: number) => {
    if (selectedIndexRef.current === null) return 1;
    if (selectedIndexRef.current === index) return 1;
    const fade = smoothstep(0.24, 0.84, approachProgressRef.current);
    return 1 - fade * 0.97;
  };

  useFrame((state, delta) => {
    camera.position.set(0, -0.2, 10.5);
    camera.lookAt(0, 0, 0);

    if (!worldRef.current) return;

    if (sequenceRef.current === "rotate") {
      const targetSpeed = hoveredRef.current ? ringSpeed * 0.15 : ringSpeed;
      speedRef.current = THREE.MathUtils.damp(speedRef.current, targetSpeed, 3.2, delta);
      worldRef.current.rotation.y += speedRef.current * delta;
      worldRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.12;
    }

    if (sequenceRef.current === "centering") {
      speedRef.current = THREE.MathUtils.damp(speedRef.current, 0, 5.5, delta);
      const diff = shortestAngleDiff(worldRef.current.rotation.y, targetRotationRef.current);
      worldRef.current.rotation.y += diff * Math.min(1, delta * 5.2);
      worldRef.current.position.y = THREE.MathUtils.damp(worldRef.current.position.y, 0, 5.5, delta);
      if (Math.abs(diff) < 0.015) {
        worldRef.current.rotation.y = targetRotationRef.current;
        sequenceRef.current = "approach";
      }
    }

    if (sequenceRef.current === "approach") {
      worldRef.current.rotation.y = THREE.MathUtils.damp(worldRef.current.rotation.y, targetRotationRef.current, 8, delta);
      worldRef.current.position.y = THREE.MathUtils.damp(worldRef.current.position.y, 0, 5.5, delta);
      approachProgressRef.current = Math.min(1, approachProgressRef.current + delta / 2.5);
      if (approachProgressRef.current > 0.84) sequenceRef.current = "flash";
    }

    if (sequenceRef.current === "flash") {
      worldRef.current.rotation.y = targetRotationRef.current;
      worldRef.current.position.y = 0;
      approachProgressRef.current = Math.min(1, approachProgressRef.current + delta / 1.1);
      flashOpacityRef.current = smoothstep(0.86, 1, approachProgressRef.current);
      if (!enteredRef.current && approachProgressRef.current >= 1 && selectedIndexRef.current !== null) {
        enteredRef.current = true;
        document.body.style.cursor = "default";
        onEnterAdventure(academies[selectedIndexRef.current]);
      }
    }

    if (flashPlaneRef.current) {
      const flashMaterial = flashPlaneRef.current.material as THREE.MeshBasicMaterial;
      flashMaterial.opacity = flashOpacityRef.current;
    }
  });

  const handleActivate = (index: number) => {
    if (interactionLockedRef.current) return;
    interactionLockedRef.current = true;
    hoveredRef.current = false;
    selectedIndexRef.current = index;
    sequenceRef.current = "centering";
    targetRotationRef.current = -(index * SEG_ANGLE + SEG_ANGLE / 2);
  };

  return (
    <>
      <ambientLight intensity={1.7} />
      <pointLight position={[0, 1.2, 7]} intensity={20} color="#ffe0b0" distance={20} />
      <pointLight position={[-3, 2.4, 2]} intensity={9} color="#c287ff" distance={16} />
      <pointLight position={[3, -1.4, -2]} intensity={6} color="#87cefa" distance={16} />

      <FloatingParticles color="#ffe7c2" size={0.04} count={140} spread={16} />
      <FloatingParticles color="#c79bff" size={0.06} count={110} spread={13} />

      <group ref={worldRef}>
        {academies.map((academy, i) => (
          <WorldSegment
            key={`${academy.slug}-${i}`}
            index={i}
            texture={textureByUrl.get(academy.image)!}
            interactive={!interactionLockedRef.current}
            getSelectionProgress={getSelectionProgress}
            getPortalProgress={getPortalProgress}
            getOpacity={getOpacity}
            onActivate={handleActivate}
            onHoverChange={(hovered) => {
              if (!interactionLockedRef.current) hoveredRef.current = hovered;
            }}
          />
        ))}
      </group>

      <mesh ref={flashPlaneRef} position={[0, 0, 8.9]} renderOrder={1000}>
        <planeGeometry args={[18, 12]} />
        <meshBasicMaterial color="#fff7ea" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>

      <fog attach="fog" args={["#e9b58f", 13, 26]} />
    </>
  );
};

export const HomeRotatingBuilding = () => {
  const [enteredAcademy, setEnteredAcademy] = useState<(typeof academies)[number] | null>(null);

  return (
    <main className="relative h-screen w-screen overflow-hidden animate-fade-in bg-background">
      {enteredAcademy ? (
        <div className="absolute inset-0 animate-fade-in">
          <img
            src={staircaseEntry}
            alt={`${enteredAcademy.label} adventure staircase hall`}
            className="h-full w-full object-cover object-center"
            loading="eager"
            width={1920}
            height={1080}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.08),transparent_28%,transparent_72%,hsl(var(--background)/0.24))]" />
        </div>
      ) : (
        <>
          <img
            src={adventureClouds.url}
            alt="Sunset clouds behind the floating academy subject selector"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
            loading="eager"
          />
          <Canvas camera={{ position: [0, -0.2, 10.5], fov: 42, near: 0.1, far: 100 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
            <Suspense fallback={null}>
              <Showcase onEnterAdventure={setEnteredAcademy} />
            </Suspense>
          </Canvas>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,hsl(var(--background)/0.18)_40%,hsl(var(--background)/0.55)_100%)]" />
        </>
      )}
    </main>
  );
};
