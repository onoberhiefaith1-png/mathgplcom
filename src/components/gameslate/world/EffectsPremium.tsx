import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useVfxTextures, type VfxTextures } from "./vfxTextures";
import { effectNow } from "@/lib/slate/vfx/clock";
import { playSfx } from "@/lib/slate/audio";
import { premiumBombProfile } from "@/lib/slate/vfx/premiumProfiles";
import type { PremiumBombStyle } from "@/lib/slate/types";

export const CHAIN_BOMB_DURATION = 7.8;
export const CHAIN_DETONATION = 3.05;

export interface PremiumTarget {
  id: string;
  slotId: string;
  point: [number, number, number];
}

interface Props {
  startedAt: number;
  style: PremiumBombStyle;
  power: number;
  speed: number;
  targets: PremiumTarget[];
  onImpact: (target: PremiumTarget) => void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);

function curvePoint(target: THREE.Vector3, amount: number, path: "direct" | "arc" | "spiral", seed: number) {
  const t = ease(amount);
  const point = target.clone().multiplyScalar(t);
  const distance = Math.max(0.5, target.length());
  const arc = Math.sin(t * Math.PI) * Math.min(0.75, distance * 0.18);
  if (path === "arc") point.y += arc * (seed % 2 ? 1 : -0.5);
  if (path === "spiral") {
    point.x += Math.sin(t * Math.PI * 3 + seed) * arc * (1 - t);
    point.y += Math.cos(t * Math.PI * 3 + seed) * arc * (1 - t);
  }
  point.z += Math.sin(t * Math.PI) * 0.22;
  return point;
}

function DirectedProjectile({ target, index, startedAt, textures, style, speed, onImpact }: {
  target: PremiumTarget;
  index: number;
  startedAt: number;
  textures: VfxTextures;
  style: PremiumBombStyle;
  speed: number;
  onImpact: (target: PremiumTarget) => void;
}) {
  const profile = premiumBombProfile(style);
  const head = useRef<THREE.Group>(null);
  const trail = useRef<THREE.Line>(null);
  const impact = useRef<THREE.Group>(null);
  const hit = useRef(false);
  const targetPoint = useMemo(() => new THREE.Vector3(...target.point), [target.point]);
  const positions = useMemo(() => new Float32Array(18 * 3), []);
  const trailObject = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: profile.colours[index % 4] ?? profile.colours[0],
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    return new THREE.Line(geometry, material);
  }, [index, positions, profile.colours]);
  const texture = profile.shape === "star" ? textures.star : profile.shape === "sigil" || profile.shape === "spiral" ? textures.magic : textures.spark;
  const launch = CHAIN_DETONATION + 0.22 + index * profile.cadence;
  const flight = profile.shape === "comet" ? 0.42 : profile.shape === "spiral" ? 0.72 : 0.56;

  useFrame(({ clock }) => {
    const t = (effectNow(clock) - startedAt) * speed;
    const p = clamp01((t - launch) / flight);
    const live = t >= launch && p < 1;
    if (head.current) {
      head.current.visible = live;
      if (live) head.current.position.copy(curvePoint(targetPoint, p, profile.path, index + 1));
    }
    if (trail.current) {
      trail.current.visible = live;
      if (live) {
        const start = Math.max(0, p - profile.trail * 0.28);
        for (let i = 0; i < 18; i++) {
          const q = start + (p - start) * (i / 17);
          const pt = curvePoint(targetPoint, q, profile.path, index + 1);
          positions[i * 3] = pt.x;
          positions[i * 3 + 1] = pt.y;
          positions[i * 3 + 2] = pt.z;
        }
        const attribute = trail.current.geometry.attributes["position"];
        if (attribute) attribute.needsUpdate = true;
        (trail.current.material as THREE.LineBasicMaterial).opacity = 0.92 * (1 - p * 0.25);
      }
    }
    if (p >= 1 && !hit.current) {
      hit.current = true;
      playSfx("premium-impact");
      onImpact(target);
    }
    if (impact.current) {
      const age = (t - launch - flight) / 0.55;
      impact.current.visible = age >= 0 && age < 1;
      impact.current.position.copy(targetPoint);
      impact.current.scale.setScalar(0.25 + ease(age) * 1.5);
      impact.current.children.forEach((child) => {
        const material = (child as THREE.Mesh).material as THREE.Material & { opacity?: number };
        if ("opacity" in material) material.opacity = Math.max(0, 1 - age);
      });
    }
  });

  return (
    <group>
      <primitive ref={trail} object={trailObject} visible={false} frustumCulled={false} />
      <group ref={head} visible={false}>
        <sprite scale={[0.32, 0.32, 1]}>
          <spriteMaterial map={texture} color={profile.colours[index % 4] ?? profile.colours[0]} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
        <mesh><sphereGeometry args={[0.055, 12, 8]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
        <pointLight color={profile.colours[index % 4] ?? profile.colours[0]} intensity={10} distance={1.7} decay={2} />
      </group>
      <group ref={impact} visible={false}>
        <mesh><ringGeometry args={[0.1, 0.24, 28]} /><meshBasicMaterial color={profile.colours[1]} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} /></mesh>
        <sprite scale={[0.62, 0.62, 1]}><spriteMaterial map={texture} color={profile.colours[0]} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></sprite>
      </group>
    </group>
  );
}

/** Shared mechanics with ten materially different premium visual profiles. */
export function PremiumChainBombEffect({ startedAt, style, power, speed, targets, onImpact }: Props) {
  const profile = premiumBombProfile(style);
  const root = useRef<THREE.Group>(null);
  const charge = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Sprite>(null);
  const blast = useRef<THREE.Sprite>(null);
  const smoke = useRef<THREE.Sprite>(null);
  const shock = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const played = useRef(false);
  const textures = useVfxTextures();
  const flare = textures.flare;
  const explosion = textures.explosion;
  const smokeTexture = textures.smoke;
  const fragments = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    angle: (i / 18) * Math.PI * 2,
    lift: ((i * 7) % 9) / 9 - 0.25,
    speed: 0.7 + ((i * 13) % 8) / 10,
  })), []);

  useFrame(({ clock }) => {
    const t = (effectNow(clock) - startedAt) * speed;
    const chargeK = clamp01((t - 0.45) / 2.4);
    const explosionAge = t - CHAIN_DETONATION;
    if (charge.current) {
      charge.current.visible = t < CHAIN_DETONATION;
      // rotation is read from the timeline, not accumulated per frame, so it
      // is frame-rate independent and freezes cleanly when paused
      charge.current.rotation.z = t * (profile.shape === "spiral" ? 5.4 : 2.7);
      charge.current.rotation.y = t * 2.1;
      charge.current.scale.setScalar(0.65 + chargeK * 1.25);
    }
    if (t >= CHAIN_DETONATION && !played.current) {
      played.current = true;
      playSfx("premium-blast");
    }
    if (flash.current) {
      flash.current.visible = explosionAge >= 0 && explosionAge < 0.55;
      flash.current.scale.setScalar((0.4 + ease(explosionAge / 0.55) * 4.5) * power);
      flash.current.material.opacity = Math.max(0, 1 - explosionAge / 0.55);
    }
    if (blast.current) {
      blast.current.visible = explosionAge >= 0 && explosionAge < 1.05;
      blast.current.scale.setScalar((0.55 + ease(explosionAge / 0.8) * 3.1) * power);
      blast.current.material.opacity = Math.max(0, 0.94 - explosionAge / 1.05);
      blast.current.material.color.set(profile.colours[profile.shape === "fire" ? 2 : 1]);
    }
    if (smoke.current) {
      smoke.current.visible = explosionAge > 0.22 && explosionAge < 2.2;
      smoke.current.position.y = Math.max(0, explosionAge - 0.22) * 0.18;
      smoke.current.scale.setScalar(1.1 + Math.max(0, explosionAge) * 1.4);
      smoke.current.material.opacity = Math.max(0, 0.42 * (1 - (explosionAge - 0.22) / 2));
    }
    if (shock.current) {
      shock.current.visible = explosionAge >= 0 && explosionAge < 0.8;
      shock.current.scale.setScalar(0.15 + ease(explosionAge / 0.8) * (profile.shape === "sun" ? 4.8 : 3.8));
      (shock.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - explosionAge / 0.8));
    }
    if (light.current) light.current.intensity = explosionAge >= 0 && explosionAge < 1.2 ? 45 * power * (1 - explosionAge / 1.2) : 7 * chargeK;
    if (root.current) root.current.visible = t < CHAIN_BOMB_DURATION;
  });

  return (
    <group ref={root} position={[0, 0, 0.18]}>
      <pointLight ref={light} color={profile.colours[1]} intensity={0} distance={9} decay={2} />
      <group ref={charge}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[i * 0.8, i * 1.1, 0]}>
            {profile.shape === "crystal" ? <octahedronGeometry args={[0.42 + i * 0.12, 0]} /> : <torusGeometry args={[0.4 + i * 0.13, 0.018 + i * 0.006, 8, profile.shape === "sigil" ? 6 : 44]} />}
            <meshBasicMaterial color={profile.colours[(i + 1) % 4] ?? profile.colours[0]} transparent opacity={0.72 - i * 0.14} blending={THREE.AdditiveBlending} depthWrite={false} wireframe={profile.shape === "crystal"} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <sprite ref={flash} visible={false}><spriteMaterial map={flare} color="#ffffff" transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></sprite>
      <sprite ref={blast} visible={false}><spriteMaterial map={explosion} color={profile.colours[1]} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></sprite>
      <sprite ref={smoke} visible={false} position={[0, 0, -0.08]}><spriteMaterial map={smokeTexture} color={profile.shape === "fire" ? "#ff8a18" : "#a7c9d8"} transparent opacity={0} depthWrite={false} /></sprite>
      <mesh ref={shock} visible={false}><ringGeometry args={[0.36, 0.48, profile.shape === "star" ? 10 : 64]} /><meshBasicMaterial color={profile.colours[1]} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      <group>
        {fragments.map((fragment, i) => <Fragment key={i} data={fragment} index={i} startedAt={startedAt} colour={profile.colours[(i + 1) % 4] ?? profile.colours[0]} speed={speed} crystal={profile.shape === "crystal"} />)}
      </group>
      {targets.slice(0, 24).map((target, index) => <DirectedProjectile key={target.id} target={target} index={index} startedAt={startedAt} textures={textures} style={style} speed={speed} onImpact={onImpact} />)}
    </group>
  );
}

function Fragment({ data, index, startedAt, colour, speed, crystal }: { data: { angle: number; lift: number; speed: number }; index: number; startedAt: number; colour: string; speed: number; crystal: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const age = (effectNow(clock) - startedAt) * speed - CHAIN_DETONATION;
    ref.current.visible = age >= 0 && age < 1.65;
    if (age >= 0) {
      const d = age * data.speed;
      ref.current.position.set(Math.cos(data.angle) * d, Math.sin(data.angle) * d + data.lift * age - age * age * 0.18, 0.18 + Math.sin(index) * d * 0.25);
      ref.current.rotation.set(age * (2 + index % 3), age * (3 + index % 4), age * 2.4);
      ref.current.scale.setScalar(Math.max(0.02, 1 - age / 1.65));
    }
  });
  return <mesh ref={ref} visible={false}>{crystal ? <tetrahedronGeometry args={[0.075, 0]} /> : <dodecahedronGeometry args={[0.055, 0]} />}<meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={1.8} metalness={0.55} roughness={0.22} toneMapped={false} /></mesh>;
}
