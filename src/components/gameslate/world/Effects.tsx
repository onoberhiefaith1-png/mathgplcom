// Reward effects as real events in the world. Every effect component mounts
// only while it runs and unmounts afterwards, so nothing is left simulating.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t: number) => Math.pow(clamp01(t), 2.4);

export const CORE_DURATION = 4;
export const SWEEP_DURATION = 1.9;

interface EffectProps {
  /** Ignored for timing; kept so a re-fire remounts the effect. */
  startedAt: number;
  colour: string;
  power: number;
}

/* ------------------------------------------------------------------ */
/* Math Core: dormant -> charge -> spin -> energy -> explosion -> fade */
/* ------------------------------------------------------------------ */

export function CoreEffect({ colour, power }: EffectProps) {
  const born = useRef<number | null>(null);
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const shock = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.PointLight>(null);
  const bolts = useRef<THREE.Group>(null);
  const sparks = useRef<THREE.Points>(null);
  const smoke = useRef<THREE.Points>(null);

  const spark = useMemo(() => {
    const count = 160;
    const positions = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 1.6 + Math.random() * 4.4;
      velocity[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocity[i * 3 + 1] = Math.cos(phi) * speed;
      velocity[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed * 0.4;
    }
    return { count, positions, velocity };
  }, []);

  const smokePuffs = useMemo(() => {
    const count = 70;
    const positions = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 1.1;
      velocity[i * 3] = Math.cos(theta) * speed;
      velocity[i * 3 + 1] = 0.3 + Math.random() * 0.9;
      velocity[i * 3 + 2] = Math.sin(theta) * speed * 0.3;
    }
    return { count, positions, velocity };
  }, []);

  const boltSeeds = useMemo(
    () => Array.from({ length: 10 }, (_, i) => ({ angle: (i / 10) * Math.PI * 2, jitter: Math.random() })),
    [],
  );

  useFrame(({ clock }) => {
    if (born.current === null) born.current = clock.elapsedTime;
    const t = clock.elapsedTime - born.current;
    const scale = 1 + (power - 1) * 0.5;

    // --- build up -------------------------------------------------
    const grow =
      t < 0.3
        ? 0.35 + easeOut(t / 0.3) * 0.35
        : t < 0.8
          ? 0.7 + easeOut((t - 0.3) / 0.5) * 1.1
          : t < 1.3
            ? 1.8 + easeOut((t - 0.8) / 0.5) * 0.5
            : t < 1.7
              ? 2.3 + easeIn((t - 1.3) / 0.4) * 0.9
              : 0;

    if (core.current) {
      const live = t < 1.7;
      core.current.visible = live;
      if (live) {
        const pulse = 1 + Math.sin(t * (8 + t * 26)) * 0.06 * clamp01(t / 1.7);
        core.current.scale.setScalar(grow * scale * pulse * 0.5);
        core.current.rotation.y += 0.04 + t * 0.32;
        core.current.rotation.x += 0.02 + t * 0.12;
      }
    }

    if (halo.current) {
      const live = t < 1.75;
      halo.current.visible = live;
      if (live) {
        halo.current.scale.setScalar(grow * scale * 0.62 * (1 + Math.sin(t * 22) * 0.05));
        const material = halo.current.material as THREE.MeshBasicMaterial;
        material.opacity = 0.1 + clamp01(t / 1.7) * 0.42;
      }
      halo.current.rotation.z -= 0.05;
    }

    // --- escaping lightning --------------------------------------
    if (bolts.current) {
      const live = t > 1.15 && t < 2.4;
      bolts.current.visible = live;
      if (live) {
        const phase = t < 1.7 ? (t - 1.15) / 0.55 : 1;
        const reach = t < 1.7 ? 0.8 + phase * 0.9 : 1.7 + easeOut((t - 1.7) / 0.7) * 1.9;
        bolts.current.children.forEach((child, index) => {
          const seed = boltSeeds[index];
          if (!seed) return;
          const flickerOn = Math.sin(t * (40 + index * 7) + seed.jitter * 9) > -0.35;
          child.visible = flickerOn;
          const length = reach * scale * (0.6 + seed.jitter * 0.7);
          child.scale.set(1, length, 1);
          child.position.set(
            Math.cos(seed.angle) * length * 0.5,
            Math.sin(seed.angle) * length * 0.5,
            0.05,
          );
          child.rotation.z = seed.angle - Math.PI / 2 + Math.sin(t * 30 + index) * 0.09;
        });
      }
    }

    // --- explosion ------------------------------------------------
    const blast = t - 1.7;
    if (shock.current && ring2.current) {
      const live = blast > 0 && blast < 1.2;
      shock.current.visible = live;
      ring2.current.visible = live;
      if (live) {
        const s = easeOut(blast / 1.1);
        shock.current.scale.setScalar((0.3 + s * 3.4) * scale);
        ring2.current.scale.setScalar((0.2 + easeOut(blast / 0.8) * 2.3) * scale);
        (shock.current.material as THREE.MeshBasicMaterial).opacity = (1 - s) * 0.75;
        (ring2.current.material as THREE.MeshBasicMaterial).opacity = (1 - s) * 0.5;
        shock.current.rotation.z += 0.01;
      }
    }

    if (flash.current) {
      flash.current.intensity =
        blast > 0 && blast < 1.6
          ? 260 * power * Math.pow(1 - blast / 1.6, 2.2) * (0.75 + 0.25 * Math.sin(blast * 40))
          : t > 1.2 && t < 1.7
            ? 26 * power * ((t - 1.2) / 0.5)
            : 0;
    }

    if (sparks.current) {
      const live = blast > 0 && blast < 1.9;
      sparks.current.visible = live;
      if (live) {
        const geo = sparks.current.geometry;
        const array = geo.attributes["position"]?.array as Float32Array | undefined;
        if (array) {
          const drag = 1 - Math.exp(-2.1 * blast);
          for (let i = 0; i < spark.count; i++) {
            const k = drag * scale;
            array[i * 3] = (spark.velocity[i * 3] ?? 0) * k;
            array[i * 3 + 1] = (spark.velocity[i * 3 + 1] ?? 0) * k - blast * blast * 1.1;
            array[i * 3 + 2] = (spark.velocity[i * 3 + 2] ?? 0) * k;
          }
          geo.attributes["position"]!.needsUpdate = true;
        }
        (sparks.current.material as THREE.PointsMaterial).opacity = 1 - blast / 1.9;
      }
    }

    if (smoke.current) {
      const live = blast > 0.15 && blast < 2.3;
      smoke.current.visible = live;
      if (live) {
        const age = blast - 0.15;
        const geo = smoke.current.geometry;
        const array = geo.attributes["position"]?.array as Float32Array | undefined;
        if (array) {
          const k = (1 - Math.exp(-1.2 * age)) * scale;
          for (let i = 0; i < smokePuffs.count; i++) {
            array[i * 3] = (smokePuffs.velocity[i * 3] ?? 0) * k * 1.4;
            array[i * 3 + 1] = (smokePuffs.velocity[i * 3 + 1] ?? 0) * k + age * 0.35;
            array[i * 3 + 2] = (smokePuffs.velocity[i * 3 + 2] ?? 0) * k;
          }
          geo.attributes["position"]!.needsUpdate = true;
        }
        const material = smoke.current.material as THREE.PointsMaterial;
        material.opacity = 0.34 * (1 - age / 2.15);
        material.size = 0.16 + age * 0.34;
      }
    }

    if (group.current) group.current.visible = t < CORE_DURATION;
  });

  return (
    <group ref={group}>
      <pointLight ref={flash} color={colour} intensity={0} distance={26} decay={1.6} />

      <mesh ref={core}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial color="#fff3d0" toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>

      <group ref={bolts} visible={false}>
        {boltSeeds.map((seed, index) => (
          <mesh key={index}>
            <planeGeometry args={[0.045, 1]} />
            <meshBasicMaterial
              color="#cfe8ff"
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
          fog={false}
            />
          </mesh>
        ))}
      </group>

      <mesh ref={shock} visible={false}>
        <ringGeometry args={[0.72, 1, 64]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <mesh ref={ring2} visible={false}>
        <ringGeometry args={[0.9, 1, 48]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>

      <points ref={sparks} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[spark.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffd79a"
          size={0.075}
          transparent
          opacity={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </points>

      <points ref={smoke} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[smokePuffs.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#2b2118" size={0.2} transparent opacity={0} depthWrite={false} fog={false} />
      </points>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Collectors: charge, accelerate, cross the whole visible area        */
/* ------------------------------------------------------------------ */

interface SweepProps extends EffectProps {
  axis: "x" | "y";
  /** Travel span in world units, centred on the reward. */
  span: number;
}

export function SweepEffect({ colour, power, axis, span }: SweepProps) {
  const born = useRef<number | null>(null);
  const head = useRef<THREE.Group>(null);
  const streak = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const trail = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const count = 90;
    const positions = new Float32Array(count * 3);
    const offsets = new Float32Array(count);
    for (let i = 0; i < count; i++) offsets[i] = Math.random();
    return { count, positions, offsets };
  }, []);

  useFrame(({ clock }) => {
    if (born.current === null) born.current = clock.elapsedTime;
    const t = clock.elapsedTime - born.current;
    const charge = 0.4;
    const travel = 1.0;

    let progress = 0;
    if (t > charge) progress = clamp01((t - charge) / travel);
    const eased = progress < 0.25 ? easeIn(progress / 0.25) * 0.25 : progress;
    const pos = -span / 2 + eased * span;
    const alive = t < charge + travel + 0.35;

    if (head.current) {
      head.current.visible = alive;
      const chargeScale = t < charge ? 0.5 + easeOut(t / charge) * 0.9 : 1.4;
      head.current.scale.setScalar(chargeScale * (0.8 + power * 0.25));
      if (axis === "x") head.current.position.set(t < charge ? -span / 2 : pos, 0, 0.2);
      else head.current.position.set(0, t < charge ? -span / 2 : pos, 0.2);
      head.current.rotation.z += 0.3;
    }

    if (streak.current) {
      const live = t > charge && alive;
      streak.current.visible = live;
      if (live) {
        const length = Math.min(2.6, eased * span * 0.8);
        if (axis === "x") {
          streak.current.scale.set(length, 1, 1);
          streak.current.position.set(pos - length / 2, 0, 0.16);
        } else {
          streak.current.scale.set(1, length, 1);
          streak.current.position.set(0, pos - length / 2, 0.16);
        }
        (streak.current.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - progress * 0.5);
      }
    }

    if (trail.current) {
      const live = t > charge && alive;
      trail.current.visible = live;
      if (live) {
        const geo = trail.current.geometry;
        const array = geo.attributes["position"]?.array as Float32Array | undefined;
        if (array) {
          for (let i = 0; i < particles.count; i++) {
            const lag = (particles.offsets[i] ?? 0) * 0.9;
            const p = Math.max(0, eased - lag) * span - span / 2;
            const spread = (Math.random() - 0.5) * 0.28;
            if (axis === "x") {
              array[i * 3] = p;
              array[i * 3 + 1] = spread;
            } else {
              array[i * 3] = spread;
              array[i * 3 + 1] = p;
            }
            array[i * 3 + 2] = 0.18 + (Math.random() - 0.5) * 0.1;
          }
          geo.attributes["position"]!.needsUpdate = true;
        }
        (trail.current.material as THREE.PointsMaterial).opacity = 0.85 * (1 - progress * 0.7);
      }
    }

    if (light.current) {
      light.current.intensity = alive ? 22 * power * (t < charge ? t / charge : 1 - progress * 0.4) : 0;
      if (axis === "x") light.current.position.set(pos, 0, 0.7);
      else light.current.position.set(0, pos, 0.7);
    }
  });

  return (
    <group>
      <pointLight ref={light} color={colour} intensity={0} distance={9} decay={2} />
      <group ref={head}>
        <mesh>
          <sphereGeometry args={[0.16, 18, 18]} />
          <meshBasicMaterial color="#fffbe8" toneMapped={false}
          fog={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.3, 18, 18]} />
          <meshBasicMaterial
            color={colour}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          fog={false}
          />
        </mesh>
      </group>
      <mesh ref={streak} visible={false}>
        <planeGeometry args={[1, 0.22]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <points ref={trail} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particles.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={colour}
          size={0.07}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </points>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Small rewards: a contained burst of light and particles             */
/* ------------------------------------------------------------------ */

export function PulseEffect({ colour, power }: EffectProps) {
  const born = useRef<number | null>(null);
  const ring = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const motes = useRef<THREE.Points>(null);

  const data = useMemo(() => {
    const count = 44;
    const positions = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.4;
      velocity[i * 3] = Math.cos(angle) * speed;
      velocity[i * 3 + 1] = Math.sin(angle) * speed + 0.4;
      velocity[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    return { count, positions, velocity };
  }, []);

  useFrame(({ clock }) => {
    if (born.current === null) born.current = clock.elapsedTime;
    const t = clock.elapsedTime - born.current;
    const life = clamp01(t / 1.2);
    if (ring.current) {
      ring.current.scale.setScalar(0.2 + easeOut(life) * 1.5 * power);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - life) * 0.7;
    }
    if (light.current) light.current.intensity = 30 * power * Math.pow(1 - life, 2);
    if (motes.current) {
      const geo = motes.current.geometry;
      const array = geo.attributes["position"]?.array as Float32Array | undefined;
      if (array) {
        const k = 1 - Math.exp(-2.4 * t);
        for (let i = 0; i < data.count; i++) {
          array[i * 3] = (data.velocity[i * 3] ?? 0) * k;
          array[i * 3 + 1] = (data.velocity[i * 3 + 1] ?? 0) * k;
          array[i * 3 + 2] = (data.velocity[i * 3 + 2] ?? 0) * k;
        }
        geo.attributes["position"]!.needsUpdate = true;
      }
      (motes.current.material as THREE.PointsMaterial).opacity = 1 - life;
    }
  });

  return (
    <group>
      <pointLight ref={light} color={colour} intensity={0} distance={7} decay={2} />
      <mesh ref={ring}>
        <ringGeometry args={[0.72, 1, 40]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <points ref={motes} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={colour}
          size={0.06}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </points>
    </group>
  );
}
