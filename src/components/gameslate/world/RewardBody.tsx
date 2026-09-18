// Pieces that belong to the reward OBJECT itself while it activates: the
// energy that orbits its body and the fragments it breaks into. Everything
// here is mounted as a child of the object's group,
// so it inherits the object's position, scale and spin.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { effectNow } from "@/lib/slate/vfx/clock";
import * as THREE from "three";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

/** Rings of energy orbiting the body, tightening as the charge builds. */
export function OrbitRings({
  colour,
  size,
  startedAt,
  chargeDuration,
  rate,
}: {
  colour: string;
  size: number;
  startedAt: number;
  chargeDuration: number;
  rate: number;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    const node = group.current;
    if (!node) return;
    const charge = clamp01(((effectNow(clock) - startedAt) * rate) / chargeDuration);
    node.rotation.z += delta * (1.2 + charge * 7);
    node.rotation.x += delta * (0.6 + charge * 3);
    node.children.forEach((child, index) => {
      const mesh = child as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = charge * charge * (0.5 - index * 0.11);
      const r = 1.25 - charge * 0.35 + index * 0.16;
      mesh.scale.setScalar(r);
    });
  });

  return (
    <group ref={group}>
      {[0, 1, 2].map((index) => (
        <mesh key={index} rotation={[index * 0.7, index * 0.9, 0]}>
          <torusGeometry args={[size * 0.78, size * 0.028, 8, 48]} />
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
  );
}

/**
 * The body breaking apart: shards launched in 3D from the object's own
 * position, with gravity and spin, so the explosion is the object.
 */
export function FragmentBurst({
  size,
  power = 1,
  delay,
  rate,
}: {
  size: number;
  power?: number;
  delay: number;
  rate: number;
}) {
  const group = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Mesh>(null);
  const born = useRef<number | null>(null);


  const shards = useMemo(
    () =>
      Array.from({ length: 18 }, () => {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = (1.6 + Math.random() * 3.6) * power;
        return {
          v: new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.cos(phi) * speed + 0.6,
            Math.sin(phi) * Math.sin(theta) * speed * 0.45,
          ),
          spin: new THREE.Vector3(
            (Math.random() - 0.5) * 14,
            (Math.random() - 0.5) * 14,
            (Math.random() - 0.5) * 14,
          ),
          size: size * (0.1 + Math.random() * 0.16),
        };
      }),
    [size, power],
  );

  useFrame(({ clock }, rawDelta) => {
    if (born.current === null) born.current = effectNow(clock);
    const t = (effectNow(clock) - born.current) * rate - delay;
    const active = t >= 0 && t < 2.25;

    if (group.current) group.current.visible = active;
    if (shell.current) shell.current.visible = active && t < 0.24;
    if (!active) return;
    const dt = Math.min(rawDelta, 0.05);

    // the casing itself tearing open, for the first instant only
    if (shell.current) {
      const live = t < 0.24;
      if (live) {
        const k = clamp01(t / 0.24);
        shell.current.scale.setScalar(size * (0.5 + easeOut(k) * 2.4) * power);
        (shell.current.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      }
    }

    const node = group.current;
    if (!node) return;
    const life = clamp01(t / 2.1);
    node.children.forEach((child, index) => {
      const shard = shards[index];
      if (!shard) return;
      const k = 1 - Math.exp(-2.6 * t);
      child.position.set(
        shard.v.x * k,
        shard.v.y * k - 1.8 * t * t,
        shard.v.z * k,
      );
      child.rotation.x += shard.spin.x * dt;
      child.rotation.y += shard.spin.y * dt;
      child.rotation.z += shard.spin.z * dt;
      const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      material.opacity = 1 - easeOut(life);
      material.emissiveIntensity = Math.max(0, 1.8 * (1 - life * 2));
    });
  });

  return (
    <group>
      <mesh ref={shell} visible={false}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial
          color="#fff0c8"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <group ref={group} visible={false}>
        {shards.map((shard, index) => (
          <mesh key={index}>
            <tetrahedronGeometry args={[shard.size, 0]} />
            <meshStandardMaterial
              color="#2a2320"
              emissive="#ff7a18"
              emissiveIntensity={1.6}
              roughness={0.7}
              metalness={0.3}
              transparent
              opacity={1}
            />
          </mesh>
        ))}
      </group>
    </group>
  );

}
