import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import adventureClouds from "@/assets/adventure-clouds.png.asset.json";
import algebraIsland from "@/assets/adventure/algebra-island.png.asset.json";
import calculusIsland from "@/assets/adventure/calculus-island.png.asset.json";
import geometryIsland from "@/assets/adventure/geometry-island.png.asset.json";
import statisticsIsland from "@/assets/adventure/statistics-island.png.asset.json";
import trigonometryIsland from "@/assets/adventure/trigonometry-island.png.asset.json";
import mathgplPalace from "@/assets/adventure/mathgpl-palace.png.asset.json";
import centralDomeCore from "@/assets/adventure/central-dome-core.png.asset.json";
import staircaseEntry from "@/assets/adventure/staircase-entry.jpg";
import magicBallStorm from "@/assets/effects/video-fx/magic_ball_storm.mp4.asset.json";
import thorLightningOverlay11 from "@/assets/effects/video-fx/thor_lightning_overlay_11.mp4.asset.json";
import halfDomeShockwave from "@/assets/effects/video-fx/half_dome_shockwave.mp4.asset.json";
import magicEnergyBurstPink from "@/assets/effects/video-fx/magic_energy_burst_pink.mp4.asset.json";
import { useWebglRecovery } from "@/lib/stability/useWebglRecovery";

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

// ── INNER CENTRAL CORE (the middle royal palace building) ──────────────────
const CORE_SEGMENTS = 12;
const CORE_SEG_ANGLE = (Math.PI * 2) / CORE_SEGMENTS;
const CORE_RADIUS = 2.55;
const CORE_HEIGHT = 5.4;
const CORE_Y_OFFSET = 0.95;

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
        <bufferAttribute attach="attributes-position" args={[vertices, 3]} />
      </bufferGeometry>
      <pointsMaterial size={size} color={color} transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

// The inner royal palace core, built from many overlapping dome copies wrapped
// onto a smaller cylinder so their roofs/walls fuse into one continuous middle
// building that rotates locked to the outer ring city.
const CoreSegment = ({
  texture,
  index,
  getCoreOpacity,
}: {
  texture: THREE.Texture;
  index: number;
  getCoreOpacity: () => number;
}) => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const overlap = CORE_SEG_ANGLE * 3;
  const thetaStart = index * CORE_SEG_ANGLE - overlap / 2;
  const thetaLength = CORE_SEG_ANGLE + overlap;
  const radius = CORE_RADIUS + (index % 2 === 0 ? 0.06 : 0);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.opacity = THREE.MathUtils.damp(materialRef.current.opacity, getCoreOpacity(), 6, delta);
    }
  });

  return (
    <mesh renderOrder={index % 2 === 0 ? -1 : -2}>
      <cylinderGeometry args={[radius, radius, CORE_HEIGHT, 64, 1, true, thetaStart, thetaLength]} />
      <meshBasicMaterial ref={materialRef} map={texture} transparent alphaTest={0.04} opacity={1} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
};

const CentralCore = ({ getCoreOpacity, getWorldExpand }: { getCoreOpacity: () => number; getWorldExpand: () => number }) => {
  const texture = useLoader(THREE.TextureLoader, centralDomeCore.url) as THREE.Texture;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const expand = 1 + getWorldExpand() * 0.32;
    groupRef.current.scale.x = THREE.MathUtils.damp(groupRef.current.scale.x, expand, 4.8, delta);
    groupRef.current.scale.y = THREE.MathUtils.damp(groupRef.current.scale.y, expand, 4.8, delta);
    groupRef.current.scale.z = THREE.MathUtils.damp(groupRef.current.scale.z, expand, 4.8, delta);
  });
  return (
    <group ref={groupRef} position={[0, CORE_Y_OFFSET, 0]}>
      {Array.from({ length: CORE_SEGMENTS }).map((_, i) => (
        <CoreSegment key={i} index={i} texture={texture} getCoreOpacity={getCoreOpacity} />
      ))}
    </group>
  );
};

// One jagged vertical lightning bolt as a glowing polyline.
const makeBolt = () => {
  const segs = 10;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs;
    const y = 1.15 - t * 2.3; // top → bottom across the door
    const wobble = Math.sin(t * Math.PI); // narrow at ends, wide in middle
    const x = (Math.random() - 0.5) * 0.42 * wobble;
    points.push(new THREE.Vector3(x, y, (Math.random() - 0.5) * 0.06));
  }
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color: "#d8e8ff",
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Line(geom, mat);
};

const WorldSegment = ({
  texture,
  index,
  interactive,
  getSelectionProgress,
  getWorldExpand,
  getPortalProgress,
  getThunderProgress,
  getOpacity,
  onActivate,
  onHoverChange,
}: {
  texture: THREE.Texture;
  index: number;
  interactive: boolean;
  getSelectionProgress: (index: number) => number;
  getWorldExpand: () => number;
  getPortalProgress: (index: number) => number;
  getThunderProgress: (index: number) => number;
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
  const thunderGroupRef = useRef<THREE.Group>(null);
  const thunderFlashRef = useRef<THREE.Mesh>(null);
  const thunderLightRef = useRef<THREE.PointLight>(null);
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

  // Three static lightning bolts reused with flickering opacity for the strike.
  const bolts = useMemo(() => [makeBolt(), makeBolt(), makeBolt()], []);

  useFrame((state, delta) => {
    const selectionProgress = getSelectionProgress(index);
    const worldExpand = getWorldExpand();
    const portalProgress = getPortalProgress(index);
    const thunderProgress = getThunderProgress(index);
    const opacity = getOpacity(index);

    if (groupRef.current) {
      // BALLOON: every segment inflates uniformly with the world expand so the
      // whole circular city grows outward as one — never a detached slice.
      const balloon = 1 + worldExpand * 0.32;
      // Selected segment gets a tiny extra forward push so the camera locks on the door.
      const targetX = balloon;
      const targetY = balloon;
      const targetZ = balloon + selectionProgress * 0.06;
      groupRef.current.scale.lerp(new THREE.Vector3(targetX, targetY, targetZ), 1 - Math.pow(0.001, delta));
      groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, selectionProgress * 0.45, 4.8, delta);
      groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, selectionProgress * 0.12, 4.2, delta);
    }

    if (materialRef.current) {
      materialRef.current.opacity = THREE.MathUtils.damp(materialRef.current.opacity, opacity, 6, delta);
    }

    // DOOR-LOCKED FRAMING: the door (glowing central arch) is the focal point.
    // It sits at the horizontal centre (u≈0.5) and just above mid-height of the
    // image (door spans v≈0.42–0.66). We zoom into a tight window centred on the
    // door so it DOMINATES the screen, while the two flanking statues stay just
    // inside the left/right edges.
    localTexture.repeat.set(
      THREE.MathUtils.lerp(1, 0.34, selectionProgress), // width: door + statues at the sides
      THREE.MathUtils.lerp(1, 0.4, selectionProgress), // height: door dominates the frame
    );
    localTexture.offset.set(
      THREE.MathUtils.lerp(0, 0.33, selectionProgress), // centre horizontally on the door
      THREE.MathUtils.lerp(0, 0.34, selectionProgress), // raise window onto the door (off the courtyard)
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
      // Sustained glow that intensifies while paused in front of the door.
      const glow = portalProgress * 0.88 + thunderProgress * 0.5;
      glowMaterial.opacity = glow * pulse;
      const glowScale = 1 + portalProgress * 0.16 + thunderProgress * 0.18;
      portalDoorGlowRef.current.scale.set(glowScale, glowScale, 1);
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

    // ── THUNDERBOLT BLAST on the door while the camera pauses ──────────────
    if (thunderGroupRef.current) {
      thunderGroupRef.current.visible = thunderProgress > 0.001;
    }
    if (thunderProgress > 0.001) {
      // Crackling envelope: rises quickly, holds, then a few stabbing strikes.
      const env = smoothstep(0, 0.18, thunderProgress);
      const crackle = Math.random();
      bolts.forEach((bolt, i) => {
        const mat = bolt.material as THREE.LineBasicMaterial;
        const strike = Math.random() > (0.42 + i * 0.12);
        mat.opacity = env * (strike ? 0.7 + Math.random() * 0.3 : 0.05);
      });
      if (thunderFlashRef.current) {
        const flashMat = thunderFlashRef.current.material as THREE.MeshBasicMaterial;
        flashMat.opacity = env * (0.15 + crackle * 0.65) * 0.7;
      }
      if (thunderLightRef.current) {
        thunderLightRef.current.intensity = env * (8 + crackle * 34);
      }
    } else {
      bolts.forEach((bolt) => {
        (bolt.material as THREE.LineBasicMaterial).opacity = 0;
      });
      if (thunderLightRef.current) thunderLightRef.current.intensity = 0;
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
            <bufferAttribute attach="attributes-position" args={[portalPoints, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.045} color="#ffd36f" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      </group>

      {/* Thunderbolt strikes that blast across the door during the pause. */}
      <group ref={thunderGroupRef} position={[0, 0.2, WORLD_RADIUS + 0.34]} visible={false}>
        <pointLight ref={thunderLightRef} color="#bcd6ff" distance={8} intensity={0} />
        {bolts.map((bolt, i) => (
          <primitive key={i} object={bolt} position={[(i - 1) * 0.34, 0, 0]} />
        ))}
        <mesh ref={thunderFlashRef}>
          <planeGeometry args={[1.3, 2.2]} />
          <meshBasicMaterial color="#e2eeff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
};

const Showcase = ({ onDoorReady, onZoomStart }: { onDoorReady: (academy: (typeof academies)[number]) => void; onZoomStart: (academy: (typeof academies)[number]) => void }) => {
  const worldRef = useRef<THREE.Group>(null);
  const speedRef = useRef(ringSpeed);
  const hoveredRef = useRef(false);
  const interactionLockedRef = useRef(false);
  const selectedIndexRef = useRef<number | null>(null);
  const sequenceRef = useRef<"rotate" | "centering" | "approach" | "pause" | "flash">("rotate");
  const targetRotationRef = useRef(0);
  const approachProgressRef = useRef(0);
  const pauseProgressRef = useRef(0);
  const flashProgressRef = useRef(0);
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
    return smoothstep(0.5, 0.95, approachProgressRef.current);
  };

  const getThunderProgress = (index: number) => {
    if (selectedIndexRef.current !== index) return 0;
    if (sequenceRef.current === "pause") return pauseProgressRef.current;
    if (sequenceRef.current === "flash") return 1;
    return 0;
  };

  const getOpacity = (index: number) => {
    if (selectedIndexRef.current === null) return 1;
    if (selectedIndexRef.current === index) return 1;
    const fade = smoothstep(0.24, 0.84, approachProgressRef.current);
    return 1 - fade * 0.97;
  };

  // Whole-world balloon expansion: every segment uses the selected segment's
  // approach progress so the entire ring inflates outward together.
  const getWorldExpand = () => {
    if (selectedIndexRef.current === null) return 0;
    return smoothstep(0, 1, approachProgressRef.current);
  };

  // The middle core fades out as we zoom into a selected door (like the other
  // non-selected buildings) so it never pokes in front of the door framing.
  const getCoreOpacity = () => {
    if (selectedIndexRef.current === null) return 1;
    const fade = smoothstep(0.18, 0.7, approachProgressRef.current);
    return 1 - fade * 0.98;
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
      // Slow, cinematic zoom toward the door — ~8s, no rushing.
      approachProgressRef.current = Math.min(1, approachProgressRef.current + delta / 8);
      if (approachProgressRef.current >= 1) {
        approachProgressRef.current = 1;
        sequenceRef.current = "pause";
      }
    }

    if (sequenceRef.current === "pause") {
      // Hold camera framed on the door while the magic ball storm effect plays
      // in the parent DOM overlay. Fire the ready callback once.
      worldRef.current.rotation.y = targetRotationRef.current;
      worldRef.current.position.y = 0;
      approachProgressRef.current = 1;
      if (!enteredRef.current && selectedIndexRef.current !== null) {
        enteredRef.current = true;
        document.body.style.cursor = "default";
        onDoorReady(academies[selectedIndexRef.current]);
      }
      pauseProgressRef.current = Math.min(1, pauseProgressRef.current + delta / 2.8);
    }

    if (flashPlaneRef.current) {
      const flashMaterial = flashPlaneRef.current.material as THREE.MeshBasicMaterial;
      flashMaterial.opacity = 0;
    }
  });

  const handleActivate = (index: number) => {
    if (interactionLockedRef.current) return;
    interactionLockedRef.current = true;
    hoveredRef.current = false;
    selectedIndexRef.current = index;
    sequenceRef.current = "centering";
    targetRotationRef.current = -(index * SEG_ANGLE + SEG_ANGLE / 2);
    onZoomStart(academies[index]);
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
        {/* Middle royal palace core — locked to the same group so it rotates with the city. */}
        <CentralCore getCoreOpacity={getCoreOpacity} getWorldExpand={getWorldExpand} />
        {academies.map((academy, i) => (
          <WorldSegment
            key={`${academy.slug}-${i}`}
            index={i}
            texture={textureByUrl.get(academy.image)!}
            interactive={!interactionLockedRef.current}
            getSelectionProgress={getSelectionProgress}
            getWorldExpand={getWorldExpand}
            getPortalProgress={getPortalProgress}
            getThunderProgress={getThunderProgress}
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

export const AdventurePortalScene = () => {
  const gpuRecovery = useWebglRecovery("adventure-portal");
  const [zoomingAcademy, setZoomingAcademy] = useState<(typeof academies)[number] | null>(null);
  const [effectAcademy, setEffectAcademy] = useState<(typeof academies)[number] | null>(null);
  const [enteredAcademy, setEnteredAcademy] = useState<(typeof academies)[number] | null>(null);
  const [revealed, setRevealed] = useState(false);
  // Cinematic door-open sequence:
  //   idle → lightning (lightning crackles around the door frame while the camera zooms, 2s)
  //        → grow      (magic ball storm grows from door centre, 2.6s)
  //        → cover     (storm fully covers screen; swap underlying image, 0.35s)
  //        → transition(storm fades out + shockwave + pink burst land us in next scene, 1.2s)
  //        → done
  const [effectStage, setEffectStage] = useState<
    "idle" | "lightning" | "grow" | "cover" | "transition" | "done"
  >("idle");
  const stormVideoRef = useRef<HTMLVideoElement>(null);
  const lightningVideoRef = useRef<HTMLVideoElement>(null);

  // Kick off the lightning around the door frame the moment the camera starts zooming.
  useEffect(() => {
    if (!zoomingAcademy) return;
    setEffectStage("lightning");
    lightningVideoRef.current?.play().catch(() => undefined);
    const t = window.setTimeout(() => {
      setEffectStage("grow");
      stormVideoRef.current?.play().catch(() => undefined);
    }, 2000);
    return () => window.clearTimeout(t);
  }, [zoomingAcademy]);

  // Once the camera lands on the door, run the cover/transition stages.
  useEffect(() => {
    if (!effectAcademy) return;
    const COVER = 350;
    const TRANSITION = 1200;
    const t1 = window.setTimeout(() => {
      setEffectStage("cover");
      setEnteredAcademy(effectAcademy);
    }, 0);
    const t2 = window.setTimeout(() => setEffectStage("transition"), COVER);
    const t3 = window.setTimeout(() => setEffectStage("done"), COVER + TRANSITION);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [effectAcademy]);

  useEffect(() => {
    if (!enteredAcademy) return;
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [enteredAcademy]);

  const stormScale =
    effectStage === "grow" || effectStage === "cover" || effectStage === "transition"
      ? 2.6
      : 0.06;
  const stormOpacity =
    effectStage === "grow" || effectStage === "cover" ? 1 : effectStage === "transition" ? 0 : 0;
  const stormVisible = effectStage === "grow" || effectStage === "cover" || effectStage === "transition";
  // Lightning frames the door from zoom-start through to when the storm fully covers the screen.
  const lightningVisible = effectStage === "lightning" || effectStage === "grow";
  const transitionVisible = effectStage === "transition";

  return (
    <main className="relative h-screen w-screen overflow-hidden animate-fade-in bg-background">
      {enteredAcademy ? (
        <div className="absolute inset-0">
          <img
            src={staircaseEntry}
            alt={`${enteredAcademy.label} adventure staircase hall`}
            className="h-full w-full object-cover object-center"
            loading="eager"
            width={1920}
            height={1080}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.08),transparent_28%,transparent_72%,hsl(var(--background)/0.24))]" />
          <div
            className="pointer-events-none absolute inset-0 bg-[#fff7ea] transition-opacity duration-700 ease-out"
            style={{ opacity: revealed ? 0 : 1 }}
          />
        </div>
      ) : (
        <>
          <img
            src={adventureClouds.url}
            alt="Sunset clouds behind the floating academy subject selector"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
            loading="eager"
          />
          <Canvas key={gpuRecovery.resetKey} onCreated={({ gl }) => gpuRecovery.attach(gl.domElement)} camera={{ position: [0, -0.2, 10.5], fov: 42, near: 0.1, far: 100 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
            <Suspense fallback={null}>
              <Showcase onDoorReady={setEffectAcademy} onZoomStart={setZoomingAcademy} />
            </Suspense>
          </Canvas>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,hsl(var(--background)/0.18)_40%,hsl(var(--background)/0.55)_100%)]" />
        </>
      )}

      {/* 1) Lightning crackles around the door FRAME (mask knocks out the centre). */}
      {(zoomingAcademy || effectAcademy) && effectStage !== "done" && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center overflow-hidden">
          <video
            ref={lightningVideoRef}
            src={thorLightningOverlay11.url}
            muted
            playsInline
            autoPlay
            loop
            className="h-[72vmin] w-[42vmin] object-cover transition-opacity duration-700 ease-out"
            style={{
              opacity: lightningVisible ? 1 : 0,
              mixBlendMode: "screen",
              // Hollow-out the middle so only the door-frame perimeter is lit.
              WebkitMaskImage:
                "radial-gradient(ellipse 42% 48% at 50% 50%, transparent 55%, black 78%)",
              maskImage:
                "radial-gradient(ellipse 42% 48% at 50% 50%, transparent 55%, black 78%)",
              filter: "drop-shadow(0 0 18px rgba(180,210,255,0.55))",
            }}
          />
        </div>
      )}

      {/* 2) Magic ball storm grows from door centre to fullscreen */}
      {effectAcademy && effectStage !== "done" && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden">
          <video
            ref={stormVideoRef}
            src={magicBallStorm.url}
            muted
            playsInline
            autoPlay
            className="aspect-square h-[60vmin] w-[60vmin] object-cover transition-[transform,opacity] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              transform: `scale(${stormVisible ? stormScale : 0.06})`,
              opacity: stormOpacity,
              mixBlendMode: "screen",
              transitionDuration: effectStage === "transition" ? "900ms" : "2600ms",
            }}
          />
        </div>
      )}

      {/* 3) Cinematic transition into the new scene: shockwave + pink energy burst */}
      {effectAcademy && transitionVisible && (
        <>
          <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
            <video
              src={halfDomeShockwave.url}
              muted
              playsInline
              autoPlay
              className="h-full w-full object-cover"
              style={{ mixBlendMode: "screen", opacity: 0.95 }}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 z-[61] overflow-hidden">
            <video
              src={magicEnergyBurstPink.url}
              muted
              playsInline
              autoPlay
              className="h-full w-full object-cover animate-fade-in"
              style={{ mixBlendMode: "screen", opacity: 0.85 }}
            />
          </div>
        </>
      )}
    </main>
  );
};
