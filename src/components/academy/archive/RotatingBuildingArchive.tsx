import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Text, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useNavigate } from "@/lib/router-compat";
import birdModel from "@/assets/models/bird.glb?url";
import algebraImage from "@/assets/academy/algebra.png";
import geometryImage from "@/assets/academy/geometry.png";
import trigonometryImage from "@/assets/academy/trigonometry.png";
import statisticsImage from "@/assets/academy/statistics.png";
import calculusImage from "@/assets/academy/calculus.png";
import academyBackground from "@/assets/academy_background.png";
import academyClouds from "@/assets/academy_clouds.png";

const subjects = [
  { slug: "algebra", image: algebraImage },
  { slug: "geometry", image: geometryImage },
  { slug: "trigonometry", image: trigonometryImage },
  { slug: "statistics", image: statisticsImage },
  { slug: "calculus", image: calculusImage },
];

type AcademyPanelProps = {
  image: string;
  index: number;
  hovered: number | null;
  selected: number | null;
  onHover: (index: number | null) => void;
  onSelect: (index: number, slug: string) => void;
  slug: string;
};

const panelArc = (Math.PI * 2) / subjects.length;
const academyRadius = 2.85;
const academyHeight = 2.82;

const AcademyPanel = ({ image, index, hovered, selected, onHover, onSelect, slug }: AcademyPanelProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const texture = useLoader(THREE.TextureLoader, image);
  const isActive = hovered === index || selected === index;
  const thetaStart = -Math.PI / 2 - panelArc / 2 + index * panelArc;
  const panelGeometry = useMemo(() => new THREE.CylinderGeometry(academyRadius, academyRadius, academyHeight, 34, 8, true, thetaStart, panelArc), [thetaStart]);
  const glowGeometry = useMemo(() => new THREE.CylinderGeometry(academyRadius + 0.035, academyRadius + 0.035, academyHeight + 0.12, 34, 8, true, thetaStart, panelArc), [thetaStart]);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  useFrame((_, delta) => {
    const targetScale = isActive ? 1.05 : 1;
    if (meshRef.current) {
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.pow(0.001, delta));
    }
    if (glowRef.current) {
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = THREE.MathUtils.damp(material.opacity, isActive ? 0.34 : 0, 8, delta);
      glowRef.current.scale.lerp(new THREE.Vector3(isActive ? 1.095 : 1.02, isActive ? 1.105 : 1.02, 1), 1 - Math.pow(0.001, delta));
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(index, slug);
  };

  return (
    <group>
      <mesh ref={glowRef}>
        <primitive object={glowGeometry} attach="geometry" />
        <meshBasicMaterial color="#ffd06a" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh
        ref={meshRef}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(index);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "default";
        }}
        onClick={handleClick}
      >
        <primitive object={panelGeometry} attach="geometry" />
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
};

const Particles = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const vertices = useMemo(() => {
    const positions = new Float32Array(150 * 3);
    for (let i = 0; i < 150; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 11;
      positions[i * 3 + 1] = Math.random() * 5 - 1.4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 9;
    }
    return positions;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.025;
    pointsRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.08;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[vertices, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#ffd06a" transparent opacity={0.78} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

const CloudFloor = ({ buildingSpeedRef }: { buildingSpeedRef: React.MutableRefObject<number> }) => {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useLoader(THREE.TextureLoader, academyClouds);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 8;

  useFrame((_, delta) => {
    if (groupRef.current) {
      // Building now rotates anticlockwise (positive Y), clouds rotate clockwise (negative Y).
      groupRef.current.rotation.y -= Math.abs(buildingSpeedRef.current) * 0.85 * delta;
    }
  });

  return (
    <group ref={groupRef} position={[0, -1.5, 0]}>
      {/* Soft outer cloud disk filling the void below the building */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <ringGeometry args={[1.4, 7.5, 128]} />
        <meshBasicMaterial map={texture} transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Inner soft fade ring so clouds never visually touch the building base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.4, 2.4, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.0} depthWrite={false} />
      </mesh>
      {/* MATHGPL brand text — glowing LED-like letters, midway across the cloud disk */}
      <BrandRing radius={4.45} baseAngle={0} />
      <BrandRing radius={4.45} baseAngle={Math.PI} />
    </group>
  );
};

const BRAND = "MATHGPL";

/** Renders the brand text laid flat on the cloud as glowing golden LED letters. */
const BrandRing = ({ radius, baseAngle }: { radius: number; baseAngle: number }) => {
  const chars = BRAND.split("");
  const step = 0.34;
  const total = (chars.length - 1) * step;
  const coreRefs = useRef<(THREE.Object3D | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    chars.forEach((_, i) => {
      const core = coreRefs.current[i] as any;
      if (core?.material) core.material.opacity = 0.9 + 0.1 * Math.sin(t * 3 + i * 0.5);
    });
  });

  return (
    <group position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {chars.map((ch, i) => {
        const a = baseAngle - total / 2 + i * step;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        const rotZ = a + Math.PI / 2;
        return (
          <group key={`${baseAngle}-${i}`} position={[x, y, 0.02]} rotation={[0, 0, rotZ]}>
            {/* Solid glowing letter — gold body with thin dark gold outline, no surrounding bloom */}
            <Text
              ref={(el) => (coreRefs.current[i] = el)}
              position={[0, 0, 0.01]}
              fontSize={0.82}
              color="#fbbf24"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.04}
              outlineColor="#8a6508"
              outlineOpacity={1}
              outlineBlur={0}
              fillOpacity={1}
            >
              {ch}
            </Text>
          </group>
        );
      })}
    </group>
  );
};

/** A bird that flies around the outside of the academy cylinder.
 *  Optimized: throttled updates (~30Hz), unlit materials, no shadows,
 *  static inner matrices, and reduced trig recomputation. */
const Bird = () => {
  const groupRef = useRef<THREE.Group>(null);
  const angleRef = useRef(0);
  const yRef = useRef(0.2);
  const yDirRef = useRef(1);
  const flapRef = useRef(0);
  const accumRef = useRef(0);
  // Target ~30 fps for the bird sub-system; main scene still runs at display rate.
  const FRAME_INTERVAL = 1 / 30;

  const { scene } = useGLTF(birdModel) as any;
  const cloned = useMemo(() => {
    const obj = scene.clone(true);
    // Normalize size
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const target = 0.9;
    obj.scale.setScalar(target / maxDim);
    // Center
    const center = new THREE.Vector3();
    new THREE.Box3().setFromObject(obj).getCenter(center);
    obj.position.sub(center);

    obj.traverse((child: any) => {
      if (child.isMesh) {
        // Disable shadows + lighting work
        child.castShadow = false;
        child.receiveShadow = false;
        // Replace PBR material with unlit MeshBasicMaterial when possible
        const oldMat = child.material;
        if (oldMat) {
          const basic = new THREE.MeshBasicMaterial({
            map: oldMat.map ?? null,
            color: oldMat.color ?? new THREE.Color(0xffffff),
            transparent: false,
            depthWrite: true,
            toneMapped: false,
          });
          child.material = basic;
        }
        // Inner meshes don't move relative to the parent group — freeze matrices
        child.matrixAutoUpdate = false;
        child.updateMatrix();
        // Enable frustum culling
        child.frustumCulled = true;
      }
    });
    obj.matrixAutoUpdate = false;
    obj.updateMatrix();
    return obj;
  }, [scene]);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    accumRef.current += delta;
    if (accumRef.current < FRAME_INTERVAL) return;
    const dt = accumRef.current;
    accumRef.current = 0;

    angleRef.current += dt * 0.55;
    yRef.current += yDirRef.current * dt * 0.18;
    if (yRef.current > academyHeight / 2 - 0.2) yDirRef.current = -1;
    if (yRef.current < -academyHeight / 2 + 0.4) yDirRef.current = 1;
    flapRef.current += dt * 6;

    const a = angleRef.current;
    const r = academyRadius + 0.65;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    const flap = flapRef.current;
    const sinFlap = Math.sin(flap);
    const bob = sinFlap * 0.08;

    const g = groupRef.current;
    g.position.set(cosA * r, yRef.current + bob, sinA * r);
    g.rotation.set(0, -a + Math.PI / 2, Math.sin(flap * 0.5) * 0.12);
  });

  return (
    <group ref={groupRef} frustumCulled>
      <primitive object={cloned} />
    </group>
  );
};

useGLTF.preload(birdModel);

const AcademyStructure = () => {
  const groupRef = useRef<THREE.Group>(null);
  const selectedLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const speedRef = useRef((Math.PI * 2) / 25);
  const navigate = useNavigate();
  const { camera } = useThree();

  useFrame((_, delta) => {
    const targetSpeed = selected !== null ? 0 : hovered !== null ? ((Math.PI * 2) / 25) * 0.6 : (Math.PI * 2) / 25;
    speedRef.current = THREE.MathUtils.damp(speedRef.current, targetSpeed, selected !== null ? 3.4 : 4.8, delta);

    if (groupRef.current) {
      groupRef.current.rotation.y += speedRef.current * delta;
    }

    const targetZ = selected !== null ? 4.35 : 7.4;
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.6, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, selected !== null ? -0.12 : -0.45, 3.6, delta);

    if (selected !== null && groupRef.current) {
      const panelAngle = -Math.PI / 2 + selected * panelArc + groupRef.current.rotation.y;
      selectedLookAt.current.set(Math.sin(panelAngle) * academyRadius, 0, Math.cos(panelAngle) * academyRadius);
      camera.lookAt(selectedLookAt.current.x, selectedLookAt.current.y, selectedLookAt.current.z);
    } else {
      camera.lookAt(0, 0.05, 0);
    }
  });

  const selectPanel = (index: number, slug: string) => {
    setSelected(index);
    document.body.style.cursor = "default";
    window.setTimeout(() => navigate(`/subjects/${slug}`), 1050);
  };

  return (
    <>
      <ambientLight intensity={1.65} />
      <pointLight position={[0, -1.2, 2.2]} intensity={26} color="#ffd06a" distance={8} />
      <pointLight position={[0, 2.8, 1]} intensity={10} color="#6fd4ff" distance={9} />
      <Particles />
      <group ref={groupRef} position={[0, 0, 0]}>
        {subjects.map((subject, index) => (
          <AcademyPanel
            key={subject.slug}
            {...subject}
            index={index}
            hovered={hovered}
            selected={selected}
            onHover={setHovered}
            onSelect={selectPanel}
          />
        ))}
      </group>
      <Bird />
      <CloudFloor buildingSpeedRef={speedRef} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.58, 0]}>
        <ringGeometry args={[2.2, 4.9, 96]} />
        <meshBasicMaterial color="#ffd06a" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  );
};

export const RotatingBuildingArchive = () => (
  <main className="cinematic-sky relative h-screen w-screen overflow-hidden animate-fade-in">
    <img
      src={academyBackground}
      alt="Cinematic floating academy landscape at sunset"
      className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
      loading="eager"
    />
    <div className="academy-background-blend pointer-events-none absolute inset-0" />
    <Canvas camera={{ position: [0, -0.45, 7.4], fov: 42, near: 0.1, far: 100 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
      <Suspense fallback={null}>
        <AcademyStructure />
      </Suspense>
    </Canvas>
    <div className="academy-vignette pointer-events-none absolute inset-0" />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/80 to-transparent" />
  </main>
);

export { subjects };