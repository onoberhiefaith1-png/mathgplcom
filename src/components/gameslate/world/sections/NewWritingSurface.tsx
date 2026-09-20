import { Component, useMemo, useRef, type ReactNode } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cachedGeometry } from "@/lib/slate/vfx/geometryCache";
import type { PbrMaps } from "../pbr";
import type { SurfaceDef } from "@/lib/slate/surfaces";
import {
  facetedPanel,
  finialProfile,
  plaquePanel,
  ribbonPanel,
  tubeGeometry,
} from "./premiumSurfaceGeometry";

interface Props {
  kind: NonNullable<SurfaceDef["newKind"]>;
  width: number;
  height: number;
  maps: PbrMaps;
  accent: string;
  colour?: string | undefined;
}

type Side = -1 | 1;
const SIDES: Side[] = [-1, 1];
const GOLD = "#e4aa29";
const PALE_GOLD = "#ffd96b";
const DARK_GOLD = "#713507";
const RUBY = "#a90e2d";
const SILK = "#c80d35";
const VIOLET = "#a53cff";
const CYAN = "#64e9ff";

function StandardMaterial({ maps, colour, roughness, metalness }: {
  maps: PbrMaps;
  colour?: string;
  roughness?: number;
  metalness?: number;
}) {
  return <meshStandardMaterial map={maps.map} normalMap={maps.normalMap} roughnessMap={maps.roughnessMap} aoMap={maps.aoMap} normalScale={maps.normalScale} color={colour ?? maps.color} roughness={roughness ?? maps.roughness} metalness={metalness ?? maps.metalness} />;
}

function GoldMaterial({ pale = false }: { pale?: boolean }) {
  return <meshPhysicalMaterial color={pale ? PALE_GOLD : GOLD} metalness={0.94} roughness={0.16} clearcoat={0.72} clearcoatRoughness={0.09} />;
}

function GemMaterial({ colour = RUBY }: { colour?: string }) {
  return <meshPhysicalMaterial color={colour} emissive={colour} emissiveIntensity={0.22} metalness={0.05} roughness={0.08} transmission={0.18} thickness={0.18} clearcoat={1} />;
}

/** Never divides by a collapsed dimension: a NaN scale erases the whole body. */
const ratio = (value: number, base: number) => (base > 1e-4 ? value / base : 1);

function useExpansion(width: number, height: number, apply: (w: number, h: number) => void) {
  const dimensions = useRef({ width, height });
  const target = useRef({ width, height });
  target.current = { width, height };
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const blend = 1 - Math.exp(-13 * delta);
    dimensions.current.width = THREE.MathUtils.lerp(dimensions.current.width, target.current.width, blend);
    dimensions.current.height = THREE.MathUtils.lerp(dimensions.current.height, target.current.height, blend);
    apply(dimensions.current.width, dimensions.current.height);
  });
}

function Plain({ width, height, maps, colour }: Omit<Props, "kind" | "accent">) {
  return <RoundedBox args={[width, height, 0.11]} radius={0.055} smoothness={4} position-z={-0.055} receiveShadow castShadow><StandardMaterial maps={maps} colour={colour ?? "#f4ead7"} roughness={0.58} metalness={0.02} /></RoundedBox>;
}

function ScrollPost({ side, height, maps }: { side: Side; height: number; maps: PbrMaps }) {
  const finial = useMemo(() => finialProfile(), []);
  return (
    <group rotation-z={side * 0.018}>
      <mesh castShadow><cylinderGeometry args={[0.105, 0.105, height + 0.24, 28]} /><meshPhysicalMaterial map={maps.map} normalMap={maps.normalMap} color="#9a5a22" roughness={0.54} clearcoat={0.28} /></mesh>
      {SIDES.map((vertical) => (
        <group key={vertical} position={[0, vertical * (height / 2 + 0.11), 0.015]}>
          <mesh rotation-x={Math.PI / 2} castShadow><torusGeometry args={[0.11, 0.024, 10, 28]} /><GoldMaterial /></mesh>
          <mesh geometry={finial} position={[0, vertical * 0.12, 0]} rotation-z={vertical < 0 ? Math.PI : 0} scale={0.72} castShadow><GoldMaterial pale /></mesh>
          <mesh position={[0, vertical * 0.035, 0.055]} scale={[1, 0.5, 0.42]} castShadow><sphereGeometry args={[0.075, 18, 12]} /><GoldMaterial /></mesh>
        </group>
      ))}
      {[0.24, -0.24].map((y) => <mesh key={y} position={[0, Math.max(-height / 2 + 0.11, Math.min(height / 2 - 0.11, y)), 0.055]} rotation-x={Math.PI / 2}><torusGeometry args={[0.108, 0.015, 8, 24]} /><GoldMaterial /></mesh>)}
    </group>
  );
}

function Parchment({ width, height, maps }: Omit<Props, "kind" | "accent" | "colour">) {
  const centre = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const baseWidth = Math.max(width, 0.01);
  const baseHeight = Math.max(height, 0.01);
  useExpansion(width, height, (w, h) => {
    if (centre.current) centre.current.scale.set(ratio(w, baseWidth), ratio(h, baseHeight), 1);
    if (left.current) left.current.position.set(-w / 2 - 0.07, 0, 0.015);
    if (right.current) right.current.position.set(w / 2 + 0.07, 0, 0.015);
  });
  const edgeCount = Math.max(8, Math.ceil(width / 0.18));
  return (
    <group>
      <group ref={centre}>
        <mesh position={[0, 0, -0.052]} castShadow receiveShadow><boxGeometry args={[baseWidth, baseHeight, 0.085, 12, 8, 1]} /><meshStandardMaterial normalMap={maps.normalMap} roughnessMap={maps.roughnessMap} normalScale={maps.normalScale} color="#d7ad68" roughness={0.94} /></mesh>
        <mesh position={[0, 0, 0.005]}><planeGeometry args={[baseWidth * 0.96, baseHeight * 0.9, 10, 7]} /><meshStandardMaterial normalMap={maps.normalMap} roughnessMap={maps.roughnessMap} normalScale={maps.normalScale} color="#f7dfaa" roughness={0.92} /></mesh>
        {Array.from({ length: edgeCount }, (_, index) => {
          const x = -baseWidth / 2 + ((index + 0.5) / edgeCount) * baseWidth;
          const ripple = 0.012 + Math.abs(Math.sin(index * 2.13)) * 0.018;
          return SIDES.map((vertical) => <mesh key={`${index}:${vertical}`} position={[x, vertical * (baseHeight / 2 + ripple * 0.15), 0.012]} rotation-z={Math.sin(index * 1.7) * 0.08}><sphereGeometry args={[ripple, 7, 5]} /><meshStandardMaterial color="#b98545" roughness={1} /></mesh>);
        })}
      </group>
      <group ref={left} position={[-width / 2 - 0.07, 0, 0.015]}><ScrollPost side={-1} height={height} maps={maps} /></group>
      <group ref={right} position={[width / 2 + 0.07, 0, 0.015]}><ScrollPost side={1} height={height} maps={maps} /></group>
    </group>
  );
}

function Flourish({ side, vertical }: { side: Side; vertical: Side }) {
  const curve = useMemo(() => tubeGeometry(`flourish:${side}:${vertical}`, [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-side * 0.07, vertical * 0.035, 0.014),
    new THREE.Vector3(-side * 0.11, -vertical * 0.035, 0.028),
    new THREE.Vector3(-side * 0.04, -vertical * 0.08, 0.038),
  ], 0.013), [side, vertical]);
  return <group><mesh geometry={curve} castShadow><GoldMaterial /></mesh><mesh position={[-side * 0.045, -vertical * 0.075, 0.035]} rotation-z={side * vertical * 0.75} scale={[0.055, 0.095, 0.035]}><sphereGeometry args={[1, 14, 10]} /><GoldMaterial pale /></mesh></group>;
}

function Crown() {
  return (
    <group>
      <mesh position={[0, -0.015, 0]} scale={[0.22, 0.105, 0.075]} castShadow><sphereGeometry args={[1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} /><meshPhysicalMaterial color={RUBY} roughness={0.35} sheen={0.65} sheenColor="#ff9a90" /></mesh>
      {[-0.15, -0.075, 0, 0.075, 0.15].map((x, index) => <mesh key={x} position={[x, 0.035 + (index === 2 ? 0.035 : 0), 0.075]} rotation-z={-x * 1.4} castShadow><capsuleGeometry args={[0.014, 0.13 + (index === 2 ? 0.04 : 0), 4, 9]} /><GoldMaterial pale /></mesh>)}
      <mesh position={[0, -0.075, 0.08]} rotation-x={Math.PI / 2}><torusGeometry args={[0.19, 0.025, 10, 32, Math.PI]} /><GoldMaterial /></mesh>
      {[-0.12, -0.06, 0, 0.06, 0.12].map((x, index) => <mesh key={x} position={[x, -0.07, 0.11]} rotation-z={Math.PI / 4} scale={index === 2 ? 0.032 : 0.022}><octahedronGeometry args={[1]} /><GemMaterial colour={index % 2 ? "#f5db57" : RUBY} /></mesh>)}
      <mesh position={[0, 0.19, 0.08]} rotation-z={Math.PI / 4} scale={[0.045, 0.06, 0.025]}><octahedronGeometry args={[1]} /><GemMaterial /></mesh>
      <mesh position={[0, 0.27, 0.065]}><boxGeometry args={[0.025, 0.085, 0.025]} /><GoldMaterial pale /></mesh>
      <mesh position={[0, 0.27, 0.065]}><boxGeometry args={[0.075, 0.025, 0.025]} /><GoldMaterial pale /></mesh>
    </group>
  );
}

function Royal({ width, height, maps }: Omit<Props, "kind" | "accent" | "colour">) {
  const body = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const crown = useRef<THREE.Group>(null);
  const lower = useRef<THREE.Group>(null);
  const geometry = useMemo(() => plaquePanel(width, height, 0.12), [width, height]);
  const inner = useMemo(() => plaquePanel(width * 0.92, height * 0.82, 0.055), [width, height]);
  useExpansion(width, height, (w, h) => {
    if (body.current) body.current.scale.set(ratio(w, width), ratio(h, height), 1);
    if (left.current) left.current.position.x = -w / 2;
    if (right.current) right.current.position.x = w / 2;
    if (crown.current) crown.current.position.y = h / 2 + 0.1;
    if (lower.current) lower.current.position.y = -h / 2 - 0.03;
  });
  return (
    <group>
      <group ref={body}>
        <mesh geometry={geometry} position-z={-0.08} castShadow receiveShadow><GoldMaterial /></mesh>
        <mesh geometry={inner} position-z={0.015} receiveShadow><meshStandardMaterial normalMap={maps.normalMap} roughnessMap={maps.roughnessMap} normalScale={maps.normalScale} color="#f7e9ca" roughness={0.78} metalness={0.01} /></mesh>
        <mesh position={[0, height / 2 - 0.035, 0.06]}><boxGeometry args={[Math.max(0.2, width - 0.25), 0.035, 0.035]} /><GoldMaterial pale /></mesh>
        <mesh position={[0, -height / 2 + 0.035, 0.06]}><boxGeometry args={[Math.max(0.2, width - 0.25), 0.035, 0.035]} /><GoldMaterial pale /></mesh>
      </group>
      <group ref={left} position={[-width / 2, 0, 0.075]}>{SIDES.map((v) => <group key={v} position={[0.035, v * (height / 2 - 0.055), 0]}><Flourish side={-1} vertical={v} /></group>)}</group>
      <group ref={right} position={[width / 2, 0, 0.075]}>{SIDES.map((v) => <group key={v} position={[-0.035, v * (height / 2 - 0.055), 0]}><Flourish side={1} vertical={v} /></group>)}</group>
      <group ref={crown} position={[0, height / 2 + 0.1, 0.08]} scale={1.24}><Crown /></group>
      <group ref={lower} position={[0, -height / 2 - 0.03, 0.08]}><mesh rotation-z={Math.PI / 4} scale={[0.075, 0.075, 0.045]}><octahedronGeometry args={[1]} /><GoldMaterial pale /></mesh><mesh position={[0, -0.07, 0]} scale={[0.04, 0.075, 0.03]}><sphereGeometry args={[1, 14, 10]} /><GoldMaterial /></mesh></group>
    </group>
  );
}

function CrystalMaterial({ glow = false }: { glow?: boolean }) {
  return <meshPhysicalMaterial color={glow ? "#a8efff" : "#deefff"} roughness={0.035} metalness={0} transmission={0.94} thickness={0.62} ior={1.53} attenuationDistance={1.8} attenuationColor="#b5eaff" clearcoat={1} clearcoatRoughness={0.025} iridescence={0.24} iridescenceIOR={1.3} transparent opacity={glow ? 0.9 : 0.78} />;
}

function Crystal({ width, height }: Omit<Props, "kind" | "accent" | "colour" | "maps">) {
  const cut = Math.min(0.16, Math.max(0.08, height * 0.22));
  const outer = useMemo(() => facetedPanel(width, height, 0.18, cut), [width, height, cut]);
  const pane = useMemo(() => facetedPanel(Math.max(0.2, width - cut * 1.6), Math.max(0.2, height - cut * 1.4), 0.07, cut * 0.32), [width, height, cut]);
  const corners = useRef<Array<THREE.Group | null>>([]);
  const horizontal = useRef<Array<THREE.Mesh | null>>([]);
  const vertical = useRef<Array<THREE.Mesh | null>>([]);
  useExpansion(width, height, (w, h) => {
    corners.current.forEach((node, index) => node?.position.set((index % 2 ? 1 : -1) * (w / 2 - cut * 0.38), (index > 1 ? 1 : -1) * (h / 2 - cut * 0.38), 0.07));
    horizontal.current.forEach((node, index) => { if (node) { node.position.set(0, (index ? 1 : -1) * (h / 2 - cut * 0.3), 0.07); node.scale.x = ratio(w, width); } });
    vertical.current.forEach((node, index) => { if (node) { node.position.set((index ? 1 : -1) * (w / 2 - cut * 0.3), 0, 0.07); node.scale.y = ratio(h, height); } });
  });
  return (
    <group>
      <mesh geometry={outer} position-z={-0.1} castShadow><CrystalMaterial /></mesh>
      <mesh geometry={pane} position-z={0.005} receiveShadow><meshPhysicalMaterial color="#dbeaff" roughness={0.12} transmission={0.96} thickness={0.24} ior={1.46} attenuationDistance={3} attenuationColor="#dff6ff" transparent opacity={0.3} /></mesh>
      {SIDES.map((v, index) => <mesh key={`h${v}`} ref={(node) => { horizontal.current[index] = node; }} position={[0, v * (height / 2 - cut * 0.3), 0.07]}><boxGeometry args={[Math.max(0.2, width - cut * 1.35), 0.035, 0.045]} /><CrystalMaterial glow /></mesh>)}
      {SIDES.map((v, index) => <mesh key={`v${v}`} ref={(node) => { vertical.current[index] = node; }} position={[v * (width / 2 - cut * 0.3), 0, 0.07]}><boxGeometry args={[0.035, Math.max(0.2, height - cut * 1.25), 0.045]} /><CrystalMaterial glow /></mesh>)}
      {[-1, 1].flatMap((x) => [-1, 1].map((y) => [x, y] as const)).map(([x, y], index) => <group key={`${x}:${y}`} ref={(node) => { corners.current[index] = node; }} position={[x * (width / 2 - cut * 0.38), y * (height / 2 - cut * 0.38), 0.07]} rotation-z={Math.PI / 4}><mesh scale={[cut * 0.9, cut * 0.9, cut * 0.48]} castShadow><octahedronGeometry args={[1]} /><CrystalMaterial glow /></mesh><pointLight color={index % 2 ? CYAN : "#ffffff"} intensity={0.12} distance={0.7} /></group>)}
    </group>
  );
}

function Wood({ width, height, maps }: Omit<Props, "kind" | "accent" | "colour">) { return <RoundedBox args={[width, height, 0.2]} radius={0.055} smoothness={3} position-z={-0.1} castShadow receiveShadow><StandardMaterial maps={maps} roughness={0.78} metalness={0.01} /></RoundedBox>; }
function Stone({ width, height, maps }: Omit<Props, "kind" | "accent" | "colour">) { return <RoundedBox args={[width, height, 0.28]} radius={0.12} smoothness={2} position-z={-0.14} castShadow receiveShadow><StandardMaterial maps={maps} roughness={0.96} metalness={0} /></RoundedBox>; }

function LeafFrame({ width, height, maps }: Omit<Props, "kind" | "accent" | "colour">) {
  const leaf = useMemo(() => cachedGeometry("leaf", () => { const shape = new THREE.Shape(); shape.moveTo(0, -0.09); shape.bezierCurveTo(0.1, -0.055, 0.12, 0.055, 0, 0.13); shape.bezierCurveTo(-0.12, 0.055, -0.1, -0.055, 0, -0.09); const result = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.012, bevelThickness: 0.01 }); result.center(); return result; }), []);
  const count = Math.max(5, Math.min(12, Math.ceil(width / 0.24)));
  return <group><RoundedBox args={[width, height, 0.1]} radius={0.065} smoothness={4} position-z={-0.05} receiveShadow><StandardMaterial maps={maps} roughness={0.9} metalness={0} /></RoundedBox>{Array.from({ length: count }, (_, i) => { const x = -width / 2 + (i / Math.max(1, count - 1)) * width; return SIDES.map((v) => <mesh key={`${i}:${v}`} geometry={leaf} position={[x, v * height / 2, 0.07]} rotation={[0.15, -0.18, v * (0.8 + (i % 2) * 0.45)]} scale={0.82 + (i % 3) * 0.08} castShadow><meshStandardMaterial color={i % 2 ? "#3f7f35" : "#659b3d"} roughness={0.76} /></mesh>); })}</group>;
}

function MagicEnd({ side }: { side: Side }) {
  return <group><mesh scale={[0.075, 0.15, 0.055]} rotation-z={Math.PI / 4}><octahedronGeometry args={[1]} /><GemMaterial colour={VIOLET} /></mesh><mesh rotation-x={Math.PI / 2}><torusGeometry args={[0.11, 0.023, 9, 24]} /><GoldMaterial /></mesh>{SIDES.map((v) => <mesh key={v} position={[0, v * 0.17, 0]} scale={[0.045, 0.075, 0.035]} rotation-z={side * v * 0.4}><sphereGeometry args={[1, 16, 10]} /><GoldMaterial pale /></mesh>)}</group>;
}

function Magical({ width, height, maps }: Omit<Props, "kind" | "colour" | "accent">) {
  const aura = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const paths = useMemo(() => [0, 1, 2].flatMap((layer) => {
    const spread = 0.035 + layer * 0.018;
    const radius = 0.011 - layer * 0.002;
    return SIDES.map((vertical) => tubeGeometry(`aura:${layer}:${vertical}:${width.toFixed(2)}:${height.toFixed(2)}`, [
      new THREE.Vector3(-width / 2, vertical * height * 0.34, 0.07 + layer * 0.01),
      new THREE.Vector3(-width * 0.32, vertical * (height / 2 + spread), 0.08),
      new THREE.Vector3(-width * 0.08, vertical * (height / 2 - spread * 0.35), 0.09),
      new THREE.Vector3(width * 0.2, vertical * (height / 2 + spread * 0.55), 0.08),
      new THREE.Vector3(width / 2, vertical * height * 0.34, 0.07),
    ], radius));
  }), [width, height]);
  useExpansion(width, height, (w, h) => { if (body.current) body.current.scale.set(ratio(w, width), ratio(h, height), 1); if (left.current) left.current.position.x = -w / 2 - 0.08; if (right.current) right.current.position.x = w / 2 + 0.08; });
  useFrame(({ clock }) => { if (!aura.current) return; aura.current.rotation.z = Math.sin(clock.elapsedTime * 0.7) * 0.006; aura.current.children.forEach((child, index) => { const material = (child as THREE.Mesh).material; if (material instanceof THREE.MeshBasicMaterial) material.opacity = 0.55 + Math.sin(clock.elapsedTime * 2.2 + index) * 0.18; }); });
  return <group><group ref={body}><RoundedBox args={[width, height, 0.1]} radius={0.055} smoothness={5} position-z={-0.06} receiveShadow><meshStandardMaterial normalMap={maps.normalMap} roughnessMap={maps.roughnessMap} normalScale={maps.normalScale} color="#f4dfb4" roughness={0.8} /></RoundedBox></group><group ref={aura}>{paths.map((geometry, index) => <mesh key={index} geometry={geometry}><meshBasicMaterial color={index % 3 === 1 ? VIOLET : CYAN} transparent opacity={0.48} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped /></mesh>)}{Array.from({ length: 14 }, (_, index) => { const angle = (index / 14) * Math.PI * 2; return <mesh key={index} position={[Math.cos(angle) * width * 0.54, Math.sin(angle) * height * 0.62, 0.11]} rotation-z={angle} scale={0.02 + (index % 3) * 0.006}><octahedronGeometry args={[1]} /><GemMaterial colour={index % 2 ? CYAN : VIOLET} /></mesh>; })}</group><group ref={left} position={[-width / 2 - 0.08, 0, 0.1]}><MagicEnd side={-1} /></group><group ref={right} position={[width / 2 + 0.08, 0, 0.1]}><MagicEnd side={1} /></group></group>;
}

function Cloud({ width, height }: Pick<Props, "width" | "height">) {
  const cloud = useRef<THREE.Group>(null);
  const count = Math.max(13, Math.min(27, Math.ceil(width / 0.12) + 8));
  const lobes = useMemo(() => Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0.5 : index / (count - 1);
    const lane = index % 3;
    const x = (t - 0.5) * width * 0.96;
    const y = lane === 0 ? height * 0.34 : lane === 1 ? -height * 0.33 : Math.sin(index * 1.91) * height * 0.2;
    const edgeFade = Math.sin(Math.PI * Math.max(0.08, t));
    const radius = Math.max(0.095, height * (0.24 + (index % 4) * 0.035) * (0.78 + edgeFade * 0.3));
    return { x, y, radius, z: -0.03 - radius * 0.7, shade: index % 4 };
  }), [count, width, height]);
  useExpansion(width, height, (w, h) => { if (cloud.current) cloud.current.scale.set(ratio(w, width), ratio(h, height), 1); });
  return <group ref={cloud}><mesh position-z={-0.03 - height * 0.33} rotation-z={Math.PI / 2} scale={[1, 0.82, 1]} receiveShadow><capsuleGeometry args={[height * 0.33, Math.max(0.08, width - height * 0.66), 8, 24]} /><meshPhysicalMaterial color="#edf7ff" roughness={0.94} sheen={0.28} sheenColor="#bfe4ff" /></mesh>{lobes.map((lobe, index) => <mesh key={index} position={[lobe.x, lobe.y, lobe.z]} scale={[1.28, 0.9, 0.7]} castShadow receiveShadow><sphereGeometry args={[lobe.radius, 18, 12]} /><meshPhysicalMaterial color={lobe.shade === 0 ? "#d3e8fb" : lobe.shade === 1 ? "#f7fbff" : "#e8f4ff"} roughness={0.9} transmission={0.04} thickness={0.2} sheen={0.25} sheenColor="#bfe4ff" /></mesh>)}</group>;
}

function Metal({ width, height, maps }: Omit<Props, "kind" | "accent" | "colour">) { return <RoundedBox args={[width, height, 0.18]} radius={0.055} smoothness={4} position-z={-0.09} castShadow receiveShadow><StandardMaterial maps={maps} colour="#a8adb1" roughness={0.31} metalness={0.94} /></RoundedBox>; }

function RibbonEnd({ side, height, maps }: { side: Side; height: number; maps: PbrMaps }) {
  const spiral = useMemo(() => tubeGeometry(`ribbon-curl:${side}:${height.toFixed(2)}`, Array.from({ length: 12 }, (_, index) => { const t = index / 11; const angle = t * Math.PI * 1.85; const radius = 0.035 + t * 0.055; return new THREE.Vector3(side * Math.sin(angle) * radius, height * 0.32 - t * height * 0.24, Math.cos(angle) * radius); }), 0.022), [side, height]);
  return <group scale={1.18}><mesh geometry={spiral} castShadow><meshPhysicalMaterial map={maps.map} normalMap={maps.normalMap} roughnessMap={maps.roughnessMap} color={SILK} roughness={0.28} sheen={1} sheenColor="#ff8295" /></mesh><mesh castShadow><cylinderGeometry args={[0.082, 0.082, height * 0.78, 22]} /><meshPhysicalMaterial map={maps.map} normalMap={maps.normalMap} roughnessMap={maps.roughnessMap} color={SILK} roughness={0.28} sheen={1} sheenColor="#ff8295" /></mesh>{SIDES.map((v) => <group key={v} position={[0, v * height * 0.39, 0]}><mesh rotation-x={Math.PI / 2}><torusGeometry args={[0.083, 0.018, 9, 24]} /><GoldMaterial pale /></mesh><mesh position={[0, 0, 0.075]} scale={[0.045, 0.045, 0.025]}><sphereGeometry args={[1, 14, 10]} /><GoldMaterial /></mesh></group>)}</group>;
}

function Silk({ width, height, maps }: Pick<Props, "width" | "height" | "maps">) {
  const body = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const geometry = useMemo(() => ribbonPanel(width, height, 0.075), [width, height]);
  const trimTop = useMemo(() => tubeGeometry(`silk-top:${width.toFixed(2)}:${height.toFixed(2)}`, [new THREE.Vector3(-width / 2, height * 0.46, 0.035), new THREE.Vector3(-width * 0.18, height * 0.36, 0.045), new THREE.Vector3(width * 0.18, height * 0.55, 0.045), new THREE.Vector3(width / 2, height * 0.4, 0.035)], 0.014), [width, height]);
  const trimBottom = useMemo(() => tubeGeometry(`silk-bottom:${width.toFixed(2)}:${height.toFixed(2)}`, [new THREE.Vector3(-width / 2, -height * 0.39, 0.035), new THREE.Vector3(-width * 0.18, -height * 0.54, 0.045), new THREE.Vector3(width * 0.18, -height * 0.36, 0.045), new THREE.Vector3(width / 2, -height * 0.46, 0.035)], 0.014), [width, height]);
  useExpansion(width, height, (w, h) => { if (body.current) body.current.scale.set(ratio(w, width), ratio(h, height), 1); if (left.current) left.current.position.x = -w / 2 - 0.06; if (right.current) right.current.position.x = w / 2 + 0.06; });
  return <group><group ref={body}><mesh geometry={geometry} castShadow receiveShadow><meshPhysicalMaterial map={maps.map} normalMap={maps.normalMap} roughnessMap={maps.roughnessMap} normalScale={maps.normalScale} color={SILK} roughness={0.26} metalness={0.01} sheen={1} sheenColor="#ff9faf" sheenRoughness={0.3} clearcoat={0.18} /></mesh><mesh geometry={trimTop}><GoldMaterial pale /></mesh><mesh geometry={trimBottom}><GoldMaterial pale /></mesh></group><group ref={left} position={[-width / 2 - 0.06, 0, -0.015]} rotation-z={-0.06}><RibbonEnd side={-1} height={height} maps={maps} /></group><group ref={right} position={[width / 2 + 0.06, 0, -0.015]} rotation-z={0.06}><RibbonEnd side={1} height={height} maps={maps} /></group></group>;
}

/**
 * A decorated style must never be able to leave the board blank. If its body
 * fails to build, the same material is drawn as a plain slab instead.
 */
class SurfaceBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) console.warn("[writing surface] style failed to build", error);
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SurfaceBody({ kind, width, height, maps, accent, colour }: Props) {
  if (kind === "plain") return <Plain width={width} height={height} maps={maps} colour={colour} />;
  if (kind === "parchment") return <Parchment width={width} height={height} maps={maps} />;
  if (kind === "royal") return <Royal width={width} height={height} maps={maps} />;
  if (kind === "crystal") return <Crystal width={width} height={height} />;
  if (kind === "wood") return <Wood width={width} height={height} maps={maps} />;
  if (kind === "stone") return <Stone width={width} height={height} maps={maps} />;
  if (kind === "leaf") return <LeafFrame width={width} height={height} maps={maps} />;
  if (kind === "magic") return <Magical width={width} height={height} maps={maps} />;
  if (kind === "cloud") return <Cloud width={width} height={height} />;
  if (kind === "metal") return <Metal width={width} height={height} maps={maps} />;
  return <Silk width={width} height={height} maps={maps} />;
}

export function NewWritingSurface(props: Props) {
  // Every style is drawn at a real, positive size from its very first frame,
  // so the panel is visible before any growth animation runs.
  const width = Math.max(0.3, props.width);
  const height = Math.max(0.26, props.height);
  return (
    <SurfaceBoundary
      fallback={<Plain width={width} height={height} maps={props.maps} colour={props.colour} />}
    >
      <SurfaceBody {...props} width={width} height={height} />
    </SurfaceBoundary>
  );
}
