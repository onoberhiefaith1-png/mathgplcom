import { useFrame } from "@react-three/fiber";
import { effectNow } from "@/lib/slate/vfx/clock";
import { useRef } from "react";
import * as THREE from "three";

interface Props {
  size: number;
  active: boolean;
  startedAt?: number;
  speed: number;
  lighting: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
};

/** A real, lit spherical reward body. This is never used by the original Bomb. */
export function PremiumBombBody({ size, active, startedAt = 0, speed, lighting }: Props) {
  const root = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Group>(null);
  const core = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }, delta) => {
    if (!root.current || !shell.current) return;
    const t = active ? Math.max(0, (effectNow(clock) - startedAt) * Math.max(0.4, speed)) : 0;
    const reveal = smooth(t / 0.5);
    const charge = smooth((t - 0.5) / 2.15);
    const critical = smooth((t - 2.65) / 0.4);
    const exploded = t >= 3.05;

    // Natural spherical yaw: left → right → left, never an up/down rock.
    const yaw = active ? Math.sin(t * 3.55) * (0.28 + charge * 0.3) : Math.sin(effectNow(clock) * 0.65) * 0.08;
    shell.current.rotation.y = THREE.MathUtils.damp(shell.current.rotation.y, yaw, 10, Math.min(delta, 0.05));
    shell.current.rotation.x = 0;
    shell.current.rotation.z = 0;

    const growth = t < 0.5 ? 0.96 + reveal * 0.04
      : t < 1.05 ? 1 + smooth((t - 0.5) / 0.55) * 0.1
      : t < 1.55 ? 1.1 + smooth((t - 1.05) / 0.5) * 0.15
      : t < 2.05 ? 1.25 + smooth((t - 1.55) / 0.5) * 0.2
      : t < 2.65 ? 1.45 + smooth((t - 2.05) / 0.6) * 0.15
      : 1.6 - critical * 0.18;
    root.current.scale.setScalar(exploded ? 0.001 : growth);
    root.current.visible = !exploded;
    if (core.current) core.current.emissiveIntensity = (0.55 + reveal * 0.7 + charge * 2.8) * lighting;
  });

  const r = size * 0.48;
  return (
    <group ref={root} scale={0.96}>
      <group ref={shell}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[r, 48, 32]} />
          <meshPhysicalMaterial color="#101722" metalness={0.86} roughness={0.18} clearcoat={1} clearcoatRoughness={0.1} envMapIntensity={2.2 * lighting} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[r * 0.88, r * 0.105, 12, 64]} />
          <meshPhysicalMaterial color="#ffc51b" metalness={0.88} roughness={0.16} clearcoat={1} emissive="#8b4e00" emissiveIntensity={0.4} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[r * 0.88, r * 0.075, 10, 64]} />
          <meshPhysicalMaterial color="#ffc51b" metalness={0.9} roughness={0.14} clearcoat={1} emissive="#8b4e00" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, 0, r * 0.91]}>
          <octahedronGeometry args={[r * 0.24, 1]} />
          <meshStandardMaterial ref={core} color="#ffffff" emissive="#36e9ff" emissiveIntensity={0.7} toneMapped={false} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * r * 0.54, 0, r * 0.78]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[r * 0.065, r * 0.28, 5, 10]} />
            <meshStandardMaterial color="#74f5ff" emissive="#00bfff" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
