// Reward effects as real events in the world. Every effect component mounts
// only while it runs and unmounts afterwards, so nothing is left simulating.

import { useEffect, useMemo, useRef } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { effectNow } from "@/lib/slate/vfx/clock";
import * as THREE from "three";
import { playSfx } from "@/lib/slate/audio";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t: number) => Math.pow(clamp01(t), 2.4);
const easeInOut = (t: number) =>
  clamp01(t) < 0.5 ? 2 * clamp01(t) * clamp01(t) : 1 - Math.pow(-2 * clamp01(t) + 2, 2) / 2;

export const CORE_DURATION = 5.8;
export const SWEEP_DURATION = 1.9;
export const VAULT_DURATION = 2.2;

interface EffectProps {
  /** Ignored for timing; kept so a re-fire remounts the effect. */
  startedAt: number;
  colour: string;
  power: number;
}


/* ------------------------------------------------------------------ */
/* Shared primitive: a branching bolt                                   */
/* ------------------------------------------------------------------ */

const BOLT_MAIN = 14;
const BOLT_BRANCHES = 3;
const BOLT_BRANCH_STEPS = 5;
const BOLT_LINES = BOLT_MAIN + BOLT_BRANCHES * BOLT_BRANCH_STEPS;

/** Rewrites a unit-length jagged bolt (origin -> +Y) with side branches. */
function writeBolt(array: Float32Array, spread: number) {
  let i = 0;
  const push = (x1: number, y1: number, x2: number, y2: number) => {
    array[i++] = x1;
    array[i++] = y1;
    array[i++] = 0;
    array[i++] = x2;
    array[i++] = y2;
    array[i++] = 0;
  };

  const pts: Array<[number, number]> = [[0, 0]];
  for (let s = 1; s <= BOLT_MAIN; s++) {
    const y = s / BOLT_MAIN;
    const x = s === BOLT_MAIN ? 0 : (Math.random() - 0.5) * spread * (0.4 + Math.sin(s * 1.7) * 0.6);
    pts.push([x, y]);
  }
  for (let s = 0; s < BOLT_MAIN; s++) {
    const a = pts[s];
    const b = pts[s + 1];
    if (a && b) push(a[0], a[1], b[0], b[1]);
  }

  for (let b = 0; b < BOLT_BRANCHES; b++) {
    const origin = pts[2 + Math.floor(Math.random() * (BOLT_MAIN - 4))] ?? [0, 0.4];
    let bx = origin[0];
    let by = origin[1];
    const drift = (Math.random() - 0.5) * 1.4 * spread * 6;
    for (let s = 0; s < BOLT_BRANCH_STEPS; s++) {
      const nx = bx + drift * 0.035 + (Math.random() - 0.5) * spread;
      const ny = by + 0.045 + (Math.random() - 0.5) * 0.02;
      push(bx, by, nx, ny);
      bx = nx;
      by = ny;
    }
  }
}

/**
 * Lightning as real geometry: white-hot core, coloured outer glow, secondary
 * branches and a rapidly changing shape. Drawn in unit length along +Y so the
 * parent can scale, rotate and travel with it.
 */
export function BranchingBolt({
  colour,
  spread = 0.05,
  rate = 0.035,
  opacity = 1,
}: {
  colour: string;
  spread?: number;
  rate?: number;
  opacity?: number;
}) {
  const core = useRef<THREE.LineSegments>(null);
  const glow = useRef<THREE.LineSegments>(null);
  const last = useRef(0);

  const positions = useMemo(() => {
    const array = new Float32Array(BOLT_LINES * 6);
    writeBolt(array, spread);
    return array;
  }, [spread]);

  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < rate) return;
    last.current = clock.elapsedTime;
    writeBolt(positions, spread);
    [core.current, glow.current].forEach((line) => {
      const attribute = line?.geometry.attributes["position"];
      if (attribute) attribute.needsUpdate = true;
    });
  });

  return (
    <group>
      <lineSegments ref={glow} scale={[2.6, 1, 1]} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={colour}
          transparent
          opacity={0.55 * opacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </lineSegments>
      <lineSegments ref={core} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.95 * opacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </lineSegments>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Math Core / bomb                                                     */
/* recognition -> orbital charge -> ignition -> layered detonation      */
/* -> environmental light -> resolution                                 */
/* ------------------------------------------------------------------ */

const ORBIT_COUNT = 84;
const REC = 0.5;
const CHARGE_END = 2.65;
const DET = 3;
const LIGHTNING_START = DET + 0.28;
const LIGHTNING_END = 5.35;

export function CoreEffect({ colour, power }: EffectProps) {
  const born = useRef<number | null>(null);
  const group = useRef<THREE.Group>(null);
  const charge = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const orbit = useRef<THREE.Points>(null);
  const fireball = useRef<THREE.Mesh>(null);
  const flashPlane = useRef<THREE.Mesh>(null);
  const shock = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.PointLight>(null);
  const bolts = useRef<THREE.Group>(null);
  const embers = useRef<THREE.Points>(null);
  const sparks = useRef<THREE.Points>(null);
  const dust = useRef<THREE.Points>(null);
  const smoke = useRef<THREE.Points>(null);
  const blasted = useRef(false);

  const scatter = (count: number, min: number, max: number, lift: number, flatten: number) =>
    useMemo(() => {
      const positions = new Float32Array(count * 3);
      const velocity = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = min + Math.random() * (max - min);
        velocity[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
        velocity[i * 3 + 1] = Math.cos(phi) * speed + lift;
        velocity[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed * flatten;
      }
      return { count, positions, velocity };
    }, []);

  /* eslint-disable react-hooks/rules-of-hooks */
  const spark = scatter(170, 2.4, 7.4, 0, 0.4);
  const ember = scatter(60, 0.5, 1.8, 0.6, 0.3);
  const dustCloud = scatter(90, 0.8, 2.6, -0.1, 0.5);
  const smokePuffs = scatter(70, 0.3, 1.4, 0.7, 0.3);
  /* eslint-enable react-hooks/rules-of-hooks */

  // orbital energy: every particle rides its own tilted 3D orbit
  const orbits = useMemo(() => {
    const positions = new Float32Array(ORBIT_COUNT * 3);
    const radius = new Float32Array(ORBIT_COUNT);
    const speed = new Float32Array(ORBIT_COUNT);
    const phase = new Float32Array(ORBIT_COUNT);
    const tiltX = new Float32Array(ORBIT_COUNT);
    const tiltZ = new Float32Array(ORBIT_COUNT);
    for (let i = 0; i < ORBIT_COUNT; i++) {
      radius[i] = 0.55 + Math.random() * 0.9;
      speed[i] = 1.6 + Math.random() * 2.4;
      phase[i] = Math.random() * Math.PI * 2;
      tiltX[i] = (Math.random() - 0.5) * 1.5;
      tiltZ[i] = (Math.random() - 0.5) * 1.5;
    }
    return { positions, radius, speed, phase, tiltX, tiltZ };
  }, []);

  const boltSeeds = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        angle: (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.16,
        jitter: Math.random(),
        major: i % 3 === 0,
      })),
    [],
  );

  const drift = (
    points: THREE.Points | null,
    data: { count: number; velocity: Float32Array },
    k: number,
    gravity: number,
  ) => {
    if (!points) return;
    const array = points.geometry.attributes["position"]?.array as Float32Array | undefined;
    if (!array) return;
    for (let i = 0; i < data.count; i++) {
      array[i * 3] = (data.velocity[i * 3] ?? 0) * k;
      array[i * 3 + 1] = (data.velocity[i * 3 + 1] ?? 0) * k - gravity;
      array[i * 3 + 2] = (data.velocity[i * 3 + 2] ?? 0) * k;
    }
    points.geometry.attributes["position"]!.needsUpdate = true;
  };

  useFrame(({ clock }) => {
    if (born.current === null) born.current = effectNow(clock);
    const t = effectNow(clock) - born.current;
    const scale = 1 + (power - 1) * 0.5;

    if (!blasted.current && t >= DET) {
      blasted.current = true;
      playSfx("bomb-blast");
      playSfx("bomb-debris");
    }

    // Activation and charge stay close to the body. The large visual growth
    // comes from the actual bomb object, not from an opaque replacement glow.
    const grow =
      t < REC
        ? 0.42 + easeOut(t / REC) * 0.28
        : t < CHARGE_END
          ? 0.7 + easeInOut((t - REC) / (CHARGE_END - REC)) * 0.38
          : t < DET
            ? 1.08 - easeIn((t - CHARGE_END) / (DET - CHARGE_END)) * 0.16
            : 0;

    if (charge.current) {
      const shakeAmount = t < DET ? 0.009 * Math.pow(t / DET, 2.2) : 0;
      charge.current.position.set(
        (Math.random() - 0.5) * shakeAmount * 6,
        (Math.random() - 0.5) * shakeAmount * 6,
        0,
      );
    }

    // inner heat: the light building *inside* the bomb's own body. It never
    // covers the body, it only glows out of it.
    if (core.current) {
      const live = t < DET;
      core.current.visible = live;
      if (live) {
        const pulse = 1 + Math.sin(t * (8 + t * 26)) * 0.09 * clamp01(t / DET);
        const heat = grow * scale * pulse * 0.22;
        core.current.scale.set(heat, heat, heat);
        (core.current.material as THREE.MeshBasicMaterial).opacity =
          0.25 + 0.6 * Math.pow(clamp01(t / DET), 2);
        core.current.rotation.y += 0.04 + t * 0.32;
        core.current.rotation.x += 0.02 + t * 0.12;
      }
    }


    if (halo.current) {
      const live = t < DET + 0.05;
      halo.current.visible = live;
      if (live) {
        halo.current.scale.setScalar(grow * scale * 0.78 * (1 + Math.sin(t * 22) * 0.04));
        (halo.current.material as THREE.MeshBasicMaterial).opacity =
          0.1 + clamp01(t / DET) * 0.42 * (0.7 + 0.3 * Math.sin(t * 31));
      }
      halo.current.rotation.z -= 0.05;
    }

    // orbital energy: tightening, faster and brighter toward detonation
    if (orbit.current) {
      const live = t > REC * 0.6 && t < DET;
      orbit.current.visible = live;
      if (live) {
        const k = clamp01((t - REC * 0.6) / (DET - REC * 0.6));
        const array = orbit.current.geometry.attributes["position"]?.array as Float32Array | undefined;
        if (array) {
          for (let i = 0; i < ORBIT_COUNT; i++) {
            const r = (orbits.radius[i] ?? 1) * scale * (1.15 - k * 0.72);
            const a = (orbits.phase[i] ?? 0) + t * (orbits.speed[i] ?? 2) * (1 + k * 3.4);
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            const tx = orbits.tiltX[i] ?? 0;
            const tz = orbits.tiltZ[i] ?? 0;
            array[i * 3] = x + y * tz * 0.3;
            array[i * 3 + 1] = y * Math.cos(tx);
            array[i * 3 + 2] = y * Math.sin(tx) + x * tz * 0.35;
          }
          orbit.current.geometry.attributes["position"]!.needsUpdate = true;
        }
        const material = orbit.current.material as THREE.PointsMaterial;
        material.opacity = 0.35 + k * 0.65;
        material.size = 0.045 + k * 0.05;
      }
    }

    // lifting embers during the build-up
    if (embers.current) {
      const live = t > REC && t < DET + 0.3;
      embers.current.visible = live;
      if (live) {
        drift(embers.current, ember, (1 - Math.exp(-0.9 * (t - REC))) * scale, 0);
        (embers.current.material as THREE.PointsMaterial).opacity = 0.9 * clamp01((t - REC) / 0.4);
      }
    }

    // Lightning is born only after the body has shattered and the fireball
    // has begun expanding. Major bolts decay before the smaller residual arcs.
    if (bolts.current) {
      const live = t > LIGHTNING_START && t < LIGHTNING_END;
      bolts.current.visible = live;
      if (live) {
        const age = t - LIGHTNING_START;
        const phase = clamp01(age / (LIGHTNING_END - LIGHTNING_START));
        const reach = 0.75 + easeOut(clamp01(age / 0.42)) * 3.35;
        bolts.current.children.forEach((child, index) => {
          const seed = boltSeeds[index];
          if (!seed) return;
          const fadeStart = seed.major ? 0.48 : 0.7;
          const decay = 1 - easeIn(clamp01((phase - fadeStart) / (1 - fadeStart)));
          child.visible = decay > 0.03 && Math.sin(t * (31 + index * 5) + seed.jitter * 9) > -0.28;
          const length = reach * scale * (0.62 + seed.jitter * 0.72) * (0.72 + decay * 0.28);
          child.scale.set(1, length, 1);
          child.rotation.z = seed.angle - Math.PI / 2 + Math.sin(t * 22 + index) * 0.12;
          child.traverse((node) => {
            const line = node as THREE.LineSegments;
            const material = line.material;
            if (material instanceof THREE.LineBasicMaterial) {
              material.opacity = (line.scale.x > 1 ? 0.5 : 0.92) * decay;
            }
          });
        });
      }
    }


    // --- 4 detonation: layers at their own speeds -------------------
    const blast = t - DET;

    if (flashPlane.current) {
      const live = blast > 0 && blast < 0.12;
      flashPlane.current.visible = live;
      if (live) {
        flashPlane.current.scale.setScalar((1.6 + blast * 22) * scale);
        (flashPlane.current.material as THREE.MeshBasicMaterial).opacity = 1 - blast / 0.12;
      }
    }

    if (fireball.current) {
      const live = blast > 0 && blast < 0.95;
      fireball.current.visible = live;
      if (live) {
        const f = easeOut(blast / 0.7);
        // irregular, not a clean sphere
        fireball.current.scale.set(
          (0.4 + f * 2.2) * scale,
          (0.4 + f * 1.95) * scale * (1 + Math.sin(blast * 26) * 0.05),
          (0.4 + f * 2.1) * scale,
        );
        fireball.current.rotation.z += 0.02;
        fireball.current.rotation.x += 0.013;
        const material = fireball.current.material as THREE.MeshBasicMaterial;
        material.opacity = Math.pow(1 - blast / 0.95, 1.5);
        material.color.setStyle(blast < 0.25 ? "#fff0c0" : blast < 0.55 ? "#ffa53a" : "#d1471a");
      }
    }

    if (shock.current && ring2.current) {
      const live = blast > 0 && blast < 1.2;
      shock.current.visible = live;
      ring2.current.visible = live;
      if (live) {
        // the thin shockwave outruns everything else
        const s = easeOut(blast / 0.85);
        shock.current.scale.setScalar((0.3 + s * 4.6) * scale);
        ring2.current.scale.setScalar((0.2 + easeOut(blast / 1.15) * 2.3) * scale);
        (shock.current.material as THREE.MeshBasicMaterial).opacity = (1 - s) * 0.8;
        (ring2.current.material as THREE.MeshBasicMaterial).opacity = (1 - easeOut(blast / 1.15)) * 0.45;
        shock.current.rotation.z += 0.01;
      }
    }

    // --- 5 environmental response -----------------------------------
    if (flash.current) {
      flash.current.intensity =
        blast > 0 && blast < 1.8
          ? (blast < 0.08 ? 620 : 240) * power * Math.pow(1 - blast / 1.8, 2.2) * (0.78 + 0.22 * Math.sin(blast * 40))
          : t > CHARGE_END - 0.6 && t < DET
            ? 30 * power * clamp01((t - (CHARGE_END - 0.6)) / 0.6)
            : 0;
    }

    if (sparks.current) {
      const live = blast > 0 && blast < 1.9;
      sparks.current.visible = live;
      if (live) {
        drift(sparks.current, spark, (1 - Math.exp(-2.6 * blast)) * scale, blast * blast * 1.2);
        (sparks.current.material as THREE.PointsMaterial).opacity = 1 - blast / 1.9;
      }
    }

    if (dust.current) {
      const live = blast > 0.02 && blast < 2;
      dust.current.visible = live;
      if (live) {
        const age = blast - 0.02;
        drift(dust.current, dustCloud, (1 - Math.exp(-1.6 * age)) * scale * 1.5, age * 0.35);
        const material = dust.current.material as THREE.PointsMaterial;
        material.opacity = 0.3 * (1 - age / 1.98);
        material.size = 0.12 + age * 0.22;
      }
    }

    // --- 6 resolution: fire clears, smoke lingers, embers last ------
    if (smoke.current) {
      const live = blast > 0.15 && blast < 2.6;
      smoke.current.visible = live;
      if (live) {
        const age = blast - 0.15;
        drift(smoke.current, smokePuffs, (1 - Math.exp(-0.9 * age)) * scale * 1.4, -age * 0.35);
        const material = smoke.current.material as THREE.PointsMaterial;
        material.opacity = 0.34 * (1 - age / 2.45);
        material.size = 0.16 + age * 0.4;
      }
    }

    if (group.current) group.current.visible = t < CORE_DURATION;
  });

  return (
    <group ref={group}>
      <pointLight ref={flash} color={colour} intensity={0} distance={26} decay={1.6} />

      <group ref={charge}>
        <mesh ref={core}>
          <icosahedronGeometry args={[1, 2]} />
          <meshBasicMaterial
            color="#fff3d0"
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            fog={false}
          />
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
      </group>

      {/* orbital energy gathering before the blast */}
      <points ref={orbit} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[orbits.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={colour}
          size={0.05}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </points>

      <points ref={embers} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[ember.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffb257"
          size={0.05}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </points>

      <group ref={bolts} visible={false} position={[0, 0, 0.08]}>
        {boltSeeds.map((_, index) => (
          <group key={index}>
            <BranchingBolt colour="#cfe8ff" spread={0.045 + index * 0.003} rate={0.024 + (index % 3) * 0.008} />
          </group>
        ))}
      </group>

      {/* the single-frame white flash */}
      <mesh ref={flashPlane} visible={false}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>

      {/* the hot fireball body */}
      <mesh ref={fireball} visible={false}>
        <icosahedronGeometry args={[1, 3]} />
        <meshBasicMaterial
          color="#ffb14d"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>

      <mesh ref={shock} visible={false}>
        <ringGeometry args={[0.88, 1, 64]} />
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

      <points ref={dust} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustCloud.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#6b5a49" size={0.12} transparent opacity={0} depthWrite={false} fog={false} />
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
/* Math Vault: seal -> unlock -> the hidden text emerges -> resolve    */
/* ------------------------------------------------------------------ */

export function VaultEffect({
  colour,
  power,
  expression,
  width,
  height,
}: EffectProps & { expression?: string | undefined; width: number; height: number }) {
  const born = useRef<number | null>(null);
  const seal = useRef<THREE.Mesh>(null);
  const burst = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const leftCap = useRef<THREE.Mesh>(null);
  const rightCap = useRef<THREE.Mesh>(null);
  const textRef = useRef<THREE.Group>(null);
  const motes = useRef<THREE.Points>(null);
  const unlocked = useRef(false);
  const revealed = useRef(false);

  useEffect(() => {
    playSfx("vault-activate");
  }, []);

  const data = useMemo(() => {
    const count = 60;
    const positions = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1.6;
      velocity[i * 3] = Math.cos(angle) * speed * 1.4;
      velocity[i * 3 + 1] = Math.sin(angle) * speed + 0.5;
      velocity[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    return { count, positions, velocity };
  }, []);

  useFrame(({ clock }) => {
    if (born.current === null) born.current = effectNow(clock);
    const t = effectNow(clock) - born.current;
    const UNLOCK = 0.55;

    if (!unlocked.current && t >= UNLOCK) {
      unlocked.current = true;
      playSfx("vault-unlock");
    }
    if (!revealed.current && t >= UNLOCK + 0.18) {
      revealed.current = true;
      playSfx("vault-reveal");
    }

    // anticipation: the seal pulses and the whole mechanism trembles
    if (seal.current) {
      const live = t < UNLOCK + 0.5;
      seal.current.visible = live;
      if (live) {
        const material = seal.current.material as THREE.MeshBasicMaterial;
        material.opacity =
          t < UNLOCK ? 0.25 + 0.5 * Math.abs(Math.sin(t * 16)) : 0.75 * (1 - (t - UNLOCK) / 0.5);
        seal.current.position.set((Math.random() - 0.5) * 0.01 * (t / UNLOCK), 0, 0.02);
      }
    }

    // the ends unlock outward
    const open = t > UNLOCK ? easeOut((t - UNLOCK) / 0.45) : 0;
    if (leftCap.current && rightCap.current) {
      leftCap.current.position.x = -width * (0.42 + open * 0.34);
      rightCap.current.position.x = width * (0.42 + open * 0.34);
      const fade = clamp01(1 - (t - UNLOCK - 0.6) / 0.8);
      [leftCap.current, rightCap.current].forEach((cap) => {
        (cap.material as THREE.MeshBasicMaterial).opacity = 0.85 * fade;
        cap.rotation.z = open * 0.22 * (cap === leftCap.current ? 1 : -1);
      });
    }

    // the energy escaping the opened centre
    if (burst.current) {
      const live = t > UNLOCK && t < UNLOCK + 0.9;
      burst.current.visible = live;
      if (live) {
        const b = (t - UNLOCK) / 0.9;
        burst.current.scale.set(width * (0.3 + b * 1.5), height * (0.4 + b * 2.2), 1);
        (burst.current.material as THREE.MeshBasicMaterial).opacity = (1 - b) * 0.85;
      }
    }

    if (ringRef.current) {
      const live = t > UNLOCK && t < UNLOCK + 1;
      ringRef.current.visible = live;
      if (live) {
        const r = easeOut((t - UNLOCK) / 0.85);
        ringRef.current.scale.setScalar((0.3 + r * 2.4) * width);
        (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - r) * 0.6;
      }
    }

    if (light.current) {
      light.current.intensity =
        t < UNLOCK
          ? 8 * power * (t / UNLOCK)
          : 120 * power * Math.pow(clamp01(1 - (t - UNLOCK) / 1.2), 2);
    }

    // the hidden text rises out of the vault and illuminates
    if (textRef.current) {
      const live = t > UNLOCK + 0.05;
      textRef.current.visible = live;
      if (live) {
        const r = clamp01((t - UNLOCK - 0.05) / 0.5);
        const fade = clamp01(1 - (t - UNLOCK - 1.1) / 0.6);
        textRef.current.position.y = height * (0.1 + easeOut(r) * 0.85);
        textRef.current.scale.setScalar(0.5 + easeOut(r) * 0.7);
        textRef.current.children.forEach((child) => {
          const material = (child as THREE.Mesh).material as THREE.Material & { opacity: number };
          if (material) material.opacity = Math.min(r, fade);
        });
      }
    }

    if (motes.current) {
      const live = t > UNLOCK;
      motes.current.visible = live;
      if (live) {
        const age = t - UNLOCK;
        const array = motes.current.geometry.attributes["position"]?.array as Float32Array | undefined;
        if (array) {
          const k = (1 - Math.exp(-2 * age)) * width;
          for (let i = 0; i < data.count; i++) {
            array[i * 3] = (data.velocity[i * 3] ?? 0) * k;
            array[i * 3 + 1] = (data.velocity[i * 3 + 1] ?? 0) * k;
            array[i * 3 + 2] = (data.velocity[i * 3 + 2] ?? 0) * k * 0.4;
          }
          motes.current.geometry.attributes["position"]!.needsUpdate = true;
        }
        (motes.current.material as THREE.PointsMaterial).opacity = clamp01(1 - age / 1.4);
      }
    }
  });

  return (
    <group>
      <pointLight ref={light} color="#ffd27a" intensity={0} distance={9} decay={2} />

      {/* the seal breaking on the centre band */}
      <mesh ref={seal} position={[0, 0, 0.02]}>
        <planeGeometry args={[width * 0.52, height * 0.42]} />
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

      {[leftCap, rightCap].map((ref, index) => (
        <mesh key={index} ref={ref} position={[0, 0, 0.015]}>
          <planeGeometry args={[width * 0.16, height * 0.9]} />
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
      ))}

      <mesh ref={burst} visible={false} position={[0, 0, 0.03]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#ffd27a"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>

      <mesh ref={ringRef} visible={false} position={[0, 0, 0.025]}>
        <ringGeometry args={[0.82, 1, 48]} />
        <meshBasicMaterial
          color="#ffe6b0"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>

      {expression ? (
        <group ref={textRef} visible={false} position={[0, 0, 0.12]}>
          <Text
            fontSize={height * 0.6}
            font="/fonts/technical.ttf"
            color="#fff3d0"
            anchorX="center"
            anchorY="middle"
            outlineWidth={height * 0.03}
            outlineColor="#5a3408"
            material-transparent
            material-toneMapped={false}
            material-depthWrite={false}
          >
            {expression}
          </Text>
        </group>
      ) : null}

      <points ref={motes} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffd27a"
          size={0.055}
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
/* Collectors.                                                          */
/*                                                                      */
/* The effect is mounted as a child of the collector object, so it is   */
/* drawn at the collector's own origin and inherits its travel. Nothing */
/* here moves on its own: the energy wraps the body and the trail is    */
/* laid down *behind* it, strictly along the collector's single axis.   */
/* ------------------------------------------------------------------ */

interface SweepProps extends EffectProps {
  axis: "x" | "y";
  /** Total travel of the collector, in world units. */
  span: number;
  /** +1 or -1 along the axis: the direction the collector sweeps. */
  direction?: number;
  /** The object's own choreography, so effect and body share one clock. */
  timing: { reveal: number; anticipation: number; transform: number; duration: number };
  /** Global effect speed. */
  rate?: number;
}

const CHARGE = 0.4;
const TRAVEL = 1.0;


/** Particles drawn inward while the collector wakes up. */
function useGather(count: number) {
  return useMemo(() => {
    const positions = new Float32Array(count * 3);
    const from = new Float32Array(count * 3);
    const delay = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.9 + Math.random() * 1.6;
      from[i * 3] = Math.cos(angle) * radius;
      from[i * 3 + 1] = Math.sin(angle) * radius;
      from[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      delay[i] = Math.random() * 0.4;
    }
    return { count, positions, from, delay };
  }, [count]);
}

function drawGather(
  points: THREE.Points | null,
  data: { count: number; from: Float32Array; delay: Float32Array },
  t: number,
) {
  if (!points) return;
  const array = points.geometry.attributes["position"]?.array as Float32Array | undefined;
  if (!array) return;
  for (let i = 0; i < data.count; i++) {
    const k = clamp01((t - (data.delay[i] ?? 0)) / 0.45);
    const pull = 1 - easeIn(k);
    array[i * 3] = (data.from[i * 3] ?? 0) * pull;
    array[i * 3 + 1] = (data.from[i * 3 + 1] ?? 0) * pull;
    array[i * 3 + 2] = (data.from[i * 3 + 2] ?? 0) * pull;
  }
  points.geometry.attributes["position"]!.needsUpdate = true;
}

/**
 * One collector sweep, shared by both axes.
 *
 * Nothing in here travels: the component is a child of the collector object,
 * so it already sits at the collector's position and inherits its motion. The
 * energy wraps the body at the origin and the trail is laid down behind it,
 * strictly along one axis, so the collector always leads its own effect.
 */
function CollectorSweep({
  colour,
  power,
  span,
  axis,
  direction = 1,
  timing,
  rate = 1,
}: Omit<SweepProps, "startedAt">) {
  const born = useRef<number | null>(null);
  const halo = useRef<THREE.Group>(null);
  const trail = useRef<THREE.Mesh>(null);
  const boltGroup = useRef<THREE.Group>(null);
  const motesRef = useRef<THREE.Points>(null);
  const light = useRef<THREE.PointLight>(null);
  const gatherRef = useRef<THREE.Points>(null);
  const impact = useRef<THREE.Mesh>(null);

  const gather = useGather(48);
  const motes = useMemo(() => {
    const count = 110;
    const positions = new Float32Array(count * 3);
    const offsets = new Float32Array(count);
    const lateral = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      offsets[i] = Math.random();
      lateral[i] = (Math.random() - 0.5) * 0.28;
    }
    return { count, positions, offsets, lateral };
  }, []);

  const horizontal = axis === "x";
  // unit vector pointing back the way the collector came
  const back = horizontal
    ? ([-direction, 0] as const)
    : ([0, -direction] as const);
  // rotation that maps the +X of the trail plane onto that backward vector
  const trailAngle = horizontal
    ? direction > 0
      ? Math.PI
      : 0
    : direction > 0
      ? -Math.PI / 2
      : Math.PI / 2;
  // rotation that maps the bolt's +Y onto the same backward vector
  const boltAngle = horizontal
    ? direction > 0
      ? Math.PI / 2
      : -Math.PI / 2
    : direction > 0
      ? Math.PI
      : 0;

  useFrame(({ clock }) => {
    if (born.current === null) born.current = effectNow(clock);
    const t = (effectNow(clock) - born.current) * rate;

    const charge = clamp01(t / Math.max(0.0001, timing.anticipation));
    const k = clamp01(
      (t - timing.anticipation) / Math.max(0.0001, timing.transform - timing.anticipation),
    );
    const travelled = Math.max(0.001, span * easeIn(k));
    const after = clamp01((t - timing.transform) / Math.max(0.0001, timing.duration - timing.transform));
    const fade = 1 - easeIn(after);
    const alive = t < timing.duration;

    // energy gathering onto the body while it wakes up
    if (gatherRef.current) {
      const live = t < timing.anticipation + 0.15;
      gatherRef.current.visible = live;
      if (live) {
        drawGather(gatherRef.current, gather, t);
        (gatherRef.current.material as THREE.PointsMaterial).opacity =
          0.9 * (1 - t / (timing.anticipation + 0.15));
      }
    }

    // the energy shell that wraps the collector's own body
    if (halo.current) {
      halo.current.visible = alive;
      const size = (0.55 + charge * 0.45) * (0.85 + power * 0.25);
      halo.current.scale.setScalar(size);
      halo.current.rotation.z += horizontal ? 0.12 : -0.12;
      halo.current.children.forEach((child, index) => {
        const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        material.opacity = (0.5 - index * 0.18) * charge * fade;
      });
    }

    // the trail, always behind, always on one axis
    if (trail.current) {
      const live = k > 0 && alive;
      trail.current.visible = live;
      if (live) {
        trail.current.rotation.z = trailAngle;
        trail.current.scale.set(travelled, 1 + Math.sin(t * 38) * 0.1, 1);
        trail.current.position.set((back[0] * travelled) / 2, (back[1] * travelled) / 2, 0.14);
        (trail.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * fade * (1 - k * 0.35);
      }
    }

    if (boltGroup.current) {
      const live = k > 0 && alive;
      boltGroup.current.visible = live;
      if (live) {
        boltGroup.current.rotation.z = boltAngle;
        boltGroup.current.scale.set(1, travelled, 1);
        boltGroup.current.position.set(0, 0, 0.18);
      }
    }

    if (motesRef.current) {
      const live = k > 0 && alive;
      motesRef.current.visible = live;
      if (live) {
        const array = motesRef.current.geometry.attributes["position"]?.array as
          | Float32Array
          | undefined;
        if (array) {
          for (let i = 0; i < motes.count; i++) {
            const along = (motes.offsets[i] ?? 0) * travelled;
            const jitter = (motes.lateral[i] ?? 0) * (0.4 + Math.random() * 0.6);
            array[i * 3] = back[0] * along + (horizontal ? 0 : jitter);
            array[i * 3 + 1] = back[1] * along + (horizontal ? jitter : 0);
            array[i * 3 + 2] = 0.18 + (Math.random() - 0.5) * 0.1;
          }
          motesRef.current.geometry.attributes["position"]!.needsUpdate = true;
        }
        (motesRef.current.material as THREE.PointsMaterial).opacity = 0.85 * fade;
      }
    }

    // arrival: the sweep settles where the collector stops
    if (impact.current) {
      const age = t - timing.transform;
      const live = age > 0 && age < 0.5;
      impact.current.visible = live;
      if (live) {
        impact.current.scale.setScalar((0.3 + easeOut(age / 0.5) * 2.2) * (0.8 + power * 0.3));
        (impact.current.material as THREE.MeshBasicMaterial).opacity = (1 - age / 0.5) * 0.8;
      }
    }

    if (light.current) {
      light.current.intensity = alive ? 26 * power * (0.3 + 0.7 * charge) * fade : 0;
    }
  });

  return (
    <group>
      <pointLight ref={light} color={colour} intensity={0} distance={9} decay={2} position={[0, 0, 0.7]} />

      <points ref={gatherRef} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[gather.positions, 3]} />
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

      {/* the shell of energy around the collector's own body */}
      <group ref={halo}>
        {[0, 1, 2].map((index) => (
          <mesh key={index} rotation={[index * 0.7, index * 0.5, 0]}>
            <torusGeometry args={[0.42 + index * 0.1, 0.022, 8, 40]} />
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
        ))}
      </group>

      <group ref={boltGroup} visible={false}>
        <BranchingBolt colour={colour} spread={0.03} rate={0.028} />
      </group>

      <mesh ref={trail} visible={false}>
        <planeGeometry args={[1, 0.26]} />
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

      <points ref={motesRef} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[motes.positions, 3]} />
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

      <mesh ref={impact} visible={false} position={[0, 0, 0.2]}>
        <ringGeometry args={[0.72, 1, 44]} />
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
    </group>
  );
}

export function SweepEffect(props: SweepProps) {
  const { startedAt: _startedAt, ...rest } = props;

  useEffect(() => {
    playSfx("collector-charge");
    const id = window.setTimeout(() => playSfx("collector-attract"), 380);
    return () => window.clearTimeout(id);
  }, []);

  return <CollectorSweep {...rest} />;
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
    if (born.current === null) born.current = effectNow(clock);
    const t = effectNow(clock) - born.current;
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
